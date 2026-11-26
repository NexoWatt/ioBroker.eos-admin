/* Real Chromium, production backup UI/routes/config-store and secret restoration.
 * Database, authentication, module status and command execution are fixtures.
 * No hardware, remote account, actual backup worker or customer data is accessed. */
'use strict';
/* global document, window, innerWidth, innerHeight */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const express = require('express');
const puppeteer = require('puppeteer');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const { redact, restoreSecrets, SECRET_MARKER } = require('../src/lib/eosModuleHost');
const root = path.resolve(__dirname, '..');
const api = '/api/eos/modules/backup';
const defaults = require('../modules/backup/defaults.json');
const sourceFiles = ['modules/backup/admin/index.js', 'modules/backup/admin/index.html', 'modules/backup/admin/style.css',
    'src/lib/eosModuleHttp.js', 'src/lib/eosModuleConfigStore.js', 'src/lib/eosModuleHost.js', 'test/eos-backup-settings-browser.cjs'];
const optionalKeys = ['jobTimeoutMinutes', 'maxArchiveGiB', 'mountedBackupPath', 'influxDBBucketId', 'influxDBOrganization',
    'influxDBOrganizationId', 'zigbee2mqttProtocol', 'dropboxAccessTokens', 'googledriveAccessJson'];
const numericRanges = { minimalEveryXDays: [1, 365], ccuEveryXDays: [1, 365], minimalDeleteAfter: [0, 3650],
    ccuDeleteAfter: [0, 3650], historyEntriesNumber: [0, 3650], jobTimeoutMinutes: [1, 120], maxArchiveGiB: [1, 100] };
const clone = value => structuredClone(value);
const fail = code => Object.assign(new Error(code), { code });
const until = async (predicate, timeout = 5000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error('Backup browser fixture condition timed out');
};

async function main() {
    const sourceHashes = {};
    for (const file of sourceFiles) sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-backup-settings-browser-'));
    let browser, server, origin = '', authenticated = true, role = 'admin', validationError = '', currentJob = false;
    let gets = 0, saves = 0;
    const checks = [], pageErrors = [], requests = [], commands = [], objects = new Map();
    const csrf = 'backup-fixture-csrf-'.repeat(3);
    let saved = { ...clone(defaults), enabled: false,
        mySqlPassword: 'fixture-existing-password',
        mySqlEvents: [{ host: 'fixture-db', port: '3306', dbName: 'fixture-database', user: 'fixture-user', pass: 'fixture-row-password' }],
        unknownCustomer: { retain: ['alpha', 'beta'], nested: { value: 17 } },
    };
    const original = clone(saved);
    const owner = { namespace: 'eos-admin.0', config: {},
        encrypt: text => `fixture:${Buffer.from(text).toString('base64')}`,
        decrypt: text => { assert.ok(text.startsWith('fixture:')); return Buffer.from(text.slice(8), 'base64').toString(); },
        getForeignObjectAsync: async id => clone(objects.get(id)),
        setForeignObjectAsync: async (id, value) => { objects.set(id, clone(value)); },
    };
    const store = new EosModuleConfigStore(owner, { moduleIds: ['backup'] });
    const persist = async value => {
        await store.save('backup', { v: 1, encrypted: owner.encrypt(JSON.stringify(value)) }); saved = clone(value);
    };
    const view = () => ({ id: 'backup', config: redact(saved), configurationReady: true, configurationLoaded: true,
        configurationRevision: store.revisions.get('backup'), status: { active: true, reason: 'RUNNING', details: {
            current: currentJob ? { id: 'fixture-running-job' } : null, history: [],
            coverage: { complete: true, required: ['iobroker', 'eos-profile', 'postgresql-history'], missing: [], historyProvider: 'postgresql', externalTargetConfigured: false },
        } } });
    const host = { owner,
        view: async id => { assert.equal(id, 'backup'); gets++; return view(); },
        save: async (id, config, _migration, revision) => {
            assert.equal(id, 'backup'); saves++;
            if (revision !== store.revisions.get('backup')) throw fail('EOS_MODULE_CONFIG_CONFLICT');
            if (validationError) throw fail(validationError);
            await persist(restoreSecrets(clone(config), saved)); return view();
        },
        command: async (id, name, payload) => {
            assert.equal(id, 'backup'); commands.push({ name, payload: clone(payload) });
            if (name === 'getSdCardTargets') return [{ mountPoint: '/media/fixture-card', label: 'Fixture SD card' }];
            return { accepted: true };
        },
    };
    try {
        await persist(saved);
        const app = express();
        app.use((req, res, next) => {
            if (req.path.startsWith('/modules/backup/')) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'");
            if (req.method !== 'GET' && req.path.startsWith(api)) requests.push({ method: req.method, path: req.path, csrf: req.headers['x-nw-csrf'] });
            next();
        });
        app.get('/eos-session-idle.js', (_req, res) => res.type('text/javascript').send(''));
        app.get('/system/img/eos/nexowatt-eos-brand-wide.png', (_req, res) => res.sendFile(path.join(root, 'adminWww/img/eos/nexowatt-eos-brand-wide.png')));
        registerEosModuleRoutes({ app, host, baseDir: root, jsonParser: express.json({ limit: '1mb' }),
            authorize: async req => ({ authenticated: authenticated && req.headers.cookie?.includes('backup_fixture=yes') === true, role, csrfToken: csrf }),
            requestAllowed: req => !req.headers.origin || req.headers.origin === origin,
            csrfAllowed: req => req.headers.origin === origin && req.headers['x-nw-csrf'] === csrf,
        });
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        origin = `http://127.0.0.1:${server.address().port}`;
        browser = await puppeteer.launch({ executablePath: process.env.EOS_CHROMIUM_PATH || await puppeteer.executablePath(),
            headless: true, userDataDir: path.join(temp, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
        await page.setCookie({ name: 'backup_fixture', value: 'yes', url: origin });
        await page.setViewport({ width: 1440, height: 1050 });
        const ready = () => page.waitForFunction(() => document.getElementById('saveSettings')?.disabled === false);
        const open = async id => {
            await page.$eval(`#backup-open-${id}`, node => node.scrollIntoView({ block: 'center' }));
            await page.click(`#backup-open-${id}`);
            try { await page.waitForFunction(() => document.getElementById('settingsDialog')?.open === true, { timeout: 5000 }); }
            catch (error) {
                const details = await page.$eval(`#backup-open-${id}`, node => {
                    const rect = node.getBoundingClientRect();
                    return { disabled: node.disabled, active: document.activeElement.id, hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML,
                        message: document.getElementById('message').textContent, draft: document.getElementById('draft-status').textContent };
                });
                throw new Error(`Opening backup card ${id} failed: ${JSON.stringify(details)}; pageErrors=${JSON.stringify(pageErrors)}`, { cause: error });
            }
        };
        const closed = () => page.waitForFunction(() => document.getElementById('settingsDialog')?.open === false && document.querySelectorAll('#dialog-fields [data-config]').length === 0);
        const cancel = async () => { await page.click('#dialog-cancel'); await closed(); };
        const apply = async () => { await page.click('#dialog-form button[type="submit"]'); await closed(); };
        const set = (key, value) => page.$eval(`#field-${key}`, (node, next) => { node.value = String(next); node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
        const keys = () => page.$$eval('#dialog-fields [data-config]', nodes => nodes.map(node => node.dataset.config));
        const save = async () => {
            const count = saves; await page.click('#saveSettings'); await until(() => saves > count); await ready();
        };
        const value = key => page.$eval(`#field-${key}`, node => node.type === 'checkbox' ? node.checked : node.value);
        const reload = async () => { await page.reload(); await ready(); };
        await page.goto(`${origin}/modules/backup/`); await ready();

        const initialFields = await page.$$eval('#settings input,#settings select,#settings textarea,#dialog-fields [data-config]', nodes => nodes.length);
        assert.equal(initialFields, 1, 'only module switch exists before opening a settings dialog');
        const cardIds = await page.$$eval('.backup-card', nodes => nodes.map(node => node.dataset.group));
        for (const id of ['system', 'eos', 'ccu', 'influx', 'mysql', 'postgres', 'sqlite', 'redis', 'local', 'notifications', 'other']) assert.ok(cardIds.includes(id), id);
        const sourceSection = await page.$eval('#backup-open-influx', node => node.closest('.backup-setting-section').querySelector('h3').textContent);
        const targetSection = await page.$eval('#backup-open-local', node => node.closest('.backup-setting-section').querySelector('h3').textContent);
        assert.equal(sourceSection, 'Datenbanken'); assert.equal(targetSection, 'Zusätzliche Speicherziele');
        assert.match(await page.$eval('#backup-open-postgres', node => node.parentElement.textContent), /automatische EOS-Historiensicherung.*nicht ausgeschaltet/s);
        checks.push({ name: 'source and destination cards are separate; automatic EOS PostgreSQL history explained; no advanced editor DOM until opened', result: 'passed' });

        const seen = new Set(); let maximumDialogFields = 0;
        for (const id of cardIds) {
            await open(id);
            const current = await keys(); maximumDialogFields = Math.max(maximumDialogFields, current.length); current.forEach(key => seen.add(key));
            if (id === 'local') assert.deepEqual(current.slice(0, 3), ['cifsEnabled', 'connectType', 'mountedBackupPath']);
            if (id === 'system') assert.deepEqual(current.slice(0, 3), ['minimalEnabled', 'minimalTime', 'minimalEveryXDays']);
            for (const key of current.filter(item => Object.hasOwn(numericRanges, item))) {
                const limits = await page.$eval(`#field-${key}`, node => ({ min: node.min, max: node.max, step: node.step, required: node.required }));
                assert.deepEqual(limits, { min: String(numericRanges[key][0]), max: String(numericRanges[key][1]), step: '1', required: true });
            }
            if (id === 'influx') assert.ok(current.every(key => key.startsWith('influxDB')), 'Influx dialog only contains Influx settings');
            if (id === 'local') assert.ok(!current.some(key => key.startsWith('influxDB')), 'storage dialog must not show database source fields');
            if (id === 'notifications') for (const channel of ['Telegram', 'WhatsApp', 'Gotify', 'Signal', 'Matrix', 'Discord', 'Pushover', 'E-Mail']) {
                await page.select('#field-notificationsType', channel); (await keys()).forEach(key => seen.add(key));
            }
            await cancel();
        }
        for (const key of [...Object.keys(saved).filter(key => key !== 'enabled'), ...optionalKeys]) assert.ok(seen.has(key), `unreachable saved or optional field: ${key}`);
        assert.equal(requests.filter(row => row.method === 'PUT').length, 0);
        assert.equal(await page.$$eval('#dialog-fields [data-config]', nodes => nodes.length), 0);
        checks.push({ name: `all ${Object.keys(saved).length} existing config properties and ${optionalKeys.length} optional fields remain reachable; closed dialogs release their fields`, result: 'passed' });

        await page.click('[data-toggle="mySqlEnabled"]'); await page.click('[data-toggle="cifsEnabled"]');
        assert.equal(await page.$eval('[data-toggle="mySqlEnabled"]', node => node.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.$eval('[data-toggle="pgSqlEnabled"]', node => node.getAttribute('aria-pressed')), 'false');
        assert.equal(saved.mySqlEnabled, false); assert.equal(saved.cifsEnabled, false); assert.equal(saves, 0);
        await open('system'); await set('minimalEveryXDays', 0); await page.click('#dialog-form button[type="submit"]');
        assert.equal(await page.$eval('#settingsDialog', node => node.open), true, 'invalid days must not apply or close the dialog');
        assert.equal(await page.$eval('#field-minimalEveryXDays', node => node.validity.rangeUnderflow), true);
        await set('minimalEveryXDays', 7); await apply();
        await open('system'); assert.equal(await value('minimalEveryXDays'), '7'); await set('minimalEveryXDays', 9); await cancel();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'backup-open-system');
        await open('system'); assert.equal(await value('minimalEveryXDays'), '7'); await set('minimalEveryXDays', 11); await page.keyboard.press('Escape'); await closed();
        assert.equal(await page.evaluate(() => document.activeElement.id), 'backup-open-system');
        await open('system'); assert.equal(await value('minimalEveryXDays'), '7'); await page.click('#dialog-close'); await closed();
        assert.equal(saves, 0);
        checks.push({ name: 'independent card switches and dialog Apply edit only the draft; Cancel, close and Escape discard only dialog edits and restore focus', result: 'passed' });

        await open('mysql');
        assert.equal(await value('mySqlPassword'), '');
        assert.match(await page.$eval('#field-mySqlPassword', node => node.placeholder), /Gespeichert/);
        const rows = JSON.parse(await value('mySqlEvents')); assert.equal(rows[0].pass, SECRET_MARKER);
        await set('mySqlHost', 'db.draft.fixture'); await apply();
        await open('notifications');
        assert.ok((await keys()).every(key => key.startsWith('telegram') || key.startsWith('notification')));
        await page.select('#field-notificationsType', 'E-Mail');
        assert.ok((await keys()).every(key => key.startsWith('email') || key.startsWith('notification')));
        await set('emailReceiver', 'fixture@example.invalid'); await page.select('#field-notificationsType', 'Telegram');
        await page.select('#field-notificationsType', 'E-Mail'); assert.equal(await value('emailReceiver'), 'fixture@example.invalid');
        await page.select('#field-notificationsType', 'Telegram'); await apply();
        await save();
        assert.equal(saved.mySqlPassword, original.mySqlPassword); assert.deepEqual(saved.mySqlEvents, original.mySqlEvents);
        assert.equal(saved.mySqlHost, 'db.draft.fixture'); assert.equal(saved.minimalEveryXDays, 7);
        assert.equal(saved.mySqlEnabled, true); assert.equal(saved.cifsEnabled, true); assert.equal(saved.pgSqlEnabled, false);
        assert.equal(saved.notificationsType, 'Telegram'); assert.equal(saved.emailReceiver, 'fixture@example.invalid');
        assert.equal(saved.whatsappInstance, original.whatsappInstance); assert.deepEqual(saved.unknownCustomer, original.unknownCustomer);
        assert.equal(Object.hasOwn(saved, 'influxDBOrganization'), false, 'opening a dialog must not add absent optional defaults');
        const persisted = await store.load('backup'); assert.deepEqual(JSON.parse(owner.decrypt(persisted.encrypted)), saved);
        assert.equal(objects.get('eos-admin.0.modules.backup.configuration').acl.object, 0x600);
        assert.ok(requests.filter(row => row.method === 'PUT').every(row => row.csrf === csrf));
        checks.push({ name: 'single full save uses production CSRF route and encrypted revision store; untouched secrets, nested markers, unknown fields and unselected notification channels are preserved', result: 'passed' });

        await open('mysql'); await page.$eval('#field-mySqlPassword', node => node.closest('label').querySelector('button').click()); await cancel();
        await open('mysql'); assert.equal(await value('mySqlPassword'), '');
        await set('mySqlPassword', 'fixture-new-password'); await apply(); await save(); assert.equal(saved.mySqlPassword, 'fixture-new-password');
        await open('mysql'); await page.$eval('#field-mySqlPassword', node => node.closest('label').querySelector('button').click()); await apply(); await save(); assert.equal(saved.mySqlPassword, '');
        checks.push({ name: 'saved-secret marker is blank and preserved; explicit replacement and explicit clear work, while Cancel discards a clear', result: 'passed' });

        await open('other'); await set('unknownCustomer', '{invalid');
        await page.click('#dialog-form button[type="submit"]');
        await page.waitForFunction(() => document.getElementById('dialog-message').textContent.includes('gültiges JSON'));
        assert.equal(await page.$eval('#settingsDialog', node => node.open), true);
        await cancel(); await open('other'); assert.deepEqual(JSON.parse(await value('unknownCustomer')), original.unknownCustomer); await cancel();
        checks.push({ name: 'invalid JSON stays inside its dialog without applying or losing the existing unknown customer object', result: 'passed' });

        currentJob = true; await page.click('#refresh'); await ready(); await open('system'); await set('minimalEveryXDays', 12);
        const readBefore = gets;
        await page.$eval('#field-minimalEveryXDays', node => { window.__backupFieldIdentity = node; });
        await persist({ ...saved, minimalTime: '03:45' });
        await until(() => gets > readBefore, 6000);
        assert.equal(await value('minimalEveryXDays'), '12');
        assert.equal(await page.$eval('#field-minimalEveryXDays', node => node === window.__backupFieldIdentity), true);
        currentJob = false; await apply(); await save();
        assert.match(await page.$eval('#message', node => node.textContent), /inzwischen geändert/);
        await open('system'); assert.equal(await value('minimalEveryXDays'), '12'); await cancel();
        assert.equal(saved.minimalEveryXDays, 7); assert.equal(saved.minimalTime, '03:45');
        checks.push({ name: 'background status refresh preserves a live dialog and draft revision; concurrent committed change causes CAS conflict without overwriting draft', result: 'passed' });
        await reload();

        await page.click('[data-toggle="redisEnabled"]'); validationError = 'EOS_BACKUP_SOURCE_PATH'; await save();
        assert.match(await page.$eval('#message', node => node.textContent), /absoluter lokaler Pfad/);
        assert.equal(await page.$eval('[data-toggle="redisEnabled"]', node => node.getAttribute('aria-pressed')), 'true'); assert.equal(saved.redisEnabled, false);
        validationError = ''; authenticated = false;
        await page.click('#saveSettings'); await page.waitForFunction(() => document.getElementById('message').textContent.includes('Sitzung abgelaufen'));
        await ready(); assert.equal(saved.redisEnabled, false);
        authenticated = true; role = 'enduser';
        await page.click('#saveSettings'); await page.waitForFunction(() => document.getElementById('message').textContent.includes('ADMIN_REQUIRED')); await ready();
        assert.equal(saved.redisEnabled, false); role = 'admin';
        const callsBeforeCsrf = saves;
        const csrfDenied = await page.evaluate(async url => {
            const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: {} }) });
            return response.status;
        }, api);
        assert.equal(csrfDenied, 403); assert.equal(saves, callsBeforeCsrf);
        await save(); assert.equal(saved.redisEnabled, true);
        checks.push({ name: 'validation, session expiry, role loss and CSRF rejection leave unsaved switches intact; retry after restored authority saves the same draft', result: 'passed' });

        await open('local'); await page.click('#scanSd');
        await page.waitForSelector('#sdTargets option'); assert.equal(await page.$eval('#sdTargets option', node => node.value), '/media/fixture-card');
        assert.deepEqual(commands.at(-1), { name: 'getSdCardTargets', payload: {} }); await cancel();
        checks.push({ name: 'SD-card discovery still uses the guarded production command route and populates only the local-target dialog', result: 'passed' });

        for (const [width, height] of [[390, 844], [1024, 768]]) {
            await page.setViewport({ width, height });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await open('local');
            assert.equal(await page.evaluate(() => {
                const dialog = document.getElementById('settingsDialog'), rect = dialog.getBoundingClientRect();
                return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1 && dialog.scrollWidth <= dialog.clientWidth + 1;
            }), true, `modal fits ${width}px viewport`);
            await page.focus('#dialog-close'); await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.getElementById('settingsDialog').contains(document.activeElement)), true);
            await page.focus('#dialog-close'); await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
            assert.equal(await page.evaluate(() => document.getElementById('settingsDialog').contains(document.activeElement)), true);
            assert.equal(await page.$eval('#dialog-cancel', node => node.getBoundingClientRect().height >= 44), true);
            if (process.env.EOS_BROWSER_SCREENSHOT_DIR) {
                await fs.mkdir(process.env.EOS_BROWSER_SCREENSHOT_DIR, { recursive: true });
                await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, `backup-settings-${width}-dialog.png`) });
            }
            await page.keyboard.press('Escape'); await closed();
            assert.equal(await page.evaluate(() => document.activeElement.id), 'backup-open-local');
            if (process.env.EOS_BROWSER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.EOS_BROWSER_SCREENSHOT_DIR, `backup-settings-${width}-cards.png`) });
        }
        checks.push({ name: '390px mobile and 1024px tablet keep modal within viewport, focus inside, Escape restores opener and controls meet 44px target height', result: 'passed' });
        assert.deepEqual(pageErrors, []);
        for (const file of sourceFiles) assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'),
            sourceHashes[file], `source changed during browser run: ${file}`);
        console.log(JSON.stringify({ result: 'passed', runAt: new Date().toISOString(), node: process.version, browser: await browser.version(),
            scope: 'Real Chromium, production backup UI, HTTP routes, protected config store and secret restoration. Synthetic DB/auth/module status and commands. Strict self-only script/style CSP imposed by fixture. No backup worker or hardware.',
            checks, pageErrors, editorDom: { existingConfigurationProperties: Object.keys(original).length,
                previousEagerEditorRule: 'One form editor for every configuration property, including all advanced values',
                initialSettingEditors: initialFields, maximumSingleDialogEditors: maximumDialogFields,
                closedDialogEditors: await page.$$eval('#dialog-fields [data-config]', nodes => nodes.length),
                scope: 'DOM field count only; no process RAM benchmark.' }, sourceHashes }, null, 2));
    } finally {
        if (browser) await browser.close();
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        await fs.rm(temp, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
