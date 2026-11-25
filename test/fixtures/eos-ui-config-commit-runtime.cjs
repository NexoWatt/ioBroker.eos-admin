'use strict';
// Real NexoWattVis configuration methods behind the real process bridge. Only
// engine/network startup is omitted; the controller is supplied by the parent test.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const filename = path.resolve(__dirname, '../../ui/main.js');
const compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.TestRuntime = NexoWattVis;\n', filename);
exports.createHostedRuntime = (owner, bridge) => {
  const adapter = new compiled.exports.TestRuntime({ owner, bridge });
  return {
    async start() { await adapter.loadInstallerConfigFromState(); },
    async startOperational() {},
    async stop() { await adapter.stopStateWrites(); },
    status() { return { state: 'ready', active: true, emsReady: true, canWrite: bridge.canWrite() }; },
    handle(_req, _res, next) { next(); },
    getHistoryBackupRequirement() { return { provider: 'none' }; },
    async reconcileDeviceEms([command]) {
      if (command === 'persist') {
        const patch = structuredClone(adapter._nwInstallerConfigPatch);
        patch.tariffProvider.enabled = true;
        const persisted = await adapter.persistInstallerConfigToState(patch);
        if (persisted === true) {
          adapter._nwInstallerConfigPatch = patch;
          adapter.config = adapter.nwApplyInstallerPatchToRuntimeConfig(adapter.config, patch);
        }
        return { persisted, runtimeEnabled: adapter.config.tariffProvider.enabled };
      }
      return { runtimeEnabled: adapter.config.tariffProvider.enabled };
    },
  };
};
