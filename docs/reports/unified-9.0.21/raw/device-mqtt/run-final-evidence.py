import subprocess,json,datetime,pathlib,os,time,glob,hashlib
base=pathlib.Path('/workspace/scratch/741f792566ea');root=base/'source-921/iobroker.eos-admin';out=root/'docs/reports/unified-9.0.21/raw/device-mqtt'
commands=[]
nodes={'22':str(base/'node22-runtime/package/bin/node'),'24':'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'}
for version,node in nodes.items():
 commands.append((f'baseline-resources-node{version}',[node,'--test','modules/devices/test/mqttResourceBounds.test.js']))
 commands.append((f'all-devices-final-node{version}',[node,'--test']+sorted(glob.glob('modules/devices/test/*.test.*',root_dir=root))))
 commands.append((f'types-final-node{version}',[node,'node_modules/typescript/bin/tsc','-p','modules/devices/tsconfig.mqtt-lifecycle.json']))
 commands.append((f'lint-final-node{version}',[node,'node_modules/eslint/bin/eslint.js','-c','modules/devices/eslint.hosted.config.mjs','modules/devices/lib/drivers/mqtt.js','modules/devices/lib/drivers/mqttPendingOperations.js','modules/devices/test/mqttCommandLifecycle.test.js','modules/devices/test/mqttResourceBounds.test.js','modules/devices/test/mqttRuntimeSession.test.js']))
 commands.append((f'env-node{version}',[node,'-e',"console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,uid:process.getuid(),mqtt:require('mqtt/package.json').version,typescript:require('typescript/package.json').version}))"]))
receipts=[]
for name,cmd in commands:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
 env=os.environ.copy()
 if name.startswith('baseline-resources'): env['EOS_TEST_ROOT']=str(base/'source-920/iobroker.eos-admin')
 r=subprocess.run(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=150)
 (out/(name+'.log')).write_text(r.stdout)
 receipts.append({'name':name,'startedUtc':start,'durationSeconds':round(time.monotonic()-t,3),'command':cmd,'cwd':str(root),'exitCode':r.returncode,'expectedBaselineFailure':name.startswith('baseline-resources'),'environmentOverrides':({'EOS_TEST_ROOT':env['EOS_TEST_ROOT']} if name.startswith('baseline-resources') else {})})
 (out/'commands-final.json').write_text(json.dumps(receipts,indent=2))
 print(name,r.returncode,round(time.monotonic()-t,2),flush=True)
