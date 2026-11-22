/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-customer-write-policy.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-customer-write-policy.js
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
 * Original-Hash: 5f55b448974ca5c3f0950e6d318bb2b2573907015ea05d36102b001eec4c425e
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

/** Feldkompatible Kunden-Schreibpolicy und Browser-Härtung statisch absichern. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
const admin = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
assert.strictEqual(pkg.native.accessControl.customerWritePolicy, 'session', 'new installations require a real session');
assert.strictEqual(pkg.native.accessControl.allowedOrigins, '', 'allowedOrigins default must be empty');
assert.ok(admin.items && admin.items.sicherheit, 'security admin tab missing');

for (const rel of ['src-ts/runtime-executables/main.ts', 'main.js']) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.ok(text.includes("['all', 'lan', 'session']"), `${rel}: policy modes missing`);
  assert.ok(text.includes("customerWritePolicy === 'lan' && nwIsTrustedLanIp"), `${rel}: LAN policy missing`);
  assert.ok(text.includes("customerWritePolicy === 'session'"), `${rel}: session policy missing`);
  assert.ok(text.includes('nwRequestRemoteIp(req)'), `${rel}: socket IP evaluation missing`);
  assert.ok(text.includes("req.socket && req.socket.remoteAddress"), `${rel}: real socket address missing`);
  assert.ok(!text.includes("req.headers['x-forwarded-for']"), `${rel}: untrusted forwarded header is used`);
  assert.ok(text.includes('origin_forbidden'), `${rel}: browser origin protection missing`);
  assert.ok(text.includes('login_rate_limited'), `${rel}: login rate limit missing`);
  assert.ok(text.includes("'X-Content-Type-Options'"), `${rel}: security headers missing`);
}
console.log('[customer-write-policy] OK: explicit legacy/all, LAN/VPN and secure session default are wired without trusting forwarded headers.');
