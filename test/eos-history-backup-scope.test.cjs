'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveHistoryBackupRequirement, validateRequirement } = require('../src/lib/eosHistoryBackupScope');
const owner = value => ({ namespace:'eos-admin.0', eosHostedRuntime:{getHistoryBackupRequirement:()=>value}, getForeignObjectAsync:async()=>null });
test('saved direct Influx identity is kept without copying credentials', async()=>{
    assert.deepEqual(await resolveHistoryBackupRequirement(owner({provider:'influxdb2',url:'https://db.local:8086/',org:'EOS',bucket:'History',token:'fixture-secret'})),{provider:'influxdb2',url:'https://db.local:8086',org:'EOS',bucket:'History'});
});
test('unknown runtime and foreign PostgreSQL instance cannot claim backup coverage',async()=>{
    assert.deepEqual(await resolveHistoryBackupRequirement({...owner(null),eosHostedRuntime:undefined}),{provider:'unknown'});
    assert.deepEqual(validateRequirement({provider:'postgresql',namespace:'eos-admin.1'},'eos-admin.0'),{provider:'unknown'});
    assert.deepEqual(validateRequirement({provider:'postgresql',namespace:'eos-admin.0'},'eos-admin.0'),{provider:'postgresql',namespace:'eos-admin.0'});
});
test('existing influx adapter resolves exact saved organization and bucket, not backup defaults',async()=>{
    const subject=owner({provider:'adapter',instance:'influxdb.3'});
    subject.getForeignObjectAsync=async id=>{assert.equal(id,'system.adapter.influxdb.3');return {common:{name:'influxdb'},native:{dbversion:'2.x',protocol:'http',host:'localhost',port:8086,dbname:'site-history',organization:'site',password:'fixture-password',token:'fixture-token'}};};
    assert.deepEqual(await resolveHistoryBackupRequirement(subject),{provider:'influxdb2',url:'http://localhost:8086',bucket:'site-history',org:'site'});
});
test('unsupported adapter and malformed or credential-bearing endpoint stay incomplete',async()=>{
    for(const input of [{provider:'adapter',instance:'javascript.0'},{provider:'influxdb2',url:'https://user:secret@localhost',org:'EOS',bucket:'History'},{provider:'influxdb2',url:'https://localhost/?token=secret',org:'EOS',bucket:'History'},{provider:'influxdb2',url:'https://localhost/',org:'',bucket:'History'}])assert.deepEqual(await resolveHistoryBackupRequirement(owner(input)),{provider:'unknown'});
});
test('provider absence is explicit, never inferred from missing configuration',async()=>{
    assert.deepEqual(await resolveHistoryBackupRequirement(owner({provider:'none'})),{provider:'none'});
    assert.deepEqual(await resolveHistoryBackupRequirement(owner({})),{provider:'unknown'});
});
