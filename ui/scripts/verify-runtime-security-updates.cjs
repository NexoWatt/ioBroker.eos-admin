#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

// Isolated regression for GHSA-27r3-jxmh-p828 and the three Nodemailer
// address-parser advisories fixed in 10.1.4. No external listener or SMTP send.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const zlib = require('node:zlib');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const fixtures = [
  { id: 'nested-comment', value: 'Victim (x(y) <other@other.test>) <v@victim.test>', expected: 'v@victim.test' },
  { id: 'group-semicolon', value: 'G: (a; <other@other.test>) <v@victim.test>;', expected: 'v@victim.test' },
  { id: 'quoted-angle', value: '<"a@other.test>"@good.test>', expectedDomain: '@good.test' },
];

function productRequire(repo) {
  return createRequire(path.join(repo, 'package.json'));
}

// Read the product's actual static declarations; never evaluate source text.
// Reject unrecognised options so the harness cannot silently test a different
// parser configuration after a future product change.
function parserOptions(repo) {
  const source = fs.readFileSync(path.join(repo, 'main.js'), 'utf8');
  const declarations = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trimStart().startsWith('//')) continue;
    const match = /express\.json\((\{[^}]*\})\)/.exec(line);
    if (!match) continue;
    const options = Object.create(null);
    for (const part of match[1].slice(1, -1).split(',').map(value => value.trim()).filter(Boolean)) {
      const pair = /^(limit|strict|inflate)\s*:\s*(?:(['"])([\w.]+)\2|(true|false))$/.exec(part);
      assert(pair, 'Unrecognised JSON parser option; update the regression harness');
      assert(!Object.hasOwn(options, pair[1]), 'Duplicate parser option');
      options[pair[1]] = pair[4] ? pair[4] === 'true' : pair[3];
    }
    declarations.push(options);
  }
  assert.equal(declarations.length, 4, 'Every product JSON parser must be covered');
  return declarations;
}

function limitBytes(limit) {
  const match = /^(\d+)(kb|mb)$/.exec(String(limit));
  assert(match, 'Unknown product byte-limit unit');
  return Number(match[1]) * (match[2] === 'mb' ? 1024 * 1024 : 1024);
}

function request(port, method, route, headers, bytes) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: route, headers, agent: false }, res => {
      const chunks = [];
      let length = 0;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > 65536) return res.destroy(new Error('Unexpectedly large test response'));
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(1500, () => req.destroy(new Error('Loopback request timeout')));
    req.on('error', reject);
    req.end(bytes);
  });
}

// Send the complete compressed frame plus padding first. Only after the server
// has responded send trailing invalid bytes. This exercises the late decoder
// error, rather than merely sending malformed gzip before parsing completes.
function trailingRequest(port, encoding) {
  return new Promise((resolve, reject) => {
    const json = Buffer.from('{"probe":true}');
    const first = Buffer.concat([encoding === 'gzip' ? zlib.gzipSync(json) : zlib.deflateSync(json), Buffer.from([0])]);
    const socket = net.connect({ host: '127.0.0.1', port });
    let response = '';
    let status = null;
    let sentTrailing = false;
    let settled = false;
    const done = error => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve({ status, body: response });
    };
    socket.setTimeout(1500, () => done(new Error('Trailing-request timeout')));
    socket.on('error', done);
    socket.on('connect', () => {
      socket.write('POST /not-a-route HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Encoding: ' + encoding + '\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n');
      socket.write(first.length.toString(16) + '\r\n');
      socket.write(first);
      socket.write('\r\n');
    });
    socket.on('data', chunk => {
      response += chunk.toString('utf8');
      if (response.length > 65536) return done(new Error('Oversized test response'));
      const match = /^HTTP\/1\.1 (\d+)/.exec(response);
      if (match) status = Number(match[1]);
      if (sentTrailing || !response.includes('\r\n\r\n')) return;
      sentTrailing = true;
      const tail = Buffer.from('late-invalid-compressed-frame');
      socket.write(tail.length.toString(16) + '\r\n');
      socket.write(tail);
      socket.write('\r\n0\r\n\r\n');
      // No uncaughtException/error suppression is installed in the child.
      setTimeout(() => done(), 100);
    });
    socket.on('close', () => {
      if (!sentTrailing && !settled) done(new Error('Closed before an HTTP response'));
    });
  });
}

async function httpChild(repo, index, scenario) {
  const requireProduct = productRequire(repo);
  const express = requireProduct('express');
  const options = parserOptions(repo)[index];
  assert(options, 'Unknown parser index');
  const { safeHttpFailure } = requireProduct('./lib/http-error-boundary');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json(options));
  app.get('/health', (_req, res) => res.json({ alive: true }));
  app.post('/probe', (req, res) => res.json({ probe: req.body.probe === true }));
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => {
    const failure = safeHttpFailure(error);
    res.status(failure.status).json(failure.body);
  });
  const server = http.createServer(app);
  const deadline = setTimeout(() => process.exit(124), 3500);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    let result;
    if (scenario.endsWith('-trailing')) {
      result = await trailingRequest(port, scenario.slice(0, -'-trailing'.length));
    } else {
      let bytes = Buffer.from('{"probe":true}');
      const headers = { 'content-type': 'application/json' };
      if (scenario === 'malformed') bytes = Buffer.from('{"private-marker":');
      if (scenario === 'over-limit') bytes = Buffer.from('{"probe":"' + 'x'.repeat(limitBytes(options.limit)) + '"}');
      if (scenario === 'gzip' || scenario === 'deflate') {
        headers['content-encoding'] = scenario;
        bytes = scenario === 'gzip' ? zlib.gzipSync(bytes) : zlib.deflateSync(bytes);
      }
      result = await request(port, 'POST', '/probe', headers, bytes);
    }
    const health = await request(port, 'GET', '/health', {}, undefined);
    assert.equal(health.status, 200, 'HTTP process must continue after malformed input');
    assert.equal(JSON.parse(health.body).alive, true);
    assert(!/private-marker|node_modules|SyntaxError|Z_DATA_ERROR| at /i.test(result.body), 'Error response must not leak parser internals');
    process.stdout.write(JSON.stringify({ scenario, parserIndex: index, options, status: result.status, survived: true }) + '\n');
  } finally {
    clearTimeout(deadline);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

function child(repo, index, scenario) {
  const result = spawnSync(process.execPath, [__filename, '--http-child', repo, String(index), scenario], {
    encoding: 'utf8', timeout: 4500, maxBuffer: 262144,
  });
  let outcome = null;
  if (result.status === 0) outcome = JSON.parse(result.stdout.trim());
  return { outcome, exitCode: result.status, signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    unhandledDecoderError: /Unhandled 'error' event/.test(result.stderr || '') && /Z_DATA_ERROR/.test(result.stderr || '') };
}

function flattenAddresses(entries) {
  return entries.flatMap(entry => Array.isArray(entry.group) ? flattenAddresses(entry.group) : entry.address ? [entry.address] : []);
}

async function mailCases(repo) {
  const requireProduct = productRequire(repo);
  const parse = requireProduct('nodemailer/lib/addressparser');
  const mailer = requireProduct('nodemailer');
  const { NotificationMail, validAddress, FROM } = requireProduct('./lib/notification-mail');
  for (const fixture of fixtures) {
    const addresses = flattenAddresses(parse(fixture.value));
    assert.equal(addresses.length, 1, fixture.id + ': exactly one intended mailbox');
    if (fixture.expected) assert.equal(addresses[0], fixture.expected, fixture.id);
    else assert(addresses[0].endsWith(fixture.expectedDomain), fixture.id + ': intended domain');
    assert.equal(validAddress(fixture.value), false, fixture.id + ': product rejects rich address syntax');
  }
  const composed = [];
  let transportCreations = 0;
  const mail = new NotificationMail({ namespace: 'test.0' }, {
    createTransport: options => {
      transportCreations++;
      assert.equal(options.requireTLS, true);
      assert.equal(options.tls.rejectUnauthorized, true);
      const stream = mailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
      return { sendMail: async message => {
        const result = await stream.sendMail(message);
        composed.push({ message, envelope: result.envelope, generatedBytes: result.message.length });
        return { accepted: result.envelope.to, rejected: [] };
      } };
    },
  });
  // An ephemeral synthetic value satisfies the product contract; no SMTP connection is created.
  mail.config = { enabled: true, host: 'smtp.invalid', port: 465, tlsMode: 'tls', user: 'fixture', password: randomBytes(24).toString('hex') };
  for (const fixture of fixtures) assert.equal((await mail.send(fixture.value, 'Test', 'Fixture')).ok, false);
  assert.equal(transportCreations, 0, 'Invalid recipients must be rejected before transport creation');
  assert.equal((await mail.send('recipient@example.test', 'Test\r\nNoInjectedHeader', 'Only synthetic text')).ok, true);
  assert.equal(transportCreations, 1);
  assert.equal(composed.length, 1);
  assert.deepEqual(composed[0].envelope.to, ['recipient@example.test']);
  assert.equal(composed[0].envelope.from, FROM);
  assert(!/[\r\n]/.test(composed[0].message.subject));
  assert.equal(composed[0].message.disableFileAccess, true);
  assert.equal(composed[0].message.disableUrlAccess, true);
  assert(composed[0].generatedBytes > 0);
  return { parserCases: fixtures.length, rejectedBeforeTransport: fixtures.length, composedWithoutSmtp: true };
}

async function main() {
  if (process.argv[2] === '--http-child') {
    await httpChild(path.resolve(process.argv[3]), Number(process.argv[4]), process.argv[5]);
    return;
  }
  if (process.argv[2] === '--observe-baseline') {
    const repo = path.resolve(process.argv[3]);
    const requireProduct = productRequire(repo);
    const result = child(repo, 0, 'gzip-trailing');
    const parse = requireProduct('nodemailer/lib/addressparser');
    console.log(JSON.stringify({ scope: 'isolated loopback only; no live or SMTP access', node: process.version,
      versions: { bodyParser: requireProduct('body-parser/package.json').version, nodemailer: requireProduct('nodemailer/package.json').version },
      http: result, mail: fixtures.map(fixture => ({ id: fixture.id, parsed: flattenAddresses(parse(fixture.value)) })) }, null, 2));
    return;
  }
  const configurations = parserOptions(root);
  const expectedStatuses = { plain: 200, malformed: 400, 'over-limit': 413, gzip: 415, deflate: 415, 'gzip-trailing': 415, 'deflate-trailing': 415 };
  const results = [];
  for (let index = 0; index < configurations.length; index++) {
    assert.equal(configurations[index].inflate, false, 'Every product parser must reject compressed input before decompression');
    for (const [scenario, expected] of Object.entries(expectedStatuses)) {
      const result = child(root, index, scenario);
      assert.equal(result.exitCode, 0, 'Parser ' + index + ' / ' + scenario + ' must survive: ' + JSON.stringify(result));
      assert.equal(result.outcome.status, expected, 'Parser ' + index + ' / ' + scenario + ': HTTP status');
      results.push(result.outcome);
    }
  }
  const mail = await mailCases(root);
  console.log(JSON.stringify({ ok: true, node: process.version, httpCases: results.length, mail, results }, null, 2));
}

main().catch(error => {
  process.stderr.write(String(error?.stack || error) + '\n');
  process.exitCode = 1;
});
