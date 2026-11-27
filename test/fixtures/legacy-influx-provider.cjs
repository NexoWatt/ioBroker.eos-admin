'use strict';
// Optional acceptance fixture. Launches its own empty, loopback-only server.
// No existing database URL or token can be supplied.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const Module = require('node:module');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));

async function realHistorian(t, archive, aliases) {
    const adapterDir = path.resolve(process.env.EOS_TEST_IOBROKER_INFLUXDB);
    const serverBin = path.resolve(process.env.EOS_TEST_INFLUXD);
    const version = require(path.join(adapterDir,'package.json')).version;
    assert.equal(version,'5.5.1','acceptance harness is verified against this reader');
    // The package compact-mode entry exports a launcher. Load its unchanged
    // class to exercise its production getHistoryV2 and Flux-generation code.
    // Only the controller transport/session boundary and empty write queue
    // are fixtures. Database access uses the vendor SDK and the real server.
    const filename = path.join(adapterDir,'build/main.js');
    const m = new Module(filename,module);
    m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    const load = m.require.bind(m);
    m.require = name => name === '@iobroker/adapter-core' ? {Adapter:class {},getAbsoluteDefaultDataDir:os.tmpdir} : load(name);
    m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports = InfluxDBAdapter;', filename);
    const Database = require(path.join(adapterDir,'build/lib/DatabaseInfluxDB2x.js')).default;
    const listener = net.createServer();
    await new Promise((resolve,reject) => listener.once('error',reject).listen(0,'127.0.0.1',resolve));
    const port = listener.address().port;
    await new Promise(resolve=>listener.close(resolve));
    const root = fs.mkdtempSync(path.join(os.tmpdir(),'eos-legacy-historian-'));
    const child = spawn(serverBin,['--http-bind-address','127.0.0.1:'+port,'--bolt-path',path.join(root,'db.bolt'),
        '--sqlite-path',path.join(root,'db.sqlite'),'--engine-path',path.join(root,'engine'),
        '--reporting-disabled','--log-level','error'],{cwd:root,stdio:'ignore',env:{HOME:root,PATH:'/usr/bin:/bin'}});
    const exit = new Promise(resolve=>{child.once('error',resolve);child.once('exit',resolve);});
    let client;
    t.after(async () => {
        try { await client?.writeApi.close(); } finally {
            child.kill('SIGTERM');
            const timeout = setTimeout(()=>child.kill('SIGKILL'),3000);
            await exit; clearTimeout(timeout); fs.rmSync(root,{recursive:true,force:true});
        }
    });
    const url = 'http://127.0.0.1:'+port;
    let healthy = false;
    for (let i=0; i<150 && !healthy && child.exitCode===null; i++) {
        try { healthy = (await fetch(url+'/health',{signal:AbortSignal.timeout(400)})).ok; } catch { /* starting */ }
        if (!healthy) await pause(100);
    }
    assert.ok(healthy,'disposable InfluxDB server healthy');
    const token = crypto.randomBytes(32).toString('hex');
    const org = 'site-archive', database = 'legacy-series';
    const setup = await fetch(url+'/api/v2/setup',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:'fixtureuser',password:crypto.randomBytes(16).toString('hex'),org,bucket:database,token})});
    assert.equal(setup.status,201);
    const log={debug(){},info(){},warn(){},error(){}};
    client = new Database({host:'127.0.0.1',port,protocol:'http',database,requestTimeout:4000,log},{token,organization:org,useTags:false});
    for (const [id,points] of archive) for (const [ts,val] of points) {
        await client.writePoint(id,{time:new Date(ts),value:val,ack:true,q:0,from:'system.adapter.nexowatt-ui.0'});
    }
    const adapter = Object.create(m.exports.prototype);
    Object.assign(adapter,{log,config:{dbname:database,usetags:false,limit:1000},_client:client,_aliasMap:aliases,
        _influxDPs:Object.fromEntries([...archive.keys()].map(id=>[id,{storageType:'Number'}])),
        storeBufferedSeries:async()=>0, setConnected(){}, sendTo(_from,_cmd,result,reply){reply(result);}});
    t.diagnostic('Disposable InfluxDB 2.x + stock ioBroker.influxdb '+version+' writePoint/getHistoryV2');
    return {
        append(id,ts,val) { return client.writePoint(id,{time:new Date(ts),value:val,ack:true,q:0,from:'system.adapter.eos-admin.1'}); },
        query(body,cb) { return adapter.getHistoryV2({from:'eos-admin.1',command:'getHistory',message:body,callback:cb}); },
        async verify() {
            for (const [id,points] of archive) {
                const result = await client.query('from(bucket:"'+database+'") |> range(start:0) |> filter(fn:(r) => r._measurement == "'+id+'" and r._field == "value")');
                assert.deepEqual(result.map(row=>[new Date(row._time).valueOf(),row._value]), points);
            }
        },
    };
}
module.exports = {realHistorian};
