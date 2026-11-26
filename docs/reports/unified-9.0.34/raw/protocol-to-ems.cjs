'use strict';
// From the EOS repository root after npm ci (including devDependencies):
// node docs/reports/unified-9.0.34/raw/protocol-to-ems.cjs
// Real module entry points and sockets; synthetic heat pump, grid, budget and ioBroker object/state store.
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const fromRepo = createRequire(path.join(process.cwd(), 'package.json'));
const { DeviceRuntime } = fromRepo('./modules/devices/lib/deviceRuntime');
const { EosDeviceEmsService } = fromRepo('./src/lib/eosDeviceEmsService');
const { planDeviceEms } = fromRepo('./src/lib/eosDeviceEmsPlan');
const { ThermalControlModule } = fromRepo('./ui/ems/modules/thermal-control');
const { DatapointRegistry } = fromRepo('./ui/ems/datapoints');
const { EmsEngine } = fromRepo('./ui/ems/engine');
const { beginSafetyCycle } = fromRepo('./ui/ems/services/safety-envelope');
const { readFlowMeasurement } = fromRepo('./ui/lib/flow-measurement');
const templates = fromRepo('./modules/devices/lib/templates.json').templates;
const ts = fromRepo('typescript');
const until = async (fn, label, max = 6500) => {
    const end = performance.now() + max;
    while (performance.now() < end) {
        if (await fn()) return;
        await new Promise(done => setTimeout(done, 50));
    }
    throw Error('Timed out: ' + label);
};
async function simulate() {
    const samples = new Map([
        [
            110,
            new Map([
                [55076, 0],
                [55077, 12000],
            ]),
        ],
        [111, new Map()],
    ]);
    const fallbacks = new Set(),
        peers = new Set(),
        trace = [],
        unlocked = new Set();
    const byteValue = Buffer.alloc(4);
    function float(uid, start, value) {
        byteValue.writeFloatBE(value);
        samples.get(uid).set(start, byteValue.readUInt16BE(0));
        samples.get(uid).set(start + 1, byteValue.readUInt16BE(2));
    }
    float(111, 56021, 1.73);
    float(111, 56023, 5.9);
    const server = net.createServer(socket => {
        peers.add(socket);
        socket.on('error', () => {}).on('close', () => peers.delete(socket));
        let buffer = Buffer.alloc(0);
        socket.on('data', data => {
            buffer = Buffer.concat([buffer, data]);
            while (buffer.length >= 7 && buffer.length >= 6 + buffer.readUInt16BE(4)) {
                const size = 6 + buffer.readUInt16BE(4),
                    frame = buffer.subarray(0, size);
                buffer = buffer.subarray(size);
                const unit = frame[6],
                    fc = frame[7],
                    addr = frame.readUInt16BE(8),
                    n = frame.readUInt16BE(10);
                let response;
                const row = { unit, fc, addr };
                if (fallbacks.has(unit) || !samples.has(unit)) response = Buffer.from([fc | 128, 11]);
                else if (fc === 16 && addr === 101 && n === 2) {
                    if (frame.readUInt32BE(13) === 12345) unlocked.add(unit);
                    response = frame.subarray(7, 12);
                } else if (fc === 3 && (addr === 100 || unlocked.has(unit))) {
                    response = Buffer.alloc(2 + n * 2);
                    response[0] = 3;
                    response[1] = n * 2;
                    for (let i = 0; i < n; i++)
                        response.writeUInt16BE(
                            addr === 100 ? Number(unlocked.has(unit)) : samples.get(unit).get(addr + i) || 0,
                            2 + i * 2,
                        );
                } else if (unlocked.has(unit) && (fc === 16 || fc === 6)) {
                    const v = fc === 6 ? [n] : Array.from({ length: n }, (_, i) => frame.readUInt16BE(13 + i * 2));
                    for (let i = 0; i < v.length; i++) samples.get(unit).set(addr + i, v[i]);
                    row.value = fc === 6 ? n : frame.readInt32BE(13);
                    response = frame.subarray(7, 12);
                } else response = Buffer.from([fc | 128, 2]);
                row.ok = response[0] === fc;
                trace.push(row);
                const header = Buffer.from(frame.subarray(0, 7));
                header.writeUInt16BE(response.length + 1, 4);
                socket.write(Buffer.concat([header, response]));
            }
        });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return {
        trace,
        peers,
        float,
        samples,
        fallbacks,
        unlocked,
        port: server.address().port,
        close: async () => {
            for (const sock of peers) sock.destroy();
            await new Promise(done => server.close(done));
        },
    };
}
// Only these legacy adapter methods need extraction: main.js intentionally exports only the hosted runtime factory.
function adapt(web, db) {
    const source = fs.readFileSync(path.resolve('ui/main.js'), 'utf8');
    const ast = ts.createSourceFile('main.js', source, ts.ScriptTarget.ES2022, true);
    const wanted = new Set(['nwNormalizeEmsApps', 'nwApplyEmsAppsToLegacyFlags']);
    const methods = [];
    const visit = n => {
        if (ts.isMethodDeclaration(n) && wanted.has(n.name.getText(ast))) methods.push(n.getText(ast));
        ts.forEachChild(n, visit);
    };
    visit(ast);
    const Klass = Function('return class {' + methods.join('\n') + '}')();
    return Object.assign(Object.create(Klass.prototype), web, db);
}
async function main() {
    console.log(
        'EOS ' +
            fromRepo('./package.json').version +
            ' – Node ' +
            process.version +
            ' – simulated OVUM MIRA HSM and WPM on localhost.',
    );
    const sim = await simulate(),
        obj = new Map(),
        state = new Map(),
        runtime = {},
        ns = 'eos-admin.0',
        messages = [];
    const original = Date.now;
    let offset = 0;
    Date.now = () => original() + offset;
    const id = k => (k.startsWith(ns + '.') || k === 'meter.grid' ? k : ns + '.' + k);
    let dp;
    const adapter = adapt(
        { _nwLicenseAllowsAppId: key => key === 'thermal' },
        {
            namespace: ns,
            config: {},
            log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(k => [k, m => messages.push(m)])),
            setObjectNotExistsAsync: async (k, o) => {
                if (!obj.has(id(k))) obj.set(id(k), { ...o, _id: id(k) });
            },
            extendObjectAsync: async (k, patch) => {
                const old = obj.get(id(k)) || {};
                obj.set(id(k), {
                    ...old,
                    ...patch,
                    _id: id(k),
                    native: { ...old.native, ...patch.native },
                    common: { ...old.common, ...patch.common },
                });
            },
            getForeignObjectsAsync: async pattern =>
                Object.fromEntries([...obj].filter(([k]) => k.startsWith(pattern.slice(0, -1)))),
            getObjectAsync: async k => obj.get(id(k)),
            getForeignObjectAsync: async k => obj.get(id(k)),
            getStateAsync: async k => state.get(id(k)),
            getForeignStateAsync: async k => state.get(id(k)),
            setStateAsync: async (k, s, ack) => {
                const v = s && typeof s === 'object' && Object.hasOwn(s, 'val') ? s : { val: s, ack: ack ?? true };
                const st = { q: 0, ts: Date.now(), ...v };
                state.set(id(k), st);
                dp?.handleStateChange(id(k), st, true);
            },
            setForeignStateAsync: async (k, v, ack) => {
                assert.equal(ack, false);
                await runtime.hsm.handleStateChange(k, { val: v, ack: false });
            },
        },
    );
    const requested = {
        requested: true,
        requestId: 'bbcafa54-26c2-4dbf-8463-339321388559',
        limits: { maxPowerW: 2300, miraSources: 'confirmed' },
    };
    const devices = ['hsm', 'wpm'].map((role, i) => ({
        id: role,
        name: 'MIRA ' + role,
        protocol: 'modbusTcp',
        enabled: true,
        templateId: 'heat.ovum.mira.' + role,
        pollIntervalMs: 350,
        connection: { host: '127.0.0.1', port: sim.port, unitId: 110 + i, writePassword: '12345' },
        ems: { mode: 'auto', ...(i === 0 ? { activation: requested } : {}) },
    }));
    try {
        for (const d of devices) {
            const tpl = templates.find(t => t.id === d.templateId);
            runtime[d.id] = new DeviceRuntime(adapter, d, tpl, {});
            await runtime[d.id].initObjects();
            await runtime[d.id].start();
        }
        const snap = { namespace: ns, devices, moduleEnabled: true, generation: 1 };
        const service = new EosDeviceEmsService({ owner: adapter, getSnapshot: () => snap });
        const inv = await service.inventory(snap);
        const plan = planDeviceEms({
            config: {
                datapoints: { gridPointPower: 'meter.grid' },
                installerConfig: { gridConnectionPower: 11000, safetyMeterTimeoutSec: 30 },
                chargingManagement: { staleTimeoutSec: 300 },
            },
            devices: inv,
            allowedApps: ['thermal'],
            referenceMeta: { 'meter.grid': { type: 'number', read: true, unit: 'W' } },
        });
        assert.equal(plan.config.vis.flowSlots.consumers[0].consumerType, 'heatPump', JSON.stringify(plan.statuses));
        assert.equal(plan.config.settings.flowPowerDpIsW.consumer1Power, true);
        adapter.config = adapter.nwApplyEmsAppsToLegacyFlags(plan.config);
        const row = adapter.config.thermal.devices[0];
        assert.equal(row.enabled, true);
        assert.equal(adapter.config.enableThermalControl, true);
        const flow = adapter.config.datapoints.consumer1Power;
        const value = () => Math.round(state.get(flow).val);
        assert.equal(value(), 1730);
        const rec = state.get(flow);
        assert.equal(
            Math.round(
                readFlowMeasurement(
                    { consumer1Power: { value: rec.val, ts: rec.ts, q: rec.q } },
                    'consumer1Power',
                    Date.now(),
                    30000,
                ).value,
            ),
            1730,
        );
        console.log(
            'PASS electrical register 56021 (1.73 kW) → actual WPM alias → commissioned consumer1Power (W) → flow reader: 1730 W. Thermal register is 5.9 kW.',
        );
        dp = new DatapointRegistry(adapter, []);
        const engine = new EmsEngine(adapter);
        engine.dp = dp;
        engine.mm = { tick: async () => {} };
        const thermal = new ThermalControlModule(adapter, dp);
        await thermal.init();
        await dp.upsert({
            key: 'vis.gridNetW',
            objectId: 'meter.grid',
            dataType: 'number',
            direction: 'in',
            unit: 'W',
        });
        for (const k of [flow, row.miraPvStatusReadId, row.miraPowerTargetReadId])
            dp.handleStateChange(k, state.get(k), true);
        await adapter.setStateAsync('thermal.user.c1.regEnabled', true, true);
        await adapter.setStateAsync('thermal.user.c1.mode', 'inherit', true);
        let gen = 0;
        async function tick(block) {
            await adapter.setStateAsync('meter.grid', -4200, true);
            await engine.tick();
            adapter._emsCaps = { grid: { gridImportLimitW_effective: 11000, gridImportLimitW_physical: 11000 } };
            const budget = 4200,
                ts = Date.now();
            adapter._emsBudget = {
                ts,
                peek: () => ({ remainingPvW: budget, remainingTotalW: budget, ts }),
                getPvGrant: () => ({ grantW: budget }),
                getTotalGrant: () => ({ grantW: budget }),
                reserve() {},
            };
            adapter._para14a = { active: !!block };
            beginSafetyCycle(adapter, ++gen, ts);
            await thermal.tick();
        }
        const writes = () =>
            sim.trace
                .filter(x => x.fc !== 3 && x.addr !== 101 && x.ok)
                .map(({ unit, fc, addr, value }) => [unit, fc, addr, value]);
        await tick(false);
        assert.deepEqual(
            writes(),
            [[110, 16, 55076, 2300]],
            JSON.stringify([...state].filter(([k]) => k.includes('reason') || k.includes('stateText'))),
        );
        await until(() => state.get(row.miraPowerTargetReadId).val === 2300, 'target physical echo');
        await tick(false);
        assert.deepEqual(writes().at(-1), [110, 6, 55070, 1]);
        await until(() => state.get(row.miraPvStatusReadId).val === 1, 'mode physical echo');
        for (let i = 0; i < 3; i++) await tick(false);
        assert.equal(writes().length, 2);
        assert.equal(state.get(id('thermal.devices.c1.applied')).val, true);
        console.log(
            'PASS commissioned EMS thermal controller sent FC16 55076=2300 W, then FC06 55070=1 with real FC03 echo. Three unchanged cycles added zero commands.',
        );
        await tick(true);
        assert.deepEqual(writes().at(-1), [110, 6, 55070, 0]);
        await until(() => state.get(row.miraPvStatusReadId).val === 0, 'neutral physical echo');
        await tick(true);
        assert.equal(writes().length, 3);
        assert.ok(Math.abs(state.get(id('thermal.summary.appliedTotalW')).val - 1730) < 1);
        console.log(
            'PASS simulated §14a release sent only FC06 55070=0. Post-release electrical measurement persists at 1730 W.',
        );
        sim.fallbacks.add(111);
        sim.unlocked.delete(111);
        for (const s of sim.peers) s.destroy();
        await until(() => state.get(id('devices.wpm.info.connection'))?.val === false, 'device offline', 11000);
        const before = state.get(flow).ts;
        assert.equal(value(), 1730, 'a lost meter cannot become a fabricated numeric zero');
        offset += 360000;
        await tick(false);
        assert.equal(state.get(flow).ts, before, 'a failed WPM read must not renew the old measurement');
        assert.equal(writes().filter(x => x[2] === 55070 && x[3] === 1).length, 1, 'stale WPM cannot enable PV');
        sim.fallbacks.delete(111);
        sim.float(111, 56021, 0.86);
        await until(
            () => state.get(id('devices.wpm.info.connection'))?.val === true && value() === 860,
            'device recovers',
            15000,
        );
        assert.equal(sim.unlocked.has(111), true);
        assert.ok(state.get(flow).ts > before);
        console.log(
            'PASS disconnected WPM with rejected bus access was marked offline; stale 1730 W could not trigger boost. New login and polling restored 860 W on the same slot.',
        );
        assert.ok(
            writes().every(
                ([uid, fc, reg, value]) =>
                    uid === 110 &&
                    ((fc === 6 && reg === 55070 && (value === 0 || value === 1)) ||
                        (fc === 16 && reg === 55076 && value === 2300)),
            ),
        );
        assert.ok(
            [110, 111].every(unit => sim.trace.some(r => r.unit === unit && r.fc === 16 && r.addr === 101 && r.ok)),
        );
        for (const [index, command] of sim.trace.entries()) {
            if (command.addr === 101 || command.fc === 3 || !command.ok) continue;
            const next = sim.trace
                .slice(index + 1)
                .find(frame => frame.unit === command.unit && frame.fc === 3 && frame.addr === command.addr);
            assert.ok(next?.ok, 'missing physical FC03 read after register ' + command.addr);
        }
        const count = sim.trace.filter(r => r.unit === 111 && r.fc === 16 && r.addr === 101 && r.ok).length;
        assert.ok(count >= 2, 'WPM had to log in again');
        console.log(
            'Control trace ' +
                JSON.stringify(writes()) +
                '. A neutral retry followed the simulated six-minute outage. No nonvolatile parameter was written.',
        );
    } catch (e) {
        console.error('last device log', messages.slice(-8).join('\n').replace(/12345/g, '[redacted]'));
        throw e;
    } finally {
        for (const r of Object.values(runtime)) await r.stop().catch(() => {});
        Date.now = original;
        await sim.close();
    }
}
main().catch(e => {
    console.error(e.stack);
    process.exitCode = 1;
});
