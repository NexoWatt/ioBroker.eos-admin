// Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
// Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt.
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createHarness } = require('../work/NexoWatt_UI_1.0.30/scripts/verify-stable-1.0.9-access.cjs');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
(async () => {
  let mode = 'redirect';
  let foreignRequests = 0;
  let headerForwarded = false;
  const token = crypto.randomBytes(32).toString('hex');
  const large = JSON.stringify({ ok: true, fixturePadding: 'x'.repeat(2 * 1024 * 1024) });
  const sink = http.createServer((req,res) => {
    foreignRequests++;
    headerForwarded ||= req.headers['x-nexowatt-mesh-token'] === token;
    res.setHeader('Content-Type','application/json');
    res.end(large);
  });
  await listen(sink);
  const peer = http.createServer((req,res) => {
    if (mode === 'redirect') {
      res.writeHead(302, { location: `http://127.0.0.1:${sink.address().port}/redirect-target` });
      res.end();
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.end('not JSON');
    }
  });
  await listen(peer);
  const h = await createHarness();
  try {
    h.adapter._nwLicenseAllowsAppId = () => true;
    h.adapter._meshCoordinator = { appState: () => ({ installed: true, enabled: true }), config: { role: 'off' } };
    h.adapter.config.meshMicrogrid = { tailscale: { enabled: true, timeoutMs: 5000, peerUrls: [`http://127.0.0.1:${peer.address().port}`], peerToken: token } };
    const admin = await h.login('admin');
    const redirected = await h.request('/api/mesh/peer/fieldtest', { method:'POST', token:admin, body:{probe:false} });
    assert.equal(redirected.status, 200, 'fixture reaches licensed fieldtest');
    assert.equal(headerForwarded, true, 'configured peer redirects custom secret header across origins');
    assert.equal(foreignRequests, 2);
    assert.equal(redirected.data.peers[0].handshake.fixturePadding.length, 2 * 1024 * 1024);
    assert.equal(redirected.data.peers[0].status.fixturePadding.length, 2 * 1024 * 1024);
    mode = 'invalid-json';
    const invalid = await h.request('/api/mesh/peer/fieldtest', { method:'POST', token:admin, body:{probe:false} });
    assert.equal(invalid.status, 200);
    assert.equal(invalid.data.ok, true);
    assert.equal(invalid.data.peers[0].handshake, null);
    assert.equal(invalid.data.peers[0].status, null);
    const result = { baselineVersion: '1.0.29', actualRuntime: true, route: '/api/mesh/peer/fieldtest', authentication: 'admin session', network: 'loopback only, synthetic secret, no hardware', crossOriginCustomTokenForwarded: headerForwarded, crossOriginRequests: foreignRequests, responseBytesAcceptedPerRead: Buffer.byteLength(large), invalidJsonIncorrectlyAccepted: invalid.data.ok === true, externalAccess: false };
    fs.writeFileSync(__dirname + '/review-mesh-fieldtest-baseline.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { await h.close(); await close(peer); await close(sink); }
})().catch(error => { console.error(error.message); process.exitCode=1; });
