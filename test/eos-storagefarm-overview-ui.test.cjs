/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '../ui/src-ts/runtime-executables/www/storagefarm-summary.ts'), 'utf8'), { mode: 'transform' });
const html = fs.readFileSync(path.join(__dirname, '../ui/www/storagefarm.html'), 'utf8');
const htmlIds = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), match => match[1]));
const now = 1800000000000;
const overview = () => ({ v: 1, updatedAt: now, members: { total: 2, fresh: 2 },
    battery: { netW: 1000, chargeW: 1000, dischargeW: 2000, valid: 2, total: 2, complete: true },
    soc: { meanPct: 50, valid: 2, total: 2, complete: true },
    capacity: { totalKWh: 30, knownKWh: 30, valid: 2, total: 2, complete: true },
    pv: { powerW: 4000, valid: 1, total: 1, complete: true } });
function browser() {
    const elements = new Map();
    const node = id => { assert.ok(htmlIds.has(id), `Rendered element ${id} exists in the shipped HTML`); if (!elements.has(id)) elements.set(id, { textContent: '', dataset: {} }); return elements.get(id); };
    const window = {};
    vm.runInNewContext(source, { window, document: { getElementById: node } });
    return { node, render(data, connected = true, time = now) { window.NWStorageFarmSummary.render({ 'storageFarm.overviewJson': { value: JSON.stringify(data) },
        'storageFarm.totalPowerW': { value: 999999999 }, 'storageFarm.totalSoc': { value: 99 } }, connected, time); },
        raw(snapshot) { window.NWStorageFarmSummary.render(snapshot, true, now); } };
}

test('atomic farm overview displays physical battery gross totals, configured capacity and arithmetic SoC', () => {
    const f = browser(); f.render(overview());
    assert.equal(f.node('sf_capacity_value').textContent, '30 kWh');
    assert.equal(f.node('sf_soc_value').textContent, '50 %');
    assert.match(f.node('sf_soc_detail').textContent, /arithmetisch, nicht kapazitätsgewichtet/);
    assert.equal(f.node('sf_net_value').textContent, 'Entladen 1 kW');
    assert.equal(f.node('sf_charge_value').textContent, '1 kW');
    assert.equal(f.node('sf_discharge_value').textContent, '2 kW');
    assert.equal(f.node('sf_pv_value').textContent, '4 kW');
    assert.equal(f.node('sf_members').textContent, '2 / 2 aktuell');
    assert.equal(f.node('sf_metric_net').dataset.quality, 'complete');
});

test('partial coverage suppresses full power sums and explicitly labels partial capacity and SoC mean', () => {
    const f = browser(), data = overview();
    data.members.fresh = 1;
    data.battery = { ...data.battery, valid: 1, complete: false, netW: null, chargeW: null, dischargeW: null };
    data.soc = { ...data.soc, valid: 1, complete: false, meanPct: 75 };
    data.capacity = { ...data.capacity, valid: 1, complete: false, totalKWh: null, knownKWh: 10 };
    data.pv = { ...data.pv, valid: 0, complete: false, powerW: null };
    f.render(data);
    for (const key of ['net', 'charge', 'discharge', 'pv']) assert.equal(f.node(`sf_${key}_value`).textContent, '—');
    assert.equal(f.node('sf_capacity_label').textContent, 'Bekannte Kapazität');
    assert.equal(f.node('sf_capacity_value').textContent, '10 kWh');
    assert.equal(f.node('sf_soc_label').textContent, 'Ø Ladezustand · Teilmittel');
    assert.equal(f.node('sf_soc_value').textContent, '75 %');
    assert.equal(f.node('sf_members').textContent, '1 / 2 aktuell');
    assert.match(f.node('sf_aggregate_hint').textContent, /Teilsummen und Teilmittel/);
});

test('lost connection and aged snapshots clear live totals without presenting unknown values as zero', () => {
    const f = browser();
    f.render(overview(), false);
    assert.equal(f.node('sf_net_value').textContent, '—'); assert.equal(f.node('sf_soc_value').textContent, '—');
    assert.equal(f.node('sf_capacity_value').textContent, '30 kWh');
    assert.match(f.node('sf_capacity_detail').textContent, /zuletzt bestätigte Konfiguration/);
    f.render(overview(), true, now + 30001);
    assert.equal(f.node('sf_metric_net').dataset.quality, 'stale');
    assert.match(f.node('sf_summary').textContent, /veraltet/);
    f.raw({ 'storageFarm.totalPowerW': { value: 42 }, 'storageFarm.totalSoc': { value: 80 } });
    assert.equal(f.node('sf_net_value').textContent, '—', 'legacy converter/controller totals are never used as physical battery totals');
    assert.equal(f.node('sf_soc_value').textContent, '—');
});

test('true zero remains visible while null totals, unsupported payloads and absent PV sources remain unavailable', () => {
    const f = browser(), data = overview();
    Object.assign(data.battery, { netW: 0, chargeW: 0, dischargeW: 0 }); data.soc.meanPct = 0;
    data.pv = { valid: 0, total: 0, complete: false, powerW: null };
    f.render(data);
    assert.equal(f.node('sf_net_value').textContent, '0 W'); assert.equal(f.node('sf_soc_value').textContent, '0 %');
    assert.equal(f.node('sf_pv_value').textContent, '—'); assert.match(f.node('sf_pv_detail').textContent, /Keine PV-Quelle/);
    data.battery.netW = null; f.render(data);
    assert.equal(f.node('sf_metric_net').dataset.quality, 'partial'); assert.equal(f.node('sf_charge_value').textContent, '—');
    data.members.total = '<img src=x>'; f.render(data);
    assert.equal(f.node('sf_members').textContent, '— / — aktuell');
    assert.doesNotMatch(f.node('sf_summary').textContent, /<img/);
    f.render({ ...overview(), v: 2 }); assert.equal(f.node('sf_net_value').textContent, '—');
});

test('real aggregation helper and UI agree on counterflow, partial metrics and independently deduplicated PV sources', () => {
    const { buildFarmOverview } = require('../ui/src-ts/runtime-executables/lib/storage-farm-overview.ts');
    const f = browser();
    const members = [
        { key: 'a', fresh: true, batteryPowerW: -3000, socPct: 20, capacityKWh: 10 },
        { key: 'b', fresh: true, batteryPowerW: 1000, socPct: 80, capacityKWh: 30 },
    ];
    f.render(buildFarmOverview(members, [{ key: 'pv-a', powerW: 1000 }, { key: 'pv-b', powerW: 2000 }, { key: 'pv-c', powerW: 500 }], now));
    assert.equal(f.node('sf_net_value').textContent, 'Laden 2 kW');
    assert.equal(f.node('sf_charge_value').textContent, '3 kW');
    assert.equal(f.node('sf_discharge_value').textContent, '1 kW');
    assert.equal(f.node('sf_capacity_value').textContent, '40 kWh');
    assert.equal(f.node('sf_soc_value').textContent, '50 %', 'the display does not claim the 65% capacity-weighted mean');
    assert.equal(f.node('sf_pv_value').textContent, '3,5 kW');
    assert.match(f.node('sf_pv_detail').textContent, /3 \/ 3/);
    members[1] = { ...members[1], fresh: false, batteryPowerW: null, socPct: null, capacityKWh: null };
    f.render(buildFarmOverview(members, [], now));
    assert.equal(f.node('sf_net_value').textContent, '—');
    assert.equal(f.node('sf_soc_value').textContent, '20 %');
    assert.match(f.node('sf_soc_label').textContent, /Teilmittel/);
    assert.equal(f.node('sf_capacity_label').textContent, 'Bekannte Kapazität');
});


test('App-Center farm links directly to the complete overview in the same tab', () => {
    const appCenter = fs.readFileSync(path.join(__dirname, '../ui/www/ems-apps.html'), 'utf8');
    const link = appCenter.match(/<a\s[^>]*id="storageFarmOverviewLink"[^>]*>[\s\S]*?<\/a>/);
    assert.ok(link); assert.match(link[0], /href="storagefarm.html"/); assert.doesNotMatch(link[0], /target=/);
    assert.ok(html.indexOf('/static/storagefarm-summary.js') < html.indexOf('/static/storagefarm.js'), 'strict summary renderer loads before the page invokes it');
});
