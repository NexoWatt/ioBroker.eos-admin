'use strict';
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { createMeshPeerClient, safeMeshPeerError } = require('../work/NexoWatt_UI_1.0.30/lib/mesh-peer-http');
(async () => {
  let hits = 0;
  const server = http.createServer((_req, res) => { hits++; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: false, error: 'SYNTHETIC_PRIVATE_REMOTE_ERROR', stack: 'SYNTHETIC_REMOTE_STACK' })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await createMeshPeerClient(base, 200, 'fixture-token').request('/api/mesh/handshake');
    console.log(JSON.stringify({ case: 'negative-200-remote-details', retainedError: result.data.error === 'SYNTHETIC_PRIVATE_REMOTE_ERROR', retainedStack: result.data.stack === 'SYNTHETIC_REMOTE_STACK' }));
    const before = hits; const start = performance.now();
    const client = createMeshPeerClient(base, 15, 'fixture-token');
    const body = { toJSON() { const until = performance.now() + 80; while (performance.now() < until) {} return { probeOnly: true }; } };
    let code = '';
    try { await client.request('/api/mesh/command/receive', body); } catch (error) { code = safeMeshPeerError(error); }
    console.log(JSON.stringify({ case: 'expired-during-body-serialization', code, durationMs: Math.round(performance.now() - start), requestsAfterExpiry: hits - before }));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
