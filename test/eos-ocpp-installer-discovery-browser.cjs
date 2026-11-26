'use strict';
/* Real Chromium/App-Center and hosted configuration/CAS routes. Controller,
 * authentication and OCPP inventory are fixtures; no hardware is addressed. */
/* global document */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const ts = require('typescript');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { synchronizeChargingPointIdentity } = require('../ui/lib/charging-point-identity');
const root = path.resolve(__dirname, '..');
const stationRoot = 'eos-admin.0.ocpp.ENERGYLINE';
const connector = {
    base: stationRoot, stationKey: stationRoot, name: 'Energyline', connectorNo: 1,
    telemetryProfile: 'nexowattocpp', controlPreference: 'powerW', contractVersion: 'nexowatt-ocpp21-0.4-native',
    ids: { powerId: `${stationRoot}.measurements.powerW`, setPowerWId: `${stationRoot}.control.chargeLimit`,
        onlineId: `${stationRoot}.info.socketConnected`, enableWriteId: `${stationRoot}.control.availability` },
};
const nativeRow = { enabled: false, name: 'Energyline gespeichert', powerId: connector.ids.powerId,
    setPowerWId: connector.ids.setPowerWId, stationKey: '', maxPowerW: 7400 };

async function main() {
    const h = await createHarness(); const a = h.adapter;
    let browser, server, undercountNextConfig = false; const errors = [], checks = [], posts = [];
    try {
        const canonical = await fs.readFile(path.join(root, 'ui/src-ts/runtime-executables/www/ems-apps.ts'), 'utf8');
        const javascript = ts.transpileModule(canonical,
            { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
        a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
        a.nwWriteUserdataBackup = async () => {};
        a._nwInitLicense = async () => {};
        a.startHistorieExportTimer = () => {};
        h.owner.subscribeForeignStates = () => {};
        h.owner.unsubscribeForeignStates = () => {};
        a.initEmsEngine = async force => {
            assert.equal(force, true);
            await synchronizeChargingPointIdentity(a, a.config.settingsConfig.evcsList);
        };
        for (const [id, type, write, unit] of [
            [connector.ids.powerId, 'number', false, 'W'], [connector.ids.setPowerWId, 'number', true, 'W'],
            [connector.ids.onlineId, 'boolean', false, ''], [connector.ids.enableWriteId, 'boolean', true, ''],
            ['fixture.other.power', 'number', false, 'W'],
        ]) h.objects.set(id, { type: 'state', common: { type, read: true, write, ...(unit ? { unit } : {}) }, native: {} });
        const backgroundSave = async rows => {
            const config = { settingsConfig: { evcsCount: rows.length, evcsList: structuredClone(rows), stationGroups: [] },
                emsApps: { apps: { charging: { installed: true, enabled: true } } } };
            a._nwInstallerConfigPatch = structuredClone(config);
            a.config = a.nwApplyInstallerPatchToRuntimeConfig(a.config, structuredClone(config));
            assert.equal(await a.persistInstallerConfigToState(config), true);
            await synchronizeChargingPointIdentity(a, rows);
            await a.syncSettingsConfigToStates();
        };
        await backgroundSave([]);
        const token = await h.login('installer');
        server = http.createServer(async (req, res) => {
            const pathname = new URL(req.url, 'http://fixture').pathname;
            if (pathname === '/ems-apps.js') {
                res.setHeader('Content-Type', 'application/javascript'); res.end(javascript); return;
            }
            if (pathname === '/api/ocpp/discover') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ connectors: [connector, structuredClone(connector)] })); return;
            }
            if (['/api/auth/status', '/api/session/me'].includes(pathname)) {
                const access = await h.bridge.resolveAccess(req);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.end(JSON.stringify({ enabled: true, configured: true, mode: 'iobroker', protectWrites: true,
                    authed: !!access?.authenticated, authenticated: !!access?.authenticated,
                    user: access?.user || null, role: access?.role || 'none', capabilities: access?.capabilities || [],
                    csrfToken: access?.csrfToken || '' })); return;
            }
            if (pathname === '/api/installer/config' && req.method === 'GET' && undercountNextConfig) {
                undercountNextConfig = false;
                const end = res.end.bind(res);
                res.end = payload => {
                    const data = JSON.parse(payload.toString());
                    data.config.settingsConfig.evcsCount = 0;
                    res.removeHeader('Content-Length');
                    return end(JSON.stringify(data));
                };
            }
            a._hostedApp(req, res);
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || '/usr/bin/chromium',
            headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.setDefaultTimeout(15000);
        await page.setViewport({ width: 1440, height: 1000 });
        await page.setCookie({ name: 'fixture', value: token, url: base });
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/installer/config') posts.push(JSON.parse(request.postData()));
        });
        const status = text => page.waitForFunction(value => document.getElementById('nw-emsapps-status')?.textContent.includes(value), {}, text);
        const count = () => page.$eval('#evcsCount', input => Number(input.value));
        const name = () => page.$eval('[data-evcs-remove="1"]', button => button.closest('.nw-config-card').querySelector('input[type="text"]').value);
        const setName = async value => page.$eval('[data-evcs-remove="1"]', (button, next) => {
            const input = button.closest('.nw-config-card').querySelector('input[type="text"]');
            input.value = next; input.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
        const save = async () => {
            const response = page.waitForResponse(item => item.request().method() === 'POST'
                && new URL(item.url()).pathname === '/api/installer/config');
            await page.click('#nw-emsapps-save');
            const result = await response;
            await status(result.status() === 200 ? 'Gespeichert.' : 'Speichern fehlgeschlagen');
            return result.status();
        };
        await page.goto(`${base}/ems-apps.html?nwAdmin=1`); await status('Konfiguration geladen');
        assert.equal(await count(), 0);
        await backgroundSave([nativeRow]);
        undercountNextConfig = true;
        await page.click('[data-tab="evcs"]'); await status('Konfiguration geladen');
        assert.equal(await count(), 1);
        assert.equal(await name(), nativeRow.name);
        assert.ok(await page.evaluate(() => document.getElementById('evcsList').textContent.includes('Unzugeordnet')));
        checks.push('pristine tab adopts background-created LP despite stale count zero and preserves empty manual station assignment');

        await page.click('#ocppAutoDetect'); await status('OCPP21:');
        await page.waitForFunction(() => document.getElementById('nw-emsapps-status').textContent.includes('Bitte speichern'));
        assert.equal(await count(), 1); assert.equal(await name(), nativeRow.name);
        await page.click('#ocppMapExisting'); await status('Bitte speichern');
        assert.equal(await count(), 1);
        checks.push('both buttons merge duplicate inventory idempotently without replacing commissioned names/limits');

        await setName('Lokaler Entwurf bleibt');
        await backgroundSave([nativeRow, { enabled: false, name: 'Zwischenzeitlich hinzugefügt', powerId: 'fixture.other.power' }]);
        await page.click('#ocppAutoDetect'); await status('Bitte speichern');
        assert.equal(await count(), 1); assert.equal(await name(), 'Lokaler Entwurf bleibt');
        assert.equal(await save(), 409);
        assert.equal(await name(), 'Lokaler Entwurf bleibt');
        assert.equal(posts.at(-1).patch.settingsConfig.evcsList.length, 1);
        checks.push('dirty discovery retains its draft/CAS; concurrent background change causes real HTTP409');

        await page.click('#nw-emsapps-reload'); await status('Konfiguration geladen');
        assert.equal(await count(), 2);
        await page.click('#ocppMapExisting'); await status('Bitte speichern');
        assert.equal(await count(), 2);
        assert.equal(await save(), 200);
        const stored = JSON.parse(h.states.get(`${h.owner.namespace}.installer.configJson`).val);
        assert.equal(stored.settingsConfig.evcsList.length, 2);
        assert.equal(stored.settingsConfig.evcsList[0].stationKey || '', '');
        assert.equal(stored.settingsConfig.evcsList[0].maxPowerW, 7400);
        assert.deepEqual(stored.settingsConfig.stationGroups, []);
        checks.push('explicit reload resolves conflict; authoritative pair saves with no automatic station groups');
        assert.deepEqual(errors, []);
        process.stdout.write(`${JSON.stringify({ ok: true, checks, pageErrors: errors, postCount: posts.length }, null, 2)}\n`);
    } finally {
        await browser?.close();
        if (server) await new Promise(resolve => server.close(resolve));
        await new Promise(resolve => a.onUnload(resolve));
        await h.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
