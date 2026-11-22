#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
// Native Loopback-Transporte + echte Express-Route; ausschließlich Testkonten und neutrale Proben.
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createMeshPeerClient, normalizeMeshPeerUrl, safeMeshPeerError, MESH_PEER_LIMITS } = require('../lib/mesh-peer-http');
const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = '/api/mesh/handshake';
function validPayload(url) {
  if (url.endsWith('/status')) return { ok:true, schema:'nexowatt.mesh-peer-status.v1', nodeId:'peer', clusterId:'cluster', mesh:{nodes:[{id:'load',name:'Test',surplusW:0,demandW:10,priority:100}]} };
  if (url.endsWith('/receive')) return { ok:true, schema:'nexowatt.mesh-command-ack.v1', status:'accepted', directHardwareWrite:false, neutralCommandOnly:true };
  return { ok:true, schema:'nexowatt.mesh-peer-handshake.v1', nodeId:'peer', clusterId:'cluster' };
}
async function expectCode(promise, expected) {
  await assert.rejects(promise, error => safeMeshPeerError(error) === expected);
}
(async () => {
  let checks = 0, mode = 'ok', forwarded = 0, requests = 0, closedEarly = 0, probes = 0;
  const token = crypto.randomBytes(32).toString('hex');
  const sink = http.createServer((_req,res) => { forwarded++; res.end('{}'); }); await listen(sink);
  const peer = http.createServer((req,res) => {
    requests++;
    res.setHeader('Content-Type','application/json');
    if (mode === 'redirect') { res.writeHead(302,{Location:`http://127.0.0.1:${sink.address().port}/target`}); return res.end(); }
    if (mode === 'declared-large') { res.writeHead(200,{'Content-Length':MESH_PEER_LIMITS.maxResponseBytes+1}); return res.end('{}'); }
    if (mode === 'chunked-large') { res.writeHead(200); res.write(' '.repeat(MESH_PEER_LIMITS.maxResponseBytes)); return res.end(' '.repeat(8192)); }
    if (mode === 'invalid-json') return res.end('invalid JSON');
    if (mode === 'invalid-shape') return res.end('{"ok":true}');
    if (mode === 'invalid-node') return res.end(JSON.stringify({...validPayload('/status'),mesh:{nodes:[{id:'load',demandW:'10'}]}}));
    if (mode === 'pollution') return res.end(JSON.stringify(validPayload(endpoint)).slice(0,-1)+',"nested":{"__proto__":{"polluted":true}}}');
    if (mode === 'deep') return res.end(JSON.stringify(validPayload(endpoint)).slice(0,-1)+',"nested":'+ '['.repeat(40)+'0'+']'.repeat(40)+'}');
    if (mode === 'nodes') return res.end(JSON.stringify({...validPayload(endpoint),list:Array(21000).fill(0)}));
    if (mode === 'nonfinite') return res.end(JSON.stringify(validPayload(endpoint)).slice(0,-1)+',"value":1e999}');
    if (mode === 'negative-private') return res.end(JSON.stringify({ok:false,error:'SYNTHETIC_PRIVATE_REMOTE_ERROR',stack:'SYNTHETIC_REMOTE_STACK'}));
    if (mode === 'negative-known') return res.end(JSON.stringify({ok:false,error:'cluster_mismatch',stack:'SYNTHETIC_REMOTE_STACK'}));
    if (mode === 'encoding') { res.setHeader('Content-Encoding','gzip'); return res.end('{}'); }
    if (mode === 'status-error') { res.statusCode=401; return res.end(JSON.stringify({ok:false,error:token})); }
    if (mode === 'drip') {
      res.write('{');
      const timer=setInterval(()=>res.write(' '),10);
      return res.on('close',()=>{clearInterval(timer);closedEarly++;});
    }
    const payload=validPayload(req.url);
    if (mode === 'echo') payload.note=token;
    const send=()=>res.end(JSON.stringify(payload));
    if (req.method==='POST') {
      let body='';req.on('data',chunk=>{body+=chunk;});req.on('end',()=>{
        const envelope=JSON.parse(body);assert.equal(envelope.directHardwareWrite,false);assert.equal(envelope.neutralCommandOnly,true);
        assert.equal(envelope.commands[0].plannedPowerW,0);probes++;send();
      });
    } else if(mode==='delayed') setTimeout(send,60); else send();
  }); await listen(peer);
  const base=`http://127.0.0.1:${peer.address().port}`;
  const client=(ms=5000)=>createMeshPeerClient(base,ms,token);
  try {
    assert.equal(normalizeMeshPeerUrl(`127.0.0.1:${peer.address().port}/`),base);
    assert.equal(normalizeMeshPeerUrl('http://peer.tailnet.example/prefix/'),'http://peer.tailnet.example/prefix');
    assert.equal(normalizeMeshPeerUrl('https://peer.tailnet.example:8443'),'https://peer.tailnet.example:8443');
    for(const url of ['ftp://peer','http://user:secret@peer','http://peer/?token=secret','http://peer/#fragment','http://peer\\evil','']) assert.throws(()=>normalizeMeshPeerUrl(url),error=>safeMeshPeerError(error)==='mesh_peer_invalid_url');
    assert.equal(safeMeshPeerError(new Error('private-fixture-message')), 'mesh_peer_network_error');
    assert.equal(safeMeshPeerError(new Proxy({}, {getPrototypeOf(){throw new Error('private');}})), 'mesh_peer_network_error');checks++;
    const good=await client().request(endpoint);assert.equal(good.data.ok,true);assert.equal(Object.getPrototypeOf(good.data),null);checks++;
    for(const [testMode,code] of [['redirect','mesh_peer_redirect_forbidden'],['declared-large','mesh_peer_too_large'],['chunked-large','mesh_peer_too_large'],['invalid-json','mesh_peer_invalid_json'],['invalid-shape','mesh_peer_invalid_response'],['pollution','mesh_peer_invalid_response'],['deep','mesh_peer_invalid_response'],['nodes','mesh_peer_invalid_response'],['nonfinite','mesh_peer_invalid_response'],['encoding','mesh_peer_unsupported_encoding']]) {
      mode=testMode;await expectCode(client().request(endpoint),code);checks++;
    }
    mode='invalid-node';await expectCode(client().request('/api/mesh/status'),'mesh_peer_invalid_response');checks++;
    assert.equal(forwarded,0);assert.equal({}.polluted,undefined);
    mode='negative-private';const negative=await client().request(endpoint);assert.equal(negative.data.error,'mesh_peer_rejected');assert(!JSON.stringify(negative).includes('SYNTHETIC'));
    mode='negative-known';const known=await client().request(endpoint);assert.equal(known.data.error,'cluster_mismatch');assert(!JSON.stringify(known).includes('SYNTHETIC'));checks++;
    const beforeSerialize=requests;await expectCode(client(5).request('/api/mesh/command/receive',{toJSON(){const until=performance.now()+30;while(performance.now()<until){}return {};}}),'mesh_peer_timeout');await pause(10);assert.equal(requests,beforeSerialize);checks++;
    mode='status-error';const denied=await client().request(endpoint);assert.equal(denied.status,401);assert.equal(denied.ok,false);assert(!JSON.stringify(denied).includes(token));checks++;
    mode='echo';const redacted=await client().request(endpoint);assert.equal(redacted.data.note,'[redacted]');checks++;
    mode='drip';let started=performance.now();await expectCode(client(80).request(endpoint),'mesh_peer_timeout');assert(performance.now()-started<800);await pause(20);assert(closedEarly>=1);checks++;
    mode='delayed';const shared=client(100);await shared.request(endpoint);await expectCode(shared.request('/api/mesh/status'),'mesh_peer_timeout');checks++;
    // Deadline beginnt vor DNS; verspätete Auflösung darf keinen Socket nachträglich senden.
    mode='ok';const beforeDns=requests;const lookup=dns.lookup;
    dns.lookup=(hostname,options,callback)=>{
      if(hostname==='delayed-peer.invalid') return setTimeout(()=>callback(null,[{address:'127.0.0.1',family:4}]),100);
      return lookup(hostname,options,callback);
    };
    try { await expectCode(createMeshPeerClient(`http://delayed-peer.invalid:${peer.address().port}`,30,token).request(endpoint),'mesh_peer_timeout');await pause(140);assert.equal(requests,beforeDns); } finally {dns.lookup=lookup;}checks++;
    mode='drip';started=performance.now();await expectCode(client(20000).request(endpoint),'mesh_peer_timeout');const duration=performance.now()-started;assert(duration>=4700&&duration<6500,`5s clamp: ${duration}`);checks++;
    const h=await createHarness();
    try {
      h.adapter._nwLicenseAllowsAppId=()=>true;
      h.adapter._meshCoordinator={appState:()=>({installed:true,enabled:true}),config:{role:'off'}};
      h.adapter.config.meshMicrogrid={tailscale:{enabled:true,timeoutMs:500,peerUrls:[base],peerToken:token}};
      const admin=await h.login('admin');
      assert.equal((await h.request('/api/mesh/peer/fieldtest',{method:'POST',body:{probe:false}})).status,401);checks++;
      mode='ok';const success=await h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{}});
      assert.equal(success.status,200);assert.equal(success.data.ok,true);assert.equal(success.data.peers[0].errorClass,'ok');assert.equal(success.data.remoteNodeMatrix[0].nodeId,'load');assert.equal(probes,1);checks++;
      mode='redirect';const blocked=await h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{probe:false}});
      assert.equal(blocked.status,409);assert.deepEqual(blocked.data.peers[0].errors,['mesh_peer_redirect_forbidden']);assert.equal(forwarded,0);assert(!blocked.text.includes(token));checks++;
      mode='invalid-json';const invalid=await h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{probe:false}});assert.equal(invalid.status,409);assert.equal(invalid.data.ok,false);checks++;
      h.adapter.config.meshMicrogrid.tailscale.peerUrls=['http://user:secret@peer'];
      const invalidUrl=await h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{probe:false}});assert.equal(invalidUrl.status,409);assert(!invalidUrl.text.includes('user:secret'));checks++;
      h.adapter.config.meshMicrogrid.tailscale.peerUrls=[base];mode='drip';const beforeBusy=requests;
      const pending=h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{probe:false}});
      while(requests===beforeBusy) await pause(5);
      const busy=await h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{probe:false}});assert.equal(busy.status,409);assert.equal(busy.data.error,'mesh_fieldtest_busy');await pending;
      mode='ok';h.adapter.config.meshMicrogrid.tailscale.peerUrls=[base,base];
      const recovered=await h.request('/api/mesh/peer/fieldtest',{method:'POST',token:admin,body:{probe:false}});assert.equal(recovered.status,200);assert.equal(recovered.data.okPeerCount,2);assert.equal(probes,1);checks++;
    } finally {await h.close();}
    // Testzertifikat ausschließlich temporär erzeugen; keine ausgelieferten Schlüssel.
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nw-mesh-tls-'));
    let tls;
    try {
      execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(directory,'key.pem'),'-out',path.join(directory,'cert.pem'),'-subj','/CN=localhost','-days','1'],{stdio:'ignore'});
      tls=https.createServer({key:fs.readFileSync(path.join(directory,'key.pem')),cert:fs.readFileSync(path.join(directory,'cert.pem'))},(_req,res)=>res.end(JSON.stringify(validPayload(endpoint))));await listen(tls);
      await expectCode(createMeshPeerClient(`https://127.0.0.1:${tls.address().port}`,5000,token).request(endpoint),'mesh_peer_network_error');checks++;
    } finally {if(tls)await close(tls);fs.rmSync(directory,{recursive:true,force:true});}
    console.log(`[mesh-peer-http] OK: ${checks} native Transport-/HTTP-Prüfgruppen; Redirect, Größen-/Strukturlimits, DNS-/Body-/Gesamtbudget, TLS-Prüfung, Rollen, neutrale Probe, Mehrpeer und Wiederaufnahme.`);
  } finally {await close(peer);await close(sink);}
})().catch(error=>{console.error(error);process.exitCode=1;});
