'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../work/NexoWatt_UI_1.0.30');
const ts = require(path.join(root, 'node_modules/typescript'));
const originalJs = Module._extensions['.js'];
const originalResolve = Module._resolveFilename;
const virtualHelper = path.join(root, 'lib/config-boundary-contracts.js');
Module._resolveFilename = function(request, parent, ...rest) {
  if (parent && request.startsWith('.') && [virtualHelper, virtualHelper.slice(0, -3)].includes(path.resolve(path.dirname(parent.filename), request))) return virtualHelper;
  return originalResolve.call(this, request, parent, ...rest);
};
Module._extensions['.js'] = (mod, filename) => {
  const relative = path.relative(root, filename).split(path.sep).join('/');
  if (!['lib/nvp-config-api.js', 'lib/dynamic-grid-config-api.js', 'lib/config-boundary-contracts.js', 'lib/http-error-boundary.js'].includes(relative)) return originalJs(mod, filename);
  const source = path.join(root, 'src-ts/runtime-executables', relative.replace(/\.js$/, '.ts'));
  return mod._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: source }).outputText, filename);
};
