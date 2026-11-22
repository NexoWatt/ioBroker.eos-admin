/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-ts-nocheck-budget.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-ts-nocheck-budget.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: 652a1877866f54a11d7d8f81b9d842b76491ec39fd390b9bbd9007ce8ba264a2
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * No-growth gate for the staged TypeScript migration.
 * Existing runtime files remain field-compatible, but no additional runtime file may
 * gain @ts-nocheck and the total unchecked runtime line budget may not grow silently.
 */
const assert = require('assert');
const fs = require('fs');
const { splitProprietaryHeader, hasLeadingNoCheck } = require('./proprietary-header-policy.cjs');
const path = require('path');
const root = path.join(__dirname, '..');
const baseDir = path.join(root, 'src-ts', 'runtime-executables');
const baselinePath = path.join(root, 'scripts', 'ts-nocheck-budget.json');

/**
 * Code-Teil: walk
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}
/**
 * Code-Teil: collect
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function collect() {
  const unchecked = [];
  let uncheckedLines = 0;
  for (const file of walk(baseDir)) {
    // Der Lizenzkommentar darf die Direktive weder verstecken noch das Codebudget erhöhen.
    const text = splitProprietaryHeader(fs.readFileSync(file, 'utf8')).body;
    if (hasLeadingNoCheck(text)) {
      const rel = path.relative(root, file).replace(/\\/g, '/');
      const lines = text.split(/\r?\n/).length;
      unchecked.push({ file: rel, lines });
      uncheckedLines += lines;
    }
  }
  unchecked.sort((a, b) => a.file.localeCompare(b.file));
  return { unchecked, uncheckedFileCount: unchecked.length, uncheckedLines };
}

if (process.argv.includes('--write-baseline')) {
  const current = collect();
  const payload = {
    schema: 'nexowatt.ts-nocheck-budget.v1',
    generatedForVersion: require(path.join(root, 'package.json')).version,
    uncheckedFileCount: current.uncheckedFileCount,
    maxUncheckedLines: current.uncheckedLines,
    files: current.unchecked.map((item) => item.file),
  };
  fs.writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`[ts-nocheck-budget] baseline written: ${payload.uncheckedFileCount} files / ${payload.maxUncheckedLines} lines`);
  process.exit(0);
}

assert.ok(fs.existsSync(baselinePath), 'ts-nocheck budget baseline missing');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = collect();
const allowedFiles = new Set(Array.isArray(baseline.files) ? baseline.files : []);
const newFiles = current.unchecked.filter((item) => !allowedFiles.has(item.file));
assert.deepStrictEqual(newFiles, [], `new @ts-nocheck runtime files: ${newFiles.map((x) => x.file).join(', ')}`);
assert.ok(current.uncheckedFileCount <= Number(baseline.uncheckedFileCount), `unchecked runtime file count grew: ${current.uncheckedFileCount} > ${baseline.uncheckedFileCount}`);
assert.ok(current.uncheckedLines <= Number(baseline.maxUncheckedLines), `unchecked runtime line budget grew: ${current.uncheckedLines} > ${baseline.maxUncheckedLines}`);
console.log(`[ts-nocheck-budget] OK: ${current.uncheckedFileCount} files / ${current.uncheckedLines} lines (max ${baseline.maxUncheckedLines})`);
