# ioBroker- und EOS-Richtlinienabgleich 9.0.17

**Stand und Quellenabruf:** 24.11.2026. **Produkt:** `iobroker.eos-admin` 9.0.17.
**Umfang:** Parallelbetrieb mit Standard-Admin/Backitup, Konfigurationserhalt,
Sitzungsgrenzen, Laufzeit-/Paketmetadaten und unmittelbar betroffene Prüfpipeline.
Dies ist ein gezielter Quell- und Nachweisabgleich. Eine vollständige Prüfung aller
ioBroker-Adapter-Checker-Regeln, aller Geräteprofile oder eine CRA-Konformitätsbewertung
wird damit nicht erklärt. Maßgeblich für abschließende Testergebnisse ist der
[Release-Prüfbericht](PRUEFBERICHT.md), nicht die Existenz einer CI-Datei.

## Konkrete Zuordnung

| Anforderung / Quelle | Befund und Umsetzung im aktuellen Stand | Nachweis / Grenze |
| --- | --- | --- |
| Adapter-Core-API, eigene Namensräume und Lebenszyklus [I1, I2] | `eos-admin` bleibt eigenständiger Daemon; kein Umbenennen in `admin` oder `backitup`. EOS-Startpflege ist auf eigene Objekte begrenzt. Frühere automatische Fremd-ACL-/Metadaten- und Gruppenänderungen sind aus den Startpfaden entfernt. Explizite berechtigte Systemverwaltung und kontrollierte NexoWatt-Migration bleiben eigene Zugriffspfade. | `test/eos-parallel-admin-objects.test.cjs`; Backup-Abgrenzung im [Backup-Review](BACKUP_COEXISTENCE_REVIEW_DE.md). Gemeinsamer Controller-/OS-Zugang bleibt eine gemeinsame Vertrauenszone. |
| Bestehende Objekt-/Kundeneinstellungen nicht durch Startvorlagen überschreiben [I2, I3] | Eigene Modulkonfiguration liegt unter `<namespace>.modules.<modul>.configuration`, mit verschlüsseltem Inhalt, Revision und Verifikation. Bereits gültige Konfiguration hat Vorrang. Standard-`backitup` ist kein Legacy-Importziel; nur der eigene `nexowatt-backup` gehört zum Übernahmepfad. | `test/eos-module-config-store.test.cjs`, `test/eos-module-legacy-migration.test.cjs`, Update-Erhaltungstests. Die Diagnose vorhandener Fremd-ACL-Spuren ist rein lesend; kein Zurücksetzen unbekannter Vorzustände. |
| Sinnvolle Rollen und stabile Datentypen [I4, I5] | Vier generische `instanceObjects`-Rollen korrigiert: `info.connected`, `info.newsETag`, `info.newsLastId` → `text`; `info.newsFeed` → `json`. Sechs Node/npm-Versionsstates → `text`; numerische Updateanzahl → `value`. IDs, Typen, Einheiten, Werte und Schreibrechte bleiben unverändert. | `test/eos-unified-metadata.test.cjs`: 4/4 bestanden unter Node 24.22.3; [Rohbeleg](metadata-guidelines.tap). Die bestehende Controller-Darstellung `common.type=json` wird bewusst erhalten; daraus folgt keine pauschale Aussage zu allen historischen Rollen aller eingebetteten Module. |
| Port-/Konfigurationsfelder und deklarierte Laufzeit [I4, I6, I7] | `native.port=8188`, `native.bind=0.0.0.0`, TLS und Anmeldung standardmäßig aktiv; Standard-Admin auf 8081 bleibt getrennt. Paketname, Adaptername und Versionen stimmen überein. `adminUI.config=json` verwendet `admin/jsonConfig.json5`. `compact=false` ist ausdrücklich deklariert. | Metadatenschema-Prüfung. Paket erlaubt Node `>=22.23.4 <23` oder `>=24.22.1 <25`, Controller `>=7.2.5`. Daraus folgt kein automatischer Node-Hauptversionswechsel anderer Anlagenadapter. |
| Geheimnisse, lokale Anmeldung und minimale Rechte [I3, I6; EOS §§7–9] | EOS-eigene Cookie-Namen und ein eigenes Socket-Geheimnis trennen die EOS-Sitzung vom Standard-Admin. Rollen werden in HTTP und Socket über denselben reinen Resolver aus tatsächlichen Gruppenmitgliedschaften bestimmt. Der Name `system.user.admin` allein erteilt keine Rolle. Keine globalen Mitgliedschaftsänderungen zur Rollenauflösung. | Cookie-, Socket-Secret-, Rollen-/Sessiontests; [Rollenreview](ROLE_POLICY_REVIEW_DE.md). Vorhandenes `oidcClientSecret` ist geschützt, aber nicht in `encryptedNative`; OIDC ist im aktuellen Webserver deaktiviert. Eine spätere SSO-Aktivierung braucht vorher Secret-Migration und Identitätsprüfung. |
| Logging, Abbruch und Ressourcen [I2, I3; EOS §§5–6] | Eigene Logger-/Unloadpfade und begrenzte IO-/History-/Workerabläufe bleiben erhalten. Der neue Wiederherstellungsdiagnostiker liest nur zugelassene ACL-Eigenschaften und gibt keine vollständigen Kundenkonfigurationen aus. Backup-`process.exit` liegt ausschließlich im separaten Workerprozess. | Zielgerichtete Lifecycle-/Worker-/Diagnosetests. Diese Prüfung behauptet weder eine vollständige Log-Auditierung aller Altfunktionen noch eine neue RAM-/Regellatenzmessung auf der Kundenanlage. |
| Paket-, Funktions- und echte Controller-Tests [I4, I8] | Die CI enthält Build, Typprüfung, Lint, Tests und Abhängigkeitsprüfung. Zusätzlich ist jetzt ein eigener Job für die unveränderten gelieferten Paketbytes mit `npm run test:integration` unter Node 22.23.4 und 24.22.3 konfiguriert. Er baut oder versiegelt vorher nicht neu. | Ausführungsergebnisse im Release-Prüfbericht; Konfiguration allein ist kein bestandener Lauf. Linuxprüfungen ersetzen weder native Windows-Publishprüfung noch Kundenhardwareabnahme. |
| Nachvollziehbare Lizenz und Veröffentlichung [I4; EOS §12] | Proprietäre Produktlizenz `SEE LICENSE IN LICENSE` bleibt erhalten; io-package kennzeichnet `paid`. Lizenzlink wurde auf 9.0.17 aktualisiert. Fremdkomponenten und erforderliche MIT-Hinweise bleiben in den vorhandenen Lizenz-/Herkunftsnachweisen. Publish behält die Lieferintegritätsprüfung. | Keine Änderung zu einer freien Produktlizenz; kein npm-/Git-Upload in diesem Review. Aufnahme in das offizielle ioBroker-Repository ist ein gesondertes Verfahren mit weiteren Bedingungen und wird nicht durch dieses Testpaket behauptet. |

## EOS-Sicherheitsbezug und offene Abnahme

Angewandt wurden die vorhandene `AGENTS.md` sowie die EOS-Vorgaben zu sicherer
Entwicklung, Funktionserhalt, Nachweisen und Lieferumfang. Die relevanten Grenzen
sind Plattformrechte, Browseranmeldung, persistente Gerätekonfiguration und Backup.
Die neuen reinen Rollen-/Diagnosehelfer benötigen keine zusätzlichen
npm-Laufzeitabhängigkeiten. Weder ein fremdes ACL-Standardprofil noch eine
Lizenz-/Startgate-Umgehung wurde als Reparatur eingeführt.

Die allgemeinen Architektur-/CRA-Unterlagen bleiben unter
`docs/unified/SECURITY_CRA.md` mit ihren bestehenden Befundkennungen erhalten.
Dieser Abgleich ergänzt deren technische Nachweise für 9.0.17; er erklärt keine
vollständige Normerfüllung, unabhängige Zertifizierung oder allgemeine
Produktionsfreigabe. Gerätebetrieb, physische Regelgrenzen und Wiederherstellung
auf der konkreten Anlage bleiben getrennte Abnahmepunkte. Verlässliche frühere
Einstellungen lassen sich nicht aus einem unbekannten Vorzustand rekonstruieren.

## Offizielle ioBroker-Quellen

Alle Quellen wurden am 24.11.2026 abgerufen. Die Markdown-Dateien wurden direkt
im offiziellen ioBroker-Projekt geprüft; bei nicht lesbarer GitHub-Webansicht
wurde derselbe Dateiinhalt über die GitHub-Dateischnittstelle gelesen.

- [I1 – Adapterentwicklung](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md), Dokumentstand 08.09.2026.
- [I2 – Adapter-API und Objektpflege](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md), Dokumentstand 09.09.2026.
- [I3 – Best Practices](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/bestpractices.md), Dokumentstand 08.09.2026; Git-Datei-SHA `ed946b25b3a3a3c18fd7ea1bcb3d9622a84beb19`.
- [I4 – Repository-Anforderungen und Coding Practices](https://github.com/ioBroker/ioBroker.repositories/blob/master/README.md).
- [I5 – State-Rollen](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/stateroles.md), Dokumentstand 07.11.2026; Git-Datei-SHA `9356c45e1059cf9194502f121a98284c1536175a`.
- [I6 – io-package](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/iopackage.md), Dokumentstand 08.09.2026; Git-Datei-SHA `01f6710dfed78b81492174ff29a8b42fe88b59fa`.
- [I7 – ioBroker: Node.js aktualisieren](https://www.iobroker.com/docs/install/updatenode.md?lang=de). Die Empfehlung für ioBroker und die Freigabe aller installierten Adapter sind getrennt zu prüfen.
- [I8 – Adaptertests](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adaptertesting.md), Dokumentstand 08.09.2026; Git-Datei-SHA `abad88c8e4d14c9070a4b23ce5b1c5929fbb27c1`.
