import os,sys,subprocess,json,time,hashlib,pathlib,datetime
root=pathlib.Path('/workspace/scratch/741f792566ea/source-921/iobroker.eos-admin')
raw=pathlib.Path('/workspace/scratch/741f792566ea/audit-921/history')
node=sys.argv[1]; tag=sys.argv[2]
checks=[('regression', [node,'--test','test/eos-tariff-initial-outage.test.cjs','test/eos-tariff-cancel-transport.test.cjs','test/eos-customer-tariff-runtime.test.cjs','test/eos-tariff-quarter-hour-runtime.test.cjs','test/eos-influx-history-runtime.test.cjs','test/eos-influx-direct.test.cjs','test/eos-influx-security.test.cjs','test/eos-influx-sustained-outage.test.cjs']), ('cra-tariff-source',[node,'ui/scripts/verify-cra-tariff.cjs','--source'])]
if tag=='node24':
 checks.append(('baseline920-outage',[node,'--test','--test-name-pattern=921-HIS-001|unresolved cloud','test/eos-tariff-initial-outage.test.cjs']))
 checks.append(('baseline920-influx-sequence',[node,'--test','test/eos-influx-sustained-outage.test.cjs']))
results=[]
for label,cmd in checks:
 env=os.environ.copy()
 if label.startswith('baseline920'):env['EOS_AUDIT_SOURCE_ROOT']='/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin'
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();begin=time.monotonic()
 p=subprocess.run(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 file=raw/f'{label}-{tag}.log';file.write_bytes(p.stdout)
 result={'command':cmd,'cwd':str(root),'sourceOverride':env.get('EOS_AUDIT_SOURCE_ROOT'), 'startedUtc':start,'durationSeconds':round(time.monotonic()-begin,3),'exitCode':p.returncode,'log':file.name,'logSha256':hashlib.sha256(p.stdout).hexdigest()}
 results.append(result);print(json.dumps(result),flush=True)
(raw/f'results-{tag}.json').write_text(json.dumps(results,indent=2)+'\n')
