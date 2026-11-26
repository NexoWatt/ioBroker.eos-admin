/** Copyright (c) 2026 NexoWatt. Confidential and proprietary.
 * Chromium smoke: shipped dashboard HTML/CSS and actual energy/tariff render sources.
 * Bootstrap/auth/API/device communication are replaced by deterministic local snapshots.
 * This is a browser presentation test, not an EOS or hardware integration acceptance.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const ts = require('typescript');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const www = path.join(root, 'ui/www');
const sourceRoot = path.join(root, 'ui/src-ts/runtime-executables/www');
const names = ['coerceNumber','isMappedDatapoint','getGridImportExport','getStateAgeMs','getFlowFreshMaxAgeMs','getFreshFlowNumber','getStableFlowNumber','getConfiguredDatapointId','getBalanceDerivedBatteryFlow','getNormalizedBatteryFlow','getCanonicalPvPowerW','getLiveMeasurementView','getEvcsPowerW','updateEnergyWebExtras','updateEnergyWeb','updateEmsControlUi','nwRenderDashboardStatus','nwSetLiveOnline','formatPower','formatFlowPower','formatPricePerKwh','nxTryTsDashboardFormat','setText'];
async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-flow-browser-'));
  const shots = process.env.EOS_BROWSER_SCREENSHOTS ? path.resolve(process.env.EOS_BROWSER_SCREENSHOTS) : null;
  let server, browser;
  const pageErrors = [], rejectedRequests = [], results = [], sourceHashes = {};
  try {
    const app = await fs.readFile(path.join(sourceRoot, 'app.ts'), 'utf8');
    const ast = ts.createSourceFile('app.ts',app,ts.ScriptTarget.Latest,true);
    const functions = new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name?.text,n.getText(ast)]));
    for(const name of names) assert.ok(functions.has(name), `actual renderer function missing: ${name}`);
    let script = `let state = {}; const units = {power:'kW'}; const FLOW_UI_STABILITY = {decimals:1}; let nxLiveDashboardTsFormat = null;
const flowExtras = {meta:{evcsAvailable:true},producers:[],consumers:[],special:[]};
function nwStorageFarmFeatureFromConfig(){return false} function nwEvcsFeatureFromConfig(){return true}
window.__nwCfg = {datapoints:{gridPointPower:'fixture.grid',batteryPower:'fixture.battery',consumptionTotal:'fixture.load'},settings:{deviceStaleTimeoutSec:30},tariffDisplay:{currentSource:'provider',averageSource:'provider',currentUnit:'EUR/kWh',averageUnit:'EUR/kWh'}};
window.__nwEmsCfg = {}; window.__nwTariffLiveOnline = true;
`;
    for(const name of ['power-measurements','live-display','tariff-display']) {
      const relative = `ui/src-ts/runtime-executables/www/${name}.ts`;
      const text = await fs.readFile(path.join(root,relative),'utf8');
      sourceHashes[relative] = crypto.createHash('sha256').update(text).digest('hex');
      script += ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText + '\n';
    }
    script += names.map(name=>functions.get(name)).join('\n');
    script += `\nwindow.fixtureSnapshot = function(values, age={}, quality={}) { const now=Date.now(); state=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,ts:now-(age[key]||0),...(quality[key]===undefined?{}:{q:quality[key]})}])); window.latestState=state; window.__nwTariffLiveOnline=true; updateEnergyWeb(); updateEmsControlUi(); return now; };`;
    sourceHashes['ui/src-ts/runtime-executables/www/app.ts'] = crypto.createHash('sha256').update(app).digest('hex');
    let html=await fs.readFile(path.join(www,'index.html'),'utf8');
    sourceHashes['ui/www/index.html']=crypto.createHash('sha256').update(html).digest('hex');
    sourceHashes['ui/www/styles.css']=crypto.createHash('sha256').update(await fs.readFile(path.join(www,'styles.css'))).digest('hex');
    html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<link\b[^>]*rel="manifest"[^>]*>/gi,'');
    html=html.replace('</body>','<script src="/fixture.js"></script></body>');
    server=http.createServer(async(req,res)=>{
      try {
        const url=new URL(req.url,'http://127.0.0.1');
        if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
        if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(script);return;}
        if(url.pathname.startsWith('/static/')) {
          const file=path.resolve(www,url.pathname.slice('/static/'.length));
          if(!file.startsWith(www+path.sep)){res.statusCode=400;res.end();return;}
          const ext=path.extname(file);res.setHeader('Content-Type',ext==='.css'?'text/css':ext==='.svg'?'image/svg+xml':ext==='.png'?'image/png':'application/octet-stream');
          res.end(await fs.readFile(file));return;
        }
        res.statusCode=404;res.end();
      } catch {res.statusCode=404;res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    browser=await puppeteer.launch({executablePath:process.env.EOS_CHROMIUM_PATH||puppeteer.executablePath(),headless:true,userDataDir:path.join(temp,'profile'),args:['--no-sandbox','--disable-dev-shm-usage']});
    const page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request',req=>{if(req.url().startsWith(base+'/')||req.url().startsWith('data:'))void req.continue();else{rejectedRequests.push(req.url());void req.abort();}});
    await page.goto(base+'/',{waitUntil:'networkidle0'});
    const snapshot=(values,age={},quality={})=>page.evaluate((v,a,q)=>window.fixtureSnapshot(v,a,q),values,age,quality);
    const read=()=>page.evaluate(()=>Object.fromEntries(['centerPower','pvVal','gridVal','restVal','c2Val','batterySocIn','batteryFlowDirection','energyFlowQuality','emsStatusText'].map(id=>[id,document.getElementById(id).textContent])));
    const baseValues={'derived.core.pv.totalW':2500,consumptionTotal:9100,gridPointPower:3800,batteryPower:2800,storageSoc:90,'evcs.totalPowerW':6800,'settings.dynamicTariff':true,'settings.tariffMode':2};
    function tariffStatus(){return JSON.stringify({ts:Date.now(),active:true,intent:{snapshotFresh:true},effective:{statusText:'Tarif Automatik günstig (0.200 €/kWh): Speicher lädt',detailStatusText:'Prüfbeispiel: Readback bestätigt'}});}
    for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      await page.setViewport({width,height,deviceScaleFactor:1});
      await snapshot({...baseValues,'tarif.statusJson':tariffStatus()});
      let values=await read();assert.equal(values.centerPower,'2.3 kW');assert.equal(values.c2Val,'6.8 kW');assert.equal(values.energyFlowQuality,'');assert.match(values.emsStatusText,/Speicher lädt/);
      const geometry=await page.evaluate(()=>{
        const card=document.querySelector('.energy-web'),status=document.getElementById('emsStatusText'),wrap=document.getElementById('emsStatusWrap');
        const c=card.getBoundingClientRect(),s=status.getBoundingClientRect();
        return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,cardWidth:c.width,cardLeft:c.left,cardRight:c.right,statusWidth:s.width,statusHeight:s.height,statusLeft:s.left,statusRight:s.right,statusHidden:wrap.classList.contains('hidden')||status.classList.contains('hidden'),statusDisplay:getComputedStyle(status).display,cardScrollWidth:card.scrollWidth,cardClientWidth:card.clientWidth};
      });
      assert.equal(geometry.statusHidden,false);assert.notEqual(geometry.statusDisplay,'none');assert.ok(geometry.statusHeight>0&&geometry.statusWidth>0);
      assert.ok(geometry.statusLeft>=geometry.cardLeft-1&&geometry.statusRight<=geometry.cardRight+1,`${label} status outside card: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.cardScrollWidth<=geometry.cardClientWidth+1,`${label} flow card overflow: ${JSON.stringify(geometry)}`);
      if(shots){await fs.mkdir(shots,{recursive:true});const card=await page.$('.energy-web');await card.screenshot({path:path.join(shots,`flow-${label}.png`)});}
      results.push({scenario:`coherent-balance-and-visible-tariff-${label}`,result:'passed',values,geometry});
      await snapshot({...baseValues,consumptionTotal:13000,'evcs.totalPowerW':10700,'tarif.statusJson':tariffStatus()});
      values=await read();assert.equal(values.centerPower,'2.3 kW');assert.match(values.energyFlowQuality,/Bilanzabweichung 3\.9 kW/);
      results.push({scenario:`reported-incoherent-values-diagnosed-${label}`,result:'passed',values});
      await snapshot({...baseValues,'tarif.statusJson':tariffStatus()},{'evcs.totalPowerW':31000});
      values=await read();assert.equal(values.centerPower,'--');assert.equal(values.c2Val,'--');assert.match(values.energyFlowQuality,/fehlt oder ist veraltet/);
      results.push({scenario:`stale-ev-stays-unknown-${label}`,result:'passed',values});
      await snapshot({...baseValues,'tarif.statusJson':tariffStatus()},{},{'evcs.totalPowerW':64});
      values=await read();assert.equal(values.centerPower,'--');assert.equal(values.c2Val,'--');
      results.push({scenario:`invalid-quality-ev-stays-unknown-${label}`,result:'passed',values});
      await snapshot({...baseValues,'derived.core.pv.totalW':80,consumptionTotal:80,gridPointPower:0,batteryPower:0,'evcs.totalPowerW':0});
      values=await read();assert.equal(values.centerPower,'0.1 kW');assert.equal(values.pvVal,'0.1 kW');assert.equal(values.energyFlowQuality,'');
      results.push({scenario:`real-small-load-not-suppressed-${label}`,result:'passed',values});
      await snapshot({...baseValues,'derived.core.pv.totalW':0,consumptionTotal:0,gridPointPower:0,batteryPower:0,storageSoc:0,'evcs.totalPowerW':0});
      values=await read();assert.equal(values.centerPower,'0.0 kW');assert.equal(values.batterySocIn,'0 %');assert.match(values.emsStatusText,/Warte|warten/i);
      results.push({scenario:`confirmed-zero-and-tariff-awaiting-status-${label}`,result:'passed',values});
      const arrivingDirect = {...baseValues,consumptionTotal:1200,'derived.core.pv.totalW':1200,
        gridPointPower:0,batteryPower:0,'evcs.totalPowerW':0,'derived.core.building.loadTotalW':null,
        'derived.core.building.quality':'missing-grid'};
      const previousFrameAge = {'derived.core.building.loadTotalW':3000,'derived.core.building.quality':3000};
      await snapshot(arrivingDirect,previousFrameAge);
      values=await read();assert.equal(values.centerPower,'1.2 kW');assert.equal(values.energyFlowQuality,'');
      results.push({scenario:`fresh-direct-meter-before-derived-frame-${label}`,result:'passed',values});
      await snapshot(arrivingDirect,previousFrameAge,{consumptionTotal:64});
      values=await read();assert.equal(values.centerPower,'--');assert.match(values.energyFlowQuality,/Netzmessung/);
      results.push({scenario:`invalid-direct-meter-cannot-hide-loss-${label}`,result:'passed',values});
      const screenshot = {...baseValues, consumptionTotal:null, 'derived.core.pv.totalW':1200,'derived.core.grid.netW':-500,
        'derived.core.storage.netW':-1800,'derived.core.building.loadTotalW':null,'derived.core.building.quality':'invalid-balance','evcs.totalPowerW':0};
      await snapshot(screenshot);
      values=await read();assert.equal(values.centerPower,'--');assert.equal(values.batteryFlowDirection,'Laden');assert.match(values.energyFlowQuality,/Energiebilanz ist negativ/);
      await snapshot({...screenshot,'derived.core.storage.netW':1800,'derived.core.building.loadTotalW':2500,'derived.core.building.quality':'ok'});
      values=await read();assert.equal(values.centerPower,'2.5 kW');assert.equal(values.batteryFlowDirection,'Entladen');assert.equal(values.energyFlowQuality,'');
      assert.ok(await page.evaluate(()=>{const label=document.getElementById('batteryFlowDirection').getBoundingClientRect();const svg=document.getElementById('energyWebSvg').getBoundingClientRect();return label.height>0 && label.top>=svg.top && label.bottom<=svg.bottom && label.left>=svg.left && label.right<=svg.right;}));
      results.push({scenario:`reported-signed-storage-and-visible-direction-${label}`,result:'passed',values});
      const measuredFrame = {...baseValues, 'derived.core.pv.totalW':1500, 'derived.core.grid.netW':-1800,
        'derived.core.storage.netW':2800, 'derived.core.building.loadTotalW':2500,
        'settings.flowInvertGrid':true, 'evcs.totalPowerW':0, batteryPower:-2800};
      await snapshot(measuredFrame);
      values=await read();assert.equal(values.centerPower,'2.5 kW');assert.equal(values.gridVal,'-1.8 kW');assert.equal(values.restVal,'2.8 kW');assert.equal(values.energyFlowQuality,'');
      results.push({scenario:`normalized-frame-overrides-opposite-legacy-signs-${label}`,result:'passed',values});
      await snapshot({...measuredFrame, 'derived.core.storage.netW':-2800, 'derived.core.building.loadTotalW':null,
        'derived.core.building.quality':'invalid-balance'});
      values=await read();assert.equal(values.centerPower,'--');assert.equal(values.restVal,'-2.8 kW');assert.match(values.energyFlowQuality,/Energiebilanz.*negativ/i);
      results.push({scenario:`negative-balance-keeps-load-unknown-${label}`,result:'passed',values});
      await snapshot({...measuredFrame, 'derived.core.grid.netW':null, 'derived.core.building.loadTotalW':null,
        'derived.core.building.quality':'missing-grid'});
      values=await read();assert.equal(values.centerPower,'--');assert.equal(values.gridVal,'--');assert.match(values.energyFlowQuality,/Netzmessung/i);
      results.push({scenario:`missing-net-identified-without-legacy-substitution-${label}`,result:'passed',values});
      await snapshot({...baseValues,'tarif.statusJson':tariffStatus()});
      await page.evaluate(()=>nwSetLiveOnline(false));values=await read();assert.doesNotMatch(values.emsStatusText,/Speicher lädt/);assert.match(values.emsStatusText,/Verbindung/i);assert.equal(values.centerPower,'--');
      results.push({scenario:`offline-removes-charging-claim-${label}`,result:'passed',values});
    }
    assert.deepEqual(pageErrors,[]);assert.deepEqual(rejectedRequests,[]);
    console.log(JSON.stringify({scope:'Chromium presentation smoke using shipped HTML/CSS and actual canonical renderer/helper sources; deterministic snapshots; no auth, transport, backend or physical devices',browser:await browser.version(),node:process.version,runAt:new Date().toISOString(),results,pageErrors,rejectedRequests,sourceHashes},null,2));
  } finally {if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
