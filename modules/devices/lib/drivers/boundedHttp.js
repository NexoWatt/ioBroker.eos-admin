'use strict';
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Gemeinsame HTTP-Grenze für Gerätetreiber: höchstens 5 s Gesamtbudget pro Poll,
 * echter Transportabbruch, feste Datenlimits und unveränderte TLS-Prüfung.
 * Eine explizite öffentliche CA ersetzt niemals Hostname-/Zertifikatsprüfung.
 */
const axios = require('axios');
const http = require('node:http');
const https = require('node:https');
const { X509Certificate } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_BUDGET_MS = 5000;
const MAX_PENDING_REQUESTS = 4;

function failure(code) { return Object.assign(new Error(code), { code }); }
function safeErrorCode(error) { return /^[A-Z0-9_]{1,64}$/.test(error?.code || '') ? error.code : 'E_HTTP_REQUEST_FAILED'; }

function publicCa(connection) {
  if (connection.insecureTls || connection.insecureTLS || connection.allowInsecureTls || connection.rejectUnauthorized === false) {
    throw failure('E_HTTP_TLS_VERIFICATION_REQUIRED');
  }
  const pem = connection.trustedCaPem;
  if (pem === undefined || pem === '') return undefined;
  if (typeof pem !== 'string' || Buffer.byteLength(pem) > 65536) throw failure('E_HTTP_CA_INVALID');
  const certs = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!certs?.length || certs.length > 8 || pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) {
    throw failure('E_HTTP_CA_INVALID');
  }
  try { for (const cert of certs) new X509Certificate(cert); } catch { throw failure('E_HTTP_CA_INVALID'); }
  return certs;
}

/** Axios limits decoded bytes before its JSON transform; this bounds the parsed tree too. */
function validateResponse(data) {
  const stack = [{ value: data, depth: 0 }];
  let nodes = 0;
  let bytes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (++nodes > 50000 || depth > 32) throw failure('E_HTTP_RESPONSE_STRUCTURE');
    if (value === null) { bytes += 4; }
    else if (typeof value === 'string') { bytes += Buffer.byteLength(value); }
    else if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw failure('E_HTTP_RESPONSE_STRUCTURE');
      bytes += 24;
    } else if (typeof value === 'boolean') { bytes += 5; }
    else if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length + nodes + stack.length > 50000) throw failure('E_HTTP_RESPONSE_STRUCTURE');
      for (const key of keys) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw failure('E_HTTP_RESPONSE_STRUCTURE');
        bytes += Buffer.byteLength(key) + 4;
        stack.push({ value: value[key], depth: depth + 1 });
      }
    } else { throw failure('E_HTTP_RESPONSE_STRUCTURE'); }
    if (bytes > MAX_RESPONSE_BYTES) throw failure('E_HTTP_RESPONSE_TOO_LARGE');
  }
}

class BoundedDeviceHttp {
  constructor(connection, canOperate = () => true) {
    this.canOperate = canOperate;
    this.epoch = 0;
    this.stopped = false;
    this.pending = new Set();
    const c = connection || {};
    let base;
    try { base = new URL(String(c.baseUrl || c.url || '').trim()); } catch { throw failure('E_HTTP_BASE_URL_INVALID'); }
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.hash || base.search) {
      throw failure('E_HTTP_BASE_URL_INVALID');
    }
    this.baseURL = base.href.replace(/\/+$/, '');
    this.origin = base.origin;
    const timeout = Number(c.timeoutMs ?? c.timeout ?? MAX_BUDGET_MS);
    this.budgetMs = Number.isFinite(timeout) && timeout > 0 ? Math.min(MAX_BUDGET_MS, Math.max(100, Math.floor(timeout))) : MAX_BUDGET_MS;
    this.httpAgent = new http.Agent({ keepAlive: false, maxSockets: MAX_PENDING_REQUESTS });
    this.httpsAgent = new https.Agent({ rejectUnauthorized: true, minVersion: 'TLSv1.2', ca: publicCa(c), keepAlive: false, maxSockets: MAX_PENDING_REQUESTS });
    const username = String(c.username || '');
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: username ? { username, password: String(c.password || '') } : undefined,
      headers: c.headers && typeof c.headers === 'object' ? c.headers : undefined,
      httpAgent: this.httpAgent, httpsAgent: this.httpsAgent,
      timeout: this.budgetMs,
      maxContentLength: MAX_RESPONSE_BYTES, maxBodyLength: MAX_REQUEST_BYTES,
      maxRedirects: 0, proxy: false,
    });
  }

  connect() {
    if (!this.canOperate()) throw failure('EOS_MODULE_DISABLED');
    this.stopped = false;
  }

  begin() {
    const operation = { epoch: this.epoch, deadline: performance.now() + this.budgetMs };
    this.assertCurrent(operation);
    return operation;
  }

  assertCurrent(operation) {
    if (this.stopped || operation.epoch !== this.epoch) throw failure('E_HTTP_STOPPED');
    if (!this.canOperate()) throw failure('EOS_MODULE_DISABLED');
    if (performance.now() >= operation.deadline) throw failure('E_HTTP_DEADLINE');
  }

  disconnect() {
    this.stopped = true;
    this.epoch++;
    for (const controller of this.pending) controller.abort(failure('E_HTTP_STOPPED'));
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  /** Fixed-origin endpoints cannot redirect Basic Auth or template headers to another host. */
  target(url) {
    if (typeof url !== 'string' || url.length > 8192 || /[\\\u0000-\u0020\u007f]/.test(url)) throw failure('E_HTTP_URL_INVALID');
    let target;
    try {
      target = new URL(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) ? url : `${this.baseURL}/${url.replace(/^\/+/, '')}`);
    } catch { throw failure('E_HTTP_URL_INVALID'); }
    if (target.origin !== this.origin || target.username || target.password || target.hash) throw failure('E_HTTP_ORIGIN_MISMATCH');
    return target.href;
  }

  async request(client, config, operation) {
    this.assertCurrent(operation);
    if (this.pending.size >= MAX_PENDING_REQUESTS) throw failure('E_HTTP_BUSY');
    const url = this.target(config.url);
    if (config.data !== undefined) {
      let body;
      try { body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data); } catch { throw failure('E_HTTP_REQUEST_STRUCTURE'); }
      if (typeof body !== 'string' || Buffer.byteLength(body) > MAX_REQUEST_BYTES) throw failure('E_HTTP_REQUEST_TOO_LARGE');
    }
    const controller = new AbortController();
    this.pending.add(controller);
    let abortListener;
    const aborted = new Promise((_, reject) => {
      abortListener = () => reject(controller.signal.reason || failure('E_HTTP_CANCELLED'));
      controller.signal.addEventListener('abort', abortListener, { once: true });
    });
    const remaining = Math.max(1, Math.ceil(operation.deadline - performance.now()));
    const timer = setTimeout(() => controller.abort(failure('E_HTTP_DEADLINE')), remaining);
    try {
      // The race bounds completion even for a broken transport; the AbortSignal
      // simultaneously destroys Axios' underlying request and response stream.
      const response = await Promise.race([aborted, Promise.resolve().then(() => {
        this.assertCurrent(operation);
        return client.request({
          ...config, url, baseURL: undefined, signal: controller.signal,
          timeout: remaining, maxRedirects: 0, proxy: false,
          maxContentLength: MAX_RESPONSE_BYTES, maxBodyLength: MAX_REQUEST_BYTES,
          httpAgent: this.httpAgent, httpsAgent: this.httpsAgent,
        });
      })]);
      this.assertCurrent(operation);
      validateResponse(response.data);
      return response;
    } catch (error) {
      // Adapter logs receive only stable codes, never Axios configs, URLs or bodies.
      throw failure(controller.signal.aborted ? safeErrorCode(controller.signal.reason) : safeErrorCode(error));
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', abortListener);
      this.pending.delete(controller);
    }
  }
}

module.exports = { BoundedDeviceHttp, MAX_RESPONSE_BYTES, MAX_REQUEST_BYTES, MAX_BUDGET_MS, validateResponse, safeErrorCode, failure };
