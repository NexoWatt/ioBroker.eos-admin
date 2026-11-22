/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express permission is prohibited.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2]);
const ts = require(path.join(root, 'node_modules/typescript'));
const rows = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    const rel = dir+'/'+entry.name;
    if(entry.isDirectory()) walk(rel);
    else if(entry.isFile() && /\.tsx?$/.test(rel)) {
      const text = fs.readFileSync(path.join(root,rel),'utf8');
      const ast=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,rel.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
      let explicitAny=0;
      function visit(node) { if(node.kind===ts.SyntaxKind.AnyKeyword) explicitAny++; ts.forEachChild(node,visit); }
      visit(ast);
      rows.push({path:rel,sha256:crypto.createHash('sha256').update(text).digest('hex'),explicitAny,noCheckDirective:ast.checkJsDirective?.enabled===false});
    }
  }
}
walk('src-ts'); walk('src-admin-tab/src');
console.log(JSON.stringify({typescript:ts.version,rootVersion:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,files:rows},null,2));
