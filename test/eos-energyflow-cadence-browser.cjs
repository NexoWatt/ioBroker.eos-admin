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
async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'eos-cadence-browser-'));
 let browser;
 try{
  const source=await fs.readFile(path.join(root,'ui/src-ts/runtime-executables/www/app.ts'),'utf8');
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
   let counter=0;const burst=setInterval(()=>{p.sample.value=++counter;p.schedule(false);p.schedule(false);p.schedule(false);},25);
   await new Promise(resolve=>setTimeout(resolve,10250));clearInterval(burst);
   return {elapsedMs:performance.now()-begin,sampleTs,renders:p.renders.slice(),bursts:counter,clockOffsetMs:p.wallOffset};
  });
  assert.equal(timing.renders.length,3,`SSE burst produced unexpected renders: ${JSON.stringify(timing)}`);
  const gaps=timing.renders.slice(1).map((r,i)=>r.at-timing.renders[i].at);
  assert.ok(gaps.every(ms=>ms>=4800&&ms<=5700),`not the requested five-second cadence: ${JSON.stringify(gaps)}`);
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
  console.log(JSON.stringify({scope:'Actual canonical scheduling code with real Chromium timers and render observer; simulated SSE bursts/visibility/BFcache events; no backend or physical device',browser:await browser.version(),node:process.version,runAt:new Date().toISOString(),result:'passed',timing:{...timing,gaps},lifecycle,pageErrors,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')},null,2));
 }finally{if(browser)await browser.close();await fs.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
