# NexoWatt EOS

NexoWatt EOS is the local platform for energy, charging and building control, including the responsive customer cockpit and installer workspace.

**Current security review build:** `1.0.38` (2026-11-22)

EOS-Original-Logo auf der Anmeldung und neutrale sichtbare Texte; die getrennten Anmeldeprofile und bestehenden Anlagenfunktionen bleiben erhalten. [Release 1.0.38](STABLE_1_0_38_RELEASE_DE.md), [Einrichtung und Testanlage](operations/TESTANLEITUNG_1_0_37_DE.md), [Prüfbericht](reports/branding-2026-11-22/PRUEFBERICHT_DE.md).

HTTPS im ioBroker-Admin ab 8.3: gleicher Origin über den Instanzproxy für Anmeldung und Laufzeitseiten. [Release 1.0.35](STABLE_1_0_35_RELEASE_DE.md), [Betrieb und Diagnose](operations/ADMIN_HTTPS_PROXY_DE.md).

Beliebige ioBroker-Benutzer mit eigenem Kontopasswort: EOS-Rechte aus tatsächlichen Gruppen; eigene Anbietergruppen konfigurierbar. [Release 1.0.34](STABLE_1_0_34_RELEASE_DE.md), [Einrichtung und Migration](operations/BENUTZER_GRUPPENRECHTE_DE.md).

Partneranbindungen und eigenständige Arbitrage auf Basis 1.0.31: getrennte Datenrechte, ausgehendes WSS und zeitlich begrenzte Speicheranforderungen durch den bestehenden Regler. Haushaltsbetrieb und reiner Speicherhandel benötigen weder PV noch dynamischen Netzanschluss. [Releasehinweise](STABLE_1_0_32_RELEASE_DE.md), [Protokoll und Einrichtung](PARTNER_INTEGRATION_PROTOCOL_V1_DE.md), [Prüfbericht und offene Anlagenabnahme](reports/partner-arbitrage-2026-10-28/PRUEFBERICHT_DE.md).

Die Einrichtung nutzt die gesamte Breite unter EMS Apps und dieselbe Datenpunktauswahl wie die vorhandenen Apps. [Bedienungskorrektur 1.0.28](STABLE_1_0_28_RELEASE_DE.md).

Der Speicherfehler `DYNAMIC_GRID_VERSION_CONFLICT` bei der Erstinstallation ist korrigiert. [Änderung und Prüfstand](reports/dynamic-grid-save-2026-10-23/PRUEFVERMERK_DE.md).

Bestandslizenzen werden ohne zusätzliche Dienstkonfiguration weiter geprüft; die spätere Lizenzmigration ist der eigenen EOS-Software vorbehalten. [Betrieb und Navigation](operations/EMS_APPS_LIZENZ_KOMPATIBILITAET_DE.md).

Eigene herstellerunabhängige App **Dynamischer Netzanschluss** unter **EMS Apps**: M0 aus Allgemein, M1 und Speicherzuordnungen mit Betriebsarten zentral in der App. Aktive Regelung verwendet generische Datenpunktverträge und bestehende Regelbausteine. [Einrichtung und Betrieb](DYNAMISCHER_NETZANSCHLUSS_DE.md).

**Nicht für den Produktivbetrieb freigegeben.** Einstieg: [Prüfstand 1.0.31](STABLE_1_0_31_RELEASE_DE.md), [Heizstab-Prüfvermerk](reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md), [Anlagentest für Nachtabschaltung und PV-Regelung](operations/HEIZSTAB_NACHT_PV_TEST_DE.md), [CRA-Akte](cra/README.md). Historische Stable-Aussagen und alte Prüfberichte gelten nur für ihren damaligen Stand.

It provides live energy-flow visualization, historical analysis, SmartHome visualization, installer-controlled EMS applications, and selected customer controls for desktop, tablet, and smartphone use.

## Documentation

All Markdown documentation is collected under `docs/`.

- [Release 1.0.21: Nulleinspeisung, Wechselrichter-Zuordnung und SmartHome-Rechte](STABLE_1_0_21_RELEASE_DE.md)
- [Heizstab 1.0.23: Nachtabschaltung und morgendlicher PV-Anlauf](operations/HEIZSTAB_NACHT_PV_TEST_DE.md)
- [Nulleinspeisung Schritt für Schritt einrichten](NULL_EINSPEISUNG_EINRICHTUNG_DE.md)
- [Release 1.0.20: Speicherunterstützung und erlaubter Netzbezug bei Nulleinspeisung](STABLE_1_0_20_RELEASE_DE.md)
- [Release 1.0.19: Netzanteil je Ladepunkt, Auto und PV](STABLE_1_0_19_RELEASE_DE.md)
- [Release 1.0.18: PV-Taktschutz und damalige Boost-Grenze](STABLE_1_0_18_RELEASE_DE.md)
- [Release 1.0.17: Gemeinsame PV-Strategie bei Nulleinspeisung](STABLE_1_0_17_RELEASE_DE.md)
- [Nulleinspeisung: Voraussetzungen und Inbetriebnahme](NULL_EINSPEISUNG_PV_STRATEGIE_DE.md)
- [Release 1.0.16: Microgrid als gemeinsame EMS-App](STABLE_1_0_16_RELEASE_DE.md)
- [Release 1.0.15: Transformer limits, meter archives and billing drafts](STABLE_1_0_15_RELEASE_DE.md)
- [Microgrid setup and safety contract](MICROGRID_MASTER_SLAVE_DE.md)
- [Release 1.0.13: SmartHome setup permissions and logo correction](STABLE_1_0_13_RELEASE_DE.md)
- [Release 1.0.12: reliable ZIP updates and publishing](STABLE_1_0_12_RELEASE_DE.md)
- [Quellcode verstehen – deutscher Wegweiser](QUELLCODE_WEGWEISER_DE.md)
- [Funktions- und Dateiverknüpfungen](QUELLCODE_VERKNUEPFUNGEN_DE.md)
- [Verbindlicher Dokumentationsstandard](DOKUMENTATIONSSTANDARD_DE.md)
- [Changelog](CHANGELOG.md)
- [Contribution guidelines](CONTRIBUTING.md)
- [Repository guidelines](AGENTS.md)
- [GitHub upload](GITHUB_UPLOAD.md)
- [TypeScript development](development/TYPESCRIPT_README.md)
- [Historical validation reports](reports/)

## Main features

- **LIVE dashboard** with PV, grid, storage, building load, weather, KPIs, quick actions, and AI advisor cards.
- **History and reports** for energy flows, storage, grid import/export, tariff costs, EVCS reports, and yearly reports.
- **SmartHome visualization and Installer/Admin setup** with rooms, devices, favorites, and responsive mobile navigation.
- **Admin-only SMTP and license management**, including direct page and API access.
- **Storage farm licenses:** Home includes up to 2 configured storage systems; Pro supports up to 10.
- **Installer App-Center** for datapoint mapping, EMS apps, heating rod control, storage farm setup, EVCS/charging management, tariff logic, and diagnostics.
- **Responsive frontend** for desktop, tablet, and smartphone.

## Technical platform compatibility

NexoWatt EOS runs locally as an adapter on the ioBroker platform and is prepared for Node.js 22+. The platform identifier remains technical; all customer-visible product branding uses NexoWatt EOS.

Recommended runtime baseline:

- Node.js: `>=22`
- js-controller: `>=6.0.11`
- Admin: `>=7.0.0`

Before publishing or submitting the adapter, run:

```bash
npm run publish:check
npm run test:package
```

For repository submission, additionally run the official ioBroker Adapter Checker and fix any reported findings.

## Configuration

The basic HTTP port and IP binding are configured through the underlying platform administration.

EMS datapoint mapping and installer-specific configuration are handled inside the protected NexoWatt EOS App-Center.

## License

This repository is proprietary and not open source.

Copyright (c) 2025–2026 NexoWatt. All rights reserved.

Use, copying, modification, distribution, hosting, or sublicensing is not permitted without explicit written permission from NexoWatt.

See [LICENSE](../LICENSE) for details.

## Netzbetreiber-Schnittstelle

NexoWatt EOS enthält eine vorbereitete, standardmäßig deaktivierte und read-only Schnittstellen-App für zertifizierte EZA-/Parkregler. Herstellerspezifische Register werden ausschließlich über versionierte Treiberprofile ergänzt; der EOS-Core arbeitet mit einem kanonischen Datenmodell. Die operative Übergabe an Assets bleibt bis zur Hersteller- und Projektabnahme gesperrt.

## npm-Testpakete und automatische SBOM (1.0.22)

`npm publish` prüft den fertigen Paketstand technisch; Tests auf der eigenen Anlage
werden nicht durch den noch offenen Status der Produktivfreigabe blockiert.
`npm run release:production-check` prüft diese Herstellerentscheidung gesondert.

Beim Erstellen eines Releasepakets erzeugt `npm run release:generate-manifest`
die CycloneDX-SBOM automatisch vor der Versiegelung. Beim Upload prüft
`publish:check` die mitgelieferte SBOM einschließlich Quellen- und Dateihashes
automatisch. Eine fehlende oder veraltete SBOM stoppt den Upload. Der fertige
Release wird beim Veröffentlichen weder neu gebaut noch neu versiegelt.

Die SBOM beschreibt den Paketstand und dessen Referenzabhängigkeiten, nicht
automatisch sämtliche tatsächlich installierten Komponenten des ioBroker-Hosts.
Details und Nachprüfung: [npm-/SBOM-Korrektur](reports/cra-2026-09-29/NPM_UPLOAD_SBOM_KORREKTUR_DE.md).

Vor dem Liveupdate dieses Prüfstands die separate private Lizenzumgebung einrichten;
Einzelheiten in [Releasehinweisen](STABLE_1_0_22_RELEASE_DE.md) und im privaten
Installationspaket. Öffentliche/npm-Pakete enthalten den Wert ausdrücklich nicht.
Die verbindliche [Entwicklungsleitlinie](ENTWICKLUNGSLEITLINIE_SICHERHEIT_DE.md)
beschreibt die Anforderungen für weitere Adapter.

Der Heizstab-Teststand 1.0.23 führt diese bestehende Bereitstellung fort. Er
enthält keine neue zentrale Offline-Lizenzarchitektur und keine privaten
Installationsdateien. Änderungen, tatsächliche Prüfergebnisse und offene
Anlagentests stehen im [aktuellen Prüfvermerk](reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md).

Aktuelle Anmeldungskorrektur 1.0.33: [Releasehinweise](STABLE_1_0_33_RELEASE_DE.md) und [Admin-8-Anmeldung](operations/ADMIN8_EMS_ANMELDUNG_DE.md).
