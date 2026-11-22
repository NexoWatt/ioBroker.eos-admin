'use strict';
/** Reale Modulmanager-Registrierung mit isolierten Bestandsmodulen:
 * NVP darf im statischen Bestand keine zusätzliche Modultelemetrie erzeugen.
 * Der echte NVP-Beobachter bleibt auch bei deaktivierter EMS-Diagnose erreichbar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../ems/module-manager.js');
const nativeRequire = createRequire(filename);
class LegacyModuleStub {
  setDeferredDynamicPv() {}
  async init() {}
  async tick() {}
  async deactivate() { return { ok: true }; }
}
const isolatedModule = { exports: {} };
vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(id => {
  if (id.startsWith('./modules/') && id !== './modules/nvp-topology') return new Proxy({}, { get: () => LegacyModuleStub });
  return nativeRequire(id);
}, isolatedModule, isolatedModule.exports);
const { ModuleManager } = isolatedModule.exports;

test('Manager: statischer Beobachter erzeugt keine zusätzlichen Modulstates und wird beendet', async () => {
  const writes = [], reads = [];
  const adapter = {
    config: { diagnostics: { enabled: false }, installerConfig: {} },
    log: { warn() {}, info() {}, debug() {}, error() {} },
    setStateAsync: async (id, value) => { writes.push({ id, value }); },
    setObjectNotExistsAsync: async () => {},
    getForeignStatesAsync: async ids => { reads.push(ids); return {}; },
  };
  const manager = new ModuleManager(adapter, null);
  try {
    await manager.init();
    assert.equal(typeof adapter._nwPreviewNvpTopology, 'function');
    assert.equal(manager.modules.some(row => row.key === 'nvpTopology'), false);
    await manager.tick();
    assert.equal(reads.length, 0);
    assert.equal(adapter._nwNvpTopologyStatus.status, 'static');
    assert.equal(writes.some(entry => entry.id.startsWith('nvpTopology.') || entry.value?.val === 'nvpTopology'), false);
    assert.equal(manager.lastTickDiag.results.some(row => row.key === 'nvpTopology'), false);
  } finally { manager.stop(); }
  assert.equal(adapter._nwPreviewNvpTopology, undefined);
});
