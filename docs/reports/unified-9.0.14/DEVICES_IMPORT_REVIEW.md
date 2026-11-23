# Devices: Bestandsdaten und manueller Import

Stand: 23.11.2026. Änderungsstand für 9.0.14. Dieser Vermerk beschreibt Quellcodeprüfung und lokale Tests, keinen vollständigen Test der Kundenanlage.

## Belegte Befunde

1. **Verlorene Geräteliste bei einer gültigen Altform:** Der echte Adapter 0.5.176 kennt `native.devices` und `native.devicesJson`. Seine Funktion `autoMigrateLegacyDevicesJson` übernimmt die JSON-Liste auch dann, wenn `devices` bereits als leeres Standardarray existiert. Der bisherige EOS-Preflight rief unmittelbar `validateConfig` auf; dieses las die JSON-Liste nur bei fehlendem `devices` und löschte danach `devicesJson`. `devices: []` plus eine gefüllte JSON-Liste wurde dadurch zu null Geräten. Reproduktion mit `modules/devices/index.js` aus der unveränderten Release-ZIP 9.0.13: ein Quellgerät → null Zielgeräte; korrigierter Preflight: ein Quellgerät → ein Zielgerät. Bei diesem Vergleich wurden die lokalen Hilfsabhängigkeiten verwendet, nicht eine separat gestartete vollständige Altinstallation.
2. **Unverständliche Importsperre:** `EOS_MODULE_IMPORT_REQUIRES_DISABLED` war eine bestehende Schutzbedingung. Das gespeicherte Zielmodul muss für den manuellen Konfigurationsimport deaktiviert sein. Die Oberfläche bot die Schaltfläche trotzdem an und zeigte anschließend nur den Fehlercode.
3. **Parallelitätsfehler:** Der alte Import prüfte den deaktivierten Zustand vor mehreren asynchronen Zugriffen. Die Mutationssperre wurde erst beim abschließenden `save` reserviert. Eine zwischenzeitliche Aktivierung/Speicherung konnte deshalb anschließend vom Import überschrieben werden.
4. **Gefahr beim erneuten Import:** Ein manueller Import ersetzte den Migrationsvermerk. Nach einer automatischen Übernahme konnte so `preserveNamespace` verloren gehen und die Bindung an die ursprünglichen Datenpunkt-IDs entfallen.
5. **Initialisierungsrennen:** Ein neu angelegter, noch nicht gestarteter Modulhost besitzt zunächst leere deaktivierte In-Memory-Einträge. Ein Import konnte diesen Zwischenzustand als gespeicherte Deaktivierung behandeln. Parallel laufendes `start()` lud danach eine tatsächlich aktivierte Kundenkonfiguration; der Import konnte diese anschließend überschreiben. Ein unabhängiger Review reproduzierte einen gestarteten Zielruntime und dessen nachträgliche Ersetzung durch den Import.
6. **Falsche Backup-Zielangabe:** Der manuelle Importbericht verwendete für alle Nicht-Devices-Module den EEBus-Präfix. Backup meldet jetzt den tatsächlichen `.backup.`-Zielpräfix; es handelt sich um eine Berichtskorrektur, nicht um umgeschriebene Datenpunkte.

Die angezeigte Importsperre allein beweist keinen Datenverlust auf der konkreten Kundenanlage. Der separat vom Nutzer gemeldete Bestandsstatus `LICENSE_REQUIRED` ist ein anderer Befund; seine Wiederaufnahme wird im Migrations-/Startbericht behandelt.

## Umsetzung und Schutzgrenzen

- Nur der Legacy-Preflight löst die zwei Gerätequellen auf. Bei leerem/fehlendem `devices` werden gefüllte `devicesJson` übernommen. Beide gefüllten Quellen müssen übereinstimmen; andernfalls bricht die Übernahme mit `EOS_DEVICES_LEGACY_CONFIG_CONFLICT` ab, ohne eine Quelle zu überschreiben. Fehlerhaftes JSON, unbekannte Vorlagen, unerlaubte Konfiguration und unpassende Protokolle bleiben abgelehnt.
- Der manuelle Import verwendet jetzt ebenfalls diesen Preflight. Geräte-IDs, Verbindungsparameter und Zugangsdaten bleiben erhalten; Zugangsdaten werden im API-Ergebnis maskiert und im privaten Konfigurationsspeicher verschlüsselt gespeichert. Quellobjekte werden nicht verändert.
- Normales Speichern einer bewusst geleerten Geräteliste bleibt unverändert: alte JSON-Reste beleben keine entfernten Geräte wieder.
- Der komplette manuelle Import besitzt die Mutationssperre. Paralleles Speichern/Aktivieren und weitere Importe werden abgelehnt. Der Quellenstopp wird nach der asynchronen Konvertierung erneut geprüft; ein zwischenzeitlicher Hoststopp verhindert die Speicherung.
- Startinitialisierung und Konfigurationsänderungen besitzen dieselbe Sperre. Import und Speichern werden vor vollständig geladenen Zielkonfigurationen mit `EOS_MODULE_NOT_READY` abgelehnt. Auch ein bewusst wegen ausstehender Migration nicht gestarteter Host darf dadurch seine leeren Standardwerte nicht über Kundenkonfigurationen speichern. Gleichzeitige Startaufrufe warten auf denselben Startvorgang. Fehlgeschlagene Konfigurationslesevorgänge gelten nicht als erfolgreiche Initialisierung des betroffenen Eintrags. Katalog-/Diagnoseabfragen bleiben lesbar.
- Bereits übernommene Original-Namespaces und nicht bestätigte Modulstopps blockieren den manuellen Import. Es gibt keine automatische Ziellöschung und keine automatische Umgehung einer belegten Zielkonfiguration.
- Die Devices-Seite zeigt die konkrete Voraussetzung und deaktiviert die Importschaltfläche passend zum gespeicherten Zustand. Ein bloß entferntes, noch nicht gespeichertes Aktivierungshäkchen reicht nicht. Der Link zum Status der automatischen Bestandsübernahme bleibt sichtbar. Bekannte Serverfehler werden verständlich erklärt; geänderte, noch nicht gespeicherte Formulare bleiben bei Fehlern erhalten.
- Ein manueller Import ist weiterhin eine **deaktivierte Konfigurationskopie mit neuen Datenpunkt-Pfaden**, keine 1:1-Bestandsübergabe. Er kopiert keine Zustände, schreibt keine EMS-Zuordnungen um und startet keine Gerätekommunikation. Für die ursprünglichen IDs bleibt die automatische Bestandsübernahme zuständig.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Node.js 24.22.3: Import-Recovery, Editor-Sitzung, Modulhost, reale Modulverträge, Stop-Lifecycle und Devices-Hosted-Modul | 64/64 bestanden, keine übersprungenen Tests |
| Node.js 22.23.4: dieselben sechs Testdateien | 64/64 bestanden, keine übersprungenen Tests |
| `tsc -p modules/devices/tsconfig.hosted.json` | bestanden |
| ESLint mit `eslint.unified.config.mjs`: Modulhost, Devices-Modul und drei geänderte Testdateien | bestanden |
| ESLint: Browserbrücke im Script-/Browserkontext mit denselben Regeln | bestanden |
| `node --check modules/devices/admin/host-bridge.js` | bestanden |
| Historischer Preflight aus Release-ZIP 9.0.13 gegen korrigierten Preflight, gleiche synthetische Legacy-Konfiguration | Datenverlust vorher reproduziert; korrigiert ein Gerät erhalten |

Die Testdateien sind `test/eos-module-import-recovery.test.cjs`, `test/eos-module-editor-session.test.cjs`, `test/eos-module-host.test.cjs`, `test/eos-module-real-contract.test.cjs`, `test/eos-module-stop-lifecycle.test.cjs` und `modules/devices/test/hostedModule.test.js`. Die Editorprüfung verwendet einen minimalen DOM-Vertrag; sie ist kein visueller Browsertest. Node 22 meldete eine experimentelle `EnvHttpProxyAgent`-Warnung der Testumgebung, aber keine Testfehler.

## Offene Abnahme

Kein Zugriff auf Gerätepasswörter, reale Modbus-/EEBus-Geräte oder die laufende Kundenanlage. Deshalb bleibt nach Wiederaufnahme der Migration zu prüfen: erwartete Geräteanzahl, erhaltene Original-IDs und Zuordnungen, laufende Verbindungen, genau eine zuständige Steuerungsinstanz und EMS-Diagnose. Eine gleichzeitige Änderung der alten Instanz durch einen anderen Administrator ist weiterhin zu vermeiden; ioBroker bietet für die gesamte Quellen-/Zielübernahme keine datenbankübergreifende Transaktion. Es wurde keine Produktivänderung oder Veröffentlichung ausgeführt.
