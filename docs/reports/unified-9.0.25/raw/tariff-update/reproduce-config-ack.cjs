'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const repo='/workspace/scratch/b0b00b64c39c/work-recovery/iobroker.eos-admin';
const scratch='/workspace/scratch/b0b00b64c39c/tariff-update-review';
const ts=require(path.join(repo,'node_modules/typescript'));
for(const name of ['eosUiProcess','eosUiProcessWorker','eosUiProcessRpc','eosUiSecretCodec']){
 const source=fs.readFileSync(path.join(repo,'src/lib',name+'.ts'),'utf8');
 fs.writeFileSync(path.join(scratch,name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
}
const fixture=path.join(scratch,'actual-persist-fixture.cjs');
fs.writeFileSync(fixture, `
'use strict';
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const filename=${JSON.stringify(path.join(repo,'ui/main.js'))};
const moduleCopy=new Module(filename,module);moduleCopy.filename=filename;moduleCopy.paths=Module._nodeModulePaths(path.dirname(filename));
moduleCopy._compile(fs.readFileSync(filename,'utf8')+'\\nmodule.exports.ReviewRuntime=NexoWattVis;\\n',filename);
exports.createHostedRuntime=(owner,bridge)=>{
 const adapter=new moduleCopy.exports.ReviewRuntime({owner,bridge});
 adapter.config={tariffProvider:{enabled:false,providerId:'manual-dp'},emsApps:{apps:{}}};
 adapter._nwInstallerConfigPatch={tariffProvider:{enabled:false,providerId:'manual-dp'}};
 return {async start(){},async startOperational(){},async stop(){await adapter.stopStateWrites();},status(){return {state:'ready',active:true,emsReady:true,canWrite:bridge.canWrite()};},handle(req,res,next){next();},getHistoryBackupRequirement(){return {provider:'none'};},async reconcileDeviceEms([command]){
  if(command==='persist'){
   const patch={tariffProvider:{enabled:true,providerId:'fixture-provider'}};
   const persisted=await adapter.persistInstallerConfigToState(patch);
   if(persisted===true){adapter._nwInstallerConfigPatch=patch;adapter.config=adapter.nwApplyInstallerPatchToRuntimeConfig(adapter.config,patch);}
   return {persisted,runtimeEnabled:adapter.config.tariffProvider.enabled,patchEnabled:adapter._nwInstallerConfigPatch.tariffProvider.enabled};
  }
  return {runtimeEnabled:adapter.config.tariffProvider.enabled,patchEnabled:adapter._nwInstallerConfigPatch.tariffProvider.enabled};
 }};
};
`);
const {createEosUiProcess}=require(path.join(scratch,'eosUiProcess.js'));
const acl={owner:'system.user.admin',ownerGroup:'system.group.administrator',object:0x600,state:0x600};
let state=null,issuedAt=null,committedAt=null;const logs=[];
const object={type:'state',common:{read:false},native:{},acl};
const owner={namespace:'eos-admin.0',instance:0,config:{eosUi:{}},log:{info(){},debug(){},warn(message){logs.push(message)},error(message){logs.push(message)}},
 getForeignObjectAsync:async id=>id==='system.config'?{native:{}}:object,
 extendForeignObjectAsync:async()=>undefined,
 setForeignStateAsync:async(id,value)=>{issuedAt=Date.now();await new Promise(resolve=>setTimeout(resolve,2200));state={id,value};committedAt=Date.now();return id;}};
const bridge={canWrite:()=>true,originAllowed:()=>false,getLicense:()=>({valid:false}),resolveAccess:async()=>null,isListening:()=>true};
const runtime=createEosUiProcess(owner,bridge,{baseDir:repo,runtimePath:fixture,workerPath:path.join(scratch,'eosUiProcessWorker.js')});
(async()=>{
 try{
  await runtime.start();
  const before=runtime.status().process;
  const response=await runtime.reconcileDeviceEms(['persist']);const respondedAt=Date.now();
  const stillRunning=runtime.status().process;
  const stopStartedAt=Date.now();await runtime.stop();const stoppedAt=Date.now();
  const summary={response,writeIssued:issuedAt!==null,ackDelayMs:committedAt-issuedAt,responseDelayFromWriteMs:respondedAt-issuedAt,
    committedBeforeResponse:committedAt<=respondedAt,committedEnabled:state?JSON.parse(state.value.val).tariffProvider.enabled:null,
    runtimeRestartedBeforeStop:stillRunning.generation!==before.generation,processStateAtResponse:stillRunning.state,
    stopWaitMs:stoppedAt-stopStartedAt,stopAfterCommit:stoppedAt>=committedAt,logCodes:logs.filter(x=>/credential-state-write-failed/.test(x)).map(()=> 'credential-state-write-failed')};
  console.log(JSON.stringify(summary,null,2));fs.writeFileSync(path.join(scratch,'config-ack-result.json'),JSON.stringify(summary,null,2)+'\n');
 }finally{await runtime.stop().catch(()=>undefined);}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
