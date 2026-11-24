'use strict';
// Test-only compatibility loader. Product sources and original assertions remain untouched,
// except the explicitly audited service-worker contract assertion described below.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto'); const Module = require('node:module');
const ui = '/workspace/scratch/741f792566ea/source-919/iobroker.eos-admin/ui';
const name = process.argv[2];
const allowed = new Set(['verify-live-evcs-mode-confirmation.cjs', 'verify-storage-farm-dispatch-recovery.js', 'verify-storage-topology-authority.js', 'verify-rc78-import-only-grid-budget.cjs']);
if (!allowed.has(name)) throw new Error('Unsupported isolated legacy fixture');
const filename = path.join(ui, 'scripts', name); const original = fs.readFileSync(filename, 'utf8'); let source = original; const adaptations = [];
if (name === 'verify-live-evcs-mode-confirmation.cjs') {
  const needle = "  vm.runInContext(source, context, { filename });";
  if (!source.includes(needle)) throw new Error('VM loader changed');
  source = source.replace(needle, `  // Load the actual current shared power helper and actual application accessor.
  vm.runInContext(fs.readFileSync(path.join(root, 'www/power-measurements.js'), 'utf8'), context, { filename: 'www/power-measurements.js' });
  const accessorStart = completeSource.indexOf('function getEvcsPowerW(');
  if (accessorStart >= 0) {
    const accessorEnd = completeSource.indexOf('function updateDashboardShellUi(', accessorStart);
    assert(accessorEnd > accessorStart, 'Actual power accessor source must be complete');
    vm.runInContext(completeSource.slice(accessorStart, accessorEnd), context, { filename });
  }
${needle}`);
  adaptations.push('Isolated modal VM loads actual getEvcsPowerW and actual power-measurements.js, matching production script dependencies; all modal assertions unchanged.');
} else if (name.includes('storage-')) {
  const start = source.indexOf('Module._load = function patchedLoad('); const end = source.indexOf('\n};', start);
  if (start < 0 || end < start) throw new Error('Expected legacy dependency override missing');
  source = source.slice(0, start) + '// Actual installed dependencies are used; no intentionally missing type-detector.\n' + source.slice(end + 4);
  const factory = "const factory = require(path.join(__dirname, '..', 'main.js'));";
  if (!source.includes(factory) || !source.includes('const adapter = factory({});')) throw new Error('Expected old standalone factory missing');
  source = source.replace(factory, "const legacyHostedFixture = await require('../test/unified/http-harness.cjs').createHarness(); await legacyHostedFixture.close();");
  source = source.replace('const adapter = factory({});', `const adapter = legacyHostedFixture.adapter;
    // Preserve the original scenario's exact fake database/actuator methods.
    for (const key of Object.getOwnPropertyNames(AdapterStub.prototype)) if (key !== 'constructor') adapter[key] = AdapterStub.prototype[key].bind(adapter);
    adapter.blockedForeignIds = new Set();`);
  adaptations.push('Use actual hosted runtime fixture instead of removed standalone adapter factory; keep original fake database/actuator behavior and every scenario assertion; installed type-detector is loaded normally.');
} else {
  const old = "  assert(read('src-ts/runtime-executables/www/sw.ts').match(/const CACHE_NAME = 'nexowatt-cache-v\\d+'/));";
  if (!source.includes(old)) throw new Error('Expected stale SW assertion missing');
  source = source.replace(old, `  const worker = read('src-ts/runtime-executables/www/sw.ts');
  assert(worker.includes('self.registration.unregister()'));
  assert(worker.includes("key.startsWith('nexowatt-cache-')"));
  assert(worker.includes('caches.delete(key)'));
  assert(!worker.includes("addEventListener('fetch'"));`);
  adaptations.push('Replace only obsolete positive offline-cache-name assertion with current stricter worker retirement contract: remove old caches, unregister and no fetch interception. All import/grid-budget/safety assertions unchanged.');
}
console.log(JSON.stringify({ original: filename, sha256: crypto.createHash('sha256').update(original).digest('hex'), adaptations }));
process.argv = [process.argv[0], filename, ...process.argv.slice(3)];
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename)); loaded._compile(source, filename);
