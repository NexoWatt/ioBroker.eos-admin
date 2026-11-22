'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { publicOrigin, transportAllowed, sameOrigin, readAccessToken, UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const TOKEN = 'a'.repeat(40);
function req(extra = {}) { return { headers: { host: 'device.example', origin: 'https://device.example', cookie: `access_token=${TOKEN}`, ...extra }, socket: {remoteAddress:'127.0.0.1'} }; }
function setup(overrides = {}) {
    const destroyed=[];
    const adapter = { eosSessionSecurity:{epoch:'epoch-one',revoke(){this.epoch='epoch-two';}}, eosHostedRuntime:{revokeSessions(){adapter.revoked=true;}},
        getSession(id,cb){ cb(id === `a:${TOKEN}` ? {aToken:TOKEN,rToken:'r'.repeat(40)}:null); }, destroySession(id,cb){destroyed.push(id);cb();} };
    const authority=new UnifiedSessions(adapter,{externalOrigin:'https://device.example',secure:false,resolveAccess:async()=>({userId:'system.user.customer',role:'enduser',groups:['system.group.user']}),firstLogin:async()=>({required:false}),getLicense:()=>({valid:true,coreEnabled:true}),...overrides});
    return {authority,adapter,destroyed};
}
test('explicit external origin is HTTPS-only, canonical and rejects userinfo/path',()=>{
    assert.equal(publicOrigin('https://192.168.2.5'),'https://192.168.2.5');
    for(const value of ['http://device.example','https://device.example/','https://user@device.example','https://device.example/path','https://device.example#fragment']) assert.throws(()=>publicOrigin(value));
});
test('transport rejects remote plaintext and spoofed Host/Origin regardless forwarding headers',()=>{
    assert.equal(transportAllowed(req(),'https://device.example',false),true);
    const remote=req(); remote.socket.remoteAddress='192.168.2.20'; assert.equal(transportAllowed(remote,'https://device.example',false),false);
    assert.equal(sameOrigin(req({origin:'https://evil.example','x-forwarded-host':'device.example','x-forwarded-proto':'https'}),'https://device.example',false),false);
    assert.equal(sameOrigin(req({host:'evil.example','x-forwarded-host':'device.example'}),'https://device.example',false),false);
    assert.equal(sameOrigin(req({'sec-fetch-site':'cross-site'}),'https://device.example',false),false);
});
test('session token parsing rejects duplicate cookies and encoded/unsigned aliases',()=>{
    assert.equal(readAccessToken(req()),TOKEN);
    assert.equal(readAccessToken(req({cookie:`access_token=${TOKEN}; access_token=${TOKEN}`})),null);
    assert.equal(readAccessToken(req({cookie:`access_token=s:${TOKEN}.signature`})),null);
});
test('status maps roles and persists activation only when core entitlement is granted',async()=>{
    const {authority}=setup(); const status=await authority.status(req());
    assert.equal(status.role,'customer');assert.equal(status.nextUrl,'/');assert.equal(status.activationRequired,false);
    const {authority:unlicensed}=setup({resolveAccess:async()=>({userId:'system.user.operator',role:'admin',groups:[]}),getLicense:()=>({valid:true,coreEnabled:false})});
    assert.equal((await unlicensed.status(req())).nextUrl,'/nexowatt/license');
    const {authority:first}=setup({firstLogin:async()=>({required:true}),getLicense:()=>({valid:false})});
    assert.equal((await first.status(req())).nextUrl,'/system/?passwordSetup');
});
test('CSRF token is session- and epoch-bound; logout revokes stored pair and open streams',async()=>{
    const {authority,adapter,destroyed}=setup(); const request=req();request.headers['x-nw-csrf']=authority.csrf(request);
    assert.equal(authority.csrfAllowed(request),true);
    const other=req({cookie:`access_token=${'b'.repeat(40)}`,'x-nw-csrf':request.headers['x-nw-csrf']});assert.equal(authority.csrfAllowed(other),false);
    const res={clearCookie(){},setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await authority.logout(request,res);assert.equal(res.code,200);assert.equal(adapter.revoked,true);assert.deepEqual(destroyed,[`a:${TOKEN}`,`r:${'r'.repeat(40)}`]);assert.equal(authority.csrfAllowed(request),false);
});
test('bad CSRF does not revoke another login',async()=>{
    const {authority,adapter,destroyed}=setup();const res={status(code){this.code=code;return this;},json(){return this;}};
    await authority.logout(req({'x-nw-csrf':'0'.repeat(64)}),res);assert.equal(res.code,403);assert.equal(adapter.eosSessionSecurity.epoch,'epoch-one');assert.equal(destroyed.length,0);
});
test('real HTTP login delegates to existing OAuth route and returns only opaque-cookie success',async t=>{
    const {authority}=setup({externalOrigin:''});const app=express();app.use(express.json({limit:'4kb'}));
    app.post('/api/auth/login',(request,response,next)=>authority.prepareLogin(request,response,next));
    let issued=0;
    app.post('/oauth/token',(request,response)=>{issued++;assert.equal(request.body.grant_type,'password');assert.equal(request.body.username,'operator');assert.equal(request.body.password,'unique-test-password');response.cookie('access_token',TOKEN,{httpOnly:true,sameSite:'strict'});response.json({access_token:TOKEN,refresh_token:'secret-refresh'});});
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
    const origin=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(`${origin}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({user:'operator',password:'unique-test-password'})});
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.equal(issued,1);
    const denied=await fetch(`${origin}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:JSON.stringify({user:'operator',password:'unique-test-password'})});assert.equal(denied.status,403);assert.equal(issued,1);
});
test('login rate map is bounded and fails closed before issuer',()=>{const {authority}=setup();const request=req();for(let i=0;i<10;i++)assert.equal(authority.loginRate(request,'operator'),true);assert.equal(authority.loginRate(request,'operator'),false);});

test('normal navigation GET/HEAD requires trusted transport but no Origin; writes still require Origin',()=>{
 const {authority}=setup(); const navigation=req();delete navigation.headers.origin;navigation.method='GET';assert.equal(authority.requestAllowed(navigation),true);navigation.method='HEAD';assert.equal(authority.requestAllowed(navigation),true);navigation.method='POST';assert.equal(authority.requestAllowed(navigation),false);navigation.method='GET';navigation.headers.origin='https://evil.example';assert.equal(authority.requestAllowed(navigation),false);
});

test('independent machine transport cannot borrow browser cookie or Origin authority',()=>{
 const {authority}=setup();const machine=req();delete machine.headers.origin;delete machine.headers.cookie;machine.method='POST';
 assert.equal(authority.machineRequestAllowed(machine),true);assert.equal(authority.requestAllowed(machine),false);
 for(const [key,value] of [['cookie','access_token=anything'],['origin','https://device.example'],['sec-fetch-site','same-origin'],['sec-fetch-mode','cors']]){machine.headers[key]=value;assert.equal(authority.machineRequestAllowed(machine),false);delete machine.headers[key];}
 machine.headers.host='attacker.example';assert.equal(authority.machineRequestAllowed(machine),false);
});
