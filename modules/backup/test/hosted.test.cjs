'use strict';
// These isolated controller fixtures contain no manufacturer-provisioned trust.
require('../build/publicTrust').capturePublicTrust=async()=>null;
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const zlib=require('node:zlib');
const {createHostedModule,validateConfig,preflightLegacyConfig}=require('../build');
async function fixture(config={}){const root=await fs.mkdtemp(path.join(os.tmpdir(),'eos-backup-hosted-'));const installationDir=path.join(root,'iobroker'),eosDataDir=path.join(installationDir,'iobroker-data/eos-admin.0'),dataDir=path.join(eosDataDir,'modules/backup');await fs.mkdir(path.join(installationDir,'node_modules/iobroker.js-controller'),{recursive:true});await fs.mkdir(path.join(eosDataDir,'tls'),{recursive:true});await fs.writeFile(path.join(eosDataDir,'tls/device-key.pem'),'ephemeral fixture identity');await fs.writeFile(path.join(installationDir,'node_modules/iobroker.js-controller/iobroker.js'),"require('node:fs').writeFileSync(process.argv[3],require('node:zlib').gzipSync('fixturecontrollerdata'));",{mode:0o600});let allowed=true;const state=new Map();const adapter={namespace:'eos-admin.0.backup',log:{warn(){},info(){},error(){},debug(){}},async getBackupDataFolders(){return [];},async setObjectNotExistsAsync(){},async setStateAsync(id,value){state.set(id,value);}};const module=createHostedModule({getHistoryBackupRequirement:()=>({provider:'none'}),adapter,canOperate:()=>allowed,dataDir,eosDataDir,installationDir,config:{enabled:true,minimalEnabled:false,...config}});return {root,dataDir,module,state,revoke(){allowed=false;},async cleanup(){await module.stop();await fs.rm(root,{recursive:true,force:true});}};}
async function finished(module){const end=Date.now()+20000;while(Date.now()<end){const status=module.getStatus();if(!status.current&&status.history.length)return status.history[0];await new Promise(r=>setTimeout(r,30));}throw new Error('job timeout');}
test('real child worker creates encrypted controller and private EOS profile, API status has no recovery key',async()=>{const f=await fixture();try{await f.module.start();const result=await f.module.command('start',{});assert.equal(result.accepted,true);await assert.rejects(()=>f.module.command('start',{}),/BUSY/);const job=await finished(f.module);assert.equal(job.state,'succeeded',job.error);assert.equal(job.files.length,3);assert.equal(f.state.get('info.status').val,'SUCCEEDED');assert(!JSON.stringify(f.module.getStatus()).includes('key'));const key=await f.module.command('exportRecoveryKey',{confirm:true});assert.equal(JSON.parse(key.content).format,'nexowatt-eos-recovery-key/v1');for(const file of job.files){const d=await f.module.getDownload(file.name);let bytes=0;for await(const chunk of d.stream)bytes+=chunk.length;assert.equal(bytes,d.size);}const names=await fs.readdir(path.join(f.dataDir,'jobs'));assert.deepEqual(names,[]);}finally{await f.cleanup();}});
test('download rejects traversal and symlinks; export requires explicit command confirmation',async()=>{const f=await fixture();try{await f.module.start();await assert.rejects(()=>f.module.getDownload('../recovery.key'),/ARCHIVE_NAME/);await assert.rejects(()=>f.module.command('exportRecoveryKey',{}),/CONFIRM/);const n='eos-backup-00000000-0000-0000-0000-000000000000-system.nwb';await fs.symlink(path.join(f.dataDir,'recovery.key'),path.join(f.dataDir,'archives',n));await assert.rejects(()=>f.module.getDownload(n));f.revoke();await assert.rejects(()=>f.module.command('start',{}),/INACTIVE/);}finally{await f.cleanup();}});
test('configuration refuses unsafe executable, insecure FTPS and automatic mount before migration',async()=>{assert.throws(()=>validateConfig({enabled:true,ftpEnabled:true,ftpSecure:false}),/FTPS_REQUIRED/);assert.throws(()=>validateConfig({enabled:true,mySqlEnabled:true,mySqlDumpExe:'/tmp/evil'}),/EXECUTABLE_REVIEW/);await assert.rejects(()=>preflightLegacyConfig({cifsEnabled:true,connectType:'Expert'}),/MOUNT_REVIEW/);await assert.rejects(()=>preflightLegacyConfig({cifsEnabled:true,connectType:'CIFS'}),/SOURCE_PATH|PREMOUNT/);});
test('legacy config keeps custom fields and decrypts documented XOR event passwords only',async()=>{const secret='fixture-only-system-secret';const plain='db password with $ special';let encrypted='';for(let i=0;i<plain.length;i++)encrypted+=String.fromCharCode(plain.charCodeAt(i)^secret.charCodeAt(i%secret.length));const source={customCustomerSetting:{x:17},mySqlMulti:true,mySqlEvents:[{host:'localhost',dbName:'iobroker',pass:encrypted}],mySqlEnabled:true};const {config}=await preflightLegacyConfig(source,{owner:{async getForeignObjectAsync(id){assert.equal(id,'system.config');return {native:{secret}};}}});assert.equal(config.mySqlEvents[0].pass,plain);assert.deepEqual(config.customCustomerSetting,{x:17});assert.equal(source.mySqlEvents[0].pass,encrypted);});

test('legacy archive import keeps original and publishes authenticated encrypted copy',async()=>{const f=await fixture();try{const oldDir=path.join(f.root,'iobroker/backups');await fs.mkdir(oldDir);const name='iobroker_2026_11_23-10_00_00_backupiobroker.tar.gz';const original=zlib.gzipSync('older controller backup');await fs.writeFile(path.join(oldDir,name),original);await f.module.start();await f.module.command('legacyList',{});let job=await finished(f.module);assert.equal(job.remote.entries[0].name,name);await f.module.command('legacyImport',{name});job=await finished(f.module);assert.equal(job.state,'succeeded',job.error);assert.equal(job.files[0].kind,'legacy-iobroker');assert.deepEqual(await fs.readFile(path.join(oldDir,name)),original);await assert.rejects(()=>f.module.command('legacyImport',{name:'../iobroker.json'}),/LEGACY_NAME/);}finally{await f.cleanup();}});

test('migration leaves inactive unsupported settings intact and refuses active missing installation',async()=>{const input={hostType:'Master',customerPreserved:17,cifsEnabled:true,connectType:'Expert'};const saved=await preflightLegacyConfig(input,{sourceEnabled:false});assert.equal(saved.config.hostType,'Master');assert.equal(saved.config.customerPreserved,17);const dir=await fs.mkdtemp(path.join(os.tmpdir(),'eos-backup-preflight-'));try{await assert.rejects(()=>preflightLegacyConfig({},{sourceEnabled:true,installationDir:dir,eosDataDir:dir}),/ENOENT/);}finally{await fs.rm(dir,{recursive:true,force:true});}});

test('custom controller dataFolder overlap is blocked before spawning a backup worker',async()=>{const f=await fixture();try{f.module.options.adapter.getBackupDataFolders=async()=>[path.join(f.root,'iobroker/iobroker-data/eos-admin.0')];await f.module.start();await assert.rejects(()=>f.module.command('start',{}),/CONTROLLER_DATA_FOLDER_OVERLAP/);assert.equal(f.module.getStatus().current,null);assert.deepEqual(await fs.readdir(path.join(f.dataDir,'jobs')),[]);}finally{await f.cleanup();}});

// Real timer + real child boundary: automatic backups still start after removing node-schedule.
test('cron schedule starts the real hosted backup worker and stop removes its next run',async()=>{const f=await fixture({minimalEnabled:true,iobrokerCron:true,iobrokerCronJob:'* * * * * *'});try{await f.module.start();assert.equal(f.module.getStatus().nextRuns.length,1);const job=await finished(f.module);assert.equal(job.state,'succeeded',job.error);assert.equal(job.files.length,3);await f.module.stop();assert.deepEqual(f.module.getStatus().nextRuns,[]);}finally{await f.cleanup();}});

test('real worker recovery set verifies controller fixture and restores exact private EOS files offline',async()=>{
    const f=await fixture();
    try{
        await f.module.start(); await f.module.command('start',{}); const job=await finished(f.module);
        assert.equal(job.state,'succeeded',job.error);
        const exported=await f.module.command('exportRecoveryKey',{confirm:true});
        const keyfile=path.join(f.root,'recovery-key.json'); await fs.writeFile(keyfile,exported.content,{mode:0o600});
        const set=job.files.find(file=>file.kind==='recovery-set');
        const output=path.join(f.root,'offline');
        const planPath=await require('../build/restore-cli').prepareRestoreSet(path.join(f.dataDir,'archives',set.name),keyfile,output);
        const plan=JSON.parse(await fs.readFile(planPath));
        const controller=plan.files.find(file=>file.kind==='iobroker');
        assert.equal(zlib.gunzipSync(await fs.readFile(path.join(output,controller.file))).toString(),'fixturecontrollerdata');
        const profile=plan.files.find(file=>file.kind==='eos-profile');
        const tar=require('tar-stream').extract(), values=new Map();
        tar.on('entry',(header,stream,next)=>{const chunks=[];stream.on('data',chunk=>chunks.push(chunk));stream.once('end',()=>{values.set(header.name,Buffer.concat(chunks));next();});});
        await require('node:stream/promises').pipeline(require('node:fs').createReadStream(path.join(output,profile.file)),zlib.createGunzip(),tar);
        assert.equal(values.get('eos-data/tls/device-key.pem').toString(),'ephemeral fixture identity');
        const manifest=JSON.parse(values.get('manifest.json'));
        for(const entry of manifest.files) assert.equal(require('node:crypto').createHash('sha256').update(values.get(entry.path)).digest('hex'),entry.sha256);
        assert.equal([...values.keys()].some(name=>name.includes('recovery.key')||name.includes('/archives/')),false);
        assert.equal(plan.automaticRestore,false);
    }finally{await f.cleanup();}
});

test('active historian missing from backup is blocked before worker and profile choice remains unchanged',async()=>{
    const f=await fixture({eosProfileEnabled:false});
    try{
        f.module.options.getHistoryBackupRequirement=()=>({provider:'influxdb2',url:'http://localhost:8086',bucket:'EOS',org:'EOS'});
        await f.module.start();
        assert.equal(f.module.getStatus().coverage.complete,false);
        await assert.rejects(()=>f.module.command('start',{}),/EOS_PROFILE_REQUIRED/);
        assert.equal(f.module.config.eosProfileEnabled,false);
        assert.equal(f.module.getStatus().current,null);
        assert.deepEqual(await fs.readdir(path.join(f.dataDir,'jobs')),[]);
    }finally{await f.cleanup();}
});
