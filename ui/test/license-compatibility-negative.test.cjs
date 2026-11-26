'use strict';
/** Historische Negativsuite des eigenständigen NexoWatt-UI-Adapters vor der EOS-Zusammenführung.
 * Für dessen damaligen Quellstand gelten die lokalen HMAC- und Trialmethoden.
 * Der integrierte EOS-Adapter prüft den zentralen Lizenzvertrag unter test/eos-license*.test.cjs.
 * Zweiter technischer Review: echte Lizenzmethoden und enge Guard-Ausnahme;
 * keine Material-/Schlüsselliterale, erzeugte Schlüssel bleiben ausschließlich im Speicher. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { inspectContent } = require('../scripts/check-repository-secrets.cjs');
const root = path.resolve(__dirname, '..');
const names = new Set([
  '_nwNormalizeLicenseKey', '_nwLegacyLicenseSecret', '_nwLicenseSecret', '_nwLicenseSecrets', '_nwExpectedLicenseKey',
  '_nwNormalizeLicenseEdition', '_nwExpectedEditionLicenseKey', '_nwResolveFullLicense',
  '_nwExpectedEditionTrialSig', '_nwExpectedEditionTrialKey', '_nwExpectedTrialSig', '_nwExpectedTrialKey',
  '_nwParseTrialKey', '_nwIsLicenseValid', '_nwClearTrialState', '_nwCheckTrialLicense', '_nwEvaluateLicense',
]);
function methodsIn(file) {
  const ast = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const methods = new Map();
  (function visit(node) {
    if (ts.isMethodDeclaration(node) && names.has(node.name.getText(ast))) methods.set(node.name.getText(ast), node.getText(ast));
    ts.forEachChild(node, visit);
  })(ast);
  return methods;
}

test('44 negative Lizenzproben: Edition, Trialdauer und Trial-zu-Voll bleiben signaturgebunden', async () => {
  let checks = 0;
  for (const file of ['src-ts/runtime-executables/main.ts', 'src-ts/runtime-mirrors/main.ts']) {
    const methods = methodsIn(file);
    assert.equal(methods.size, names.size, 'Alle tatsächlichen Lizenzmethoden sind enthalten');
    const env = {};
    const Adapter = vm.runInNewContext('(class {' + [...methods.values()].join('\n') + '})', {
      process: { env }, crypto, nwFeatureFlagsService: null,
    });
    const adapter = new Adapter();
    let writes = 0;
    const states = new Map();
    adapter.getStateAsync = async id => states.get(id);
    adapter.setStateAsync = async (id, value) => { writes++; states.set(id, value); };
    for (const privateSource of [false, true]) {
      if (privateSource) env.NEXOWATT_LICENSE_HMAC_SECRET = crypto.randomBytes(32).toString('hex');
      const uuid = crypto.randomUUID();
      const home = adapter._nwExpectedEditionLicenseKey(uuid, 'hems');
      const pro = adapter._nwExpectedEditionLicenseKey(uuid, 'eos');
      const trialHome = adapter._nwExpectedEditionTrialKey(uuid, '030', 'hems');
      const trialPro = adapter._nwExpectedEditionTrialKey(uuid, '030', 'eos');
      const legacy = adapter._nwExpectedLicenseKey(uuid);
      const trial = adapter._nwExpectedTrialKey(uuid, '030');
      const invalidKeys = [
        home.replace('NW1H', 'NW1E'), home.replace('NW1H', 'NW1'), pro.replace('NW1E', 'NW1H'),
        legacy.replace('NW1-', 'NW1E-'), trialHome.replace('NW1TH', 'NW1TE'), trialPro.replace('NW1TE', 'NW1TH'),
        trial.replace('030', '999'), trialHome.replace('030', '999'), trialPro.replace('030', '999'),
        trialHome.replace('NW1TH-030', 'NW1H'), trial.replace('NW1T-030', 'NW1'),
      ];
      const previousWrites = writes;
      for (const candidate of invalidKeys) {
        const result = await adapter._nwEvaluateLicense(uuid, candidate);
        assert.ok(result.ok === false, 'Manipulierter Präfix, Zeitraum oder Lizenztyp wird abgewiesen');
        checks++;
      }
      assert.equal(writes, previousWrites, 'Ungültige Signaturen verändern keine Trialdaten');
    }
  }
  assert.equal(checks, 44);
});

test('18 Guard-Proben: Ausnahme nur für exakten Altvertrag; andere Fundstellen bleiben blockiert', () => {
  let checks = 0;
  const check = (condition, description) => { checks++; assert.ok(condition, description); };
  const method = methodsIn('src-ts/runtime-executables/main.ts').get('_nwLegacyLicenseSecret');
  check(!!method, 'Historischer Helper vorhanden');
  const proof = body => `class Example {\n${body}\nuse(secret) { return crypto.createHmac('sha256', secret); }\n}`;
  const findings = (name, body) => inspectContent(name, Buffer.from(proof(body)));
  for (const name of ['main.js', 'src-ts/runtime-executables/main.ts', 'src-ts/runtime-mirrors/main.ts']) check(findings(name, method).length === 0, 'Exakter freigegebener Pfad');
  for (const name of ['lib/main.js', 'test/main.js', 'docs/main.ts', './main.js', 'MAIN.js', 'src-ts/runtime-executables/other.ts']) check(findings(name, method).some(row => row.rule === 'literal-hmac-secret'), 'Abweichender Pfad bleibt gesperrt');
  check(findings('main.js', method.replaceAll('_nwLegacyLicenseSecret', 'differentMethod')).length > 0, 'Abweichende Methode bleibt gesperrt');
  check(findings('main.js', method.replaceAll('legacyLicenseSecret', 'otherLicenseSecret')).length > 0, 'Abweichende Variable bleibt gesperrt');
  const literal = /(['"])([^'"\r\n]*)\1/.exec(method);
  check(!!literal, 'Genaues Literal wird nur im Speicher gelesen');
  check(findings('main.js', method.replace(literal[0], literal[1] + literal[2] + 'x' + literal[1])).length > 0, 'Abweichender Wert bleibt gesperrt');
  check(findings('main.js', method + '\n' + method).length >= 2, 'Doppelte Definition bleibt gesperrt');
  const syntheticValue = JSON.stringify(crypto.randomBytes(24).toString('hex'));
  check(findings('main.js', method + '\nother() { const other' + 'Secret' + '=' + syntheticValue + '; return otherSecret; }').length > 0, 'Zusätzliche Zuweisung bleibt gesperrt');
  check(findings('main.js', method + '\nother() { return crypto.create' + 'Hmac(' + JSON.stringify('sha256') + ',' + syntheticValue + '); }').length > 0, 'Direktes HMAC-Literal bleibt gesperrt');
  check(inspectContent('main.js', Buffer.from(proof(method) + '\nPRIVATE_TOKEN=' + syntheticValue)).some(row => row.rule === 'secret-environment-value'), 'Private ENV-Zuweisung bleibt gesperrt');
  assert.equal(checks, 18);
});
