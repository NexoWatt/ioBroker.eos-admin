/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// Actual Chromium UI against a local authenticated-contract fixture. No hardware,
// license bypass or assertion of controller integration is made by this test.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const puppeteer = require('puppeteer');
const { validateConfig } = require('..');
const root = path.resolve(__dirname, '../../..');
const screenshots = process.env.EOS_BROWSER_OUTPUT;

test('Devices EMS form: wallbox default, meter/PV targets, storage choice, durable roundtrip and responsive status', async t => {
    const errors = []; const received = [];
    let ready = false; let reads = 0;
    const basic = (id, category, templateId, manufacturer) => ({ id, category, templateId, manufacturer, name: id,
        enabled: true, protocol: 'modbusTcp', connection: { host: '192.0.2.20', port: 502, unitId: 1, password: '__EOS_SECRET_UNCHANGED__', customRetained: 9 }, futureSetting: 'keep' });
    let config = { enabled: true, devices: [
        basic('evcs1', 'EVCS', 'evcs.abl.EvcsAblImpl', 'ABL'),
        basic('meter1', 'METER', 'meter.artemes.MeterArtemesAM2Impl', 'Artemes'),
        basic('storage1', 'ESS', 'ess.adstec.EssAdstecStoraxeImpl', 'ADS-TEC'),
        basic('pv1', 'PV_INVERTER', 'pv_inverter.foxess.FoxESSTG3G3PvInverter', 'FoxESS'),
    ], futureModuleSetting: { retain: true } };
    const assets = {
        '/modules/devices/': 'modules/devices/admin/index.html',
        '/modules/devices/vendor/jquery.js': 'adminWww/lib/js/jquery-3.2.1.min.js',
        '/modules/devices/vendor/materialize.js': 'adminWww/lib/js/materialize.js',
        '/modules/devices/vendor/materialize.css': 'adminWww/lib/css/materialize.css',
        '/modules/devices/vendor/adapter.css': 'adminWww/css/adapter.css',
        '/modules/devices/templates.json': 'modules/devices/lib/templates.json',
        '/modules/shared/eos-module.css': 'modules/shared/eos-module.css',
        '/system/img/eos/nexowatt-eos-brand-wide.png': 'adminWww/img/eos/nexowatt-eos-brand-wide.png',
    };
    for (const file of ['host-bridge.js', 'ems-assignment.js', 'index_m.js', 'style.css', 'words.js']) assets[`/modules/devices/${file}`] = `modules/devices/admin/${file}`;
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname.startsWith('/api/eos/modules/devices')) {
                res.setHeader('Content-Type', 'application/json');
                if (req.method !== 'GET') {
                    assert.equal(req.headers['x-nw-csrf'], 'fixture-csrf');
                    let body = ''; for await (const chunk of req) body += chunk;
                    const input = JSON.parse(body); received.push({ method: req.method, input });
                    if (req.method === 'PUT') { config = validateConfig(input.config); ready = true; }
                } else reads++;
                if (url.pathname.endsWith('/command')) { res.end(JSON.stringify({ result: [] })); return; }
                res.end(JSON.stringify({ config, csrfToken: 'fixture-csrf', configurationReady: true,
                    status: { active: true, reason: 'RUNNING' }, emsCommissioning: { state: ready ? 'ready' : 'pending',
                        statuses: config.devices.map(d => ({ deviceId: d.id, status: ready ? 'mapped' : 'pending', code: ready ? 'ACTIVATION_APPLIED' : 'ALIASES_PENDING', activationApplied: ready, activationRequestId: d.ems?.activation?.requestId })) } })); return;
            }
            if (url.pathname === '/eos-session-idle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end('/* idle lifecycle separately tested */'); return; }
            const asset = assets[url.pathname];
            if (!asset) { res.writeHead(404).end(); return; }
            res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' })[path.extname(asset)]);
            res.end(await fs.readFile(path.join(root, asset)));
        } catch (error) { errors.push(String(error)); res.writeHead(500).end(); }
    });
    server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-devices-ui-'));
    t.after(() => fs.rm(userDataDir, { recursive: true, force: true }));
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', userDataDir, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    t.after(() => browser.close());
    const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1050 });
    await page.goto(`http://127.0.0.1:${server.address().port}/modules/devices/`);
    await page.waitForFunction(() => !document.getElementById('eosDeviceEditor').inert && Number(document.getElementById('tplCount').textContent) > 100);
    await page.click('a[href="#tabDevices"]');
    async function edit(id) {
        await page.evaluate(deviceId => {
            const row = Array.from(document.querySelectorAll('#devicesTable tbody tr')).find(row => row.querySelector('code')?.textContent === deviceId);
            row.querySelector('[data-action="edit"]').click();
        }, id);
        await page.waitForSelector('#dev_ems_mode', { visible: true });
    }
    async function keepDraft() { await page.click('#btnSaveDevice'); await page.waitForSelector('#modalDevice.open', { hidden: true }); }
    await edit('evcs1');
    assert.equal(await page.$eval('#dev_ems_mode', e => e.value), 'auto');
    assert.match(await page.$eval('#dev_ems_help', e => e.textContent), /automatisch unter Ladepunkte/);
    await page.select('#dev_ems_chargerType', 'ac'); await page.select('#dev_ems_phases', '3');
    await page.type('#dev_ems_minCurrentA', '6'); await page.type('#dev_ems_maxCurrentA', '16');
    await keepDraft();
    await edit('meter1');
    await page.select('#dev_ems_mode', 'generationMeter');
    assert.equal(await page.$eval('#dev_ems_slot', e => e.options.length), 7);
    await page.select('#dev_ems_slot', '1');
    assert.equal(await page.$eval('#dev_ems_scope_field', e => e.hidden), true);
    await keepDraft();
    await edit('pv1'); await page.select('#dev_ems_mode', 'pvInverter'); await page.select('#dev_ems_slot', '2'); await keepDraft();
    await edit('storage1'); await page.select('#dev_ems_mode', 'storageFarm'); await page.select('#dev_ems_scope', 'M0');
    await page.select('#dev_ems_coupling', 'dc'); await page.type('#dev_ems_maxChargeW', '10000'); await page.type('#dev_ems_maxDischargeW', '10000'); await page.type('#dev_ems_capacityKWh', '20');
    if (screenshots) { await fs.mkdir(screenshots, { recursive: true }); await page.screenshot({ path: path.join(screenshots, 'devices-ems-desktop.png') }); }
    await keepDraft();
    await page.click('#eosModuleSave');
    await page.waitForFunction(() => document.getElementById('eosEmsStatus').textContent.includes('4 Gerät(e) zugeordnet') && !document.getElementById('eosDeviceEditor').inert);
    assert.equal(received.filter(r => r.method === 'PUT').length, 1);
    const byId = Object.fromEntries(config.devices.map(d => [d.id, d]));
    assert.equal(byId.evcs1.ems.mode, 'auto'); assert.equal(byId.evcs1.ems.activation.limits.maxCurrentA, 16);
    assert.equal(byId.meter1.ems.mode, 'generationMeter'); assert.equal(byId.meter1.ems.flowSlot, 1);
    assert.equal(byId.pv1.ems.mode, 'pvInverter'); assert.equal(byId.pv1.ems.flowSlot, 2);
    assert.equal(byId.storage1.ems.mode, 'storageFarm'); assert.equal(byId.storage1.ems.scope, 'M0'); assert.equal(byId.storage1.ems.activation.limits.capacityKWh, 20);
    for (const device of config.devices) { assert.equal(device.ems.activation.requested, true); assert.match(device.ems.activation.requestId, /^[0-9a-f-]{36}$/); }
    assert.deepEqual(config.futureModuleSetting, { retain: true });
    for (const d of config.devices) { assert.equal(d.futureSetting, 'keep'); assert.equal(d.connection.password, '__EOS_SECRET_UNCHANGED__'); assert.equal(d.connection.customRetained, 9); }
    assert.match(await page.$eval('[data-eos-ems-id="evcs1"]', e => e.textContent), /EMS eingerichtet/);
    assert.equal(await page.$eval('a[href*="tab=evcs"]', e => e.target), '');
    await edit('meter1');
    await page.$eval('#dev_name', e => { e.value = 'Unsaved customer name'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    const before = reads;
    await page.$eval('#eosEmsRefresh', e => e.click());
    await page.waitForFunction(() => document.getElementById('eosEmsStatus').textContent.includes('4 Gerät(e) zugeordnet'));
    assert.ok(reads > before, 'status refresh actually read the server');
    assert.equal(await page.$eval('#dev_name', e => e.value), 'Unsaved customer name', 'status refresh never reloads the form');
    await page.select('#dev_ems_mode', 'gridMeter'); await page.select('#dev_ems_scope', 'M1');
    assert.equal(await page.$eval('#dev_ems_slot_field', e => e.hidden), true);
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no page horizontal overflow');
    assert.equal(await page.$eval('.nexo-ems-config', e => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= window.innerWidth; }), true);
    await page.$eval('.modal-content', e => { e.scrollTop = 0; });
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'devices-ems-mobile.png') });
    await page.click('#btnCancelDevice');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('eosDeviceEditor').inert);
    await page.click('a[href="#tabDevices"]'); await edit('meter1');
    assert.equal(await page.$eval('#dev_ems_mode', e => e.value), 'generationMeter');
    assert.equal(await page.$eval('#dev_ems_slot', e => e.value), '1');
    assert.equal(await page.$eval('#dev_name', e => e.value), 'meter1');
    assert.deepEqual(errors, []);
});
