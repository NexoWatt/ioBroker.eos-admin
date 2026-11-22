/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Read-only targeted scanner/AST evidence, not whole-repository certification.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = process.env.NEXOWATT_PROXY_TEST_ROOT || path.resolve(__dirname, '../../../..');
const baseline = process.env.NEXOWATT_PROXY_BASELINE_ROOT;
if (!baseline) throw new Error('NEXOWATT_PROXY_BASELINE_ROOT muss auf den entpackten Quellstand 1.0.34 zeigen.');
const fromRepo = Module.createRequire(path.join(root, 'package.json'));
const { ESLint } = fromRepo('eslint');
const ts = fromRepo('typescript');
const { fingerprintMessages, codeSha256, sha256 } = fromRepo('./scripts/verify-eslint-security.cjs');
const files = ['src-ts/runtime-executables/main.ts', 'src-admin-tab/src/lib/adminConnection.ts', 'src-ts/runtime-executables/lib/runtime-proxy-html.ts'];
async function main() {
  const reviewed = JSON.parse(fs.readFileSync(path.join(root, 'docs/security/eslint-reviewed-findings.json'), 'utf8')).findings;
  const eslint = new ESLint({ cwd: root });
  const results = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const [result] = await eslint.lintText(source, { filePath: path.join(root, file) });
    const current = fingerprintMessages(file, source, result.messages);
    let old = []; let oldSource = '';
    if (fs.existsSync(path.join(baseline, file))) {
      oldSource = fs.readFileSync(path.join(baseline, file), 'utf8');
      const [prior] = await eslint.lintText(oldSource, { filePath: path.join(root, file) });
      old = fingerprintMessages(file, oldSource, prior.messages);
    }
    const reviewedSites = reviewed.filter(item => item.file === file).map(item => ({ fingerprint: item.fingerprint, rule: item.rule,
      current: current.some(value => value.fingerprint === item.fingerprint), baseline: old.some(value => value.fingerprint === item.fingerprint),
      currentLine: current.find(value => value.fingerprint === item.fingerprint)?.line }));
    const entry = { file, currentCodeSha256: codeSha256(file, source), baselineCodeSha256: oldSource ? codeSha256(file, oldSource) : null,
      currentFindingCount: current.length, baselineFindingCount: old.length,
      newFindings: current.filter(item => !old.some(value => value.fingerprint === item.fingerprint)), reviewedSites };
    if (file.includes('adminConnection')) {
      const extract = value => { const ast = ts.createSourceFile(file, value, ts.ScriptTarget.Latest, true);
        return ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'copyJsonValue').getText(ast); };
      entry.copyJsonValue = { byteIdentical: extract(source) === extract(oldSource), sha256: sha256(extract(source)) };
    }
    results.push(entry);
  }
  const report = { date: '2026-11-03', baselineVersion: '1.0.34', targetVersion: '1.0.35',
    scope: 'Actual targeted ESLint rerun and source fingerprint/AST comparison; no whole-project certification', files: results };
  fs.writeFileSync(path.join(__dirname, 'backend-source-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
