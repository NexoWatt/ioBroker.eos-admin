/** Copyright (c) 2026 NexoWatt. Confidential and proprietary.
 * Real Chromium timers exercise the actual display scheduler. SSE arrival and
 * lifecycle events are simulated; no backend/EMS interval or measurement is changed.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
async function fullDashboardCadence(browser) {
 const http = require('node:http');
 const www = path.join(root, 'ui/www');
 const connections = new Set();
 let snapshotRequests = 0, eventConnections = 0, initialLoad = 1000;
 let stamp = Date.now();
 const payload = watts => Object.fromEntries(Object.entries({
   'derived.core.pv.totalW': 0, consumptionTotal: watts, gridPointPower: watts, batteryPower: 0,
   storageSoc: 60, 'evcs.totalPowerW': 0
 }).map(([key, value]) => [key, { value, ts: stamp, ack: true, q: 0 }]));
 const send = (socket, type, watts) => socket.write('data: ' + JSON.stringify({ type, payload: payload(watts) }) + '\n\n');
 const server = http.createServer(async (req, res) => {
  try {
   const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
   const json = (body, status = 200) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(JSON.stringify(body)); };
   if (pathname === '/api/state') { snapshotRequests++; return json({}, 503); }
   if (pathname === '/events') {
    eventConnections++;
    res.writeHead(200, {'content-type':'text/event-stream','cache-control':'no-cache'});
    connections.add(res);
    res.on('close', () => connections.delete(res));
    send(res,'init', initialLoad);
    return;
   }
   if (pathname === '/config') return json({ datapoints: { consumptionTotal: 'meter.0.building', gridPointPower: 'meter.0.grid', batteryPower: 'meter.0.storage' },
     settings: { deviceStaleTimeoutSec: 90 }, units: { power: 'kW' } });
   if (pathname === '/api/auth/idle') return json({ authenticated:true, kiosk:true, serverNow:Date.now(),
     idleExpiresAt:null, idleTimeoutMs:0, sessionKey:'kiosk:local-cadence-fixture', csrfToken:'a'.repeat(64) });
   if (pathname === '/api/auth/status') return json({ authed: true, authenticated: true, configured: true, enabled: true,
     protectWrites: true, mode: 'kiosk', kiosk: true, kioskEnabled: true, user: null, userId: null, role: 'customer',
     capabilities: ['frontend.open'], csrfToken: 'a'.repeat(64) });
   if (pathname.startsWith('/api/')) return json({});
   const name = pathname === '/' ? 'index.html' : pathname.replace(/^\/(?:static\/)?/, '');
   const candidates = [path.join(www, name),path.join(www, 'static', name)];
   let bytes;
   for (const file of candidates) {
    if (!file.startsWith(www + path.sep)) continue;
    try { bytes = await fs.readFile(file); break; } catch {}
   }
   if (!bytes) { res.writeHead(404); return res.end(); }
   const type = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.json':'application/json'}[path.extname(name)];
   res.writeHead(200,{'content-type':type || 'application/octet-stream'}); res.end(bytes);
  } catch { res.writeHead(500); res.end(); }
 });
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 const page=await browser.newPage();
 const dashboardErrors=[];
 page.on('pageerror', error=>dashboardErrors.push(error.message));
 try {
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  const waitLoad = async expected => { try { await page.waitForFunction(value => document.querySelector('#centerPower')?.textContent.trim() === value,
    { timeout: 16000, polling: 50 }, expected); } catch (error) {
     const diagnostics = await page.evaluate(() => ({ url:location.pathname, centre:document.querySelector('#centerPower')?.textContent,
       side:document.getElementById('sideBuildingPower')?.textContent, state:window.__nwFlowConnection, liveValue:window.latestState?.consumptionTotal,
       hint:document.getElementById('energyFlowQuality')?.textContent, visibility:document.visibilityState }));
     throw new Error('Dashboard did not render '+expected+': '+JSON.stringify({diagnostics,eventConnections,snapshotRequests,dashboardErrors}),{cause:error});
   } };
  const read = () => page.evaluate(() => Object.fromEntries(['centerPower','sideBuildingPower','sideConsumptionTotal','sideTimestamp'].map(key =>
    [key,document.getElementById(key)?.textContent.trim()])));
  await waitLoad('1.0 kW');
  const initial = await read();
  const coherent = (frame, expected) => {
   for (const key of ['centerPower','sideBuildingPower','sideConsumptionTotal']) assert.equal(frame[key],expected,JSON.stringify(frame));
   assert.ok(frame.sideTimestamp && frame.sideTimestamp !== '--',JSON.stringify(frame));
  };
  coherent(initial, '1.0 kW');
  const observerStart = await page.evaluate(() => {
   const frames = window.__flowFrames = []; const start = performance.now();
   new MutationObserver(() => {
    const cells = ['centerPower','sideBuildingPower','sideConsumptionTotal','sideTimestamp'].map(key => document.getElementById(key)?.textContent.trim());
    if (JSON.stringify(cells) !== JSON.stringify(frames.at(-1)?.cells)) frames.push({elapsed:performance.now()-start,cells});
   }).observe(document.body,{childList:true,characterData:true,subtree:true});
   return start;
  });
  await new Promise(resolve=>setTimeout(resolve,1100));
  stamp=Date.now();
  for (const c of connections) send(c,'update',2200);
  await page.waitForFunction(()=>window.latestState?.consumptionTotal?.value===2200);
  // A modal's request for an immediate UI repaint must not expose an intermediate sample.
  await page.evaluate(()=>scheduleRender(true));
  await new Promise(resolve=>setTimeout(resolve,1200));
  assert.deepEqual(await read(),initial);
  stamp=Date.now();
  for (const c of connections) send(c,'update',3300);
  await waitLoad('3.3 kW');
  const settled=await read(); coherent(settled,'3.3 kW'); assert.notEqual(settled.sideTimestamp,initial.sideTimestamp);
  const frames=await page.evaluate(()=>window.__flowFrames.slice());
  for (const {cells} of frames) {
   assert.equal(cells[0],cells[1]); assert.equal(cells[0],cells[2]); assert.notEqual(cells[0],'2.2 kW');
   if (cells[0]===initial.centerPower) assert.equal(cells[3],initial.sideTimestamp);
   else if (cells[0]===settled.centerPower) assert.equal(cells[3],settled.sideTimestamp);
   else assert.fail('unexpected display frame '+JSON.stringify(cells));
  }
  assert.ok(frames.some(f=>f.cells[0]==='3.3 kW' && f.elapsed>=9000),JSON.stringify(frames));
  initialLoad=4400; stamp=Date.now();
  for (const c of connections) c.end();
  await waitLoad('--');
  await waitLoad('4.4 kW'); const reconnected=await read(); coherent(reconnected,'4.4 kW');
  assert.ok(snapshotRequests>=1 && eventConnections>=2);
  assert.deepEqual(dashboardErrors,[]);
  return { initialHttp:503, snapshotRequests,eventConnections,observerStart, initial,settled,frames,reconnected,dashboardErrors };
 } finally {
  await page.close();
  for (const c of connections) c.destroy();
  server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
 }
}

async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'eos-cadence-browser-'));
 let browser;
 try{
  const source=await fs.readFile(path.join(root,'ui/www/app.js'),'utf8');
  const start=source.indexOf('let _renderScheduled = false;'),end=source.indexOf('function formatPower(',start);
  assert.ok(start>0&&end>start,'actual scheduler block exists');
  const block=source.slice(start,end);
  browser=await puppeteer.launch({executablePath:process.env.EOS_CHROMIUM_PATH||puppeteer.executablePath(),headless:true,userDataDir:path.join(temp,'profile'),args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.setContent('<!doctype html><html><head><title>EOS scheduling test</title></head><body><svg id="energyWebSvg"></svg></body></html>');
  await page.addScriptTag({content:`window.__probe={renders:[],sample:{value:0,ts:Date.now()},wallOffset:0,visibility:'visible'};const actualNow=Date.now.bind(Date);Date.now=()=>actualNow()+window.__probe.wallOffset;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__probe.visibility});function render(){window.__probe.renders.push({at:performance.now(),value:window.__probe.sample.value,ts:window.__probe.sample.ts});}\n${block}\nwindow.__probe.schedule=scheduleLiveTelemetryRender;`});
  const timing=await page.evaluate(async()=>{
   const p=window.__probe;const sampleTs=p.sample.ts;const begin=performance.now();p.schedule(true);
   await new Promise(resolve=>setTimeout(resolve,100));
   p.wallOffset=-3600000;
   let counter=0;const burst=setInterval(()=>{p.sample.value=++counter;p.schedule(false);p.schedule(false);scheduleRender(true);},25);
   await new Promise(resolve=>setTimeout(resolve,20500));clearInterval(burst);
   return {elapsedMs:performance.now()-begin,sampleTs,renders:p.renders.slice(),bursts:counter,clockOffsetMs:p.wallOffset};
  });
  assert.equal(timing.renders.length,3,`SSE burst produced unexpected renders: ${JSON.stringify(timing)}`);
  const gaps=timing.renders.slice(1).map((r,i)=>r.at-timing.renders[i].at);
  assert.ok(gaps.every(ms=>ms>=9800&&ms<=11500),`not the requested ten-second cadence: ${JSON.stringify(gaps)}`);
  assert.ok(timing.renders.every(r=>r.ts===timing.sampleTs),'source timestamps rewritten');
  assert.ok(timing.renders[1].value>timing.renders[0].value&&timing.renders[2].value>timing.renders[1].value,'latest buffered values not selected');
  const lifecycle=await page.evaluate(async()=>{
   const p=window.__probe;
   p.visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));const before=p.renders.length;
   p.sample.value=999;p.schedule(false);p.schedule(true);
   await new Promise(resolve=>setTimeout(resolve,180));
   const whileHidden=p.renders.length;
   const hiddenTimers={telemetry:_liveTelemetryRenderTimer,render:_renderTimer,age:liveMeasurementAgeTimer};
   p.visibility='visible';document.dispatchEvent(new Event('visibilitychange'));
   await new Promise(resolve=>setTimeout(resolve,180));const afterVisible=p.renders.slice(before);
   window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   const pagehideTimers={telemetry:_liveTelemetryRenderTimer,render:_renderTimer,age:liveMeasurementAgeTimer};
   p.sample.value=1000;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
   await new Promise(resolve=>setTimeout(resolve,180));
   return {before,whileHidden,hiddenTimers,afterVisible,pagehideTimers,afterPageshow:p.renders.at(-1),total:p.renders.length};
  });
  assert.equal(lifecycle.before,lifecycle.whileHidden,'hidden page rendered');
  assert.deepEqual(lifecycle.hiddenTimers,{telemetry:null,render:null,age:null},'hidden timers retained');
  assert.equal(lifecycle.afterVisible.length,1,'visible return not immediately rendered exactly once');
  assert.equal(lifecycle.afterVisible[0].value,999);
  assert.deepEqual(lifecycle.pagehideTimers,{telemetry:null,render:null,age:null},'pagehide timers retained');
  assert.equal(lifecycle.afterPageshow.value,1000,'BFcache return did not immediately render latest state');
  assert.equal(lifecycle.total,lifecycle.before+2,'duplicate lifecycle renders');
  assert.equal(lifecycle.afterPageshow.ts,timing.sampleTs);
  assert.deepEqual(pageErrors,[]);
  const dashboard=await fullDashboardCadence(browser);
  console.log(JSON.stringify({scope:'Shipped dashboard scheduling code with real Chromium timers and render observer; simulated SSE bursts/visibility/BFcache events; no backend or physical device',browser:await browser.version(),node:process.version,runAt:new Date().toISOString(),result:'passed',timing:{...timing,gaps},lifecycle,dashboard,pageErrors,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')},null,2));
 }finally{if(browser)await browser.close();await fs.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
