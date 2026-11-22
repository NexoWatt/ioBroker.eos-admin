#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * Lokaler Regressionstest für die aktualisierten HTTP-Parser-Abhängigkeiten.
 * Keine ioBroker-Instanz, Kundendaten oder Geräte: bindet ausschließlich Loopback.
 * Prüft normale Requests, Größenlimit, ungültiges JSON und qs-Fehlerbehandlung.
 */
const assert = require('node:assert/strict');
const express = require('express');
const qs = require('qs');

async function main() {
  const app = express();
  app.use(express.json({ limit: '64kb', strict: true }));
  app.post('/payload', (req, res) => res.json({ received: req.body.value }));
  app.get('/query', (req, res) => res.json({ filter: req.query.filter }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: 'rejected' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${base}/payload`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 42 }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: 42 });
    console.log('PASS: normal JSON request preserved');
    response = await fetch(`${base}/payload`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(66000) }) });
    assert.equal(response.status, 413);
    console.log('PASS: oversized body rejected with HTTP 413');
    response = await fetch(`${base}/payload`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(response.status, 400);
    console.log('PASS: malformed JSON rejected with HTTP 400');
    response = await fetch(`${base}/query?filter[mode]=pv`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { filter: { mode: 'pv' } });
    console.log('PASS: nested query parsing preserved after rejected requests');
    assert.doesNotThrow(() => qs.stringify(qs.parse('x%5Bconstructor%5D%5BisBuffer%5D=y', { plainObjects: true })));
    console.log('PASS: crafted qs constructor/isBuffer round-trip does not throw');
    assert.throws(() => express.json({ limit: 'not-a-size' }));
    console.log('PASS: invalid parser size rejected at construction');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(() => { console.error('FAIL: dependency regression check failed; no request contents logged.'); process.exitCode = 1; });
