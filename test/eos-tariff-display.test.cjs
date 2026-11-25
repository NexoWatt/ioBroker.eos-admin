/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { stripTypeScriptTypes } = require('node:module');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/www/app.ts'), 'utf8');
const ast = ts.createSourceFile('app.ts', source, ts.ScriptTarget.Latest, true);
const functions = new Map(ast.statements.filter(ts.isFunctionDeclaration).map(node => [node.name?.text, node.getText(ast)]));
const helperSource = stripTypeScriptTypes(fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/www/tariff-display.ts'), 'utf8'), { mode: 'transform' });
const html = fs.readFileSync(path.join(root, 'ui/www/index.html'), 'utf8');
const publicMetadata = { currentSource: 'provider', averageSource: 'provider', currentUnit: 'EUR/kWh', averageUnit: 'EUR/kWh' };
function fixture(now) {
    const elements = new Map(), listeners = new Map(), graphCalls = [], canvasOps = [];
    const canvasContext = new Proxy({}, { get(target, key) { if (key in target) return target[key]; return (...args) => canvasOps.push([key, ...args]); } });
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set();
            elements.set(id, { id, textContent: '', title: '', checked: false, style: {}, clientWidth: 700, clientHeight: 220,
                classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
                getContext: () => canvasContext, setAttribute() {}, getAttribute() { return null; }, querySelectorAll() { return []; },
                getBoundingClientRect: () => ({ left: 50, right: 750, top: 300, bottom: 520, width: 700, height: 220 }),
                querySelector: selector => element(selector.slice(1)), addEventListener(type, callback) { listeners.set(`${id}:${type}`, callback); },
                matches: () => false, contains: () => false,
            });
        }
        return elements.get(id);
    }
    const ids = new Set(['tariffCard', 'tariffForecastBtn', 'tariffForecastTip', 'priceCurrent', 'priceAverage', 'emsModal', 'emsPriceCurrent', 'emsPriceAvg', 'emsTariffToggle', 'emsTariffStatus', 'emsTariffHint', 'emsStatusText', 'emsStatusWrap']);
    for (const id of ids) { if (id !== 'tariffForecastTip') assert.ok(html.includes(`id="${id}"`), `Shipped HTML contains ${id}`); element(id); }
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    const window = { latestState: {}, __nwCfg: { tariffDisplay: publicMetadata }, innerWidth: 1200, innerHeight: 900, devicePixelRatio: 1, addEventListener() {} };
    const context = vm.createContext({ window, Date: Clock, console, document: { getElementById: id => ids.has(id) ? element(id) : null, addEventListener() {}, documentElement: {} },
        setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {}, requestAnimationFrame(callback) { callback(); },
        setText() {}, _fmtTimeHHmm: value => new Date(value).toISOString().slice(11, 16), fetch() { throw new Error('Price display must not activate or fetch'); },
    });
    vm.runInContext(helperSource, context);
    for (const name of ['formatPricePerKwh', 'nwParsePriceCurve', 'nwNiceStep', 'nwClamp', 'nwMedian', 'nwAggregateCurve', 'nwQuantile', 'nwResolveTariffThresholds', 'nwFormatCt', 'nwTariffColorForPrice', 'nwDrawTariffForecastChart', 'initTariffForecastTooltip', 'updateEmsControlUi', 'nwSetLiveOnline']) {
        if (functions.has(name)) vm.runInContext(functions.get(name), context);
    }
    const actualDraw = context.nwDrawTariffForecastChart;
    context.nwDrawTariffForecastChart = (canvas, curve, options) => { graphCalls.push({ curve, options }); return actualDraw(canvas, curve, options); };
    return { context, window, element, graphCalls, canvasOps,
        helper: window.NexoWattTariffDisplay,
        open() { context.initTariffForecastTooltip(); listeners.get('tariffForecastBtn:click')({ preventDefault() {}, stopPropagation() {} }); },
        render() { context.updateEmsControlUi(); },
    };
}
function rows(start, hours = 24, minutes = 15) {
    return Array.from({ length: hours * 60 / minutes }, (_, index) => ({ startsAt: new Date(start + index * minutes * 60000).toISOString(), endsAt: new Date(start + (index + 1) * minutes * 60000).toISOString(), total: index % 4 === 0 ? -0.12 : index % 4 === 1 ? 0 : 0.30 + index / 10000, currency: 'EUR', source: 'tibber' }));
}
function snapshot(now, curve, current = 0.2531) {
    return { 'settings.dynamicTariff': { value: false, ts: now }, priceTodayJson: { value: JSON.stringify(curve), ts: now }, priceTomorrowJson: { value: '[]', ts: now },
        'tariffProvider.statusJson': { value: JSON.stringify({ fresh: true, ts: now, currentPriceEurPerKwh: current, averagePriceEurPerKwh: 0.28 }), ts: now },
        'ems.budget.tariff.currentPriceEurKwh': { value: null, ts: now } };
}

test('actual dashboard tooltip draws all 96 supplied quarter-hours, including zero and negative intervals, without hourly averaging', () => {
    const now = new Date('2026-11-24T10:03:00Z').getTime(), f = fixture(now), start = f.helper.dayRange(now).startMs;
    f.window.latestState = snapshot(now, rows(start)); f.open();
    const plot = f.graphCalls.at(-1);
    assert.equal(plot.curve.length, 96);
    assert.equal(plot.curve[0].priceEurKwh, -0.12); assert.equal(plot.curve[1].priceEurKwh, 0);
    assert.ok(plot.curve.every(item => item.endMs - item.startMs === 900000));
    assert.match(f.element('tariffForecastMeta').textContent, /15-Minuten-Preise/);
    assert.ok(f.canvasOps.some(op => op[0] === 'lineTo'), 'The real canvas renderer executed');
});

test('actual dashboard retains all 92/100 quarter-hours on European daylight-saving days and places local clock labels correctly', () => {
    const previousTimezone = process.env.TZ; process.env.TZ = 'Europe/Berlin';
    try {
        for (const [day, count] of [['2026-03-29T12:00:00+02:00', 92], ['2026-10-25T12:00:00+01:00', 100]]) {
            const now = Date.parse(day), f = fixture(now), { startMs, endMs } = f.helper.dayRange(now);
            f.window.latestState = snapshot(now, rows(startMs, (endMs - startMs) / 3600000)); f.open();
            const plot = f.graphCalls.at(-1); assert.equal(plot.curve.length, count); assert.equal(plot.options.dayEndMs - plot.options.dayStartMs, count * 900000);
            const label = f.canvasOps.find(op => op[0] === 'fillText' && op[1] === '06:00'); assert.ok(label);
            const expected = new Date(startMs); expected.setHours(6, 0, 0, 0);
            // Actual chart layout: L=48, R=14, W=700. Compare spacing ratio to both midnight and noon.
            const midnight = f.canvasOps.find(op => op[0] === 'fillText' && op[1] === '00:00');
            const noon = f.canvasOps.find(op => op[0] === 'fillText' && op[1] === '12:00');
            const noonTime = new Date(startMs); noonTime.setHours(12, 0, 0, 0);
            assert.ok(Math.abs((label[2] - midnight[2]) / (noon[2] - midnight[2]) - (expected.getTime() - startMs) / (noonTime.getTime() - startMs)) < 1e-9);
        }
    } finally { if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone; }
});

test('price card and modal show confirmed Tibber prices while optimization remains off and an unrelated budget price is null', () => {
    const now = Date.now(), f = fixture(now); f.window.latestState = snapshot(now, [], 0.2531); f.render();
    assert.equal(f.element('priceCurrent').textContent, '0.253 €/kWh'); assert.equal(f.element('emsPriceCurrent').textContent, '0.253 €/kWh');
    assert.equal(f.element('priceAverage').textContent, '0.280 €/kWh'); assert.equal(f.element('emsTariffToggle').checked, false); assert.equal(f.element('emsTariffStatus').textContent, 'Aus');
    for (const value of [0, -0.12, 12.5]) { f.window.latestState = snapshot(now, [], value); f.render(); assert.equal(f.element('priceCurrent').textContent, `${value.toFixed(3)} €/kWh`); }
});

test('expired, absent, false or null source values clear the visible price rather than turning into zero or reusing budget values', () => {
    const now = Date.now(), f = fixture(now);
    for (const value of [null, false, '', ' ', undefined]) { f.window.latestState = snapshot(now, [], null); const status = JSON.parse(f.window.latestState['tariffProvider.statusJson'].value); status.currentPriceEurPerKwh = value; f.window.latestState['tariffProvider.statusJson'].value = JSON.stringify(status); f.render(); assert.equal(f.element('priceCurrent').textContent, '--'); }
    f.window.latestState = snapshot(now - 30001, [], 0.5); f.render(); assert.equal(f.element('priceCurrent').textContent, '--');
    f.window.latestState = snapshot(now, [], 0.5); f.render(); f.context.nwSetLiveOnline(false); assert.equal(f.element('priceCurrent').textContent, '--', 'SSE connection loss immediately clears a previously visible current price');
    f.context.nwSetLiveOnline(true); f.window.latestState = {}; f.render(); assert.equal(f.element('priceCurrent').textContent, '--');
    f.window.latestState = snapshot(now, [], 0); f.render(); assert.equal(f.element('priceCurrent').textContent, '0.000 €/kWh', 'fresh reconnect restores real zero');
});

test('legacy manual mappings remain authoritative, with explicit cent conversion and no connected-provider override', () => {
    const now = Date.now(), f = fixture(now); f.window.__nwCfg.tariffDisplay = { currentSource: 'mapped', averageSource: 'mapped', currentUnit: 'ct/kWh', averageUnit: 'EUR/kWh' };
    f.window.latestState = { ...snapshot(now, [], 9.99), priceCurrent: { value: -12, ts: now }, priceAverage: { value: 0.4, ts: now } }; f.render();
    assert.equal(f.element('priceCurrent').textContent, '-0.120 €/kWh'); assert.equal(f.element('priceAverage').textContent, '0.400 €/kWh');
    f.window.latestState.priceCurrent.value = null; f.render(); assert.equal(f.element('priceCurrent').textContent, '--');
    f.window.latestState.priceCurrent = { value: 12, ts: now - 5400001 }; f.render(); assert.equal(f.element('priceCurrent').textContent, '--');
});

test('hourly source data stays hourly; missing tomorrow does not remove today or invent quarter-hours', () => {
    const now = Date.now(), f = fixture(now), start = f.helper.dayRange(now).startMs;
    f.window.latestState = snapshot(now, rows(start, 24, 60)); f.open();
    assert.equal(f.graphCalls.at(-1).curve.length, 24); assert.match(f.element('tariffForecastMeta').textContent, /60-Minuten-Preise/);
    assert.equal(f.helper.parseCurve([{ startsAt: new Date(start).toISOString(), total: 12.5, currency: 'EUR' }])[0].priceEurKwh, 12.5);
    assert.equal(f.helper.parseCurve([{ startsAt: new Date(start).toISOString(), total: null }]).length, 0);
    assert.equal(f.helper.parseCurve([{ startsAt: new Date(start).toISOString(), total: false }]).length, 0);
});

test('real provider publication feeds the dashboard without enabling a control or fabricating absent values', async () => {
    const { TariffProviderModule } = require('../ui/ems/modules/tariff-provider');
    const now = Date.now(), f = fixture(now), states = {};
    const adapter = { namespace: 'eos-admin.0', config: { tariffProvider: { enabled: true, providerId: 'tibber', sourceId: 'tibber', maxStaleMinutes: 180, timeZone: 'Europe/Berlin', activateTariffLogic: false } },
        async setStateAsync(id, state) { states[id] = { value: state.val, ts: now }; },
        async setForeignStateAsync() { throw new Error('Unexpected control write'); }, log: { warn() {}, debug() {} } };
    const provider = new TariffProviderModule(adapter, null); provider._intervals = rows(f.helper.dayRange(now).startMs); provider._lastSuccessMs = now;
    await provider._publish(provider._cfg(), now, 'ok');
    f.window.latestState = { ...states, 'settings.dynamicTariff': { value: false, ts: now }, 'ems.budget.tariff.currentPriceEurKwh': { value: null, ts: now }, priceTodayJson: states['tariffProvider.pricesTodayJson'] };
    f.render(); f.open(); assert.notEqual(f.element('priceCurrent').textContent, '--'); assert.equal(f.graphCalls.at(-1).curve.length, 96);
    await provider._publish(provider._cfg(), now + 181 * 60000, 'stale'); f.window.latestState = states; f.render(); assert.equal(f.element('priceCurrent').textContent, '--');
});

test('both shipped dashboard entry pages load the typed price helper before app.js', () => {
    for (const name of ['index.html', 'settings.html']) { const source = fs.readFileSync(path.join(root, 'ui/www', name), 'utf8'); assert.ok(source.indexOf('/static/tariff-display.js') > 0); assert.ok(source.indexOf('/static/tariff-display.js') < source.indexOf('<script src="/static/app.js">')); }
});


test('energy flow always exposes enabled tariff or grid-fee control when its backend status is missing', () => {
    const now = Date.now(), f = fixture(now);
    f.window.latestState = { 'settings.dynamicTariff': { value: true }, 'settings.tariffMode': { value: 2 } };
    f.render();
    assert.match(f.element('emsStatusText').textContent, /Tarif Automatik aktiv.*warte auf aktuellen Regelungsstatus/);
    assert.equal(f.element('emsStatusWrap').classList.contains('hidden'), false);
    f.window.latestState = { 'settings.dynamicTariff': { value: false }, 'settings.netFeeEnabled': { value: true } };
    f.render(); assert.match(f.element('emsStatusText').textContent, /Zeitvariables Netzentgelt aktiv/);
    f.window.latestState = { 'settings.dynamicTariff': { value: false }, 'settings.netFeeEnabled': { value: false } };
    f.render(); assert.equal(f.element('emsStatusWrap').classList.contains('hidden'), true);
});

test('live flow status uses current policy snapshot, keeps unchanged text, and exposes inactive or stale runtime', () => {
    const now = Date.now(), f = fixture(now);
    const base = { 'settings.dynamicTariff': { value: true }, 'settings.tariffMode': { value: 2 },
        'tarif.statusText': { value: 'Tarif günstig: Speicher lädt', ts: now - 86400000 } };
    const status = { ts: now, active: true, intent: { snapshotFresh: true },
        effective: { statusText: 'Tarif günstig: Speicher lädt', detailStatusText: 'Readback bestätigt' } };
    f.window.latestState = { ...base, 'tarif.statusJson': { value: JSON.stringify(status), ts: now } };
    f.render(); assert.equal(f.element('emsStatusText').textContent, status.effective.statusText);
    assert.equal(f.element('emsStatusText').title, 'Readback bestätigt');
    status.active = false; f.window.latestState['tarif.statusJson'].value = JSON.stringify(status); f.render();
    assert.match(f.element('emsStatusText').textContent, /Regelung noch nicht bestätigt/);
    status.active = true; status.ts = now - 30001;
    f.window.latestState['tarif.statusJson'].value = JSON.stringify(status); f.render();
    assert.match(f.element('emsStatusText').textContent, /Regelungsstatus veraltet/);
    assert.equal(f.element('emsStatusText').textContent.includes('Speicher lädt'), false);
});

test('SSE disconnect clears stale actuator claims in the energy flow immediately and reconnect restores confirmed status', () => {
    const now = Date.now(), f = fixture(now);
    f.window.latestState = { 'settings.dynamicTariff': { value: true }, 'settings.tariffMode': { value: 1 },
        'tarif.statusJson': { value: JSON.stringify({ ts: now, active: true, intent: { snapshotFresh: true },
            effective: { statusText: 'Tarif günstig: Speicher lädt' } }), ts: now } };
    f.render(); assert.match(f.element('emsStatusText').textContent, /Speicher lädt.*Modus: Manuell/);
    f.context.nwSetLiveOnline(false);
    assert.match(f.element('emsStatusText').textContent, /Verbindung unterbrochen/);
    assert.equal(f.element('emsStatusText').textContent.includes('Speicher lädt'), false);
    f.context.nwSetLiveOnline(true); assert.match(f.element('emsStatusText').textContent, /Speicher lädt/);
});


test('invalid quality and expired source states cannot confirm charging or append a stale PV block', () => {
    const now = Date.now(), f = fixture(now);
    const status = { ts: now, active: true, intent: { snapshotFresh: true }, effective: { statusText: 'Tarif günstig: Speicher lädt' } };
    const base = { 'settings.dynamicTariff': { value: true }, 'settings.tariffMode': { value: 2 },
        'tarif.statusJson': { value: JSON.stringify(status), ts: now, q: 128 },
        'tarif.statusText': { value: status.effective.statusText, ts: now, q: 128 } };
    f.window.latestState = base; f.render();
    assert.match(f.element('emsStatusText').textContent, /nicht bestätigt/);
    assert.equal(f.element('emsStatusText').textContent.includes('Speicher lädt'), false);
    f.window.latestState = { ...base, 'tarif.statusJson': undefined }; f.render();
    assert.equal(f.element('emsStatusText').textContent.includes('Speicher lädt'), false);
    f.window.latestState = { ...base, 'tarif.statusJson': { value: JSON.stringify(status), ts: now - 30001 } }; f.render();
    assert.match(f.element('emsStatusText').textContent, /veraltet/);
    f.window.latestState = { ...base, 'tarif.statusJson': { value: JSON.stringify(status), ts: now, q: 0 },
        'speicher.regelung.tarifPvBlock': { value: true, ts: now - 30001 } };
    f.render(); assert.equal(f.element('emsStatusText').textContent.includes('PV-Reserve'), false);
    f.window.latestState['speicher.regelung.tarifPvBlock'] = { value: true, ts: now, q: 0 };
    f.render(); assert.match(f.element('emsStatusText').textContent, /PV-Reserve: Netzladen gesperrt/);
});


test('atomic storage reserve snapshot keeps a constant block visible without recycling old standalone flags', () => {
    const now = Date.now(), f = fixture(now);
    const status = { ts: now, active: true, intent: { snapshotFresh: true }, effective: { statusText: 'Tarif günstig: Speicher wartet' },
        pvReserve: { fresh: true, snapshotTs: now, blocked: true, capSocPct: 75, reason: 'PV erwartet' } };
    f.window.latestState = { 'settings.dynamicTariff': { value: true },
        'tarif.statusJson': { value: JSON.stringify(status), ts: now },
        'speicher.regelung.tarifPvBlock': { value: true, ts: now - 86400000 } };
    f.render(); assert.match(f.element('emsStatusText').textContent, /PV-Reserve: Netzladen gesperrt \(max 75.0%\)/);
    status.pvReserve = { ...status.pvReserve, fresh: false, blocked: false };
    f.window.latestState['tarif.statusJson'].value = JSON.stringify(status);
    f.window.latestState['speicher.regelung.tarifPvBlock'].ts = now;
    f.render(); assert.equal(f.element('emsStatusText').textContent.includes('PV-Reserve'), false);
});
