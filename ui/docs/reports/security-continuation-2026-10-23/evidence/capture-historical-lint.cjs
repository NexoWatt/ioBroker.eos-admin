'use strict';
const fs=require('node:fs');const path=require('node:path');
const root='/workspace/scratch/cd7c5428afc1/continuation-1.0.30/work/NexoWatt_UI_1.0.30';
const source='/workspace/scratch/cd7c5428afc1/continuation-1.0.30/evidence/lint-baseline-1.0.29';
const { ESLint }=require(path.join(root,'node_modules/eslint'));
const gate=require(path.join(root,'scripts/verify-eslint-security.cjs'));
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
(async()=>{
 const eslint=new ESLint({cwd:root});const findings=[];const excluded=[];const files=[];
 for (const file of walk(source).sort()) {
  const rel=path.relative(source,file).split(path.sep).join('/');const text=fs.readFileSync(file,'utf8');
  const [result]=await eslint.lintText(text,{filePath:path.join(root,rel)});
  const found=gate.fingerprintMessages(rel,text,result.messages);
  findings.push(...found.filter(f=>!f.fatal&&f.rule!=='<parser-or-inline-directive>'));
  excluded.push(...found.filter(f=>f.fatal||f.rule==='<parser-or-inline-directive>'));
  files.push({file:rel,sha256:gate.sha256(text)});
 }
 const baseline={schemaVersion:1,copyright:'Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Use, modification or distribution without express written permission is prohibited.',status:'OPEN HISTORICAL SCANNER FINDINGS; not reviewed-safe and not an ASVS compliance certificate',sourceVersion:'1.0.29',sourceArchiveSha256:'73714ad0975c6d1ae6a16f4a8fe8df354d04b075e915be72a35b53362f38a1ed',tools:{eslint:'10.13.0','@typescript-eslint/parser':'8.72.0','@typescript-eslint/eslint-plugin':'8.72.0','eslint-plugin-security':'4.2.0',typescript:'5.8.3'},files,findings:gate.inventory(findings),excludedBlockingDiagnostics:excluded};
 fs.writeFileSync(path.join(root,'docs/security/eslint-legacy-baseline.json'),JSON.stringify(baseline,null,2)+'\n');
 console.log(JSON.stringify({files:files.length,findings:findings.length,entries:baseline.findings.length,excluded}));
})().catch(e=>{console.error(e);process.exitCode=1});
