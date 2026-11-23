/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Alle maßgeblichen Runtime-/Adminquellen mit echten ESLint-Regeln prüfen.
 * Altbefunde bleiben sichtbar; zusätzliche Fundstellen und Typ-Unterdrückung in
 * den strikten Bereichen blockieren CI. Das ist keine ASVS-Konformitätsaussage.
 * Grenze: Fingerprints erkennen syntaktische Fundstellen, keinen Datenfluss.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { ESLint } = require('eslint');
const security = require('eslint-plugin-security');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'docs/security/eslint-legacy-baseline.json');
const REVIEWED = path.join(ROOT, 'docs/security/eslint-reviewed-findings.json');
const SOURCE_ROOTS = ['src-ts/runtime-executables', 'src-admin-tab/src'];
const REQUIRED_RULES = Object.freeze([
  ...Object.keys(security.configs.recommended.rules),
  '@typescript-eslint/no-explicit-any', '@typescript-eslint/ban-ts-comment',
  'no-eval', 'no-implied-eval', 'no-new-func', 'no-proto', 'no-script-url',
  'no-unsafe-finally', 'no-unsafe-negation', 'no-unsafe-optional-chaining',
]);
const STRICT_TYPES = new Set([
  'src-ts/runtime-executables/www/smarthome-setup.ts',
  'src-ts/runtime-executables/lib/ui-access-policy.ts',
  'src-ts/runtime-executables/lib/ui-server-transport.ts',
  'src-ts/runtime-executables/www/pwa.ts',
  'src-ts/runtime-executables/lib/smarthome-import.ts',
  'src-ts/runtime-executables/www/auth.ts',
  'src-ts/runtime-executables/www/login.ts',
  'src-ts/runtime-executables/lib/runtime-proxy-html.ts',
  'src-ts/runtime-executables/www/runtime-base.ts',
  'src-ts/runtime-executables/lib/iobroker-user-roles.ts',
  'src-ts/runtime-executables/lib/iobroker-user-auth.ts',
  'src-ts/runtime-executables/lib/http-error-boundary.ts',
  'src-ts/runtime-executables/lib/nvp-config-api.ts',
  'src-ts/runtime-executables/lib/dynamic-grid-config-api.ts',
  'src-ts/runtime-executables/lib/mesh-peer-http.ts',
  'src-ts/runtime-executables/lib/config-boundary-contracts.ts',
  'src-ts/runtime-executables/lib/partner-contracts.ts',
  'src-ts/runtime-executables/lib/partner-config-api.ts',
  'src-ts/runtime-executables/lib/partner-service.ts',
  'src-ts/runtime-executables/lib/partner-runtime.ts',
  'src-ts/runtime-executables/lib/partner-websocket.ts',
  'src-ts/runtime-executables/ems/services/arbitrage-control.ts',
]);
const TYPE_RULES = new Set(['@typescript-eslint/no-explicit-any', '@typescript-eslint/ban-ts-comment']);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
function codeSha256(file, source) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  return sha256(ts.createPrinter({ removeComments: true }).printFile(parsed));
}
function strictTypes(file) { return file === 'src-ts/runtime-executables/lib/hosted-adapter.ts' || file === 'src-ts/runtime-executables/lib/hosted-runtime-stop.ts' || file.startsWith('src-admin-tab/') || STRICT_TYPES.has(file)
  || /^src-ts\/runtime-executables\/(?:lib|www)\/smarthome-(?:device-|custom-|alias-|layout-)/.test(file); }
function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlink in lint source scope: ' + relative(file));
    return entry.isDirectory() ? filesUnder(file) : /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}
function sourceFiles() {
  return [...SOURCE_ROOTS.flatMap(dir => filesUnder(path.join(ROOT, dir))),
    path.join(ROOT, 'src-admin-tab/vite.config.ts')].sort();
}
function assertPolicy(config, file) {
  if (!config || config.linterOptions?.noInlineConfig !== true) throw new Error('Missing/noInlineConfig policy: ' + file);
  for (const name of REQUIRED_RULES) {
    if (config.rules?.[name]?.[0] !== 2) throw new Error('Required rule disabled: ' + name + ' in ' + file);
  }
  const ban = config.rules['@typescript-eslint/ban-ts-comment'][1];
  if (!ban || ['ts-ignore', 'ts-nocheck', 'ts-expect-error'].some(name => ban[name] !== true)) {
    throw new Error('Type suppression policy weakened: ' + file);
  }
  const anyOptions = config.rules['@typescript-eslint/no-explicit-any'][1];
  if (anyOptions && anyOptions.ignoreRestArgs === true) throw new Error('Any rest exemption is not permitted: ' + file);
}
/** Header/line shifts are tolerated; exact source span, source line and named
 * function ancestry are hashed. Occurrence counts prevent duplicate-site growth.
 * No code snippets or embedded credentials are stored in reports/baselines. */
function fingerprintMessages(file, source, messages) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = source.split(/\r?\n/);
  const contexts = [];
  function visit(node, parents) {
    let next = parents;
    if (ts.isFunctionLike(node)) {
      let name = node.name && node.name.getText(sf);
      if (!name && node.parent && (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent))) name = node.parent.name.getText(sf);
      next = [...parents, name || '<anonymous>'];
      contexts.push({ start: node.getStart(sf), end: node.end, label: next.join('/') });
    }
    ts.forEachChild(node, child => visit(child, next));
  }
  visit(sf, []);
  return messages.map(message => {
    const start = message.line ? sf.getPositionOfLineAndCharacter(message.line - 1, Math.max(0, message.column - 1)) : 0;
    const end = message.endLine ? sf.getPositionOfLineAndCharacter(message.endLine - 1, Math.max(0, message.endColumn - 1)) : start;
    let context = '';
    for (const entry of contexts) if (entry.start <= start && entry.end >= end) context = entry.label;
    const normalize = value => value.trim().replace(/\s+/g, ' ');
    const code = normalize(source.slice(start, end));
    const line = normalize(lines[Math.max(0, (message.line || 1) - 1)] || '');
    return {
      file, rule: message.ruleId || '<parser-or-inline-directive>',
      fingerprint: sha256(JSON.stringify([file, message.ruleId, message.messageId, message.nodeType, code, line, context])),
      line: message.line || 0, column: message.column || 0,
      fatal: Boolean(message.fatal), severity: message.severity,
    };
  });
}
function key(finding) { return finding.file + '\0' + finding.rule + '\0' + finding.fingerprint; }
function inventory(findings) {
  const result = new Map();
  for (const item of findings) {
    const id = key(item); const previous = result.get(id);
    if (previous) previous.count += 1;
    else result.set(id, { ...item, count: 1 });
  }
  return [...result.values()];
}
function evaluate(findings, baseline, reviewed = []) {
  const remaining = new Map();
  for (const entry of [...baseline, ...reviewed]) {
    if (!Number.isSafeInteger(entry.count) || entry.count <= 0 || !/^[a-f0-9]{64}$/.test(entry.fingerprint)) throw new Error('Malformed finding inventory');
    const id = key(entry); remaining.set(id, (remaining.get(id) || 0) + entry.count);
  }
  const legacyKeys = new Set(baseline.map(key));
  const introduced = []; let carried = 0; let legacyCarried = 0; let individuallyReviewed = 0;
  for (const finding of findings) {
    const forbidden = finding.fatal || finding.rule === '<parser-or-inline-directive>' ||
      (strictTypes(finding.file) && TYPE_RULES.has(finding.rule));
    const id = key(finding); const available = remaining.get(id) || 0;
    if (forbidden || available < 1) introduced.push(finding);
    else { carried += 1; if (legacyKeys.has(id)) legacyCarried += 1; else individuallyReviewed += 1; remaining.set(id, available - 1); }
  }
  return { introduced, carried, legacyCarried, individuallyReviewed, absent: [...remaining.values()].reduce((a, b) => a + b, 0) };
}
async function collect(eslint, files) {
  for (const file of files) assertPolicy(await eslint.calculateConfigForFile(file), relative(file));
  const results = await eslint.lintFiles(files);
  if (results.length !== files.length) throw new Error('Incomplete ESLint source coverage');
  return results.flatMap(result => fingerprintMessages(relative(result.filePath), result.source ?? fs.readFileSync(result.filePath, 'utf8'), result.messages));
}
async function main() {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  if (baseline.sourceVersion !== '1.0.29' || baseline.sourceArchiveSha256 !== '73714ad0975c6d1ae6a16f4a8fe8df354d04b075e915be72a35b53362f38a1ed') throw new Error('Unexpected legacy baseline provenance');
  const reviewed = JSON.parse(fs.readFileSync(REVIEWED, 'utf8'));
  for (const finding of reviewed.findings) {
    if (!finding.reason || !finding.evidence || TYPE_RULES.has(finding.rule) || finding.rule === '<parser-or-inline-directive>') throw new Error('Unreviewed or impermissible exception');
    const file = path.resolve(ROOT, finding.file);
    if (!file.startsWith(ROOT + path.sep) || codeSha256(finding.file, fs.readFileSync(file, 'utf8')) !== finding.sourceCodeSha256) throw new Error('Reviewed source changed; re-review required: ' + finding.file);
  }
  const files = sourceFiles();
  const findings = await collect(new ESLint({ cwd: ROOT }), files);
  const result = evaluate(findings, baseline.findings, reviewed.findings);
  const counts = Object.create(null);
  for (const finding of findings) counts[finding.rule] = (counts[finding.rule] || 0) + 1;
  const report = { schemaVersion: 1, tool: 'ESLint security regression gate', files: files.length, currentFindings: findings.length,
    unresolvedCarriedFindings: result.legacyCarried, individuallyReviewedFindings: result.individuallyReviewed, newlyBlockedFindings: result.introduced.length, baselineFindingsAbsent: result.absent,
    counts, findings, blocked: result.introduced,
    limitation: 'Carried findings are open scanner hotspots, not a clean security scan or proof of ASVS conformity.' };
  const output = process.env.NEXOWATT_LINT_REPORT;
  if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
  console.log('ESLint: ' + files.length + ' sources; ' + findings.length + ' current findings; ' + result.carried + ' inventoried (' + result.legacyCarried + ' historical open, ' + result.individuallyReviewed + ' individually reviewed); ' + result.introduced.length + ' blocked new/forbidden findings; ' + result.absent + ' old findings absent.');
  console.log('Open scanner hotspots: ' + JSON.stringify(counts));
  console.log('This gate prevents new scanner findings. It does not assert a clean security scan or full ASVS conformity.');
  for (const finding of result.introduced.slice(0, 60)) console.error(finding.file + ':' + finding.line + ':' + finding.column + ' ' + finding.rule + ' ' + finding.fingerprint);
  if (result.introduced.length) process.exitCode = 1;
}
module.exports = { ROOT, REQUIRED_RULES, sourceFiles, assertPolicy, fingerprintMessages, inventory, evaluate, collect, sha256, codeSha256 };
if (require.main === module) main().catch(error => { console.error('ESLint gate failed: ' + error.message); process.exitCode = 1; });
