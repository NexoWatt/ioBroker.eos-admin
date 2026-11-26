'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { remapChargingStationAssignments: remap } = require('../ui/lib/charging-station-identity');
const row = name => ({ name, powerId: `test.${name}.power`, setCurrentAId: `test.${name}.current` });
const pointA = row('A'), pointB = row('B'), pointC = row('C');
function frozen(value) {
    if (value && typeof value === 'object') { Object.freeze(value); for (const entry of Object.values(value)) frozen(entry); }
    return value;
}

test('deleting A removes A station rights and moves B station rights to B’s new slot without mutating input', () => {
    const config = frozen({ enabled: true, stations: [
        { id: 'a', token: 'a-secret', assignmentMode: 'manual', assignedChargepoints: ['lp1'], name: 'A display' },
        { id: 'b', token: 'b-secret', assignmentMode: 'manual', assignedChargepoints: ['lp2'] },
    ] });
    const result = remap([pointA, pointB], [pointB], config, config);
    assert.deepEqual(result.stations[0], { ...config.stations[0], assignedChargepoints: [] });
    assert.deepEqual(result.stations[1], { ...config.stations[1], assignedChargepoints: ['lp1'] });
    assert.deepEqual(config.stations.map(station => station.assignedChargepoints), [['lp1'], ['lp2']]);
    assert.notEqual(result, config);
});

test('automatic station mode also removes stale manual fallbacks and preserves device-key assignment', () => {
    const config = { stations: [
        { id: 'a', stationKey: 'ocpp.a', assignmentMode: 'station', chargepoints: ['lp1'], lps: ['lp1'] },
        { id: 'b', stationKey: 'ocpp.b', assignmentMode: 'station', lps: ['lp2'] },
    ] };
    const result = remap([pointA, pointB], [pointB], config, config);
    assert.deepEqual(result.stations, [
        { id: 'a', stationKey: 'ocpp.a', assignmentMode: 'station', assignedChargepoints: [] },
        { id: 'b', stationKey: 'ocpp.b', assignmentMode: 'station', assignedChargepoints: ['lp1'] },
    ]);
});

test('explicitly changed and newly added station lists remain assigned to the requested new layout', () => {
    const previous = { stations: [{ id: 'existing', assignedChargepoints: ['lp1', 'lp2'] }] };
    const submitted = frozen({ stations: [
        { id: 'existing', assignedChargepoints: ['lp1'] },
        { id: 'new', assignedChargepoints: ['lp1'] },
    ] });
    assert.equal(remap([pointA, pointB], [pointB], previous, submitted), submitted);
});

test('sorting an unchanged permission set cannot grant the next unassigned charger after deletion', () => {
    const previous = { stations: [{ id: 'display', assignedChargepoints: ['lp2', 'lp1'] }] };
    const submitted = { stations: [{ id: 'display', assignedChargepoints: ['lp1', 'lp2'] }] };
    const result = remap([pointA, pointB, pointC], [pointB, pointC], previous, submitted);
    assert.deepEqual(result.stations[0].assignedChargepoints, ['lp1'], 'only B remains assigned; the old lp2 must not grant C');
});

test('station identifiers use the same canonical aliases as the display when station order changes', () => {
    const previous = { stations: [
        { key: ' First Display ', chargepoints: ['connector 2', 'lp2'] },
        { stationId: 'second', assignedChargepoints: ['lp1'] },
        { infrastructureStationKey: 'external.source', lps: ['2'] },
    ] };
    const submitted = { stations: [previous.stations[1], previous.stations[0], previous.stations[2]] };
    const result = remap([pointA, pointB], [pointB], previous, submitted);
    assert.deepEqual(result.stations.map(station => station.assignedChargepoints), [[], ['lp1'], ['lp1']]);
    assert.equal(Object.hasOwn(result.stations[1], 'chargepoints'), false);
    assert.equal(Object.hasOwn(result.stations[2], 'lps'), false);
});

test('unchanged layouts and unchanged assignment slots retain the original object and do not generate saves', () => {
    const config = { stations: [{ id: 'a', assignedChargepoints: ['lp1'] }] };
    assert.equal(remap([pointA, pointB], [{ ...pointA, name: 'renamed' }, pointB], config, config), config);
    assert.equal(remap([pointA, pointB], [pointA, pointC], config, config), config);
    assert.equal(remap([pointA], [pointB], undefined, undefined), undefined);
});

test('reordering two devices transfers each existing station and does not revive permissions when a removed device returns', () => {
    const original = { stations: [{ id: 'a', assignedChargepoints: ['lp1'] }, { id: 'b', assignedChargepoints: ['lp2'] }] };
    const swapped = remap([pointA, pointB], [pointB, pointA], original, original);
    assert.deepEqual(swapped.stations.map(station => station.assignedChargepoints), [['lp2'], ['lp1']]);
    const removed = remap([pointB, pointA], [pointB], swapped, swapped);
    const returned = remap([pointB], [pointA, pointB], removed, removed);
    assert.deepEqual(returned.stations.map(station => station.assignedChargepoints), [[], ['lp2']]);
});

test('unknown old device identity cannot grant control over a replacement', () => {
    const config = { stations: [{ id: 'a', assignedChargepoints: ['lp1', 'lp2', 'lp50'] }] };
    const result = remap([{}, pointB], [pointA, pointB], config, config);
    assert.deepEqual(result.stations[0].assignedChargepoints, ['lp2']);
});

test('ambiguous or unbounded station configuration fails closed before remapping', () => {
    for (const config of [
        { stations: [{ id: 'duplicate' }, { key: 'DUPLICATE' }] },
        { stations: [{ id: 'a', assignedChargepoints: Array(51).fill('lp1') }] },
        { stations: [{ id: 'a', assignedChargepoints: [{}] }] },
    ]) assert.throws(() => remap([pointA], [pointB], config, config), { code: 'EOS_EVCS_STATION_ASSIGNMENTS_INVALID' });
    // The shared layout binder rejects an oversized bridge/station context
    // before station-specific assignment validation is reached.
    const oversized = { stations: Array.from({ length: 101 }, (_, index) => ({ id: `station${index}`, assignedChargepoints: [] })) };
    assert.throws(() => remap([pointA], [pointB], oversized, oversized), { code: 'EOS_EVCS_IDENTITY_LAYOUT_INVALID' });
    assert.throws(() => remap([pointA], Array(51).fill(pointB), {}, {}), { code: 'EOS_EVCS_IDENTITY_LAYOUT_INVALID' });
    assert.throws(() => remap([pointA], [pointB, pointB], {}, {}), { code: 'EOS_EVCS_IDENTITY_AMBIGUOUS' });
});
