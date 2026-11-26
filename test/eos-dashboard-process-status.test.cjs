/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dashboardProcessStatus: summarize } = require('../src/lib/eosDashboardProcessStatus');
function dashboardProcessStatus(sources, stamp) {
    const {observedAt,state,failed,paused} = summarize(sources,stamp);
    return {observedAt,state,failed,paused};
}
const now = 1_800_000_000_000;
const ids = ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'];

function operating() {
    return Object.fromEntries(ids.map((id, index) => [id, {
        enabled: true, configured: true, active: true, emsReady: id === 'ems',
        reason: index < 2 ? 'ready' : 'RUNNING',
        process: {state:'running', pid:101 + index, generation:index < 2 ? 1 : 0, lastHeartbeatAt:now - 250, lastError:''},
    }]));
}

test('uses only live supervisor evidence and returns the six approved process IDs in stable order', () => {
    const sources = operating();
    sources.devices.token = 'private'; sources.admin = {state:'failed'};
    assert.deepEqual(dashboardProcessStatus(sources, now), {observedAt:now,state:'ok',failed:[],paused:[]});
    sources.ui.process.state = 'failed';
    sources.ui.process.lastError = 'arbitrary private error';
    sources.backup.reason = 'PROCESS_BACKOFF'; sources.devices.active = false;
    delete sources.ems;
    assert.deepEqual(dashboardProcessStatus(sources, now), {observedAt:now,state:'fault',failed:['ui','devices','backup'],paused:[]});
});

test('manual pauses, optional disabled modules and unavailable optional licenses are distinct from faults', () => {
    const src=operating();
    src.ems = {...src.ems, enabled:false, active:false, reason:'stopped', process:{state:'stopped'}};
    src.ocpp = {...src.ocpp, configured:false, reason:'DISABLED', process:{state:'stopped'}};
    src.backup = {...src.backup, reason:'LICENSE_REQUIRED', active:false, process:{state:'stopped'}};
    assert.deepEqual(dashboardProcessStatus(src,now), {observedAt:now,state:'ok',failed:[],paused:['ems','backup','ocpp']});
    src.ems.process.lastError = 'EOS_UI_PROCESS_STOP_UNCONFIRMED';
    assert.deepEqual(dashboardProcessStatus(src,now), {observedAt:now,state:'fault',failed:['ems'],paused:['backup','ocpp']});
    src.ems.enabled=null; src.ems.process.lastError='';
    assert.equal(dashboardProcessStatus(src,now).state,'unknown');
});

test('configured processes with expired heartbeats identify individual failures at the supervisor limits', () => {
    const src=operating();
    for (const id of ids) src[id].process.lastHeartbeatAt = now - (id === 'ui' || id === 'ems' ? 5000 : 4000);
    assert.equal(dashboardProcessStatus(src,now).state,'ok');
    src.ems.process.lastHeartbeatAt--; src.eebus.process.lastHeartbeatAt--;
    assert.deepEqual(dashboardProcessStatus(src,now).failed,['ems','eebus']);
});

test('a missing, impossible or provisional observation never marks all subsystems operational', () => {
    for (const patch of [{active:null}, {configured:null}, {enabled:null}, {process:{state:'starting'}},
        {process:{state:'stopping'}}, {process:{state:'running',lastHeartbeatAt:0}},
        {process:{state:'running',lastHeartbeatAt:now+1}}, {process:{state:'running',lastHeartbeatAt:now,pid:null,generation:0}},
        {reason:'READY',process:{state:'stopped',generation:0}}]) {
        const src=operating(); Object.assign(src.devices,patch);
        assert.deepEqual(dashboardProcessStatus(src,now), {observedAt:now,state:'unknown',failed:[],paused:[]});
    }
    for (const value of [undefined,null,{},[],false,1]) assert.equal(dashboardProcessStatus(value,now).state,'unknown');
});

test('reads operational EMS readiness from its own worker and treats the initial shell separately', () => {
    const src=operating();
    src.ems.emsReady=false; src.ems.reason='idle';
    assert.equal(dashboardProcessStatus(src,now).state,'unknown');
    src.ems.reason='EOS_EMS_INIT_FAILED';
    assert.deepEqual(dashboardProcessStatus(src,now).failed,['ems']);
    src.ems.emsReady=true; src.ems.reason='ready'; src.ems.process={state:'stopped',generation:1};
    assert.deepEqual(dashboardProcessStatus(src,now).failed,['ems']);
    src.ems.process.generation=0;
    assert.equal(dashboardProcessStatus(src,now).state,'unknown');
});

test('confirmed configuration, ownership and authority failures remain visible before a PID exists', () => {
    const src=operating();
    src.devices = {enabled:true,configured:null,reason:'CONFIG_INVALID'};
    src.ocpp = {enabled:true,configured:true,reason:'LEGACY_CONFLICT'};
    src.eebus = {enabled:true,configured:true,reason:'START_FAILED_RESTART_REQUIRED'};
    src.backup = {enabled:true,configured:true,active:false,reason:'EOS_OWNERSHIP_REQUIRED'};
    assert.deepEqual(dashboardProcessStatus(src,now).failed,['devices','eebus','backup','ocpp']);
});
