'use strict';
// Isolierter Chromium-Nachweis: echtes HTML/CSS und komplette Quick-Control-IIFE,
// lokale API-Fixtures, keine Verbindung zu ioBroker oder angeschlossenen Aktoren.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = process.cwd();
const ts = require(path.join(root, 'node_modules/typescript'));
const { chromium } = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
const output = path.join(root, 'docs/reports/heating-rod-2026-10-08');
fs.mkdirSync(output, { recursive: true });
const sourceFile = 'src-ts/runtime-executables/www/app.ts';
const source = fs.readFileSync(path.join(root, sourceFile), 'utf8');
const parsed = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
const names = ['nwHeatingRodNightStatus', 'formatPower', 'formatPowerSigned', '_nwCssEscapeIdent', 'syncToggleGroup', 'syncToggleButtonsForInputId'];
const helpers = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(parsed));
assert.equal(helpers.length, names.length);
const start = source.indexOf('(function(){', source.indexOf('function openFlowQc('));
const end = source.indexOf('// open EVCS on node click as well', start);
assert.ok(start > 0 && end > start);
const quickControl = source.slice(start, end);
const index = fs.readFileSync(path.join(root, 'www/index.html'), 'utf8');
const modalStart = index.indexOf('<div id="flowQcModal"');
const modalEnd = index.indexOf('</main>', modalStart);
assert.ok(modalStart > 0 && modalEnd > modalStart);
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><title>Heizstab: isolierter UI-Test</title></head><body class="nw-cockpit-page">${index.slice(modalStart, modalEnd)}<script src="/fixture.js"></script></body></html>`;
const fixture = {
  available: true, cfgEnabled: true, userEnabled: true, cfgMode: 'pvAuto', userMode: 'pvAuto', effectiveMode: 'pvAuto',
  autoMode: 'zeroExportForecast', autoModeLabel: '0-W-Einspeisung / Forecast',
  zeroExportReason: 'pv_or_forecast_signal_too_low', zeroExportCanProbe: false,
  currentStage: 0, targetStage: 0, wiredStages: 6, stageCount: 6, maxPowerW: 9000,
  measuredW: 0, appliedW: 0, targetW: 0, nightPvAutoBlocked: true, nightWindowActive: true,
  nightStartTime: '20:00', nightEndTime: '06:00', status: 'night_pv_auto_blocked_confirmed',
  boostActive: false, boostRemainingMin: 0,
  modes: [{ value: 'pvAuto', label: 'Auto' }, { value: 'manual1', label: 'Stufe 1' }, { value: 'manual2', label: 'Stufe 2' }, { value: 'manual3', label: 'Stufe 3' }, { value: 'off', label: 'Aus' }],
};
let current = { ...fixture };
const writes = [];
const fixtureScript = `const units={power:'W'}; const nxTryTsDashboardFormat=()=>null;
const flowSlotsCfg={consumers:[{idx:1,name:'Heizstab · 9 kW / 6 Stufen',qc:{enabled:true,controlKind:'heatingRod',hasBoost:true,boostMinutes:60,max:9000}}]};
const flowExtras={producers:[],consumers:[]}; const state={};
window.__nwEmsApps={heatingRod:{devices:[{slot:1,maxPowerW:9000}]}};
${helpers.join('\n')}
window.nwSyncToggleButtons=syncToggleButtonsForInputId;
${quickControl}
window.__nwFlowQcOpen('consumer',1);`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/flow/qc/read') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, heatingRod: current, boostActive: current.boostActive, boostRemainingMin: current.boostRemainingMin }));
  } else if (url.pathname === '/api/set' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const data = JSON.parse(body);
      writes.push(data);
      if (data.key.endsWith('.mode')) {
        const mode = data.value;
        const stage = mode.startsWith('manual') ? Number(mode.slice(-1)) : 0;
        current = { ...fixture, userMode: mode, effectiveMode: mode, currentStage: stage, measuredW: stage * 1500, appliedW: stage * 1500 };
      } else if (data.key.endsWith('.boost')) {
        current = { ...current, boostActive: data.value === true, boostRemainingMin: data.value ? 60 : 0, effectiveMode: data.value ? 'boost' : current.userMode, currentStage: data.value ? 6 : 2, measuredW: data.value ? 9000 : 3000, appliedW: data.value ? 9000 : 3000 };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  } else if (url.pathname === '/fixture.js') {
    res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(fixtureScript);
  } else if (url.pathname === '/styles.css') {
    res.writeHead(200, { 'content-type': 'text/css' }); res.end(fs.readFileSync(path.join(root, 'www/styles.css')));
  } else if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
  } else { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/workspace/scratch/eb7acf2936df/heater-browser-tools/runtime/chromium', headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const report = { timestamp: new Date().toISOString(), environment: { node: process.version, chromium: browser.version(), viewport: { width: 1280, height: 920 } }, scope: 'Echtes Quick-Control-HTML/CSS und vollständige Quick-Control-IIFE aus kanonischem app.ts. API-Antworten und Schreibziele ausschließlich lokale Fixtures. Kein Hardware- oder vollständiger Adaptertest.', sources: {}, cases: [], writes, errors: [] };
  for (const rel of [sourceFile, 'www/index.html', 'www/styles.css']) report.sources[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  const page = await browser.newPage({ viewport: report.environment.viewport });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') { report.errors.push('blocked-external-request'); return route.abort(); }
    return route.continue();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const snapshot = async (name, expectation) => {
    await page.waitForFunction(expected => document.getElementById('flowQcModeHint').textContent.includes(expected), expectation);
    const view = await page.evaluate(() => {
      const ids = ['flowQcRegStatus','flowQcRegHint','flowQcModeHint','flowQcPower','flowQcBoostStatus'];
      const values = Object.fromEntries(ids.map(id => [id, document.getElementById(id).textContent]));
      const rect = document.querySelector('#flowQcModal .dialog').getBoundingClientRect();
      return { values, activeMode: document.querySelector('#flowQcModeButtons .active')?.dataset.mode, dialog: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight } };
    });
    assert.ok(view.dialog.x >= 0 && view.dialog.y >= 0 && view.dialog.x + view.dialog.width <= view.viewport.width && view.dialog.y + view.dialog.height <= view.viewport.height, 'Dialog liegt außerhalb des Viewports');
    const screenshot = `browser-${name}.png`;
    await page.locator('#flowQcModal .dialog').screenshot({ path: path.join(output, screenshot) });
    report.cases.push({ name, expectedText: expectation, pass: true, screenshot, ...view });
    console.log(`PASS ${name}: ${view.values.flowQcModeHint}`);
    return view;
  };
  try {
    await page.goto(base);
    let view = await snapshot('night', 'Nachts gesperrt · Automatik ab 06:00');
    assert.equal(view.values.flowQcRegStatus, 'Nachtpause');
    assert.equal(view.activeMode, 'pvAuto');
    assert.match(view.values.flowQcModeHint, /0\/6 Stufen.*9000 W/);
    assert.doesNotMatch(view.values.flowQcModeHint, /Forecast|pv_or_forecast/);
    current = { ...fixture, currentStage: 1, measuredW: 1500, appliedW: 1500, status: 'night_pv_auto_blocked_write_failed' };
    await page.reload();
    view = await snapshot('night-stop-open', 'Abschaltung noch nicht bestätigt');
    assert.match(view.values.flowQcModeHint, /1\/6 Stufen/);
    assert.equal(view.values.flowQcPower, '1500 W');
    await page.locator('#flowQcModeButtons [data-mode="manual2"]').click();
    view = await snapshot('manual', 'Aktiv: Stufe 2');
    assert.equal(view.activeMode, 'manual2');
    assert.doesNotMatch(view.values.flowQcModeHint, /Nachts gesperrt/);
    assert.deepEqual(writes.at(-1), { scope: 'flow', key: 'consumer.1.mode', value: 'manual2' });
    await page.locator('#flowQcBoostBtn').click();
    await page.waitForFunction(() => document.getElementById('flowQcModeHint').textContent.includes('Boost aktiv (60 min)'));
    // Frisch öffnen: dokumentiert 9000 W ohne den bestehenden Übergangsfilter der Anzeige.
    await page.reload();
    view = await snapshot('boost', 'Boost aktiv (60 min)');
    assert.match(view.values.flowQcModeHint, /6\/6 Stufen.*9000 W/);
    assert.equal(view.values.flowQcPower, '9000 W');
    assert.doesNotMatch(view.values.flowQcModeHint, /Nachts gesperrt/);
    assert.deepEqual(writes.at(-1), { scope: 'flow', key: 'consumer.1.boost', value: true });
    current = { ...fixture, nightPvAutoBlocked: false, nightWindowActive: false };
    await page.reload();
    view = await snapshot('morning-wait', 'PV-Leistung/Prognose noch zu gering');
    assert.equal(view.values.flowQcRegStatus, 'Aktiv');
    assert.doesNotMatch(view.values.flowQcModeHint, /Nachts gesperrt/);
    assert.equal(report.errors.length, 0, 'Browserfehler aufgetreten');
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL'; report.failure = error.stack; throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'browser-quick-control.json'), JSON.stringify(report, null, 2) + '\n');
    const savedFixture = path.join(output, 'browser-quick-control-fixture.cjs');
    if (path.resolve(__filename) !== path.resolve(savedFixture)) fs.copyFileSync(__filename, savedFixture);
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
