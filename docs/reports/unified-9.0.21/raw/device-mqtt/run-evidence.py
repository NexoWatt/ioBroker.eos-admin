import subprocess,json,datetime,pathlib,os,time
base=pathlib.Path('/workspace/scratch/741f792566ea')
root=base/'source-921/iobroker.eos-admin'
out=root/'docs/reports/unified-9.0.21/raw/device-mqtt';out.mkdir(parents=True,exist_ok=True)
nodes={'22':str(base/'node22-runtime/package/bin/node'),'24':'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'}
jobs=[]
for version,node in nodes.items():
 for repro in ['mqtt-command-replay-repro.cjs','mqtt-shutdown-repro.cjs']:
  jobs.append((f'baseline-{repro[:-4]}-node{version}',[node,str(base/'audit-921/devices'/repro)],{'EOS_TEST_ROOT':str(base/'source-920/iobroker.eos-admin')},True))
 jobs.append((f'baseline-message-session-node{version}',[node,'--test','--test-name-pattern=delayed old','modules/devices/test/mqttCommandLifecycle.test.js'],{'EOS_TEST_ROOT':str(base/'source-920/iobroker.eos-admin')},True))
 jobs.append((f'regression-node{version}',[node,'--test','modules/devices/test/mqttCommandLifecycle.test.js','modules/devices/test/tesvoltMqttTransport.test.js','modules/devices/test/hostedModule.test.js','modules/devices/test/runtimeLiveness.test.js','modules/devices/test/deviceAliasFreshness.test.js','modules/devices/test/deviceAliasSemantics.test.js'],{},False))
receipts=[]
for name,cmd,extra,expected_fail in jobs:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
 env=os.environ.copy();env.update(extra)
 try:
  r=subprocess.run(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=90)
  code=r.returncode;data=r.stdout
 except subprocess.TimeoutExpired as e:code=124;data=(e.stdout or b'').decode() if isinstance(e.stdout,bytes) else e.stdout or ''
 (out/(name+'.log')).write_text(data)
 receipts.append({'name':name,'startedUtc':start,'durationSeconds':round(time.monotonic()-t,3),'command':cmd,'cwd':str(root),'environmentOverrides':extra,'exitCode':code,'expectedBaselineFailure':expected_fail})
 (out/'commands.json').write_text(json.dumps(receipts,indent=2))
 print(name,code,round(time.monotonic()-t,2),flush=True)
