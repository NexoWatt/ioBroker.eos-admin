#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Trennt bestandene technische Paketprüfungen von der Herstellerfreigabe.
 * Daten und Wirkung: Prüft bei explizitem Aufruf die lokale Produktivfreigabe.
 * Fehlende oder widersprüchliche Entscheidungen blockieren release:production-check;
 * technische npm-Veröffentlichungen für Tests bleiben davon getrennt.
 * Bei Änderungen: Kein Umgebungsvariablen-Bypass, keine automatische Freigabe;
 * Unterschrift/Signatur und unabhängige Prüfung werden hier nicht nachgewiesen.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function validate(status, version) {
  return Boolean(status && status.schema === 'nexowatt.release-status.v1'
    && status.version === version && status.status === 'approved'
    && status.productionApproved === true && Array.isArray(status.blockers)
    && status.blockers.length === 0 && typeof status.decisionBy === 'string'
    && status.decisionBy.trim().length >= 3 && typeof status.decisionAt === 'string'
    && Number.isFinite(Date.parse(status.decisionAt))
    && typeof status.evidence === 'string' && status.evidence.trim().length > 0);
}

if (process.argv.includes('--self-test')) {
  const valid = { schema: 'nexowatt.release-status.v1', version: '1.0.0',
    status: 'approved', productionApproved: true, blockers: [],
    decisionBy: 'Testfixture', decisionAt: '2026-09-29T12:00:00Z', evidence: 'fixture' };
  assert.equal(validate(valid, '1.0.0'), true);
  for (const change of [null, {}, { ...valid, version: '0.0.0' },
    { ...valid, status: 'review' }, { ...valid, productionApproved: false },
    { ...valid, blockers: ['offen'] }, { ...valid, blockers: null },
    { ...valid, decisionBy: '' }, { ...valid, decisionAt: 'invalid' },
    { ...valid, evidence: '' }]) assert.equal(validate(change, '1.0.0'), false);
  console.log('[release-approval] Regression OK: unvollständige Freigaben blockiert. Keine reale Freigabe gesetzt.');
} else {
  try {
    const root = path.resolve(__dirname, '..');
    const status = JSON.parse(fs.readFileSync(path.join(root, 'release-manifests/release-status.json'), 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (!validate(status, pkg.version)) throw new Error('release-not-approved');
    console.log('[release-approval] Dokumentierte Herstellerentscheidung vorhanden; dies ist keine Zertifizierungsprüfung.');
  } catch (_) {
    console.error('[release-approval] BLOCKED: release-not-approved. Offene Nachweise in release-manifests/release-status.json.');
    process.exitCode = 1;
  }
}
