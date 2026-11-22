'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const api = import('../src-admin/src/components/SystemSettings/eosLicenseApi.ts');
const UUID = '550e8400-e29b-41d4-a716-446655440000';
const valid = edition => ({v:1,tokenVersion:3,scope:'system',coreEnabled:true, valid:true,code:'LICENSE_VALID',uuid:UUID,edition,expiresAt:null,limits:{chargePoints:3,batteries:2},features:['energy']});
const missing = {v:1,tokenVersion:null,scope:null,coreEnabled:false,valid:false,code:'LICENSE_MISSING',uuid:UUID,edition:null,expiresAt:null,limits:{},features:[]};

test('public status projection preserves Home/Pro and rejects hidden activation-code fields', async () => {
    const {parseLicenseStatus}=await api;
    for (const edition of ['home','pro']) {
        const result=parseLicenseStatus({...valid(edition),token:'synthetic-never-display',privateKey:'synthetic-never-display'});
        assert.equal(result.edition,edition);assert.equal(result.valid,true);
        assert.equal('token' in result,false);assert.equal('privateKey' in result,false);
    }
    assert.deepEqual(parseLicenseStatus(missing),{
        valid:false,code:'LICENSE_MISSING',uuid:UUID,edition:null,expiresAt:null,limits:{},features:[],tokenVersion:null,scope:null,coreEnabled:false
    });
});
test('license URL always uses the shared root authority from system and prefixed pages', async () => {
    const {licenseEndpoint}=await api;
    assert.equal(licenseEndpoint('status','https://eos.example/index.html#system/tabEosLicenses'),'https://eos.example/nexowatt/license/status');
    assert.equal(licenseEndpoint('activate','https://eos.example/admin/index.html#system/tabEosLicenses'),'https://eos.example/nexowatt/license/activate');
    assert.equal(licenseEndpoint('remove','https://eos.example/admin/'),'https://eos.example/nexowatt/license/remove');
});
test('invalid or inconsistent status never becomes a valid license', async () => {
    const {parseLicenseStatus}=await api;
    for(const value of [null,[],{}, {...valid('home'),valid:'true'}, {...valid('home'),code:'LICENSE_EXPIRED'},
        {...valid('home'),uuid:null}, {...valid('home'),uuid:'-'.repeat(36)}, {...valid('home'),edition:'enterprise'}, {...valid('home'),limits:{chargePoints:'3',batteries:2}},
        {...valid('home'),limits:{chargePoints:NaN,batteries:2}}, {...valid('home'),expiresAt:Infinity},
        {...valid('home'),features:['<script>']}, {...valid('home'),features:Array(65).fill('energy')}]) {
        assert.throws(()=>parseLicenseStatus(value),/LICENSE_RESPONSE/);
    }
});
test('activation and removal use existing same-origin authenticated routes and exact CSRF bodies', async t => {
    const {requestLicense}=await api;const calls=[];
    t.mock.method(globalThis,'fetch',async (url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/remove') ? missing : valid('pro'));});
    const signal=new AbortController().signal;
    await requestLicense('status',signal);await requestLicense('activate',signal,'  synthetic-NWL2-code  ');await requestLicense('remove',signal);
    assert.deepEqual(calls.map(c=>c.url),['/nexowatt/license/status','/nexowatt/license/activate','/nexowatt/license/remove']);
    assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);
    for(const c of calls){assert.equal(c.options.credentials,'same-origin');assert.equal(c.options.cache,'no-store');assert.equal(c.options.redirect,'error');}
    for(const c of calls.slice(1)){assert.equal(c.options.method,'POST');assert.equal(c.options.headers['X-EOS-License'],'1');}
    assert.deepEqual(JSON.parse(calls[1].options.body),{token:'synthetic-NWL2-code'});
    assert.deepEqual(JSON.parse(calls[2].options.body),{});
});
test('bad codes and invalid route names are rejected before any request', async t => {
    const {requestLicense}=await api;let count=0;
    t.mock.method(globalThis,'fetch',async()=>{count++;throw new Error('unexpected');});
    const signal=new AbortController().signal;
    for(const token of [undefined,'','   ','a'.repeat(16385)]) await assert.rejects(requestLicense('activate',signal,token),/LICENSE_FORMAT/);
    await assert.rejects(requestLicense('../context',signal),/LICENSE_REQUEST/);
    const aborted=new AbortController();aborted.abort();await assert.rejects(requestLicense('status',aborted.signal),{name:'AbortError'});
    assert.equal(count,0);
});
test('denied or unavailable API produces a safe error and never a false no-license status', async t => {
    const {requestLicense}=await api;
    for(const code of ['LICENSE_ADMIN_REQUIRED','LICENSE_HTTPS_REQUIRED','LICENSE_RATE_LIMIT']) {
        const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error:code},{status:403}));
        await assert.rejects(requestLicense('status',new AbortController().signal),new RegExp(code));mock.mock.restore();
    }
    t.mock.method(globalThis,'fetch',async()=>Response.json({error:'private token echoed by misconfigured proxy'},{status:500}));
    await assert.rejects(requestLicense('status',new AbortController().signal),/SERVICE_UNAVAILABLE/);
});
test('oversized and malformed response bodies are rejected and stream cancelled', async t => {
    const {requestLicense}=await api;let cancelled=false;
    const mock=t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));},cancel(){cancelled=true;}})));
    await assert.rejects(requestLicense('status',new AbortController().signal),/LICENSE_RESPONSE/);assert.equal(cancelled,true);mock.mock.restore();
    t.mock.method(globalThis,'fetch',async()=>new Response('not JSON'));
    await assert.rejects(requestLicense('status',new AbortController().signal),/LICENSE_RESPONSE/);
});
async function server(t,run) {
    const instance=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{'); const timer=setInterval(()=>res.write(' '),40);res.on('close',()=>{clearInterval(timer);instance.transportClosed=true;});});
    instance.listen(0,'127.0.0.1');await once(instance,'listening');
    const originalFetch=globalThis.fetch;
    t.mock.method(globalThis,'fetch',(url,options)=>originalFetch(`http://127.0.0.1:${instance.address().port}/${url}`,options));
    try{await run(instance);}finally{instance.closeAllConnections();await new Promise(resolve=>instance.close(resolve));}
}
test('one total five-second deadline aborts the live response stream', {timeout:8000}, async t => {
    const {requestLicense}=await api;
    await server(t,async instance=>{const start=performance.now();await assert.rejects(requestLicense('status',new AbortController().signal),{name:'AbortError'});
        assert.ok(performance.now()-start>=4800 && performance.now()-start<6500);await delay(50);assert.equal(instance.transportClosed,true);});
});
test('closing the panel cancels the live response without waiting for the deadline', {timeout:2000}, async t => {
    const {requestLicense}=await api;
    await server(t,async instance=>{const controller=new AbortController();const pending=requestLicense('status',controller.signal);setTimeout(()=>controller.abort(),60);
        await assert.rejects(pending,{name:'AbortError'});await delay(50);assert.equal(instance.transportClosed,true);});
});

test('activation never reports success for a response without a valid entitlement', async t => {
    const {requestLicense}=await api;
    t.mock.method(globalThis,'fetch',async()=>Response.json(missing));
    await assert.rejects(requestLicense('activate',new AbortController().signal,'synthetic-code'),/LICENSE_RESPONSE/);
});

test('removal never reports success when the server still confirms an active license', async t => {
    const {requestLicense}=await api;
    t.mock.method(globalThis,'fetch',async()=>Response.json(valid('pro')));
    await assert.rejects(requestLicense('remove',new AbortController().signal),/LICENSE_RESPONSE/);
});

const {generateKeyPairSync}=require('node:crypto');
const publicKeys={syntheticIssuer:generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'})};
const fingerprint='a'.repeat(64);
const trustReady={v:1,ready:true,code:'TRUST_READY',canImport:true,source:'restored',keys:[{kid:'syntheticIssuer',fingerprint,source:'restored'}],allowedKeys:[{kid:'syntheticIssuer',fingerprint,source:'release'}]};
const trustMissing={v:1,ready:false,code:'TRUST_MISSING',canImport:true,source:'none',keys:[],allowedKeys:trustReady.allowedKeys};
const fakeFile=bytes=>({size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const jsonFile=value=>fakeFile(new TextEncoder().encode(JSON.stringify(value)));

test('NWL2 extension-only scope remains distinct from the shared system authorization',async()=>{
    const {parseLicenseStatus}=await api;
    const status=parseLicenseStatus({...valid('home'),tokenVersion:2,scope:'adapters',coreEnabled:false});
    assert.equal(status.valid,true);assert.equal(status.scope,'adapters');assert.equal(status.coreEnabled,false);
    assert.equal(parseLicenseStatus({...status,v:1,coreEnabled:true}).coreEnabled,true);
    for(const value of [{...valid('home'),coreEnabled:false},{...valid('home'),scope:'extensions'}, {...valid('home'),tokenVersion:2}, {...missing,coreEnabled:true}, {...missing,tokenVersion:2}]) {
        assert.throws(()=>parseLicenseStatus(value),/LICENSE_RESPONSE/);
    }
});
test('trust projection exposes only bounded fingerprints and distinguishes release approval from active restoration',async()=>{
    const {parseTrustStatus}=await api;
    const result=parseTrustStatus({...trustReady,privateKey:'never-display',pem:'never-display'});
    assert.equal(result.keys[0].source,'restored');assert.equal(result.allowedKeys[0].source,'release');
    assert.equal('privateKey'in result,false);assert.equal('pem'in result,false);
    assert.deepEqual(parseTrustStatus(trustMissing).keys,[]);
    assert.equal(parseTrustStatus({...trustMissing,allowedKeys:Array.from({length:64},(_,i)=>({...trustReady.allowedKeys[0],kid:`issuer${i}`}))}).allowedKeys.length,64);
    for(const value of [null,[],{}, {...trustReady,ready:'true'}, {...trustReady,canImport:1}, {...trustReady,source:'release'},
        {...trustReady,code:'<script>'}, {...trustReady,keys:[]}, {...trustReady,keys:[{...trustReady.keys[0],fingerprint:'not-a-fingerprint'}]},
        {...trustReady,keys:[{...trustReady.keys[0],source:'release'}]}, {...trustReady,allowedKeys:[{...trustReady.allowedKeys[0],source:'restored'}]},
        {...trustReady,keys:[trustReady.keys[0],trustReady.keys[0]]}, {...trustReady,allowedKeys:Array(65).fill(trustReady.allowedKeys[0])},
        {...trustMissing,keys:trustReady.keys}, {...trustMissing,code:'TRUST_READY'}, {...trustReady,source:'none'}]) assert.throws(()=>parseTrustStatus(value),/TRUST_RESPONSE/);
});
test('public JSON import accepts arbitrary filenames and rejects private, vault, mixed and malformed inputs before fetch',async t=>{
    const {parsePublicKeyFile,requestTrustUpdate}=await api;let calls=0;
    t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({...trustReady,licenseStatus:missing});});
    const parsed=await parsePublicKeyFile({...jsonFile(publicKeys),name:'anything.backup'});
    assert.deepEqual(parsed,publicKeys);
    const invalid=[null,[],{}, {privateKey:'-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----'},
        {v:1,kdf:{name:'scrypt'},cipher:{name:'aes-256-gcm'},publicKey:publicKeys.syntheticIssuer},
        {...publicKeys,broken:'not PEM'}, {keys:publicKeys}, {'bad id':publicKeys.syntheticIssuer},
        Object.fromEntries(Array.from({length:33},(_,i)=>[`issuer${i}`,publicKeys.syntheticIssuer]))];
    for(const value of invalid){
        await assert.rejects(parsePublicKeyFile(jsonFile(value)),/TRUST_(?:INVALID|PRIVATE_MATERIAL)/);
        await assert.rejects(requestTrustUpdate('import',new AbortController().signal,value),/TRUST_(?:INVALID|PRIVATE_MATERIAL)/);
    }
    assert.equal(calls,0);
    await requestTrustUpdate('import',new AbortController().signal,parsed);assert.equal(calls,1);
});
test('public file bounds precede reading and reject invalid UTF8, inconsistent sizes and non-Ed25519 SPKI',async()=>{
    const {parsePublicKeyFile,parsePublicKeys}=await api;let reads=0;
    for(const size of [0,32769,NaN,-1,1.5])await assert.rejects(parsePublicKeyFile({size,arrayBuffer:async()=>{reads++;return new ArrayBuffer(0);}}),/TRUST_FILE_SIZE/);
    assert.equal(reads,0);
    await assert.rejects(parsePublicKeyFile({size:1,arrayBuffer:async()=>new ArrayBuffer(2)}),/TRUST_FILE_SIZE/);
    await assert.rejects(parsePublicKeyFile(fakeFile(new Uint8Array([0xff,0xfe]))),/TRUST_INVALID/);
    const exact=new TextEncoder().encode(JSON.stringify(publicKeys));
    const padded=new Uint8Array(32768);padded.fill(32);padded.set(exact);
    assert.deepEqual(await parsePublicKeyFile(fakeFile(padded)),publicKeys);
    const rsa=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'pem'});
    assert.throws(()=>parsePublicKeys({rsa}),/TRUST_INVALID/);
    assert.throws(()=>parsePublicKeys({issuer:publicKeys.syntheticIssuer.replace('MCow','MC0w')}),/TRUST_INVALID/);
});
test('trust requests use one central authority, exact import envelope and authenticated same-origin controls',async t=>{
    const {requestTrustStatus,requestTrustUpdate,requestTrustExport}=await api;const calls=[];
    t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/export')?publicKeys:url.endsWith('/status')?trustReady:{...trustReady,licenseStatus:valid('home')});});
    const signal=new AbortController().signal;
    await requestTrustStatus(signal);const imported=await requestTrustUpdate('import',signal,publicKeys);await requestTrustUpdate('recheck',signal);const exported=await requestTrustExport(signal);
    assert.deepEqual(calls.map(c=>c.url),['/nexowatt/license/trust/status','/nexowatt/license/trust/import','/nexowatt/license/trust/recheck','/nexowatt/license/trust/export']);
    assert.deepEqual(JSON.parse(calls[1].options.body),{keys:publicKeys});assert.deepEqual(JSON.parse(calls[2].options.body),{});
    for(const {options}of calls){assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');}
    for(const {options}of calls.slice(1,3)){assert.equal(options.method,'POST');assert.equal(options.headers['X-EOS-License'],'1');}
    assert.equal(imported.trust.ready,true);assert.equal(imported.license.coreEnabled,true);assert.deepEqual(exported,publicKeys);
});
test('unknown issuer and store errors retain actionable codes while arbitrary response text is never reflected',async t=>{
    const {requestTrustUpdate,licenseErrorCode}=await api;
    for(const code of ['TRUST_IMPORT_UNKNOWN_KEY','TRUST_KEY_CONFLICT','STORAGE_AUTH_FAILED','TRUST_PERMISSIONS']){
        const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error:code},{status:400}));
        await assert.rejects(requestTrustUpdate('import',new AbortController().signal,publicKeys),new RegExp(code));mock.mock.restore();
    }
    assert.equal(licenseErrorCode(new DOMException('timeout body not shown','AbortError')),'SERVICE_TIMEOUT');
    assert.equal(licenseErrorCode(new Error('arbitrary private response')),'SERVICE_UNAVAILABLE');
    assert.equal(licenseErrorCode(new Error('STORAGE_AUTH_FAILED')),'STORAGE_AUTH_FAILED');
});
test('trust update cannot acknowledge an inconsistent license or a private-key export',async t=>{
    const {requestTrustUpdate,requestTrustExport}=await api;
    const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({...trustReady,licenseStatus:{...valid('home'),coreEnabled:false}}));
    await assert.rejects(requestTrustUpdate('recheck',new AbortController().signal),/LICENSE_RESPONSE/);mock.mock.restore();
    t.mock.method(globalThis,'fetch',async()=>Response.json({privateKey:'-----BEGIN PRIVATE KEY-----'}));
    await assert.rejects(requestTrustExport(new AbortController().signal),/TRUST_PRIVATE_MATERIAL/);
});
