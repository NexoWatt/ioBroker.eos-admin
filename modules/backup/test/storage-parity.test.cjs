'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {randomUUID,randomBytes}=require('node:crypto');const {Readable}=require('node:stream');
const http=require('../build/http');const storage=require('../build/storage');const remote=require('../build/storageRemote');
const {retentionCandidates,retentionCount}=require('../build/storageRetention');const {storageList,storageFetch,receiveRemote}=require('../build/storageDownload');const {cachedToken}=require('../build/tokenCache');const {encryptFile,decryptFile}=require('../build/files');
const name=(kind='iobroker',i=0)=>`eos-backup-${randomUUID()}-${kind}-${i}.nwb`;
const entry=(name,time=Date.now(),size=100)=>({name,id:name,mtime:time,size});
async function fixture(t,config={}){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'eos-storage-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const workDir=path.join(dir,'work');await fs.mkdir(workDir,{mode:0o700});const target=path.join(dir,'remote');await fs.mkdir(target,{mode:0o700});const ctx={config:{enabled:true,...config},installationDir:dir,eosDataDir:dir,dataDir:dir,workDir,jobId:randomUUID(),kind:'iobroker',key:randomBytes(32).toString('base64'),retentionEnabled:true};return {ctx,target,dir};}
test('retention preserves count per type, multi-DB factor, current run, unknown legacy archives and manual runs',()=>{
 const c={enabled:true,ftpDeleteOldBackup:true,minimalDeleteAfter:2,mySqlMulti:true,mySqlEvents:[{},{}]};const current=name('mysql',3),others=Array.from({length:5},(_,i)=>entry(name('mysql',i),i+1));const rows=[...others,entry(current,20),entry(name('pgsql'),1),entry('mysql_2026-11-23_backup.tar.gz',1)];
 assert.equal(retentionCount(c,'ftp','iobroker','mysql'),4);assert.deepEqual(retentionCandidates(c,'ftp','iobroker',rows,[current]).map(x=>x.name),[others[1].name,others[0].name]);
 assert.deepEqual(retentionCandidates(c,'ftp','iobroker',rows,[current],false),[]);
 assert.deepEqual(retentionCandidates({...c,minimalDeleteAfter:0},'ftp','iobroker',rows,[current]),[]);
 assert.throws(()=>retentionCandidates(c,'ftp','iobroker',others,[current]),/INCOMPLETE/);
 assert.throws(()=>retentionCandidates(c,'ftp','iobroker',[...rows,entry(others[0].name,2)],[current]),/METADATA/);
 assert.equal(retentionCount({...c,advancedDelete:true,ftpDeleteAfter:1},'ftp','iobroker','mysql'),2);
 assert.equal(retentionCount({enabled:true,cifsDeleteOldBackup:true,connectType:'SDCard',minimalDeleteAfter:20,sdCardInfluxRetention:3,influxDBMulti:true,influxDBEvents:[{},{}]},'cifs','iobroker','influxDB'),6);
});
test('WebDAV listing rejects XML entities, malformed known metadata and path escapes, while legacy entries stay visible',()=>{
 const current=name(),base=new URL('https://dav.example/dav/backups/');
 const response=(href,size='120',modified='Mon, 23 Nov 2026 07:00:00 GMT')=>`<d:response><d:href>${href}</d:href><d:propstat><d:prop><d:getcontentlength>${size}</d:getcontentlength><d:getlastmodified>${modified}</d:getlastmodified><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
 const xml=`<d:multistatus xmlns:d="DAV:">${response('/dav/backups/'+current)}${response('/dav/backups/mysql_2026-11-23_backup.tar.gz')}${response('/elsewhere/'+name())}</d:multistatus>`;
 const list=remote.parseWebdavListing(xml,base);assert.equal(list.length,2);assert.equal(list[0].name,current);
 assert.throws(()=>remote.parseWebdavListing('<!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+xml,base),/WEBDAV_XML/);
 assert.throws(()=>remote.parseWebdavListing(`<d:multistatus xmlns:d="DAV:">${response('/dav/backups/'+current,'bad')}</d:multistatus>`,base),/METADATA/);
 assert.throws(()=>storage.remoteDir({enabled:true,ftpDir:'/a/../b'},'ftp','iobroker'),/REMOTE_PATH/);
 assert.throws(()=>storage.remoteDir({enabled:true,ftpDir:'/a/%2e%2e/b'},'ftp','iobroker'),/REMOTE_PATH/);
});
test('WebDAV creates only configured child collections and verifies a pre-existing collection',async t=>{
 const {ctx}=await fixture(t,{webdavURL:'https://dav.example/remote.php/dav/files/operator/',webdavDir:'backup/eos',webdavUsername:'fixture',webdavPassword:'fixture'});const calls=[];
 t.mock.method(http,'http',async(url,method)=>{calls.push([url.pathname,method]);return method==='MKCOL'?{status:405,body:Buffer.alloc(0),headers:{}}:{status:207,body:Buffer.from('<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:resourcetype><d:collection></d:collection></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>'),headers:{}};});
 await remote.ensureWebdavDirectory(ctx);assert.deepEqual(calls.map(x=>x[0]),['/remote.php/dav/files/operator/backup/','/remote.php/dav/files/operator/backup/','/remote.php/dav/files/operator/backup/eos/','/remote.php/dav/files/operator/backup/eos/']);
});
test('mounted target retention deletes only older configured new archives after all uploads',async t=>{
 const f=await fixture(t);Object.assign(f.ctx.config,{cifsEnabled:true,connectType:'Copy',mountedBackupPath:f.target,cifsDeleteOldBackup:true,minimalDeleteAfter:1});
 const old=name(),current=name(),legacy='iobroker_2026-11-21_backupiobroker.tar.gz';await fs.writeFile(path.join(f.target,old),'old');await require('../build/storageOwnership').saveOwnedArchives(f.ctx,'cifs',new Set([old]));await fs.utimes(path.join(f.target,old),1,1);await fs.writeFile(path.join(f.target,legacy),'legacy');const source=path.join(f.dir,current);await fs.writeFile(source,'new');
 await storage.uploadArchives(f.ctx.config,[source],'iobroker',f.ctx);await assert.rejects(()=>fs.stat(path.join(f.target,old)),/ENOENT/);assert.equal(await fs.readFile(path.join(f.target,legacy),'utf8'),'legacy');assert.equal(await fs.readFile(path.join(f.target,current),'utf8'),'new');
 const manual=name();await fs.writeFile(path.join(f.dir,manual),'manual');f.ctx.retentionEnabled=false;await storage.uploadArchives(f.ctx.config,[path.join(f.dir,manual)],'iobroker',f.ctx);assert.equal(await fs.readFile(path.join(f.target,current),'utf8'),'new');
});
test('shared-folder retention is isolated by encrypted ownership and target; collisions preserve existing archives',async t=>{
 const f=await fixture(t),ownership=require('../build/storageOwnership');Object.assign(f.ctx.config,{cifsEnabled:true,connectType:'Copy',mountedBackupPath:f.target,cifsDeleteOldBackup:true,minimalDeleteAfter:1});
 const second={...f.ctx,key:randomBytes(32).toString('base64'),jobId:randomUUID()};const other=name(),old=name(),current=name();
 await fs.writeFile(path.join(f.target,other),'other appliance');await fs.writeFile(path.join(f.target,old),'own prior backup');await fs.utimes(path.join(f.target,old),1,1);
 await ownership.saveOwnedArchives(second,'cifs',new Set([other]));await ownership.saveOwnedArchives(f.ctx,'cifs',new Set([old]));await fs.writeFile(path.join(f.dir,current),'own current backup');
 await storage.uploadArchives(f.ctx.config,[path.join(f.dir,current)],'iobroker',f.ctx);
 assert.equal(await fs.readFile(path.join(f.target,other),'utf8'),'other appliance');await assert.rejects(()=>fs.stat(path.join(f.target,old)),/ENOENT/);
 assert.deepEqual([...await ownership.ownedArchives(second,'cifs')],[other]);assert.deepEqual([...await ownership.ownedArchives(f.ctx,'cifs')],[current]);
 const changed={...f.ctx,config:{...f.ctx.config,mountedBackupPath:path.join(f.dir,'different-target')}};assert.equal((await ownership.ownedArchives(changed,'cifs')).size,0);
 await fs.writeFile(path.join(f.dir,current),'replacement must not overwrite');await assert.rejects(()=>storage.uploadArchives(f.ctx.config,[path.join(f.dir,current)],'iobroker',f.ctx),/EEXIST/);assert.equal(await fs.readFile(path.join(f.target,current),'utf8'),'own current backup');
 const ledgerFiles=await fs.readdir(path.join(f.dir,'retention'));for(const file of ledgerFiles){const bytes=await fs.readFile(path.join(f.dir,'retention',file));assert(!bytes.includes(Buffer.from(other)));assert(!bytes.includes(Buffer.from(current)));}
});
test('Copy mode keeps separate original per-kind directories',async t=>{
 const f=await fixture(t),ccu=path.join(f.dir,'ccu');await fs.mkdir(ccu,{mode:0o700});Object.assign(f.ctx.config,{cifsEnabled:true,connectType:'Copy',cifsOwnDir:true,cifsMinimalDir:f.target,cifsCcuDir:ccu});
 assert.equal(await storage.mountedTarget(f.ctx.config,'iobroker'),f.target);assert.equal(await storage.mountedTarget(f.ctx.config,'ccu'),ccu);
 const archive=name('ccu');await fs.writeFile(path.join(f.dir,archive),'ccu only');const ctx={...f.ctx,kind:'ccu'};await storage.uploadArchives(ctx.config,[path.join(f.dir,archive)],'ccu',ctx);assert.equal(await fs.readFile(path.join(ccu,archive),'utf8'),'ccu only');await assert.rejects(()=>fs.stat(path.join(f.target,archive)),/ENOENT/);
});
test('remote archive fetch is private, verifies local-key NWB, refuses overwrite and encrypts legacy copy without deleting source',async t=>{
 const f=await fixture(t);Object.assign(f.ctx.config,{cifsEnabled:true,connectType:'Copy',mountedBackupPath:f.target});const raw=path.join(f.dir,'raw');await fs.writeFile(raw,'private fixture');const encrypted=name();await encryptFile(raw,path.join(f.target,encrypted),Buffer.from(f.ctx.key,'base64'),1000);
 const legacy='iobroker_2026-11-23_backupiobroker.tar.gz';await fs.writeFile(path.join(f.target,legacy),'old plaintext backup');
 const list=await storageList(f.ctx,'cifs');assert.equal(list.entries.length,2);assert(!JSON.stringify(list).includes(f.target));assert(list.entries.every(value=>!Object.hasOwn(value,'id')&&!Object.hasOwn(value,'url')));
 const fetched=await storageFetch(f.ctx,'cifs',encrypted);assert.equal(fetched.authentication,'verified-with-current-recovery-key');await assert.rejects(()=>storageFetch(f.ctx,'cifs',encrypted),/EEXIST/);
 const imported=await storageFetch(f.ctx,'cifs',legacy);assert.match(imported.name,/-legacy-iobroker-0.nwb$/);const restored=path.join(f.dir,'restored');await decryptFile(path.join(f.dir,'archives',imported.name),restored,Buffer.from(f.ctx.key,'base64'),1000);assert.equal(await fs.readFile(restored,'utf8'),'old plaintext backup');assert.equal(await fs.readFile(path.join(f.target,legacy),'utf8'),'old plaintext backup');assert.deepEqual(await fs.readdir(f.ctx.workDir),[]);
});
test('a downloaded archive with another recovery key is not reported as authenticated',async t=>{
 const f=await fixture(t);Object.assign(f.ctx.config,{cifsEnabled:true,connectType:'Copy',mountedBackupPath:f.target});const raw=path.join(f.dir,'raw');await fs.writeFile(raw,'different plant fixture');const encrypted=name();await encryptFile(raw,path.join(f.target,encrypted),randomBytes(32),1000);
 const result=await storageFetch(f.ctx,'cifs',encrypted);assert.equal(result.authentication,'recovery-key-required-or-damaged');assert.equal(result.sourceName,encrypted);assert.equal(await fs.readFile(path.join(f.dir,'archives',encrypted)).then(bytes=>bytes.subarray(0,8).toString()),'NWEOSBK1');
});
test('FTPS creates the configured directory, uses verified TLS and rejects a data-channel error promptly',async t=>{
 const Module=require('node:module'),{EventEmitter}=require('node:events');const original=Module._load;const calls=[];let failUpload=false;
 class Ftp extends EventEmitter{connect(options){calls.push(['connect',options]);queueMicrotask(()=>this.emit('ready'));}mkdir(dir,recursive,callback){calls.push(['mkdir',dir,recursive]);callback();}put(source,target,callback){calls.push(['put',source,target]);if(failUpload)queueMicrotask(()=>this.emit('error',new Error('private remote detail')));else callback();}end(){calls.push(['end']);}destroy(){calls.push(['destroy']);}}
 t.mock.method(Module,'_load',function(request,...args){return request==='ftp'?Ftp:original.call(this,request,...args);});
 const file=name();await storage.ftpUpload({enabled:true,ftpHost:'nas.example',ftpSecure:true},[file],'/backup/eos');assert.equal(calls[0][1].secure,true);assert.equal(calls[0][1].secureOptions.rejectUnauthorized,true);assert.deepEqual(calls[1],['mkdir','/backup/eos',true]);assert.equal(calls[2][2],'/backup/eos/'+file);
 failUpload=true;await assert.rejects(()=>storage.ftpUpload({enabled:true,ftpHost:'nas.example'},[file],'/backup/eos'),/FTPS_UPLOAD/);
});
test('cloud folder creation preserves explicit paths and rejects a conflicting file',async t=>{
 const calls=[];let dropboxConflict=false;
 t.mock.method(http,'json',async(url,method,headers,body)=>{calls.push([url,method,body]);if(url.includes('dropbox')){if(url.includes('create_folder')&&dropboxConflict)throw Object.assign(new Error('conflict'),{code:'EOS_BACKUP_REMOTE_HTTP_409'});return url.includes('get_metadata')?{'.tag':'file'}:{};}if(method==='GET')throw Object.assign(new Error('notfound'),{code:'EOS_BACKUP_REMOTE_HTTP_404'});return {id:'folder-'+calls.length,folder:{}};});
 await storage.ensureDropboxDirectory('fixture','/backup/eos');assert.deepEqual(calls.slice(0,2).map(x=>x[2].path),['/backup','/backup/eos']);
 await storage.ensureOneDriveDirectory('fixture','/backup/eos');assert.equal(calls.filter(x=>x[0].includes('children')).length,2);dropboxConflict=true;await assert.rejects(()=>storage.ensureDropboxDirectory('fixture','/backup'),/DROPBOX_DIRECTORY/);
});
test('streaming remote transfer aborts oversize/truncated data and never overwrites a destination',async t=>{
 const f=await fixture(t),dest=path.join(f.dir,'download');await assert.rejects(()=>receiveRemote({stream:Readable.from([Buffer.alloc(20)])},dest,10,10),/ARCHIVE_LIMIT/);await assert.rejects(()=>fs.stat(dest),/ENOENT/);
 await assert.rejects(()=>receiveRemote({stream:Readable.from([Buffer.alloc(4)])},dest,10,10),/REMOTE_CHANGED/);await assert.rejects(()=>fs.stat(dest),/ENOENT/);
 await receiveRemote({stream:Readable.from([Buffer.from('ten bytes!')])},dest,10,10);assert.equal(await fs.readFile(dest,'utf8'),'ten bytes!');
 await assert.rejects(()=>receiveRemote({stream:Readable.from([Buffer.alloc(10)])},dest,10,10),/EEXIST/);assert.equal(await fs.readFile(dest,'utf8'),'ten bytes!');
});
test('Google, Dropbox and OneDrive token rotations are persisted encrypted and retain omitted refresh tokens',async t=>{
 const f=await fixture(t,{googledriveAccessTokens:JSON.stringify({access_token:'old',refresh_token:'google-refresh',expiry_date:1}),dropboxTokenType:'default',dropboxAccessTokens:JSON.stringify({refresh_token:'drop-refresh',access_token_expires_on:'2000-01-01'}),onedriveAccessJson:'one-refresh'});let calls=0;
 t.mock.method(http,'json',async(url)=>{calls++;if(url.includes('simatec'))return {client_id:'fixture-client'};return {access_token:url.includes('dropbox')?'drop-new':'google-new',expires_in:3600};});
 t.mock.method(http,'http',async()=>({status:200,headers:{},body:Buffer.from(JSON.stringify({access_token:'one-new',expires_in:3600,refresh_token:''}))}));
 assert.equal(await storage.googleToken(f.ctx.config,f.ctx),'google-new');assert.equal(await storage.dropboxToken(f.ctx.config,f.ctx),'drop-new');assert.equal(await storage.oneDriveToken(f.ctx.config,f.ctx),'one-new');
 const count=calls;assert.equal(await storage.googleToken(f.ctx.config,f.ctx),'google-new');assert.equal(await storage.dropboxToken(f.ctx.config,f.ctx),'drop-new');assert.equal(await storage.oneDriveToken(f.ctx.config,f.ctx),'one-new');assert.equal(calls,count);
 assert.equal(JSON.parse(await cachedToken(f.ctx,'google',f.ctx.config.googledriveAccessTokens)).refresh_token,'google-refresh');assert.equal(JSON.parse(await cachedToken(f.ctx,'dropbox',f.ctx.config.dropboxAccessTokens)).refresh_token,'drop-refresh');assert.equal(JSON.parse(await cachedToken(f.ctx,'onedrive','one-refresh')).refresh_token,'one-refresh');
 const cache=await fs.readFile(path.join(f.dir,'provider-tokens.nwb'));assert(!cache.includes(Buffer.from('refresh')));assert(!cache.includes(Buffer.from('new')));
});
test('Google and Dropbox inventories paginate, OneDrive rejects external nextLink and never exposes signed links',async t=>{
 const f=await fixture(t,{googledriveEnabled:true,googledriveDir:'',googledriveAccessTokens:JSON.stringify({access_token:'fixture',expiry_date:Date.now()+3600000}),dropboxEnabled:true,dropboxTokenType:'custom',dropboxAccessToken:'fixture',dropboxDir:'',onedriveEnabled:true,onedriveDir:'',onedriveAccessJson:JSON.stringify({access_token:'fixture',expires_at:Date.now()+3600000})});const first=name(),second=name();let google=0,dropbox=0;
 t.mock.method(http,'json',async(url)=>{
  if(url.includes('googleapis'))return google++===0?{files:[{id:'g1',name:first,size:'100',modifiedTime:new Date().toISOString()}],nextPageToken:'next'}:{files:[{id:'g2',name:second,size:'100',modifiedTime:new Date().toISOString()}]};
  if(url.includes('dropbox'))return dropbox++===0?{entries:[{'.tag':'file',id:'id:d1',name:first,size:100,client_modified:new Date().toISOString()}],has_more:true,cursor:'next'}:{entries:[{'.tag':'file',id:'id:d2',name:second,size:100,client_modified:new Date().toISOString()}],has_more:false};
  return {value:[], '@odata.nextLink':'https://attacker.invalid/steal'};
 });
 assert.equal((await storageList(f.ctx,'googledrive')).entries.length,2);assert.equal((await storageList(f.ctx,'dropbox')).entries.length,2);await assert.rejects(()=>storageList(f.ctx,'onedrive'),/REMOTE_HOST/);
 for(const url of ['http://download.1drv.com/file','https://attacker.invalid/file','https://sharepoint.com.evil.invalid/file'])assert.throws(()=>remote.graphDownloadUrl(url),/DOWNLOAD_HOST/);
 assert.equal(remote.graphDownloadUrl('https://tenant.sharepoint.com/file?opaque=secret').hostname,'tenant.sharepoint.com');
});
