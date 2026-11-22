#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Explizit abgegrenzte eigene TS-/JS-Quellen mit Lizenzkopf versehen und
 * Quellen sowie erzeugte Artefakte prüfen. --write ändert nur direkt gepflegte
 * Quellen; Generatoren bleiben für ihre Ausgaben verantwortlich.
 * Daten und Wirkung: Lokale Dateien, keine externen Abhängigkeiten/Netzzugriffe.
 * Fremdhinweise und symbolische Links stoppen vor dem ersten Schreibzugriff.
 * Grenzen: Kein Rechteaudit fremder Komponenten; keine Änderung von JSON, HTML,
 * CSS, Binärdateien, React-Drittbundles, node_modules oder Third-Party-Notices.
 */
const fs = require('node:fs');
const path = require('node:path');
const { splitProprietaryHeader, hasForeignLeadingNotice, withProprietaryHeader } = require('./proprietary-header-policy.cjs');

const MANUAL_MIRRORS = Object.freeze([
  'main.ts',
  'ems/modules/core-limits.ts',
  'ems/modules/heating-rod-control.ts',
  'ems/modules/ai-advisor.ts',
  'www/history.ts',
  'www/smarthome.ts',
  'www/smarthome-config.ts',
  'www/ems-apps.ts',
  'www/app.ts',
].map((rel) => 'src-ts/runtime-mirrors/' + rel));
const GENERATED_SCRIPTS = Object.freeze(['scripts/publish-check-rules.js']);
const OWN_CONFIGS = Object.freeze(['eslint.config.cjs', 'src-admin-tab/vite.config.ts']);
const CODE = /\.(?:[cm]?js|jsx|ts|tsx)$/;
const posix = (value) => value.split(path.sep).join('/');

/** Code-Teil: walkCode – inventarisiert nur lokale reguläre Dateien, ohne Links zu folgen. */
function walkCode(root, relative, skip = new Set()) {
  const output = [];
  const walk = (rel) => {
    if (skip.has(rel)) return;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.lstatSync(abs).isSymbolicLink()) throw new Error('Symbolic link in owned scope: ' + rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = posix(path.join(rel, entry.name));
      if (skip.has(child)) continue;
      if (entry.isSymbolicLink()) throw new Error('Symbolic link in owned scope: ' + child);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && CODE.test(entry.name)) output.push(child);
    }
  };
  walk(relative);
  return output;
}

/**
 * Code-Teil: inventory
 * Der feste Scope folgt dem Quellcode-Wegweiser: eigene src-ts-Quellen, Admin/src,
 * gepflegte Build-/Prüfskripte und zwei eigene Build-Konfigurationen. Neun bereits
 * typisierte Spiegel dürfen ausschließlich einen zusätzlichen Kopf erhalten.
 */
function inventory(root) {
  const generatedScripts = new Set(GENERATED_SCRIPTS);
  const source = new Set([
    ...walkCode(root, 'src-ts', new Set(['src-ts/runtime-mirrors'])),
    ...walkCode(root, 'src-admin-tab/src'),
    ...walkCode(root, 'scripts').filter((rel) => !generatedScripts.has(rel)),
  ]);
  for (const rel of [...MANUAL_MIRRORS, ...OWN_CONFIGS]) {
    if (fs.existsSync(path.join(root, rel))) source.add(rel);
  }
  const generated = new Set([
    ...walkCode(root, 'src-ts/runtime-mirrors').filter((rel) => !source.has(rel)),
    ...walkCode(root, 'lib/ts-mirrors'),
    ...walkCode(root, 'www/static/ts-mirrors'),
    ...GENERATED_SCRIPTS.filter((rel) => fs.existsSync(path.join(root, rel))),
  ]);
  for (const rel of source) {
    if (rel.startsWith('src-ts/runtime-executables/') && /\.tsx?$/.test(rel)) {
      generated.add(rel.slice('src-ts/runtime-executables/'.length).replace(/\.tsx?$/, '.js'));
    }
  }
  return Object.freeze({ source: [...source].sort(), generated: [...generated].sort() });
}

/**
 * Code-Teil: synchronize
 * Prüft sämtliche Quelldateien vor einer Änderung und ersetzt ausschließlich den
 * Lizenzprolog. --check verändert nichts, --write baut keine Runtime und setzt
 * insbesondere keine Hashes manuell typisierter Spiegel neu.
 */
function synchronize(root, options = {}) {
  const scope = inventory(root);
  const files = options.write || options.sourcesOnly ? scope.source : [...scope.source, ...scope.generated];
  const missing = [];
  const changes = [];
  const blocked = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    if (!fs.lstatSync(abs).isFile() || fs.lstatSync(abs).isSymbolicLink()) {
      blocked.push(rel);
      continue;
    }
    const before = fs.readFileSync(abs, 'utf8');
    if (hasForeignLeadingNotice(before)) {
      blocked.push(rel);
      continue;
    }
    if (!splitProprietaryHeader(before).header) {
      missing.push(rel);
      if (options.write) changes.push({ rel, abs, before, after: withProprietaryHeader(before) });
    }
  }
  if (blocked.length) return { ok: false, sourceCount: scope.source.length, generatedCount: scope.generated.length, missing, changed: [], blocked };
  if (options.write) {
    for (const change of changes) {
      if (fs.readFileSync(change.abs, 'utf8') !== change.before) throw new Error('Source changed during header preflight: ' + change.rel);
    }
    for (const change of changes) fs.writeFileSync(change.abs, change.after, 'utf8');
  }
  return {
    ok: options.write ? missing.length === changes.length : missing.length === 0,
    sourceCount: scope.source.length,
    generatedCount: scope.generated.length,
    missing: options.write ? missing.filter((rel) => !changes.some((change) => change.rel === rel)) : missing,
    changed: changes.map((change) => change.rel),
    blocked,
  };
}

/** Code-Teil: main – fest abgegrenzte CLI; Pfade statt Dateiinhalte/Fehler-Stacks ausgeben. */
function main(args) {
  if (args.some((arg) => !['--write', '--check', '--sources-only'].includes(arg))
    || args.filter((arg) => arg === '--write' || arg === '--check').length !== 1) {
    console.error('Usage: node scripts/sync-proprietary-headers.cjs (--write | --check) [--sources-only]');
    process.exitCode = 2;
    return;
  }
  try {
    const result = synchronize(path.resolve(__dirname, '..'), { write: args.includes('--write'), sourcesOnly: args.includes('--sources-only') });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error('[proprietary-headers] ' + (error instanceof Error ? error.message : 'Header operation failed.'));
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = Object.freeze({ MANUAL_MIRRORS, GENERATED_SCRIPTS, OWN_CONFIGS, inventory, synchronize });
