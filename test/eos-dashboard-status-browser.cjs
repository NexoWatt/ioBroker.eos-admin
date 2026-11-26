/** Exercise dashboard status text with the shipped HTML/JS and simulated ioBroker/SSE data. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const puppeteer = require('puppeteer');

const web = path.resolve(process.env.EOS_STATUS_WWW || path.join(__dirname, '../ui/www'));
const legacy = process.env.EOS_STATUS_LEGACY === '1';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const fresh = value => ({value, ts: Date.now(), ack: true, q: 0});
const labels = {de: 'Alle Systeme normal', nl: 'Alle systemen werken normaal', en: 'All systems normal'};
const keys = {ems: 'ems.core.schedulerAlive', beat: 'ems.core.schedulerHeartbeatAt', grid: 'ems.gridMeasurementFresh'};
const lp = 'chargingManagement.wallboxes.lp1.';

function snapshot(value = 24) {
    return Object.fromEntries(Object.entries({
        [keys.ems]: true, [keys.beat]: Date.now(), [keys.grid]: true,
        [lp+'name']: 'Wallbox Pilot', [lp+'cfgEnabled']: true, [lp+'online']: true,
        storageSoc: value, consumptionTotal: 900, gridPointPower: 0, batteryPower: -900, 'derived.core.pv.totalW': 0
    }).map(([k, v]) => [k, fresh(v)]));
}

async function site(language) {
    const clients = new Set();
    const cfg = {settingsConfig: {evcsConfiguredCount: 1, evcsCount: 1}, locale: {language, htmlLang: language},
        datapoints: {consumptionTotal: 'meter.load', gridPointPower: 'meter.grid', batteryPower: 'meter.storage'},
        units: {power: 'kW'}, settings: {deviceStaleTimeoutSec: 90}};
    let values = snapshot(), automaticInit = true;
    let diagnosis = {state:'ok',failed:[],paused:[]};
    let diagnosisAgeMs = 0, diagnosisCode = 200, diagnosisReads = 0;
    let releaseBootstrap;
    const bootstrap = new Promise(resolve => {releaseBootstrap = resolve;});
    const message = (client, type, payload) => client.write('data: '+JSON.stringify({type, payload})+'\n\n');
    const server = http.createServer(async (req, res) => {
        try {
            const href = new URL(req.url, 'http://localhost').pathname;
            const json = (body, status = 200) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(body)); };
            if (href === '/events') {
                res.writeHead(200, {'content-type':'text/event-stream','cache-control':'no-cache'}); res.flushHeaders();
                clients.add(res); res.on('close', () => clients.delete(res));
                if (automaticInit) message(res, 'init', values);
                return;
            }
            if (href === '/api/state') { await bootstrap; return json(values); }
            if (href === '/api/eos/dashboard/process-status') {
                diagnosisReads++;
                return json({observedAt:Date.now()-diagnosisAgeMs, deviceHealth:{state:'ok',offline:[],totalOffline:0},...diagnosis}, diagnosisCode);
            }
            if (href === '/config') return json(cfg);
            if (href === '/api/locale') return json({locale:cfg.locale});
            if (href === '/api/auth/status') return json({authed:true, authenticated:true, configured:true, enabled:true,
                protectWrites:true, mode:'kiosk', kiosk:true, kioskEnabled:true, user:null, userId:null, role:'customer',
                capabilities:['frontend.open'], csrfToken:'a'.repeat(64)});
            if (href === '/api/auth/idle') return json({authenticated:true, kiosk:true, serverNow:Date.now(),
                idleExpiresAt:null, idleTimeoutMs:0, sessionKey:'kiosk:dashboard-status-test', csrfToken:'a'.repeat(64)});
            if (href.startsWith('/api/')) return json({});
            const local = href === '/' ? 'index.html' : href.replace(/^\/(?:static\/)?/, '');
            for (const filename of [path.resolve(web, local), path.resolve(web, 'static', local)]) {
                if (!filename.startsWith(web + path.sep)) continue;
                let data;
                try { data = await fs.readFile(filename); } catch { continue; }
                const mime = {'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
                res.writeHead(200, {'content-type':mime[path.extname(filename)] || 'application/octet-stream'});
                res.end(data); return;
            }
            res.writeHead(404); res.end();
        } catch (error) { res.destroy(error); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return {
        url: 'http://127.0.0.1:'+server.address().port,
        releaseBootstrap,
        diagnosis(next, ageMs=0, httpCode=200) { diagnosis = next; diagnosisAgeMs = ageMs; diagnosisCode = httpCode; },
        reads() { return diagnosisReads; },
        update(next) { Object.assign(values, next); for (const c of clients) message(c, 'update', next); },
        reset(next) { values = next; for (const c of clients) message(c, 'init', next); },
        drop() { automaticInit = false; for (const c of clients) c.end(); },
        connected() { return clients.size > 0; },
        async close() { releaseBootstrap(); for (const c of clients) c.end(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
    };
}

function observe() {
    const el = document.getElementById('sideStatusText');
    window.statusEvidence = {writes:[], paints:[], phase:'healthy'};
    const record = (list, text) => {
        const {phase} = window.statusEvidence;
        const previous = list.at(-1);
        if (previous?.text !== text || previous?.phase !== phase) list.push({phase, text, timeMs:Math.round(performance.now())});
    };
    new MutationObserver(records => {
        for (const r of records) {
            if (r.type === 'childList') for (const n of r.addedNodes) record(window.statusEvidence.writes, n.textContent);
            else record(window.statusEvidence.writes, r.target.textContent);
        }
    }).observe(el, {childList:true,subtree:true,characterData:true});
    const frame = () => { record(window.statusEvidence.paints, el.textContent); requestAnimationFrame(frame); };
    frame();
}

async function run(browser, language) {
    const server = await site(language);
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const read = () => page.evaluate(() => ({
        status:document.getElementById('sideStatusText').textContent,
        panel:document.querySelector('.nw-panel-status').className,
        ems:document.getElementById('sideEms').textContent,
        grid:document.getElementById('sideGridStatus').textContent,
        lp:document.getElementById('sideEvcsStatusSummary').textContent
    }));
    const phase = name => page.evaluate(n => {window.statusEvidence.phase=n;},name);
    const wait = (fn, ...args) => page.waitForFunction(fn, {timeout:15000,polling:30}, ...args);
    try {
        await page.goto(server.url, {waitUntil:'domcontentloaded'});
        const startup = await read();
        if (!legacy) assert.notEqual(startup.status, labels[language], 'No healthy status before the first snapshot');
        server.releaseBootstrap();
        await wait(label => document.getElementById('sideStatusText')?.textContent === label
            && window.__nwFlowConnection === 'ready' && document.getElementById('sideEvcsStatusList')?.textContent.includes('Wallbox Pilot'), labels[language]);
        await page.evaluate(observe);
        const firstPollCount = server.reads();
        for (let i=0; i<6; i++) { server.update({'storageSoc':fresh(25+i), [keys.beat]:fresh(Date.now())}); await delay(1900); }
        const stable = await read();
        assert.equal(stable.status, labels[language]);
        const steadyPollCount = server.reads() - firstPollCount;
        if (!legacy) assert.ok(steadyPollCount >= 1 && steadyPollCount <= 2,
            'Expected one or two supervisor polls during 11.4 seconds; got '+steadyPollCount);
        const healthyWrites = await page.evaluate(() => window.statusEvidence.writes.filter(x=>x.phase==='healthy').map(x=>x.text));
        if (legacy) assert.ok(healthyWrites.some(text => /Betriebsstatus wird geprüft/.test(text)), JSON.stringify(healthyWrites));
        else assert.deepEqual(healthyWrites, [], 'Stable status should not be rewritten. Mutations: '+JSON.stringify(healthyWrites));
        await phase('repeatInit');
        for (let i=0; i<2; i++) { server.reset(snapshot()); await delay(180); }
        const repeated = await page.evaluate(() => window.statusEvidence.writes.filter(x=>x.phase==='repeatInit').map(x=>x.text));
        if (!legacy) assert.deepEqual(repeated, [], 'Repeated full snapshots must keep healthy state stable');
        const cases = {startup,stable};
        // Simulate a transport outage with retained charge-point data, then an EventSource that is connected
        // but has not yet received a full snapshot. Only the full snapshot may restore a known state.
        await phase('disconnect');
        server.drop();
        await wait(() => window.__nwFlowConnection === 'disconnected');
        await delay(350);
        cases.disconnect = await read();
        if (!legacy) {
            assert.notEqual(cases.disconnect.status, labels[language]);
            assert.match(cases.disconnect.status,/Verbindung|connection|verbinding|abgebrochen|disconnected/i);
        }
        for (let i=0; i<60 && !server.connected(); i++) await delay(100);
        assert.ok(server.connected(), 'Expected SSE reconnect after transport closed');
        await delay(150);
        cases.reconnectedWithoutSnapshot = await read();
        if (!legacy) assert.equal(cases.reconnectedWithoutSnapshot.status, cases.disconnect.status);
        const stale = snapshot();
        stale[keys.beat] = {...fresh(Date.now()-90000), ts:Date.now()-90000};
        stale[keys.grid] = {...fresh(true), q:128};
        await phase('staleInit'); server.reset(stale);
        await wait(() => window.__nwFlowConnection === 'ready' && window.latestState?.['ems.gridMeasurementFresh']?.q === 128);
        await delay(350); cases.staleInit = await read();
        if (!legacy) assert.notEqual(cases.staleInit.status, labels[language]);
        await phase('incomplete');
        const incomplete = snapshot(); delete incomplete[keys.beat]; delete incomplete[keys.grid];
        server.reset(incomplete);
        await wait(() => !window.latestState?.['ems.core.schedulerHeartbeatAt']);
        await delay(350); cases.incomplete = await read();
        if (!legacy) assert.notEqual(cases.incomplete.status, labels[language]);
        await phase('stopped');
        const stopped = snapshot(); stopped[keys.ems]=fresh(false);
        server.reset(stopped);
        await wait(() => window.latestState?.['ems.core.schedulerAlive']?.value === false);
        await delay(350); cases.stopped = await read();
        if (!legacy) assert.match(cases.stopped.status,/EMS.*(?:gestoppt|stopped|gestopt)/i);
        await phase('lpFault');
        const faulty = snapshot(); faulty[lp+'faultActive']=fresh(true);
        server.update(faulty);
        await wait(() => !!document.querySelector('#sideEvcsStatusList .is-error'));
        cases.lpFault = await read(); assert.notEqual(cases.lpFault.status, labels[language]);
        await phase('lpWarning');
        const warn = snapshot(); warn[lp+'userStationEnabled']=fresh(false);
        server.reset(warn);
        await wait(() => !!document.querySelector('#sideEvcsStatusList .is-warn'));
        cases.lpWarning = await read(); assert.notEqual(cases.lpWarning.status, labels[language]);
        await phase('recovery'); server.reset(snapshot());
        await wait(label => document.getElementById('sideStatusText').textContent === label && !document.querySelector('#sideEvcsStatusList .is-warn'),labels[language]);
        await delay(120); cases.recovery = await read();
        assert.deepEqual(pageErrors,[]);
        return {language,steadyPollCount,cases,...await page.evaluate(()=>window.statusEvidence)};
    } catch (error) {
        const d = await read().catch(()=>null);
        throw new Error(language+' '+error.message+' '+JSON.stringify({url:page.url(), state:await page.evaluate(()=>({flow:window.__nwFlowConnection,visibility:document.visibilityState,lp:document.getElementById('sideEvcsStatusList')?.textContent})).catch(()=>null),view:d,observed:await page.evaluate(()=>window.statusEvidence).catch(()=>null),pageErrors}),{cause:error});
    } finally { await context.close(); await server.close(); }
}


// Use a separate page and real supervisor poll intervals. The simulated supervisor remains
// available while its EMS/SSE endpoint is down, as it does in the deployed architecture.
async function processCases(browser, language) {
    const server = await site(language), context = await browser.createBrowserContext();
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const healthy = labels[language], deviceName = {de:/Geräte/i,en:/Devices?/i,nl:/Apparat|Toestel/i}[language];
    const expected = {de:/Prozess.*gestört/i,en:/process.*(?:fault|error|fail|issue|down)/i,nl:/proces.*(?:stor|storing|fout)/i}[language];
    const offline = /unterbrochen|interrupted|connection lost|offline|disconnected|verbroken|onderbroken/i;
    const paused = /EMS.*(?:pausiert|paused|gepauzeerd)/i;
    const unknown = /(?:prozess|process|proces).*(?:unbekannt|unknown|onbekend)/i;
    let emsAlive = true;
    const telemetry = setInterval(() => server.update({[keys.ems]:fresh(emsAlive),[keys.beat]:fresh(Date.now()),[keys.grid]:fresh(true)}),2000);
    const results = {};
    async function expect(name, predicate, timeout=18000) {
        const deadline = Date.now()+timeout; let text;
        do {
            text = await page.$eval('#sideStatusText', el=>el.textContent);
            if (predicate(text)) { results[name] = {text,discoveryPolls:server.reads()}; return; }
            await delay(100);
        } while (Date.now()<deadline);
        assert.fail(language+' '+name+' timed out: '+JSON.stringify({text,reads:server.reads(),results}));
    }
    try {
        server.diagnosis({state:'unknown',failed:[],paused:[]},0,503);
        server.releaseBootstrap();
        await page.goto(server.url,{waitUntil:'domcontentloaded'});
        await expect('supervisorUnavailable',t=>unknown.test(t) && server.reads()>0);
        server.diagnosis({state:'ok',failed:[],paused:[]});
        await expect('healthy', t=>t===healthy && server.reads()>0);
        server.diagnosis({state:'fault',failed:['devices'],paused:[]});
        await expect('failedDevice',t=>expected.test(t) && deviceName.test(t));
        server.diagnosis({state:'fault',failed:['devices','eebus','ocpp'],paused:['backup']});
        await expect('multipleModules',t=>deviceName.test(t) && /eebus/i.test(t) && /ocpp/i.test(t) && !/backup|sicherung/i.test(t));
        server.drop();
        await expect('offlineWithModuleNames',t=>offline.test(t) && deviceName.test(t) && /eebus/i.test(t) && /ocpp/i.test(t),3000);
        for (let i=0; i<60 && !server.connected(); i++) await delay(100);
        assert.ok(server.connected());
        assert.match(await page.$eval('#sideStatusText', el=>el.textContent),offline);
        server.diagnosis({state:'fault',failed:['ems','eebus','ocpp'],paused:[]});
        await expect('newEmsFaultWhileStreamUnavailable', t=>offline.test(t) && /EMS/.test(t) && /ocpp/i.test(t) && !deviceName.test(t));
        server.reset(snapshot());
        await expect('streamRestoredButModulesStillDown', t=>!offline.test(t) && /EMS/.test(t) && /ocpp/i.test(t),4000);
        server.diagnosis({state:'ok',failed:[],paused:['backup','ocpp']});
        await expect('disabledModulesExpected', t=>t===healthy);
        const meter = 'Netzzähler Nord', inverter = 'PV-Dach Süd';
        server.diagnosis({state:'ok',failed:[],paused:[],
            deviceHealth:{state:'fault',offline:[{name:meter}],totalOffline:1}});
        await expect('singlePhysicalDeviceDown',t=>t.includes(meter));
        server.diagnosis({state:'ok',failed:[],paused:[],
            deviceHealth:{state:'fault',offline:[{name:meter},{name:inverter}],totalOffline:2}});
        await expect('twoPhysicalDevicesDown',t=>t.includes(meter) && t.includes(inverter));
        server.diagnosis({state:'fault',failed:['eebus'],paused:[],
            deviceHealth:{state:'fault',offline:[{name:meter},{name:inverter}],totalOffline:2}});
        await expect('processAndDevicesDown',t=>/eebus/i.test(t) && t.includes(meter) && t.includes(inverter));
        const offlineNames = [meter,inverter,'Keller links','Halle Süd','Lüftung West','Pumpe Ost'];
        server.diagnosis({state:'ok',failed:[],paused:[],
            deviceHealth:{state:'fault',offline:offlineNames.map(name=>({name})),totalOffline:offlineNames.length}});
        await expect('severalDevicesSummarized',t=>!t.toLowerCase().includes('eebus') && offlineNames.some(name=>t.includes(name))
            && !offlineNames.every(name=>t.includes(name)) && /[0-9]/.test(t));
        const title = await page.$eval('#sideStatusText',e=>e.title);
        assert.ok(offlineNames.every(name=>title.includes(name)),title);
        results.severalDevicesSummarized.title = title;
        await page.click('#sideStatusDevices summary');
        assert.equal(await page.$eval('#sideStatusDevices',e=>e.open && !e.hidden),true);
        assert.equal(await page.$eval('#sideStatusDeviceNames',e=>e.textContent),offlineNames.join(', '));
        server.diagnosis({state:'ok',failed:[],paused:[],deviceHealth:{state:'unknown',offline:[],totalOffline:0}});
        await expect('deviceStateUnknown',t=>/gerät.*unbekannt|device.*unknown|apparaat.*onbekend|apparaten.*onbekend/i.test(t));
        server.diagnosis({state:'ok',failed:[],paused:[]});
        await expect('physicalDeviceRecovery',t=>t===healthy);
        assert.equal(await page.$eval('#sideStatusDevices',e=>e.hidden && !e.open),true);
        emsAlive = false; server.update({[keys.ems]:fresh(false)});
        server.diagnosis({state:'ok',failed:[],paused:['ems']});
        await expect('emsPaused',t=>paused.test(t));
        emsAlive = true; server.update({[keys.ems]:fresh(true),[keys.beat]:fresh(Date.now())});
        server.diagnosis({state:'ok',failed:[],paused:[]},60000);
        await expect('staleSupervisorObservation',t=>unknown.test(t),45000);
        server.diagnosis({state:'ok',failed:[],paused:[]});
        await expect('allRecovered',t=>t===healthy);
        assert.deepEqual(errors,[]);
        return {language,results};
    } finally { clearInterval(telemetry); await context.close(); await server.close(); }
}

async function main() {
    const browser = await puppeteer.launch({executablePath:process.env.EOS_CHROMIUM_PATH || puppeteer.executablePath(),
        headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
    try {
        const locales = legacy ? ['de'] : ['de','en','nl'];
        const [results, processResults] = await Promise.all([
            Promise.all(locales.map(locale=>run(browser,locale))),
            legacy ? Promise.resolve([]) : Promise.all(locales.map(locale=>processCases(browser,locale)))
        ]);
        const sha = crypto.createHash('sha256').update(await fs.readFile(path.join(web,'app.js'))).digest('hex');
        console.log(JSON.stringify({ok:true,legacy,browser:await browser.version(),appSha256:sha,scope:'Shipped dashboard, simulated HTTP/SSE backend and physical telemetry, real browser frames and DOM mutations.',results,processResults},null,2));
    } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
