'use strict';
// Shipped runtime methods with controlled controller/request boundaries.
// This is not an installed Express/ioBroker/browser integration test.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const security=require('../build/lib/eosRequestSecurity');
const {UnifiedSessions}=require('../src/lib/eosUnifiedBoundary');
const {installIdleSession}=require('./fixtures/eos-idle-session.cjs');
const code=fs.readFileSync(path.join(root,'build/lib/web.js'),'utf8');
const exportsObject={};
vm.runInNewContext(code,{exports:exportsObject,module:{exports:exportsObject},__dirname:path.join(root,'build/lib'),Buffer,URL,console,process:{env:{}},require:name=>name.startsWith('node:')?require(name):name==='./eosRequestSecurity'?security:{}},{filename:'shipped-build/lib/web.js',timeout:5000});
const makeWeb=(overrides={})=>{
 const settings={auth:true,secure:true,...overrides};
 return Object.assign(Object.create(exportsObject.default.prototype),{settings,unified:new UnifiedSessions({}, {externalOrigin:settings.eosExternalOrigin||'',secure:settings.secure})});
};
function response(){return{code:0,body:undefined,locals:{},headers:{},cookies:[],status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(name,value){this.headers[name]=value;},clearCookie(...args){this.cookies.push(args);}};}

test('login redirect rejects remote, protocol-relative, encoded separator, backslash and control origins',()=>{
 const web=makeWeb();
 for(const origin of ['//other.invalid/x/index.html','https://other.invalid/x/index.html','/\\other.invalid/x/index.html','/%5Cother.invalid/x/index.html','%2f%2fother.invalid/x/index.html','/a/../x/index.html','/a/./x/index.html','/a\n/x/index.html','/a/index.html?next=other','/login/index.html']){
  assert.equal(web.getSafeLoginOrigin({url:'/logout?origin='+encodeURIComponent(origin)}),null,origin);
 }
 assert.equal(web.getSafeLoginOrigin({url:'/logout?origin='+encodeURIComponent('/proxy/eos/index.html')}),'/proxy/eos');
 assert.equal(web.getSafeLoginOrigin({url:'/logout'}),null);
 assert.equal(web.getSafeLoginOrigin({url:'/logout?origin=/index.html'}),null);
});

test('production same-origin caller binds HTTPS versus HTTP and rejects forged forwarded origin',()=>{
 const tlsWeb=makeWeb(),tlsReq={socket:{remoteAddress:'192.168.10.20'},headers:{host:'eos.local:8188',origin:'https://eos.local:8188',cookie:'access_token=audit-placeholder'}};
 assert.equal(tlsWeb.isEosSameOriginWrite(tlsReq),true);
 assert.equal(tlsWeb.isEosSameOriginWrite({...tlsReq,headers:{...tlsReq.headers,origin:'http://eos.local:8188'}}),false);
 assert.equal(tlsWeb.isEosSameOriginWrite({...tlsReq,headers:{...tlsReq.headers,origin:'https://other.invalid','x-forwarded-host':'other.invalid','x-forwarded-proto':'https'}}),false);
 // A transport profile is fixed at construction, including its session authority.
 const httpWeb=makeWeb({secure:false}),httpReq={socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:8188',origin:'http://localhost:8188',cookie:'access_token=audit-placeholder'}};
 assert.equal(httpWeb.isEosSameOriginWrite(httpReq),true);
 assert.equal(httpWeb.isEosSameOriginWrite({...httpReq,headers:{...httpReq.headers,origin:'https://localhost:8188'}}),false);
 assert.equal(httpWeb.isEosSameOriginWrite({...httpReq,socket:{remoteAddress:'192.168.10.20'},headers:{...httpReq.headers,'x-forwarded-for':'127.0.0.1','x-forwarded-proto':'https'}}),false);
 assert.equal(httpWeb.isEosSameOriginWrite({...httpReq,headers:{...httpReq.headers,host:'eos.local:8188',origin:'http://eos.local:8188','x-forwarded-host':'localhost:8188'}}),false);
 assert.equal(httpWeb.isEosSameOriginWrite({...httpReq,headers:{...httpReq.headers,origin:'http://other.invalid','x-forwarded-host':'other.invalid'}}),false);
 const bearer={socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:8188',authorization:'Bearer audit-placeholder'}};
 assert.equal(httpWeb.isEosSameOriginWrite(bearer),true);
 assert.equal(httpWeb.isEosSameOriginWrite({...bearer,headers:{...bearer.headers,cookie:'access_token=audit-placeholder'}}),false);
 assert.equal(httpWeb.isEosSameOriginWrite({...bearer,headers:{...bearer.headers,authorization:'Basic audit-placeholder'}}),false);
 assert.equal(httpWeb.isEosSameOriginWrite({...bearer,headers:{...bearer.headers,origin:'http://other.invalid','x-forwarded-host':'other.invalid'}}),false);
 assert.equal(httpWeb.isEosSameOriginWrite({socket:httpReq.socket,headers:{host:'localhost:8188',cookie:'access_token=audit-placeholder'}}),false);
});

test('all retired passwordless endpoints deny even legacy-enabled accounts and existing claim cookies',async()=>{
 const web=makeWeb();web.settings.eosPasswordlessFirstLogin=true;
 let touched=false;web.adapter=new Proxy({}, {get(){touched=true;throw new Error('Controller must not be reached');}});
 for(const name of ['getEosPasswordlessFirstLoginStatus','startEosPasswordlessFirstLogin','saveEosPasswordlessFirstLogin']){
  const res=response();await web[name]({user:'admin',headers:{cookie:'nexowatt_eos_first_login=old-claim'},body:{user:'legacy',password:'test-only'},ip:'192.168.1.2'},res);
  assert.equal(res.code,410);assert.equal(res.body.error,'passwordlessActivationDisabled');assert.equal(res.body.eligible,false);assert.equal(res.cookies[0][0],'nexowatt_eos_first_login');
 }
 assert.equal(touched,false);
});

test('HTTP credential query guard rejects bearer/password forms and preserves normal OAuth code/state',()=>{
 for(const key of ['token','TOKEN','access_token','refresh_token','pass','password','ssoLoginResponse']){
  for(const value of ['secret','',[],{}])assert.equal(security.hasEosUrlCredentials({[key]:value}),true,key);
 }
 assert.equal(security.hasEosUrlCredentials({user:'account-selector',code:'one-time-authorization-code',state:'csrf-state'}),false);
 const src=fs.readFileSync(path.join(root,'src/lib/web.ts'),'utf8');
 assert.ok(src.indexOf('hasEosUrlCredentials(req.query')<src.indexOf('this.oauth2Model = createOAuth2Server'));
 const guard = /hasEosUrlCredentials[^\n;]*req\.query/.exec(code);
 assert.ok(guard && guard.index < code.indexOf('this.oauth2Model ='), 'shipped URL credential rejection precedes OAuth registration');
});

test('EOS token readers no longer accept query credentials but preserve cookie and Authorization',async t=>{
 const web=makeWeb();let reads=0,now=0;
 web.adapter={config:{},log:{warn(){},info(){},debug(){},error(){}}};
 const session=await installIdleSession(web.adapter,{token:'audit-placeholder-session',user:'operator',now:()=>now});
 t.after(()=>session.cleanup());
 const read=web.adapter.getSession.bind(web.adapter);
 web.adapter.getSession=(...args)=>{reads++;return read(...args);};
 const query={headers:{},query:{token:'audit-placeholder-session'}};
 assert.equal(web.readAccessTokenFromRequest(query),null);assert.equal(web.extractAccessToken(query),null);assert.equal(await web.readEosCurrentUser(query),null);assert.equal(reads,0);
 for(const headers of [{cookie:'access_token=audit-placeholder-session'},{authorization:'Bearer audit-placeholder-session'}]){
  assert.equal(await web.readEosCurrentUser({headers,query:{}}),'system.user.operator');
 }
 assert.equal(await web.readEosCurrentUser({headers:{authorization:'Bearer refresh-audit-placeholder-session'},query:{}}),null,'refresh token cannot authenticate an access request');
 assert.equal(await web.readEosCurrentUser({user:'operator',headers:{},query:{}}),null,'upstream identity alone is not a session capability');
 now=600000;
 assert.equal(await web.readEosCurrentUser({user:'operator',headers:{cookie:'access_token=audit-placeholder-session'},query:{}}),null,'cached upstream identity cannot survive the idle deadline');
});

test('file identity guard rejects anonymous and pending-password users and passes normalized caller',async()=>{
 for(const [userId,pending,expected] of [[null,false,401],['system.user.user',true,403],['system.user.user',false,0]]){
  const web=makeWeb();web.getEosRequestAccess=async()=>({userId,role:'enduser'});web.getEosFirstLoginPasswordState=async()=>({required:pending});
  const res=response();let next=false;
  await new Promise(resolve=>{const original=res.json;res.json=function(body){original.call(this,body);resolve();return this;};web.eosAuthenticatedRouteGuard()({},res,()=>{next=true;resolve();});});
  assert.equal(res.code,expected);assert.equal(next,expected===0);assert.equal(res.locals.eosAuthenticatedUser,expected===0?userId:undefined);
 }
});

test('SSO remains denied before OAuth and DB file routes have their own identity guard',()=>{
 const src=fs.readFileSync(path.join(root,'src/lib/web.ts'),'utf8');
 for(const text of [src,code]){
  const block = /this\.server\.app\.all\(\[([^\]]+)\]/.exec(text);
  assert.ok(block, 'SSO deny routes must exist');
  for(const route of ['/sso', '/sso-callback', '/sso-token']) assert.ok(block[1].includes(`'${route}'`), route);
  assert.ok(block.index < text.indexOf('this.adapter.eosSessionSecurity.bindOAuthModel'));
  assert.match(text, /this\.server\.app\.use\(\s*'\/files\/'\s*,\s*this\.eosAuthenticatedRouteGuard\(\)/);
  assert.match(text, /this\.server\.app\.use\(\s*'\/adapter\/'\s*,\s*this\.eosAuthenticatedRouteGuard\(\)/);
  assert.ok(!text.includes("pathName.endsWith('.ico')"));
  assert.ok(!text.includes("pathName.endsWith('manifest.json')"));
  assert.ok(!text.includes('readFolderRecursive'));
 }
});

test('OAuth callback messages are HTML text, replacement metacharacters cannot restore markup',()=>{
 const start=code.indexOf('function escapeHtml('),end=code.indexOf('\nfunction ',start+1);
 assert.ok(start>=0&&end>start);
 const escape=vm.runInNewContext(`const matchHtmlRegExp=/[\"'&<>]/;${code.slice(start,end)};escapeHtml`);
 const payload='<img src=x onerror="audit-marker">$&\'&';
 const expression=code.match(/text = text\.replace\('%MESSAGE%', \(\) => escapeHtml\(String\(_result\?\.result \|\| ''\)\.slice\(0, 4096\)\)\);/);
 assert.ok(expression,'actual shipped success sink must use escaped callback replacement');
 const rendered=vm.runInNewContext(`let text='<div>%MESSAGE%</div>';${expression[0]};text`,{escapeHtml:escape,_result:{result:payload}});
 assert.ok(!rendered.includes('<img'));assert.ok(rendered.includes('&lt;img'));assert.ok(rendered.includes('$&'));
 assert.ok(code.includes("script-src 'none'"));
});

test('forced administrator completes first-password flow with current credential before activation', async()=>{
 const web=makeWeb();const account={type:'user',common:{enabled:true,password:'hash'},native:{nexowattPasswordChangeRequired:true}};
 let current='TemporaryOne!42',writes=0,revoked=0;const destroyed=[];
 web.instanceProxy={invalidate(){}};web.getEosRequestAccess=async()=>({userId:'system.user.operator',role:'admin'});
 web.adapter={eosSessionSecurity:{revoke(){revoked++;}},log:{info(){},debug(){}},
  async getForeignObjectAsync(){return account;},async checkPasswordAsync(user,password){assert.equal(user,'operator');return password===current;},
  async setPasswordAsync(user,password){assert.equal(user,'operator');current=password;writes++;},async extendForeignObjectAsync(id,change){Object.assign(account,change);},async destroySession(id){destroyed.push(id);}};
 assert.equal((await web.getEosFirstLoginPasswordState('system.user.operator','admin')).required,true);
 const request={headers:{host:'eos.local',origin:'https://eos.local','x-nexowatt-eos-first-login':'1',cookie:'access_token=test-session-first-password'},body:{currentPassword:current,password:'DifferentLong!73',passwordRepeat:'DifferentLong!73'}};
 const res=response();await web.saveEosFirstLoginPassword(request,res);assert.equal(res.code,200);assert.equal(res.body.logoutRequired,true);assert.equal(writes,1);assert.equal(revoked,1);assert.ok(destroyed.length>0);
 assert.equal((await web.getEosFirstLoginPasswordState('system.user.operator','admin')).required,false);
 const noChange=response();await web.saveEosFirstLoginPassword(request,noChange);assert.equal(noChange.body.alreadyInitialized,true);assert.equal(writes,1);
});
