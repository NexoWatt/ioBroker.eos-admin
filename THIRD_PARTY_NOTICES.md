# Third-party notices

This repository contains software components derived from or compatible with the upstream ioBroker.admin project. The following notice is retained for the upstream MIT-licensed portions.

The MIT License (MIT)

Copyright (c) 2014-2026 bluefox <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## OAuth2-Modell-Testfixture

`test/fixtures/oauth2-model-v1.4.0.ts` stammt unverändert aus `ioBroker/webserver`, Tag v1.4.0, Git-Blob `3651fb210e04ebb92d952b2a532cebf6d5223df6`. Die MIT-Lizenz des Projekts liegt als `test/fixtures/OAUTH2_MODEL_LICENSE` bei. Die Datei dient ausschließlich der reproduzierbaren Prüfung des EOS-Sitzungswiderrufs; sie ersetzt keine ausgelieferte Laufzeitabhängigkeit.

## Admin 8 migration (2026-11-04)

The actual upstream base is ioBroker.admin 8.3.5 (commit `6f77eedf525813a7a61d79188d1ff05dffd05086`). Bundled GUI modules include `@iobroker/gui-components` 10.3.14; the EOS overlay is applied to reviewed unminified inputs and is documented in `docs/security/NEXOWATT_ADMIN8_FRONTEND_SECURITY_MIGRATION_2026-11-04.md`.

Exact unmodified LICENSE/NOTICE texts, package versions, origins and hashes for the identified bundled packages are recorded under `docs/third-party/admin8/` by `tools/nexowatt-artifact-inventory.cjs`. That inventory describes its coverage limits explicitly; a package metadata license label alone is not substituted for a supplied license text.

The release-only parser is Acorn 8.17.0 (MIT); its exact source, license and provenance are in `tools/vendor/acorn/`. Reviewed GUI test fixtures and their MIT license/provenance are in `tools/fixtures/admin8-objectbrowser/`. The runtime OAuth alias resolves to `@node-oauth/oauth2-server` 5.3.1 (MIT), as recorded in the lockfiles and dependency report. Original notices above remain applicable.

The development-only EOS package validator is a narrowly adapted copy of the MIT-licensed `@iobroker/testing` 6.3.1 `packageFiles` validator (Copyright 2024–2026 AlCalzone). Its exact original/fork hashes, reviewed diff and complete MIT notice are provided in `tools/vendor/package-profile-provenance.json`, `docs/security/admin8-2026-11-04/package-validator-profile.patch` and `tools/vendor/iobroker-testing-package-files.LICENSE`. The offline schema pins retain their official ioBroker origin in `test/schemas/sources.json`; they are validation inputs, not runtime libraries.

The complete MIT license texts for both pinned schema repositories are retained in `test/schemas/io-package-schema.LICENSE` and `test/schemas/jsonConfig-schema.LICENSE`; immutable-commit provenance and file hashes are in `test/schemas/license-sources.json`. The separate EOS metadata overlay is original project validation code, not an unmodified upstream schema.

## EasyAccess-Nachprüfung vom 05.11.2026

Die tatsächliche Zusammensetzung von `@iobroker/admin-component-easy-access`3.0.8 und seine Generatorherkunft sind unter `docs/ea/` dokumentiert. Dort liegen eine ergänzende CycloneDX-Komponentenliste, unveränderte verfügbare Lizenz-/Notice-Texte und `license-provenance.json`. Fehlende Volltexte für qrcode-generator2.0.4 und das native Rolldown-Buildbinding1.2.7 bleiben ausdrücklich offen. Der Anwendungscode wurde nicht verändert.

## Integrated NexoWatt modules (9.0.6)

NexoWatt Devices 0.5.176 and NexoWatt EEBus 0.3.0 are integrated, modified NexoWatt proprietary source components. Their provenance and retained original license texts are in `modules/devices/` and `modules/eebus/`. The common EOS system license is checked by the owning adapter; these modules are not separate public/free licenses. Existing third-party license grants remain unaffected.

The locked protocol dependencies include modbus-serial (ISC), MQTT.js (MIT), serialport (MIT), bonjour-service (MIT), multicast-dns (MIT), axios (MIT) and ws (MIT). The runtime CycloneDX SBOM records their resolved dependency closure and the integrated module trees. The classic Devices editor reuses the already bundled jQuery/Materialize assets and their original notices.

## Integrated NexoWatt Backup (9.0.7)

The original NexoWatt EOS Backup 1.0.10 archive contains MIT-licensed material derived from ioBroker.backitup, Copyright 2018–2026 simatec and 2026 NexoWatt. Its exact original LICENSE and NOTICE are retained under `modules/backup/upstream/`; the inherited NOTICE still refers to 1.0.9 and is intentionally not rewritten. Archive and retained-file hashes are recorded in `modules/backup/provenance.json`. The proprietary EOS notice does not withdraw these existing MIT rights.

The integrated backup uses locked tar-fs (MIT), cron-parser (MIT), ftp (MIT), Dropbox SDK (MIT), fast-xml-parser (MIT), axios (MIT), and MQTT.js (MIT). Their resolved runtime dependency closure is in the CycloneDX SBOM. Installed dependency packages retain their own license texts. No third-party CA certificate, private manufacturer key, cloud credential, or customer archive is included.

## SmartHome operating-interface reference (9.0.9)

The user-supplied `ioBroker.devices-master.zip` identifies `iobroker.devices` 4.4.0, Copyright (c) 2019–2026 bluefox, under the MIT license. Its archive SHA-256 is `a0166efec63ae7e5dc5ce3d25d41e60a321f7f58444c127c2cc4c9535a46ba2f`. The exact supplied license is retained conservatively in `ui/www/licenses/iobroker-devices-MIT.txt`; the proprietary NexoWatt notices do not withdraw rights granted under that license.

The SmartHome changes reimplement selected operating and touch-interaction patterns within the existing EOS frontend. This is not an import of the complete ioBroker.devices adapter, its React/MUI application, device/alias detection, backend, plugin services or external widget loaders. Scope, reference paths and provenance limits are recorded in `docs/reports/unified-9.0.9/DEVICE_UI_REFERENCE.md`.

## Local SmartHome GFM Markdown parser (EOS 9.0.10)

The local `ui/www/smarthome-markdown-parser.js` bundle reuses the existing Admin build dependencies `mdast-util-from-markdown`, `micromark-extension-gfm` and `mdast-util-gfm`, including their bundled transitive components. No additional network loader or package installation is introduced. Complete component names, exact installed versions and license identifiers are preserved in `ui/www/licenses/smarthome-markdown-components.json`; their unchanged license texts are retained in `ui/www/licenses/smarthome-markdown-LICENSES.txt`. Rebuild with `node ui/scripts/build-smarthome-markdown.cjs`. These third-party rights remain unaffected by the proprietary NexoWatt license.

## SmartHome category controls (EOS 9.0.10)

The built-in operating profiles follow the supplied ioBroker.devices 4.4.0 reference.
Color-conversion functions in `ui/src-ts/runtime-executables/www/smarthome-device-controls.ts`
are adapted from the reference `src-admin/src/WidgetsManager/Widgets/colorUtils.ts`;
the source attribution is retained in the code comments.
The supplied MIT license remains in `ui/www/licenses/iobroker-devices-MIT.txt`.
The current function scope and independent EOS backend are described in the 9.0.10
change report. This extends the historical 9.0.9 scope above.
