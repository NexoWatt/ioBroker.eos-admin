'use strict';
// Compile canonical source in memory; release integration uses generated artifacts.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../../ui/src-ts/runtime-executables/lib/ephemeral-cache.ts');
const js = require('typescript').transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: 9, module: 1 },
}).outputText;
const target = { exports: {} };
vm.runInNewContext(js, { exports: target.exports, module: target, Map, setTimeout, clearTimeout,
    require: createRequire(filename) }, { filename });
module.exports = target.exports;
