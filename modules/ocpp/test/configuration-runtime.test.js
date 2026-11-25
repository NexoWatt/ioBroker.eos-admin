'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { configurationStateKey2 } = require('../ocpp/configuration');

class StubAdapter {
  constructor() {
    this.namespace = 'ocpp21.0';
    this.instance = 0;
    this.config = {
      connectorDetails: false,
      createTechnicalAliases: false,
      cleanupLegacyObjects: false,
      cleanupLegacySubfolders: false,
      configurationWriteEnabled: true,
      allowConfigurationDuringCharging: false,
      autoConfigurationRefresh: false,
      configurationRefreshDelaySec: 15,
      configurationReportTimeoutSec: 120,
      callTimeoutSec: 5,
      heartbeatIntervalSec: 300,
      smartChargingMinIntervalMs: 1000,
      smartChargingDeadbandW: 100,
      smartChargingDeadbandA: 0.2,
      smartChargingConnectorId: 1,
      minimumChargingCurrentA: 6,
      nominalVoltageV: 230,
      zeroLimitBehavior: 'keepLast',
    };
    this.log = { debug() {}, info() {}, warn() {}, error() {} };
    this.objects = new Map();
    this.states = new Map();
  }

  on() {}
  async setObjectNotExistsAsync(id, obj) {
    if (!this.objects.has(id)) this.objects.set(id, structuredClone(obj));
  }
  async extendObjectAsync(id, patch) {
    const current = this.objects.get(id) || {};
    const currentNative = current.native || {};
    const patchNative = structuredClone(patch.native || {});
    const mergedNative = { ...currentNative, ...patchNative };
    if (currentNative.ocppConfiguration || patchNative.ocppConfiguration) {
      mergedNative.ocppConfiguration = {
        ...(currentNative.ocppConfiguration || {}),
        ...(patchNative.ocppConfiguration || {}),
      };
    }
    this.objects.set(id, {
      ...current,
      ...structuredClone(patch),
      common: { ...(current.common || {}), ...structuredClone(patch.common || {}) },
      native: mergedNative,
    });
  }
  async getObjectAsync(id) { return this.objects.get(id); }
  async getObjectViewAsync(_design, _search, options = {}) {
    const startkey = String(options.startkey || '');
    const endkey = String(options.endkey || '\uffff');
    const rows = [];
    for (const [id, value] of this.objects.entries()) {
      const fullId = id.startsWith(`${this.namespace}.`) ? id : `${this.namespace}.${id}`;
      if (fullId < startkey || fullId > endkey) continue;
      rows.push({ id: fullId, value: structuredClone(value) });
    }
    rows.sort((a, b) => a.id.localeCompare(b.id));
    return { rows };
  }
  async setStateAsync(id, state) { this.states.set(id, { ...state }); }
  async getStateAsync(id) { return this.states.get(id); }
  async delObjectAsync() {}
  async delForeignObjectAsync() {}
  async setForeignObjectNotExistsAsync() {}
  async getForeignObjectAsync() { return undefined; }
}

const { createOcppRuntime } = require('../runtime');
const Runtime = createOcppRuntime(StubAdapter);
const createAdapter = options => new Runtime(options);

function prepareAdapter(identity, protocol, responder) {
  const adapter = createAdapter({});
  adapter._identityStructureReady.add(identity);
  adapter._connectorCleanupDone.add(identity);
  adapter._aliasDone.add(identity);
  adapter._stateToRawIdentity.set(identity, identity);
  const calls = [];
  const client = {
    async call(method, payload) {
      calls.push({ method, payload: structuredClone(payload) });
      return responder(method, payload, calls);
    },
    async close() {},
  };
  adapter._indexClient(identity, protocol, client, identity);
  return { adapter, calls, client };
}

test('OCPP 1.6 configuration inventory stays flat and writable values use ChangeConfiguration', async () => {
  let heartbeat = '60';
  const { adapter, calls } = prepareAdapter('station16', 'ocpp1.6', async (method, payload) => {
    if (method === 'GetConfiguration') {
      return { configurationKey: [
        { key: 'HeartbeatInterval', readonly: false, value: heartbeat },
        { key: 'NumberOfConnectors', readonly: true, value: '2' },
      ] };
    }
    if (method === 'ChangeConfiguration') {
      assert.equal(payload.key, 'HeartbeatInterval');
      heartbeat = payload.value;
      return { status: 'Accepted' };
    }
    throw new Error(`Unexpected call ${method}`);
  });

  await adapter._refreshConfiguration('station16');
  const stateId = 'station16.configuration.HeartbeatInterval';
  assert.equal(adapter.states.get(stateId).val, 60);
  assert.equal(adapter.objects.get(stateId).common.write, true);
  assert.equal(adapter.objects.get('station16.configuration.NumberOfConnectors').common.write, false);
  assert.equal([...adapter.objects.keys()].some((id) => id.startsWith(`${stateId}.`)), false);

  await adapter._writeConfigurationValue('station16', stateId, 120);
  assert.equal(adapter.states.get(stateId).val, 120);
  assert.equal(adapter.states.get('station16.configuration.lastChangeStatus').val, 'Accepted');
  assert.deepEqual(calls.map((entry) => entry.method), ['GetConfiguration', 'ChangeConfiguration']);
});

test('OCPP 2.x configuration inventory completes through NotifyReport and writes with SetVariables', async () => {
  const component = { name: 'ChargingStation' };
  const variable = { name: 'HeartbeatInterval' };
  const { adapter, calls } = prepareAdapter('station21', 'ocpp2.1', async (method) => {
    if (method === 'GetBaseReport') return { status: 'Accepted' };
    if (method === 'SetVariables') {
      return { setVariableResult: [{
        attributeStatus: 'Accepted',
        attributeType: 'Actual',
        component,
        variable,
      }] };
    }
    throw new Error(`Unexpected call ${method}`);
  });

  await adapter._refreshConfiguration('station21');
  const requestId = calls[0].payload.requestId;
  assert.equal(adapter.states.get('station21.configuration.reportInProgress').val, true);
  await adapter.ingestNotifyReport('station21', 'ocpp2.1', {
    requestId,
    generatedAt: new Date().toISOString(),
    seqNo: 0,
    tbc: false,
    reportData: [{
      component,
      variable,
      variableAttribute: [{ type: 'Actual', value: '300', mutability: 'ReadWrite', persistent: true }],
      variableCharacteristics: { dataType: 'integer', unit: 's', minLimit: 10, maxLimit: 3600 },
    }],
  });

  const stateKey = configurationStateKey2(component, variable, 'Actual');
  const stateId = `station21.configuration.${stateKey}`;
  assert.equal(adapter.states.get(stateId).val, 300);
  assert.equal(adapter.states.get('station21.configuration.reportInProgress').val, false);
  assert.equal(adapter.states.get('station21.configuration.status').val, 'ready');
  assert.equal(adapter.states.get('station21.configuration.count').val, 1);
  assert.equal(adapter.objects.get(stateId).common.write, true);

  await adapter._writeConfigurationValue('station21', stateId, 180);
  assert.equal(adapter.states.get(stateId).val, 180);
  assert.deepEqual(calls.map((entry) => entry.method), ['GetBaseReport', 'SetVariables']);
});

test('rejected configuration writes restore the last station-confirmed value', async () => {
  const { adapter } = prepareAdapter('stationReject', 'ocpp1.6', async (method) => {
    if (method === 'GetConfiguration') return { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '60' }] };
    if (method === 'ChangeConfiguration') return { status: 'Rejected' };
    throw new Error(`Unexpected call ${method}`);
  });
  await adapter._refreshConfiguration('stationReject');
  const stateId = 'stationReject.configuration.HeartbeatInterval';
  await assert.rejects(adapter._writeConfigurationValue('stationReject', stateId, 120), /Rejected/);
  assert.equal(adapter.states.get(stateId).val, 60);
  assert.equal(adapter.states.get('stationReject.configuration.status').val, 'write-error');
});

test('values missing from a later complete inventory remain visible but become stale and read-only', async () => {
  let round = 0;
  const { adapter } = prepareAdapter('stationStale', 'ocpp1.6', async (method) => {
    if (method !== 'GetConfiguration') throw new Error(`Unexpected call ${method}`);
    round++;
    return round === 1
      ? { configurationKey: [
          { key: 'HeartbeatInterval', readonly: false, value: '60' },
          { key: 'MeterValueSampleInterval', readonly: false, value: '10' },
        ] }
      : { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '120' }] };
  });

  await adapter._refreshConfiguration('stationStale');
  await adapter._refreshConfiguration('stationStale');

  const staleId = 'stationStale.configuration.MeterValueSampleInterval';
  const staleObject = adapter.objects.get(staleId);
  assert.equal(staleObject.common.write, false);
  assert.equal(staleObject.native.ocppConfiguration.stale, true);
  await assert.rejects(adapter._writeConfigurationValue('stationStale', staleId, 20), /read-only/);
  assert.equal(adapter.states.get(staleId).val, 10);
  assert.equal(adapter.states.get('stationStale.configuration.count').val, 1);
});

test('sensitive configuration values are write-only locally and never persisted in clear text', async () => {
  let stationSecret = 'secret-from-station';
  const { adapter, calls } = prepareAdapter('stationSecret', 'ocpp1.6', async (method, payload) => {
    if (method === 'GetConfiguration') {
      return { configurationKey: [{ key: 'AuthorizationKey', readonly: false, value: stationSecret }] };
    }
    if (method === 'ChangeConfiguration') {
      stationSecret = payload.value;
      return { status: 'Accepted' };
    }
    throw new Error(`Unexpected call ${method}`);
  });

  await adapter._refreshConfiguration('stationSecret');
  const stateId = 'stationSecret.configuration.AuthorizationKey';
  assert.equal(adapter.states.get(stateId).val, '');
  assert.equal(adapter.objects.get(stateId).common.read, false);
  assert.equal(adapter.objects.get(stateId).common.write, true);
  assert.equal(JSON.stringify(adapter.objects.get(stateId)).includes('secret-from-station'), false);
  assert.equal(JSON.stringify([...adapter.states.entries()]).includes('secret-from-station'), false);

  await adapter._writeConfigurationValue('stationSecret', stateId, 'replacement-secret');
  assert.equal(calls.find((entry) => entry.method === 'ChangeConfiguration').payload.value, 'replacement-secret');
  assert.equal(adapter.states.get(stateId).val, '');
  assert.equal(JSON.stringify(adapter.objects.get(stateId)).includes('replacement-secret'), false);
});

test('RebootRequired stays latched until a later BootNotification and never sends Reset', async () => {
  let writeCount = 0;
  const { adapter, calls } = prepareAdapter('stationReboot', 'ocpp1.6', async (method) => {
    if (method === 'GetConfiguration') {
      return { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '60' }] };
    }
    if (method === 'ChangeConfiguration') {
      writeCount++;
      return { status: writeCount === 1 ? 'RebootRequired' : 'Accepted' };
    }
    throw new Error(`Unexpected call ${method}`);
  });

  await adapter._refreshConfiguration('stationReboot');
  const stateId = 'stationReboot.configuration.HeartbeatInterval';
  await adapter._writeConfigurationValue('stationReboot', stateId, 120);
  assert.equal(adapter.states.get('stationReboot.configuration.rebootRequired').val, true);
  await adapter._writeConfigurationValue('stationReboot', stateId, 180);
  assert.equal(adapter.states.get('stationReboot.configuration.rebootRequired').val, true);
  assert.equal(calls.some((entry) => entry.method === 'Reset'), false);

  adapter._noteBoot('stationReboot', 300);
  await adapter.runtimeIndex.get('stationReboot').deferredTail;
  assert.equal(adapter.states.get('stationReboot.configuration.rebootRequired').val, false);
  assert.equal(calls.some((entry) => entry.method === 'Reset'), false);
});

test('configuration refresh uses the shared outbound command slot', async () => {
  let releaseBlocker;
  const blocker = new Promise((resolve) => { releaseBlocker = resolve; });
  const { adapter, calls } = prepareAdapter('stationQueue', 'ocpp1.6', async (method) => {
    if (method === 'GetConfiguration') return { configurationKey: [] };
    throw new Error(`Unexpected call ${method}`);
  });
  const entry = adapter.runtimeIndex.get('stationQueue');
  entry.outboundControlTail = blocker;

  const refresh = adapter._refreshConfiguration('stationQueue');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 0, 'refresh must wait for the existing station control operation');
  releaseBlocker();
  await refresh;
  assert.deepEqual(calls.map((item) => item.method), ['GetConfiguration']);
});

test('configuration writes fail safely while a multipart inventory is still in progress', async () => {
  const { adapter } = prepareAdapter('stationBusy', 'ocpp1.6', async (method) => {
    if (method === 'GetConfiguration') return { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '60' }] };
    throw new Error(`Unexpected call ${method}`);
  });
  await adapter._refreshConfiguration('stationBusy');
  const stateId = 'stationBusy.configuration.HeartbeatInterval';
  const entry = adapter.runtimeIndex.get('stationBusy');
  entry.configurationRefreshInFlight = true;
  await assert.rejects(adapter._writeConfigurationValue('stationBusy', stateId, 120), /still in progress/);
  assert.equal(adapter.states.get(stateId).val, 60);
});

test('partial OCPP 2.x inventories stay read-only after timeout until a complete refresh succeeds', async () => {
  const component = { name: 'ClockCtrlr' };
  const variable = { name: 'TimeOffset' };
  const { adapter, calls } = prepareAdapter('stationPartial', 'ocpp2.1', async (method) => {
    if (method === 'GetBaseReport') return { status: 'Accepted' };
    throw new Error(`Unexpected call ${method}`);
  });

  await adapter._refreshConfiguration('stationPartial');
  const firstRequestId = calls[0].payload.requestId;
  await adapter.ingestNotifyReport('stationPartial', 'ocpp2.1', {
    requestId: firstRequestId,
    generatedAt: new Date().toISOString(),
    seqNo: 0,
    tbc: true,
    reportData: [{
      component,
      variable,
      variableAttribute: [{ type: 'Actual', value: '+01:00', mutability: 'ReadWrite', persistent: true }],
      variableCharacteristics: { dataType: 'string', supportsMonitoring: false },
    }],
  });

  const stateKey = configurationStateKey2(component, variable, 'Actual');
  const stateId = `stationPartial.configuration.${stateKey}`;
  assert.equal(adapter.objects.get(stateId).common.write, false);
  assert.equal(adapter.objects.get(stateId).native.ocppConfiguration.inventoryPending, true);

  const entry = adapter.runtimeIndex.get('stationPartial');
  entry.configurationReportDeadlineAt = Date.now() - 1;
  await adapter._watchdogCycle();
  assert.equal(entry.configurationRefreshInFlight, false);
  assert.equal(adapter.states.get('stationPartial.configuration.status').val, 'timeout');
  assert.equal(adapter.objects.get(stateId).common.write, false);
  await assert.rejects(adapter._writeConfigurationValue('stationPartial', stateId, '+02:00'), /read-only/);

  await adapter._refreshConfiguration('stationPartial');
  const secondRequestId = calls[1].payload.requestId;
  await adapter.ingestNotifyReport('stationPartial', 'ocpp2.1', {
    requestId: secondRequestId,
    generatedAt: new Date().toISOString(),
    seqNo: 0,
    tbc: false,
    reportData: [{
      component,
      variable,
      variableAttribute: [{ type: 'Actual', value: '+01:00', mutability: 'ReadWrite', persistent: true }],
      variableCharacteristics: { dataType: 'string', supportsMonitoring: false },
    }],
  });
  assert.equal(adapter.objects.get(stateId).common.write, true);
  assert.equal(adapter.objects.get(stateId).native.ocppConfiguration.inventoryPending, false);
});

test('configuration objects retained across an adapter restart are retired by the next complete inventory', async () => {
  const first = prepareAdapter('stationRestart', 'ocpp1.6', async (method) => {
    if (method !== 'GetConfiguration') throw new Error(`Unexpected call ${method}`);
    return { configurationKey: [
      { key: 'HeartbeatInterval', readonly: false, value: '60' },
      { key: 'RemovedAfterFirmwareUpdate', readonly: false, value: '1' },
    ] };
  });
  await first.adapter._refreshConfiguration('stationRestart');

  const second = prepareAdapter('stationRestart', 'ocpp1.6', async (method) => {
    if (method !== 'GetConfiguration') throw new Error(`Unexpected call ${method}`);
    return { configurationKey: [{ key: 'HeartbeatInterval', readonly: false, value: '120' }] };
  });
  for (const [id, object] of first.adapter.objects.entries()) {
    second.adapter.objects.set(id, structuredClone(object));
  }

  await second.adapter._refreshConfiguration('stationRestart');
  const retiredId = 'stationRestart.configuration.RemovedAfterFirmwareUpdate';
  const retiredObject = second.adapter.objects.get(retiredId);
  assert.equal(retiredObject.common.write, false);
  assert.equal(retiredObject.native.ocppConfiguration.stale, true);
  await assert.rejects(second.adapter._writeConfigurationValue('stationRestart', retiredId, 2), /read-only/);
});

test('configuration operations are blocked during charging unless explicitly enabled', async () => {
  const { adapter, calls } = prepareAdapter('stationCharging', 'ocpp1.6', async (method) => {
    if (method === 'GetConfiguration') return { configurationKey: [] };
    throw new Error(`Unexpected call ${method}`);
  });
  const entry = adapter.runtimeIndex.get('stationCharging');
  entry.transactionActive = true;
  await assert.rejects(adapter._refreshConfiguration('stationCharging'), /disabled during an active charging transaction/);
  assert.equal(calls.length, 0);
  assert.equal(adapter.states.get('stationCharging.configuration.status').val, 'busy-charging');

  adapter.config.allowConfigurationDuringCharging = true;
  await adapter._refreshConfiguration('stationCharging');
  assert.deepEqual(calls.map((item) => item.method), ['GetConfiguration']);
});

test('EOS two-port runtime publishes sum, does not erase another charging connector', async()=>{
  const {adapter}=prepareAdapter('multi','ocpp1.6',async()=>({status:'Accepted'}));
  const entry=adapter.runtimeIndex.get('multi');
  entry.connectors.add('1:1'); entry.connectors.add('1:2');
  const now=Date.now(), metric=val=>({powerW:{val,category:'realtime'}});
  await adapter._publishScopedMeter('multi',1,1,metric(4000),now,now);
  assert.equal(adapter.states.get('multi.health.dataFresh').val,false);
  await adapter._publishScopedMeter('multi',1,2,metric(3000),now,now);
  assert.equal(adapter.states.get('multi.measurements.powerW').val,7000);
  await adapter._noteTransaction('multi',{type:'Stop',evseId:1,connectorId:2,txId:'2'});
  assert.equal(adapter.states.get('multi.measurements.powerW').val,4000);
  assert.equal(adapter.states.get('multi.health.dataFresh').val,true);
});
test('EOS wire command keeps stable profile ID and sends zero after positive limit',async()=>{
  const {adapter,calls,client}=prepareAdapter('cp','ocpp1.6',async()=>({status:'Accepted'}));
  await adapter._applySmartCharging('cp',4200,'W',3);
  await adapter._applySmartCharging('cp',0,'W',3);
  assert.equal(calls.length,2);
  const profiles=calls.map(c=>c.payload.csChargingProfiles);
  assert.equal(profiles[0].chargingProfileId,profiles[1].chargingProfileId);
  assert.equal(profiles[1].chargingSchedule.chargingSchedulePeriod[0].limit,0);
  assert.equal(adapter.states.get('cp.control.appliedChargeLimitValid').val,true);
  adapter._indexClient('cp','ocpp1.6',client,'cp');
  await adapter._applySmartCharging('cp',0,'W',3);
  assert.equal(calls.length,3);
});
test('EOS rejected charging profile cannot become confirmed',async()=>{
  const {adapter}=prepareAdapter('cp','ocpp2.1',async()=>({status:'Rejected'}));
  await assert.rejects(adapter._applySmartCharging('cp',4200,'W',3),/Rejected/);
  assert.equal(adapter.runtimeIndex.get('cp').lastSmartCharging,undefined);
});

const chargeStatus = (adapter, id = 'cp') => JSON.parse(adapter.states.get(`${id}.control.chargeLimitStatus`).val);
const flushPublication = async (adapter, id = 'cp') => { await adapter._chargeLimitPublications.get(id); };

test('atomic profile status correlates requested/applied watts with current session and acceptance time', async () => {
  const { adapter, calls } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await flushPublication(adapter);
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(chargeStatus(adapter).reason, 'connected-awaiting-profile');
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  const first = chargeStatus(adapter);
  assert.equal(first.schema, 1);
  assert.equal(first.valid, true);
  assert.equal(first.requestedW, 4200);
  assert.equal(first.appliedW, 4200);
  assert.equal(first.sessionId, adapter.states.get('cp.info.sessionId').val);
  assert.ok(first.appliedAtMs > 0 && first.appliedAtMs <= first.updatedAtMs);
  await adapter._queueSmartCharging('cp', 4250, 'W', 3);
  const unchanged = chargeStatus(adapter);
  assert.equal(calls.length, 1);
  assert.equal(unchanged.requestedW, 4250);
  assert.equal(unchanged.appliedW, 4200);
  assert.equal(unchanged.appliedAtMs, first.appliedAtMs);
  await adapter._recordControlResult('cp', 'ChangeAvailability', { status: 'Accepted' });
  await adapter._recordControlResult('cp', 'GetConfiguration', null, new Error('unrelated failure'));
  assert.deepEqual(chargeStatus(adapter), unchanged);
});

test('pending command invalidates confirmation before its response and a reduction to zero remains zero', async () => {
  let resolveCall;
  const { adapter } = prepareAdapter('cp', 'ocpp1.6', async () => new Promise(resolve => { resolveCall = resolve; }));
  const pending = adapter._queueSmartCharging('cp', 0, 'W', 3);
  while (!resolveCall) await new Promise(resolve => setImmediate(resolve));
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(chargeStatus(adapter).requestedW, 0);
  assert.equal(chargeStatus(adapter).appliedW, null);
  resolveCall({ status: 'Accepted' });
  await pending;
  assert.equal(chargeStatus(adapter).valid, true);
  assert.equal(chargeStatus(adapter).appliedW, 0);
});

test('rejected and timed out profiles cannot be confirmed even when input writes are acknowledged', async () => {
  for (const kind of ['Rejected', 'timeout']) {
    const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => {
      if (kind === 'timeout') throw new Error('SetChargingProfile timeout after 5000 ms');
      return { status: kind };
    });
    adapter.states.set('cp.control.chargeLimit', { val: 4200, ack: false, ts: 123 });
    await adapter.onStateChange('ocpp21.0.cp.control.chargeLimit', { val: 4200, ack: false, ts: 123 });
    assert.equal(adapter.states.get('cp.control.chargeLimit').ack, true);
    assert.equal(chargeStatus(adapter).valid, false);
    assert.equal(chargeStatus(adapter).appliedW, null);
    assert.equal(chargeStatus(adapter).error, kind === 'Rejected' ? 'rejected' : 'timeout');
    assert.equal(adapter.states.get('cp.control.appliedChargeLimitValid').val, false);
  }
});

test('reconnect during accepted profile persistence cannot resurrect confirmation from previous socket', async () => {
  for (const field of ['appliedChargeLimitW', 'chargeLimitStatus', 'appliedChargeLimitValid']) {
    const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
    await flushPublication(adapter);
    const oldSession = adapter.runtimeIndex.get('cp').sessionId;
    const original = adapter.setStateAsync.bind(adapter);
    let reconnected = false;
    adapter.setStateAsync = async (id, state) => {
      const hit = id === `cp.control.${field}` && (field !== 'appliedChargeLimitValid' || state.val === true)
        && (field !== 'chargeLimitStatus' || JSON.parse(state.val).valid);
      if (hit && !reconnected) {
        reconnected = true;
        adapter._indexClient('cp', 'ocpp2.1', { async call() { return { status: 'Accepted' }; }, async close() {} }, 'cp');
      }
      await original(id, state);
    };
    await adapter._queueSmartCharging('cp', 4200, 'W', 3);
    await flushPublication(adapter);
    assert.equal(reconnected, true, field);
    const status = chargeStatus(adapter);
    assert.notEqual(status.sessionId, oldSession, field);
    assert.equal(status.sessionId, adapter.states.get('cp.info.sessionId').val, field);
    assert.equal(status.valid, false, field);
    assert.equal(adapter.states.get('cp.control.appliedChargeLimitValid').val, false, field);
    await adapter._queueSmartCharging('cp', 0, 'W', 3);
    assert.equal(chargeStatus(adapter).valid, true, field);
    assert.equal(chargeStatus(adapter).appliedW, 0, field);
  }
});

test('disconnect and adapter restart invalidate persisted profile status', async () => {
  const { adapter, client } = prepareAdapter('cp', 'ocpp1.6', async () => ({ status: 'Accepted' }));
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  adapter._unindexClient('cp', client);
  await flushPublication(adapter);
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(chargeStatus(adapter).reason, 'disconnected');
  adapter.runtimeIndex.clear();
  await adapter._setDisconnectedHealth('cp', 'adapter-restarted-awaiting-station');
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(chargeStatus(adapter).sessionId, '');
});

test('session identifier timestamp is not renewed by telemetry or unchanged profiles', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await flushPublication(adapter);
  const sessionState = adapter.states.get('cp.info.sessionId');
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  await adapter._publishStationTelemetry('cp', adapter.runtimeIndex.get('cp'));
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  assert.equal(adapter.states.get('cp.info.sessionId'), sessionState);
});

test('native device metadata preserves user attributes and identifies one station control scope', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp1.6', async () => ({ status: 'Accepted' }));
  await flushPublication(adapter);
  adapter._identityStructureReady.delete('cp');
  adapter.objects.set('cp', { type: 'device', common: { name: 'User name' }, native: { userSetting: 'preserved' } });
  await adapter.ensureStructure('cp');
  const obj = adapter.objects.get('cp');
  assert.equal(obj.native.controlScope, 'station');
  assert.equal(obj.native.deviceType, 'evCharger');
  assert.equal(obj.native.eosContract, 'nexowatt-ocpp21-0.4-native');
  assert.equal(obj.native.userSetting, 'preserved');
  assert.equal(obj.common.name, 'User name');
  assert.equal(adapter.objects.get('cp.info.controlScope').common.def, 'station');
  assert.equal(adapter.objects.get('cp.control.chargeLimitStatus').common.write, false);
});

test('actual command timeout remains invalid when the late station response arrives', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let lateResponse;
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => new Promise(resolve => { lateResponse = resolve; }));
  const pending = adapter._queueSmartCharging('cp', 4200, 'W', 3);
  while (!lateResponse) await new Promise(resolve => setImmediate(resolve));
  const rejected = assert.rejects(pending, /timeout/);
  t.mock.timers.tick(5000);
  await rejected;
  assert.equal(chargeStatus(adapter).error, 'timeout');
  lateResponse({ status: 'Accepted' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(adapter.runtimeIndex.get('cp').lastSmartCharging, undefined);
});

test('newest zero command supersedes an in-flight positive command without old confirmation', async () => {
  let firstResponse;
  const { adapter, calls } = prepareAdapter('cp', 'ocpp2.1', async (_method, _payload, recorded) => {
    if (recorded.length === 1) return new Promise(resolve => { firstResponse = resolve; });
    return { status: 'Accepted' };
  });
  const first = adapter._queueSmartCharging('cp', 4200, 'W', 3);
  while (!firstResponse) await new Promise(resolve => setImmediate(resolve));
  const latest = adapter._queueSmartCharging('cp', 0, 'W', 3);
  await new Promise(resolve => setImmediate(resolve));
  await flushPublication(adapter);
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(chargeStatus(adapter).requestedW, 0);
  firstResponse({ status: 'Accepted' });
  assert.equal((await first).status, 'Superseded');
  await latest;
  assert.equal(calls.length, 2);
  assert.equal(chargeStatus(adapter).appliedW, 0);
  assert.equal(chargeStatus(adapter).valid, true);
});

test('an old disconnect task cannot clear the replacement session health or profile', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp1.6', async () => ({ status: 'Accepted' }));
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  const oldEntry = adapter.runtimeIndex.get('cp');
  adapter._indexClient('cp', 'ocpp1.6', { async call() { return { status: 'Accepted' }; }, async close() {} }, 'cp');
  await adapter._queueSmartCharging('cp', 0, 'W', 3);
  adapter.states.set('cp.health.online', { val: true, ack: true });
  const current = chargeStatus(adapter);
  await adapter._setDisconnectedHealth('cp', 'socket-disconnected', oldEntry);
  assert.deepEqual(chargeStatus(adapter), current);
  assert.equal(adapter.states.get('cp.health.online').val, true);
});

async function renewLease(adapter, until = Date.now() + 15000) {
  const ts = Math.max(Date.now(), (adapter._eosLeases.get('cp')?.lastEventTs || 0) + 1);
  const state = { val: until, ts, ack: false };
  adapter.states.set('cp.control.eosLeaseUntilMs', state);
  await adapter.onStateChange('ocpp21.0.cp.control.eosLeaseUntilMs', state);
}
async function finishLeaseStop(adapter) {
  for (let i = 0; i < 100 && adapter._eosLeases.get('cp')?.stopPending; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(adapter._eosLeases.get('cp').stopPending, false);
}
function expireLease(adapter) {
  const lease = adapter._eosLeases.get('cp');
  lease.untilMs = Date.now() - 1;
  lease.deadline = performance.now() - 1;
}

test('EOS lease is opt-in, persists armed state and stops positive power on expiry', async () => {
  const { adapter, calls } = prepareAdapter('cp', 'ocpp1.6', async () => ({ status: 'Accepted' }));
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  assert.equal(adapter._eosLeases.get('cp').armed, false);
  await renewLease(adapter);
  assert.equal(adapter.states.get('cp.control.eosLeaseArmed').val, true);
  assert.equal(adapter.states.get('cp.info.eosControlLeaseSupported').val, true);
  expireLease(adapter);
  await adapter._eosLeaseWatchdogCycle();
  await finishLeaseStop(adapter);
  assert.equal(calls.at(-1).payload.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit, 0);
  assert.equal(adapter.states.get('cp.control.eosLeaseState').val, 'expired-zero-confirmed');
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(chargeStatus(adapter).error, 'EOS_LEASE_EXPIRED');
  await assert.rejects(adapter._queueSmartCharging('cp', 4200, 'W', 3), /EOS_LEASE_EXPIRED/);
  const before = calls.length;
  await renewLease(adapter);
  assert.equal(calls.length, before, 'renewal alone never restores positive power');
  adapter.runtimeIndex.get('cp').lastSmartChargingAt = 0;
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  assert.equal(calls.length, before + 1);
  assert.equal(chargeStatus(adapter).valid, true);
});

test('persisted armed lease restarts expired even when stored deadline is still in the future', async () => {
  const { adapter, calls } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await adapter._ensureEosLease('cp');
  await renewLease(adapter);
  adapter._eosLeases.delete('cp'); // new runtime cache, persisted ioBroker states retained
  const restored = await adapter._ensureEosLease('cp');
  assert.equal(restored.armed, true);
  assert.equal(adapter._eosLeaseFresh(restored), false);
  await assert.rejects(adapter._queueSmartCharging('cp', 1000, 'W', 3), /EOS_LEASE_EXPIRED/);
  await adapter._eosLeaseWatchdogCycle();
  await finishLeaseStop(adapter);
  assert.equal(calls.at(-1).payload.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit, 0);
});

test('lease rejects far-future and stale events, without disarming a persisted lease', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await renewLease(adapter);
  await renewLease(adapter, Date.now() + 60000);
  assert.equal(adapter._eosLeaseFresh(adapter._eosLeases.get('cp')), false);
  assert.equal(adapter.states.get('cp.control.eosLeaseArmed').val, true);
  await adapter._renewEosLease('cp', { val: Date.now() + 15000, ts: Date.now() - 10000, ack: false });
  assert.equal(adapter._eosLeaseFresh(adapter._eosLeases.get('cp')), false);
});

test('lease expiry fences in-flight positive acceptance and serializes zero immediately afterwards', async () => {
  let positiveResponse;
  const { adapter, calls } = prepareAdapter('cp', 'ocpp2.1', async (_method, payload) => {
    const power = payload.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit;
    if (power > 0) return new Promise(resolve => { positiveResponse = resolve; });
    return { status: 'Accepted' };
  });
  await renewLease(adapter);
  const positive = adapter._queueSmartCharging('cp', 4200, 'W', 3);
  while (!positiveResponse) await new Promise(resolve => setImmediate(resolve));
  expireLease(adapter);
  await adapter._eosLeaseWatchdogCycle();
  assert.equal(chargeStatus(adapter).valid, false);
  assert.equal(calls.length, 1, 'zero waits for the same outbound slot');
  positiveResponse({ status: 'Accepted' });
  assert.equal((await positive).status, 'Superseded');
  await finishLeaseStop(adapter);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].payload.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit, 0);
  assert.equal(chargeStatus(adapter).valid, false);
});

test('offline or rejected expiry zero stays unconfirmed and blocks positive even after renewal', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Rejected' }));
  await renewLease(adapter);
  expireLease(adapter);
  await adapter._eosLeaseWatchdogCycle();
  await finishLeaseStop(adapter);
  assert.equal(adapter.states.get('cp.control.eosLeaseState').val, 'expired-zero-failed');
  await renewLease(adapter);
  await assert.rejects(adapter._queueSmartCharging('cp', 4200, 'W', 3), /EOS_LEASE_EXPIRED/);
  const entry = adapter.runtimeIndex.get('cp');
  entry.client = null; entry.socketConnected = false;
  await adapter._eosLeaseWatchdogCycle();
  assert.equal(adapter.states.get('cp.control.eosLeaseState').val, 'expired-offline-zero-unconfirmed');
});

test('monotonic lease deadline still stops power after a backwards wall-clock jump', async t => {
  const { adapter, calls } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await renewLease(adapter);
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  adapter._eosLeases.get('cp').deadline = performance.now() - 1;
  const backwards = Date.now() - 3600000;
  t.mock.method(Date, 'now', () => backwards);
  assert.equal(adapter._eosLeaseFresh(adapter._eosLeases.get('cp')), false);
  await adapter._eosLeaseWatchdogCycle();
  await finishLeaseStop(adapter);
  assert.equal(calls.at(-1).payload.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit, 0);
});

test('one failed lease restoration can retry and does not authorize positive power', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await adapter._ensureEosLease('cp');
  adapter._eosLeases.delete('cp');
  const read = adapter.getStateAsync.bind(adapter);
  let failed = false;
  adapter.getStateAsync = async id => {
    if (id === 'cp.control.eosLeaseArmed' && !failed) { failed = true; throw new Error('transient database failure'); }
    return read(id);
  };
  await assert.rejects(adapter._queueSmartCharging('cp', 4200, 'W', 3), /database failure/);
  assert.equal(adapter._eosLeases.has('cp'), false);
  await adapter._queueSmartCharging('cp', 0, 'W', 3);
  assert.equal(chargeStatus(adapter).appliedW, 0);
});

test('queued configuration work cannot delay an expired lease zero with additional RPC timeouts', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await renewLease(adapter);
  expireLease(adapter);
  const entry = adapter.runtimeIndex.get('cp');
  let called = false;
  await assert.rejects(adapter._queueOutboundControlOperation('cp', entry, async () => { called = true; }), /EOS_LEASE_EXPIRED/);
  assert.equal(called, false);
  await assert.rejects(adapter._writeConfigurationValue('cp', 'cp.configuration.any', 'x'), /EOS_LEASE_EXPIRED/);
  await adapter._eosLeaseWatchdogCycle();
  await finishLeaseStop(adapter);
  assert.equal(adapter.states.get('cp.control.eosLeaseState').val, 'expired-zero-confirmed');
});

test('a station diagnostic write failure does not prevent another expired lease from stopping', async () => {
  const { adapter } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await renewLease(adapter);
  expireLease(adapter);
  adapter._indexClient('other', 'ocpp2.1', { async call() { return { status: 'Accepted' }; }, async close() {} }, 'other');
  await adapter._ensureEosLease('other');
  await adapter._renewEosLease('other', { val: Date.now() + 15000, ts: Date.now(), ack: false });
  const other = adapter._eosLeases.get('other');
  other.untilMs = Date.now() - 1; other.deadline = performance.now() - 1;
  const write = adapter._setStateFreshAsync.bind(adapter);
  adapter._setStateFreshAsync = async (id, ...args) => {
    if (id === 'cp.control.chargeLimitStatus') throw new Error('one station diagnostic write failed');
    return write(id, ...args);
  };
  await adapter._eosLeaseWatchdogCycle();
  for (let i = 0; i < 100 && other.stopPending; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(adapter.states.get('other.control.eosLeaseState').val, 'expired-zero-confirmed');
});

test('expired lease sends physical zero even when status publication stalls', async () => {
  const { adapter, calls } = prepareAdapter('cp', 'ocpp2.1', async () => ({ status: 'Accepted' }));
  await renewLease(adapter);
  await adapter._queueSmartCharging('cp', 4200, 'W', 3);
  const write = adapter._setStateFreshAsync.bind(adapter);
  const releases = [];
  adapter._setStateFreshAsync = (id, ...args) => {
    if (id === 'cp.control.chargeLimitStatus' || id === 'cp.control.eosLeaseState') {
      return new Promise(resolve => releases.push(() => resolve(write(id, ...args))));
    }
    return write(id, ...args);
  };
  expireLease(adapter);
  await adapter._eosLeaseWatchdogCycle();
  for (let i = 0; i < 100 && calls.length < 2; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2, 'physical zero is independent of the pending diagnostic write');
  assert.equal(calls[1].payload.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit, 0);
  adapter._setStateFreshAsync = write;
  for (const release of releases) release();
  await finishLeaseStop(adapter);
});
