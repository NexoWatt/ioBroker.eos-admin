/** Copyright (c) 2026 NexoWatt. Confidential and proprietary.
 * Browser-only smoke of actual history React sources with explicit simulated API.
 * Never connects to a live EOS, ioBroker, PostgreSQL or InfluxDB installation.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(root, 'ui/src-admin-tab/package.json'));
const esbuild = frontendRequire('esbuild');

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-history-browser-'));
  const shots = process.env.EOS_BROWSER_SCREENSHOTS ? path.resolve(process.env.EOS_BROWSER_SCREENSHOTS) : null;
  let browser, server;
  const results = [], pageErrors = [], rejectedRequests = [];
  try {
    const mockFile = path.join(temp, 'api.ts');
    await fs.writeFile(mockFile, `
const mode = new URLSearchParams(window.location.search).get('fixture') || 'new';
const existing = mode === 'legacy';
window.__historyFixture = {
  calls: [], checkError: '', provisioned: false,
  response: { ok:true, configurationRevision:'fixture-r1', config:{ provider: existing?'influxdb2':'adapter', instance:'influxdb.0', newInstallationAllowed:!existing,
    influxdb2:{ url:existing?'https://influx.fixture.invalid:8086':'', organization:existing?'Fixture organization':'', bucket:existing?'Fixture bucket':'', hasToken:existing, hasCaCertificate:false },
    postgresql:{profile:'local',provisioned:false}},
    status:{provider:existing?'influxdb2':'adapter',state:existing?'ready':'disabled',queueDepth:0,droppedPoints:0,lastWriteAt:null,lastReadAt:null,lastError:'',writeVerified:false}}
};
export function getInstance() { return '0'; }
export function getRuntimeProxyBase() { return ''; }
export async function historySetupRequest(suffix='', payload=null) {
  const state = window.__historyFixture;
  state.calls.push({suffix,payload});
  if(suffix==='/check') {
    if(state.checkError) throw {payload:{error:state.checkError,detail:'fixture-upstream-secret'}};
    return {ok:true,check:{reachable:true,readable:true,writeVerified:true}};
  }
  state.response.config.postgresql.provisioned=state.provisioned;
  if(payload) {
    if(payload.expectedConfigurationRevision!==state.response.configurationRevision) throw {status:409,payload:{error:'EOS_INSTALLER_CONFIG_CONFLICT'}};
    state.response.config.provider=payload.history.provider;
    state.response.config.newInstallationAllowed=false;
    state.response.configurationRevision='fixture-r2';
    state.response.status.provider=payload.history.provider;
    state.response.status.state='ready';
  }
  return JSON.parse(JSON.stringify(state.response));
}
`);
    const entryFile = path.join(temp, 'entry.tsx');
    await fs.writeFile(entryFile, `import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import HistorySetupPage from ${JSON.stringify(path.join(root, 'ui/src-admin-tab/src/pages/HistorySetupPage.tsx'))};
import ${JSON.stringify(path.join(root, 'ui/src-admin-tab/src/styles.css'))};
createRoot(document.getElementById('root')).render(<HashRouter><aside style={{padding:8,background:'#3e2e07',color:'#fff',textAlign:'center'}}>TESTSEITE · simulierte Backendantworten · keine Anlage verbunden</aside><HistorySetupPage/></HashRouter>);
`);
    await esbuild.build({entryPoints:[entryFile],bundle:true,outdir:temp,entryNames:'app',platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',
      nodePaths:[path.join(root,'ui/src-admin-tab/node_modules')],define:{'process.env.NODE_ENV':'"production"'},loader:{'.png':'dataurl'},
      plugins:[{name:'isolated-history-fixture',setup(build){build.onResolve({filter:/\/lib\/adminConnection$/},()=>({path:mockFile}));}}]});
    const html = '<!doctype html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EOS History Test Fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
    server = http.createServer(async (req,res)=>{
      const url = new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/app.js'||url.pathname==='/app.css') {
        res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'application/javascript');
        res.end(await fs.readFile(path.join(temp,url.pathname.slice(1))));
      } else if(url.pathname==='/') {res.setHeader('Content-Type','text/html');res.end(html);}
      else {res.statusCode=404;res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base = 'http://127.0.0.1:'+server.address().port;
    browser = await puppeteer.launch({executablePath:process.env.EOS_CHROMIUM_PATH||await puppeteer.executablePath(),headless:true,userDataDir:path.join(temp,'browser-profile'),args:['--no-sandbox','--disable-dev-shm-usage']});
    const page = await browser.newPage();
    page.on('pageerror',error=>pageErrors.push(String(error.message)));
    await page.setRequestInterception(true);
    page.on('request',req=>{const url=req.url();if(url.startsWith(base+'/')||url.startsWith('data:'))void req.continue();else{rejectedRequests.push(url);void req.abort();}});
    const click = label=>page.evaluate(label=>{const button=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===label);if(!button||button.disabled)throw Error('button unavailable: '+label);button.click();},label);
    const waitText = value=>page.waitForFunction(value=>document.body.innerText.includes(value),{},value);
    async function layout(label,width,height) {
      await page.setViewport({width,height,deviceScaleFactor:1});
      const size=await page.evaluate(()=>({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      assert.ok(size.scroll<=size.viewport+1 && size.body<=size.viewport+1,`${label}: horizontal overflow ${JSON.stringify(size)}`);
      if(shots){await fs.mkdir(shots,{recursive:true});await page.screenshot({path:path.join(shots,label+'.png'),fullPage:true});}
      results.push({scenario:label,...size,result:'passed'});
    }
    await page.setViewport({width:1440,height:1000});
    await page.goto(base+'/?fixture=new',{waitUntil:'networkidle0'});
    await waitText('Gespeicherter Stand geladen.');
    assert.equal(await page.$eval('#historyProvider',e=>e.value),'adapter');
    assert.equal(await page.evaluate(()=>window.__historyFixture.calls.length),1);
    await click('Neue Anlage mit PostgreSQL einrichten');
    await page.waitForSelector('#historyNewInstallation');
    assert.equal(await page.$eval('#historyProvider',e=>e.value),'postgresql');
    assert.equal(await page.$eval('#historyNewInstallation',e=>e.checked),true);
    assert.equal(await page.$('input[type=password]'),null);
    await waitText('Systemeinrichtung erforderlich');
    await layout('new-postgres-desktop',1440,1000);
    await layout('new-postgres-mobile',375,812);
    await page.evaluate(()=>{window.__historyFixture.checkError='EOS_POSTGRES_TLS_FAILED';});
    await click('Verbindung prüfen'); await waitText('Das PostgreSQL-Zertifikat konnte nicht geprüft werden.');
    assert.doesNotMatch(await page.$eval('body',e=>e.innerText),/fixture-upstream-secret/);
    await layout('postgres-tls-error-mobile',375,812);
    await page.evaluate(()=>{window.__historyFixture.checkError='';window.__historyFixture.provisioned=true;});
    await click('Status aktualisieren');await waitText('Geschütztes Verbindungsprofil vorhanden');
    assert.equal(await page.$eval('#historyNewInstallation',e=>e.checked),true);
    await click('Verbindung prüfen');await waitText('Verbindungsprüfung abgeschlossen.');
    assert.match(await page.$eval('body',e=>e.innerText),/Nicht durch diesen Test geprüft/);
    await click('Speichern');await waitText('Historie-Einstellungen gespeichert.');
    assert.equal(await page.$('#historyNewInstallation'),null);
    const saved=await page.evaluate(()=>window.__historyFixture.calls.filter(x=>x.payload?.expectedConfigurationRevision));
    assert.deepEqual(saved,[{suffix:'',payload:{history:{provider:'postgresql',postgresql:{profile:'local'},newInstallation:true},expectedConfigurationRevision:'fixture-r1'}}]);
    results.push({scenario:'explicit-new-site-check-save',result:'passed',runtimeNetwork:'stubbed only; no database setup invoked'});
    await page.goto(base+'/?fixture=legacy',{waitUntil:'networkidle0'});await waitText('Gespeicherter Stand geladen.');
    assert.equal(await page.$eval('#historyProvider',e=>e.value),'influxdb2');
    assert.equal(await page.$eval('#historyProvider option[value=postgresql]',e=>e.disabled),true);
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Neue Anlage mit PostgreSQL einrichten')),false);
    assert.equal(await page.$eval('#historyToken',e=>e.value),'');
    await layout('existing-influx-mobile',375,812);
    await layout('existing-influx-desktop',1440,1000);
    assert.equal(await page.evaluate(()=>window.__historyFixture.calls.filter(x=>x.payload).length),0);
    assert.deepEqual(pageErrors,[]);
    assert.deepEqual(rejectedRequests,[]);
    console.log(JSON.stringify({scope:'Actual React sources in fresh Chromium; API simulated, no actual EOS or database',browser:await browser.version(),node:process.version,results,pageErrors,rejectedRequests},null,2));
  } finally {
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    await fs.rm(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
