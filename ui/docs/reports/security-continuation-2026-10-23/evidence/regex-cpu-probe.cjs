/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited. */
'use strict';
// Isolierter Nachweis des historischen XML-RegEx-Verhaltens; führt keinen Adapter aus.
const { spawnSync } = require('node:child_process');
const results=[];
for (const count of [1000,4000,16000,64000]) {
 const source=`const r=/<(?:[A-Za-z0-9_]+:)?Period\\b[^>]*>[\\s\\S]*?<\\/(?:[A-Za-z0-9_]+:)?Period>/gi; const input='<Period>'.repeat(${count}); const start=performance.now();r.test(input);console.log(JSON.stringify({bytes:input.length,ms:performance.now()-start}));`;
 const result=spawnSync(process.execPath,['-e',source],{timeout:2000,encoding:'utf8'});
 results.push({count,bytes:8*count,status:result.status,timedOut:result.error?.code==='ETIMEDOUT',measurement:result.stdout.trim()?JSON.parse(result.stdout):null});
}
console.log(JSON.stringify({node:process.version,scope:'Original regex only, not whole adapter; isolated subprocess timeout',results},null,2));
