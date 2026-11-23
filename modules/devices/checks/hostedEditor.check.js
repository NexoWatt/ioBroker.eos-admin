'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '../../..');

test('full hosted device editor loads profiles, edits and saves through the authenticated host contract', async t => {
    const errors = []; const received = [];
    let config = { enabled: false, pollIntervalMs: 5000, modbusTimeoutMs: 2000, registerAddressOffset: 0,
        devices: [{ id: 'battery1', enabled: true, name: 'Initial', category: 'BATTERY', templateId: 'battery.bmw.BatteryBmwImpl', protocol: 'modbusTcp', connection: { host: '192.0.2.1', port: 502, unitId: 1, password: '__EOS_SECRET_UNCHANGED__', customRetainedOption: 7 } }] };
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
    for (const file of ['host-bridge.js', 'index_m.js', 'style.css', 'words.js']) assets[`/modules/devices/${file}`] = `modules/devices/admin/${file}`;
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname.startsWith('/api/eos/modules/devices')) {
                res.setHeader('Content-Type', 'application/json');
                if (req.method === 'GET') { res.end(JSON.stringify({ config, status: { state: 'disabled' }, csrfToken: 'test-csrf' })); return; }
                assert.equal(req.headers['x-nw-csrf'], 'test-csrf');
                let body = ''; for await (const chunk of req) body += chunk;
                const input = JSON.parse(body); received.push({ method: req.method, path: url.pathname, input });
                if (req.method === 'PUT') config = input.config;
                res.end(JSON.stringify(url.pathname.endsWith('/command') ? { result: [] } : { ok: true })); return;
            }
            const asset = assets[url.pathname];
            if (!asset) { res.writeHead(404).end(); return; }
            const extension = path.extname(asset);
            res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' })[extension]);
            res.end(await fs.readFile(path.join(root, asset)));
        } catch (error) { errors.push(String(error)); res.writeHead(500).end(); }
    });
    server.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    t.after(() => browser.close());
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1280, height: 850 });
    await page.goto(`http://127.0.0.1:${server.address().port}/modules/devices/`);
    await page.waitForFunction(() => Number(document.getElementById('tplCount').textContent) > 100);
    assert.equal(await page.$eval('a[href="/system/"]', element => element.textContent), 'EOS Administration');
    await page.click('a[href="#tabDevices"]');
    await page.waitForSelector('[data-action="edit"]', { visible: true });
    await page.click('[data-action="edit"]');
    await page.waitForSelector('#dev_name', { visible: true });
    await page.$eval('#dev_name', element => { element.value = 'Updated in EOS'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#btnSaveDevice');
    await page.click('#eosModuleSave');
    await page.waitForFunction(() => document.getElementById('eosModuleStatus').textContent.startsWith('Gerätemodul:'));
    assert.equal(config.devices[0].name, 'Updated in EOS');
    assert.equal(config.devices[0].connection.password, '__EOS_SECRET_UNCHANGED__');
    assert.equal(config.devices[0].connection.customRetainedOption, 7);
    assert.equal(config.enabled, false);
    assert.ok(received.some(request => request.method === 'PUT'));
    assert.deepEqual(errors, []);
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.$eval('#eosModuleSave', element => element.getBoundingClientRect().right <= innerWidth), true);
});
