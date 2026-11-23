# SmartHome: Übernahme vorhandener Kundeneinstellungen

Stand: 23.11.2026. Quellprüfung und synthetische Regressionstests für den Arbeitsstand 9.0.8; keine pauschale Kunden- oder Hardwarefreigabe.

## Tatsächliche Ablage und Übernahme

| Inhalt | Bisheriger Speicherort | Übernahmeverhalten |
| --- | --- | --- |
| Explizite Freigabe und ältere Datenpunktzuordnungen | `system.adapter.nexowatt-ui.N.native.smartHome` | Vollständig in den geschützten UI-Konfigurationsspeicher übernommen; `enabled: false` bleibt erhalten. |
| Gebäudestruktur, Etagen, Räume, Funktionen, Geräte, Seiten, Szenen | `native.smartHomeConfig` beziehungsweise aktueller `nexowatt-ui.N.installer.configJson` | Der Installer-Patch bleibt am alten Ort. Die eingebettete Laufzeit liest ihn mit dem ursprünglichen Namensraum und verwendet die aktuelle Struktur vor älteren nativen Angaben. |
| Datenpunktadressen und Geräteverknüpfungen | `smartHome.datapoints`, `smartHomeConfig.devices[].io` | Keine automatische Umbenennung oder Neuerstellung der referenzierten Fremddatenpunkte. |
| Logikeditor | `installer.configJson.logicEditor` | Bestehende Graphen und Referenzen werden geladen. |
| Gerätezeitprogramme | `nexowatt-ui.N.smarthome.timersJson` und Zeitstempel | Gleiche IDs; vorhandene JSON-Konfiguration wird weiter gelesen. |
| Logikuhren | `nexowatt-ui.N.smarthome.logicClocksJson`, Zeitstempel und `smarthome.logicClocks.*` | Gleiche IDs und Eingangsreferenzen bleiben bestehen. |
| Objektmetadaten und History-Zuordnung | Bestehende ioBroker-Objekte | Werden beim Übergang nicht ersetzt. |

Die Übernahme kopiert keine offenen, unbestätigten Gerätebefehle und spielt sie nicht erneut ab. HTTPS, Anmeldung und Systemlizenz werden zentral durch EOS verwaltet; die alten Transport- und Lizenzfelder werden ausdrücklich nicht als neue Systemkonfiguration übernommen.

In 9.0.7 ergibt sich die Kundensicht aus dem nativen `smartHome.enabled` oder einer installierten und aktivierten SmartHome-App. Das Anlegen einer Gebäudestruktur aktiviert diese Sicht nicht automatisch. Der Struktur-Speicherweg ändert `smartHomeConfig`, nicht die Freigabe.

## Geprüft

Ausgeführt:

```sh
node --test test/eos-module-legacy-migration.test.cjs ui/test/unified/migrated-runtime.test.cjs ui/test/unified/preserved-ui-config.test.cjs
npx tsc -p ui/tsconfig.preserved-ui-config.json
```

Ergebnis: **27 Tests bestanden, keine fehlgeschlagen, keine übersprungen**; separater strikter Typcheck des neuen Bestandsdatenprüfers bestanden. Vier zusätzliche Fälle prüfen jeweils ausdrücklich aktiviertes und deaktiviertes SmartHome:

- Übergabe und erneutes Laden der geschützten nativen Konfiguration;
- unveränderte ursprüngliche States, Objekte, History-Metadaten und ein unbestätigter Gerätebefehl;
- tatsächliches Laden des aktuellen Installer-Patches durch die eingebettete Laufzeit;
- Erhalt von Etagen-/Raumzuordnung, Geräte-IO, Szenen, Seiten, Logikreferenzen, Zeitprogrammen und Logikuhren;
- Erhalt des nativen Freigabestatus trotz eines abweichenden älteren Installer-Patch-Schalters;
- keine neuen SmartHome- oder Installer-Konfigurationsstates im EOS-Namensraum anstelle des bisherigen UI-Namensraums.

Weitere neue Fälle prüfen beschädigtes, zu großes oder strukturell falsches JSON, unzulässige Objektschlüssel, nicht lesbare States, die feste Fünf-Sekunden-Lesedeadline, leere optionale Uhren, verlorene bekannte Konfiguration zwischen Vorprüfung und Übergabe sowie das Ausbleiben eines fremden globalen Backup-Imports.

## Zusätzliche Übernahmesicherung in 9.0.8

Der gemeinsame Prüfer liest `installer.configJson`, `smarthome.timersJson` und `smarthome.logicClocksJson` vor dem Stoppen des alten Adapters, nochmals nach dessen bestätigtem Stop und vor dem Start der übernommenen Laufzeit. Vorhandene gültige JSON-States werden als erforderliche Bestandsdaten in der geschützten Migrationsmetadatei vermerkt. Später fehlende erforderliche States verhindern die Aktivierung mit einem festen Fehlercode. Fehlende optionale Uhren und ihre bisherigen leeren Standardwerte bleiben zulässig. Ein vorhandenes Installer-Konfigurationsobjekt ohne lesbaren State wird nicht als neue leere Anlage interpretiert.

Die übernommenen Laufzeitdaten werden vor dem Anlegen von Default-States gelesen. Der Installer-Loader verwendet bei einer übernommenen UI ausschließlich den erhaltenen Namensraum und die übernommenen nativen Angaben; er liest keine globale `0_userdata.0.nexowattVis`-Sicherung als automatischen Ersatz. Ungültige oder unlesbare Bestandsdaten werden nicht durch eine vermeintlich erfolgreiche Default-Konfiguration verdeckt. Die bestehenden ACL-bewussten ioBroker-Lesewege bleiben erhalten; es gibt keinen Rechte-Bypass und keine geratenen Credential-Entschlüsselungen.

Die Testdaten sind synthetisch. Datenbank und Sitzung werden durch Testvorrichtungen bereitgestellt. Die zeitgesteuerte Befehlsausführung wurde in den Hydrationstests gezielt angehalten; das Ergebnis beweist Konfigurationsübernahme und Adressidentität, keine physische Aktorwirkung, Echtzeitgarantie oder unterbrechungsfreie Übergabe.

## Weiterhin bestehende Grenzen

Es gelten die dokumentierten allgemeinen Migrationssperren aus 9.0.7: bekannte Quellversionen und eindeutige Instanzen auf demselben Host, keine bereits belegte Zielkonfiguration, lesbare geschützte Felder, geprüfte EEBus-Identität und keine unversorgten alten RPC-Verweise. Ein deaktivierter alter UI-Adapter wird derzeit nicht automatisch übernommen. Diese SmartHome-Prüfung beseitigt diese Sperren nicht.

Die zusätzliche Prüfung validiert bekannte JSON-Container, Größe, Tiefe und SmartHome-Abschnittsstrukturen. Sie ist keine vollständige fachliche Abnahme jedes Altgraphen, Geräts oder Timerfelds. Vor einer allgemeinen Kundenfreigabe sind vollständige, lesbare Bestandsdaten und die tatsächliche Wirkung der vorhandenen Automatisierungen gesondert zu prüfen. Die reine Existenz einer Übernahmefunktion ersetzt diese Abnahme nicht. Eine bereits mit 9.0.7 erfolgte Übernahme besitzt noch keine historische Liste erforderlicher States; vorhandene beschädigte Daten werden auch dort abgewiesen, ein vor dieser Erweiterung bereits gelöschter optionaler State lässt sich ohne Sicherung jedoch nicht rekonstruieren.
