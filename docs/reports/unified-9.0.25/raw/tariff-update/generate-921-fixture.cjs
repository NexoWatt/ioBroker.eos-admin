'use strict';
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = '/workspace/scratch/b0b00b64c39c/work-recovery/iobroker.eos-admin';
const old = '/workspace/scratch/741f792566ea/review-921/source/extracted/iobroker.eos-admin';
const file = path.join(old, 'ui/main.js');
const source = fs.readFileSync(file, 'utf8');
const m = new Module(file, module); m.filename=file; m.paths=Module._nodeModulePaths(path.dirname(file));
m._compile(source + '\nmodule.exports.TestRuntime=NexoWattVis;\n', file);
const {createHarness} = require(path.join(root, 'ui/test/unified/http-harness.cjs'));
(async () => {
 const h=await createHarness();
 try {
  const runtime=new m.exports.TestRuntime({owner:h.owner, bridge:h.bridge});
  const providers=[];
  for (const id of ['tibber','entsoe','energyzero','market-profile','custom-rest','manual-dp']) {
   const patch={tariffProvider:{enabled:true,providerId:id,sourceId:id==='market-profile'?'entsoe':id,providerProfileId:id==='market-profile'?'awattar':'local-provider',
    country:'DE',timeZone:'Europe/Berlin',homeId:'fixture-home',priceComponent:'total',activateTariffLogic:false,automaticMode:false,autoCoupleDatapoints:false,
    resolutionMinutes:30,refreshMinutes:45,maxStaleMinutes:240,timeoutMs:4500,
    credentials:{accessToken:'synthetic-tibber-update-token',securityToken:'synthetic-entsoe-update-token',apiKey:'synthetic-rest-update-key'},
    retainedProviderCredentials:{previous:{accessToken:'synthetic-retained-update-token'}},
    formula:{marketMultiplier:1.05,supplierMarkupEurPerKwh:0.04,gridVariableEurPerKwh:0.05,taxEurPerKwh:0.02,otherVariableEurPerKwh:0,vatPct:19,priceIncludesVat:true},
    customRest:{url:'https://example.invalid/tariff',method:'GET',authMode:'api-key',headersJson:'',body:'',arrayPath:'prices',startPath:'startsAt',endPath:'endsAt',pricePath:'total',currencyPath:'currency',unit:'EUR/kWh',apiKeyHeader:'x-api-key'}},
   datapoints:{priceCurrent:'alias.0.tariff.current',priceAverage:'alias.0.tariff.average',priceTodayJson:'alias.0.tariff.today',priceTomorrowJson:'alias.0.tariff.tomorrow'},
   settings:{dynamicTariff:true,tariffMode:0,price:0.173,tariffPvSeasonEnabled:true,tariffPvSeasonAiEnabled:false,tariffPvSeasonQ1Factor:0.45},
   emsApps:{schemaVersion:1,apps:{tariff:{installed:true,enabled:true}}}};
   assert.equal(await runtime.persistInstallerConfigToState(patch),true);
   const stateJson=h.states.get('eos-admin.0.installer.configJson').val;
   assert.deepEqual(JSON.parse(stateJson),patch);
   providers.push({id,stateJson});
  }
  const fixture={origin:{version:'9.0.21',file:'ui/main.js',sha256:crypto.createHash('sha256').update(source).digest('hex'),writer:'NexoWattVis.persistInstallerConfigToState',credentials:'synthetic-only'},providers};
  fs.mkdirSync(path.join(root,'test/fixtures'),{recursive:true});
  fs.writeFileSync(path.join(root,'test/fixtures/tariff-provider-9.0.21.json'),JSON.stringify(fixture,null,2)+'\n');
  console.log('Original 9.0.21 writer generated and verified 6 synthetic provider fixtures; no provider requests.');
 } finally {await h.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
