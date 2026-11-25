'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = '/workspace/scratch/741f792566ea/source-921/iobroker.eos-admin';
const baseline = '/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
const local = createRequire(path.join(root, 'package.json'));
const { ESLint } = local('eslint');
const js = local('@eslint/js');
const globals = local('globals');
const files = ['ui/src-ts/runtime-executables/ems/modules/tariff-provider.ts', 'ui/src-ts/runtime-executables/ems/services/tariff-provider-registry.ts', 'test/eos-tariff-initial-outage.test.cjs', 'test/eos-tariff-cancel-transport.test.cjs', 'test/eos-influx-sustained-outage.test.cjs', 'test/eos-customer-tariff-runtime.test.cjs', 'test/eos-tariff-quarter-hour-runtime.test.cjs'];
(async () => {
 const lint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: [{ files: ['**/*.ts','**/*.cjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node }, rules: { ...js.configs.recommended.rules, 'no-eval':'error','no-implied-eval':'error','no-new-func':'error','no-proto':'error','no-extend-native':'error','no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none'}] } }] });
 const report=[];
 for (const file of files) {
  const variants={};
  for (const [name, dir] of [['baseline920',baseline],['candidate921',root]]) {
   if(!fs.existsSync(path.join(dir,file)))continue;
   const source=fs.readFileSync(path.join(dir,file),'utf8');
   const [result]=await lint.lintText(source,{filePath:path.join(root,file)});
   variants[name]=result.messages.map(row=>({ruleId:row.ruleId,message:row.message,line:row.line,sourceLine:source.split('\n')[row.line-1].trim()}));
  }
  const fingerprint=row=>JSON.stringify([row.ruleId,row.message,row.sourceLine]);
  const previous=new Set((variants.baseline920||[]).map(fingerprint));
  report.push({file,...variants,newDiagnostics:variants.candidate921.filter(row=>!previous.has(fingerprint(row)))});
 }
 console.log(JSON.stringify({node:process.version,mode:'ESLint recommended syntax/control-flow checks; no type-information claim for legacy ts-nocheck modules',files:report},null,2));
 process.exitCode=report.some(row=>row.newDiagnostics.length)?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
