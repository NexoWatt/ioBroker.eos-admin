# SmartHome-Geräteimport und Bestandskompatibilität

Stand: Entwicklung 1.0.37 auf Basis 1.0.36, 19.11.2026.

## Zweck und Grenzen

Die eigene EOS-Visualisierung und die eigene SmartHome-Konfiguration bleiben
maßgeblich. Der vorhandene `@iobroker/type-detector` in Version **5.0.10** liefert
lokale Erkennungsvorschläge. Es wird weder die React-Oberfläche von
`ioBroker.devices` eingebunden noch ein weiterer Adapter zur Voraussetzung für
die Bedienung. Ein vorhandener Alias kann als stabiler Gerätevertrag genutzt
werden; seine ID und damit ioBroker-Umrechnungs-/Schreiblogik bleiben erhalten.

Die Erkennung liest Objekte und erstellt Vorschläge. Sie speichert keine
Konfiguration, schaltet kein Gerät und ändert keine EMS-Priorität. Übernahme und
Aktualisierung bearbeiten zunächst ausschließlich den lokalen Installerentwurf.
Erst die vorhandene Aktion **Speichern** verwendet den geschützten,
transaktionalen Konfigurationspfad. Importherkunft oder Quellmetadaten verleihen
keine Rollen- oder Datenpunktrechte.

## Erkennung und Übernahme

1. Im eigenen SmartHome-Konfigurator Geräte automatisch erkennen lassen.
2. Vorschlag, Datenpunkte, Werttyp, Raum und Funktion prüfen. Ein neuer Raum oder
   eine Funktion trägt den Hinweis „beim Übernehmen anlegen“. Gleichnamige
   Bestandsräume bleiben eine ausdrückliche Auswahl; die Erkennung legt keinen
   zusätzlichen Raum zum Auflösen einer Mehrdeutigkeit an.
3. Gewünschtes Gerät übernehmen, den Entwurf prüfen und anschließend speichern.

Sensoren übernehmen `common.type`: `boolean`, `string` oder `number`. Dadurch
werden beispielsweise Bewegungsmeldungen und Textzustände nicht mehr als
Zahlen geparst. Der Werttyp ist auch bei einem nur lesenden Sensor im
Konfigurator sichtbar und einstellbar. Die Einheit kommt aus `common.unit`.

Gerätename, unterstütztes lokales Symbol, feste Hexfarbe sowie Mitgliedschaften
in `enum.rooms.*` und `enum.functions.*` werden vorgeschlagen. Nicht unterstützte
Bildpfade bleiben sichtbare Hinweise für den Installateur; der Import lädt keine
externen Bilder. Eine erkannte Quellenzuordnung ändert keinen bestehenden Raum,
keine Funktion, keine Gebäudestruktur und keine Favoriteneinstellung.

## Aliase und Dubletten

`resolveSmartHomeAliasIdentity` verfolgt Lese- und Schreibziel getrennt, mit
Zyklenerkennung und höchstens 16 Schritten. Nicht vorhandene oder ungültige
Stateziele sperren die automatische Übernahme. Die aufgelösten Endpunkte dienen
nur zum Vergleich; die vorgeschlagenen IO-IDs bleiben die Alias-IDs.

Ein passender Alias wird gegenüber einer zusätzlichen physischen Quelle
bevorzugt. Die semantische Zuordnung wird auch gegen vorhandene manuelle Geräte
und bereits übernommene Entwurfsgeräte geprüft. Gemeinsam verwendete Batterie-
oder Störungsdatenpunkte zählen nicht als Geräteidentität. Mehrdeutige bestehende
Zuordnungen werden nicht automatisch zusammengeführt oder ersetzt. Gewollte
Spezialzuordnungen bleiben über die manuelle Konfiguration möglich.

## Quellenänderungen ausdrücklich prüfen

Ein importiertes Gerät erhält `importProvenance` mit Provider, Quell-ID,
Detektortyp/-version, Mappingversion, SHA-256-Fingerabdruck sowie ursprünglichen
und semantischen State-IDs. `sourceValues` enthält eine begrenzte Liste fester
Importattribute. Ungültige Herkunft wird bei der Normalisierung entfernt.
Vorhandene manuelle Geräte bekommen keine künstliche Importhistorie.

Eine erneute Erkennung vergleicht den ursprünglichen Quellenstand, den neuen
Vorschlag und den aktuellen Gerätewert. Änderungen werden feldweise mit altem und
vorgeschlagenem Wert angezeigt. Manuelle Abweichungen sind gekennzeichnet; kein
Feld ist vorausgewählt. **Ausgewählte Änderungen übernehmen** übernimmt nur die
markierten Felder in einen kopierten Entwurf. Wurde ein ausgewählter aktueller
Wert inzwischen bearbeitet, wird der gesamte Vorgang abgewiesen und eine neue
Prüfung verlangt.

**Gerätewerte beibehalten** bestätigt ausdrücklich den neuen Quellenstand ohne
Übernahme der Gerätewerte. Nicht übernommene Werte bleiben eigene Einstellungen.
Stabile Geräte-IDs, Räume, Geschosse, Funktionen, Favoriten, Szenen-/Timerbezüge
und Berechtigungen sind keine automatisch aktualisierbaren Importattribute.
Änderungen einer Gerätefähigkeit oder Schreibfreigabe sind weiterhin manuell im
eigenen Konfigurator zu bewerten. Der Erkennungscache berücksichtigt den aktuellen
Konfigurationsfingerabdruck und zeigt gespeicherte Zuordnungen sofort korrekt an.

## Optionaler Status und Kameras

| Konfiguration | Laufzeitwert | Bedeutung |
| --- | --- | --- |
| `io.indicators.batteryId`, `batteryUnit: '%'` | `state.battery`: Zahl 0–100 | Prozentwert; 0 ist ein gültiger Wert. |
| `io.indicators.batteryId`, `batteryUnit: 'low'` | `state.battery`: Boolean | `true` bedeutet „Batterie schwach“, keine Prozentumrechnung. |
| `io.indicators.unreachableId` | `state.unreachable`: Boolean | Ein gültiges `true` setzt den Gerätestatus auf offline. |
| `io.indicators.errorId` | `state.deviceError`: Boolean/Zahl/Text | Wahr, eine Zahl ungleich 0 oder ein Fehlertext meldet Störung. Gesunde Standardwerte wie `false`, `0`, leer oder `OK` melden keine Störung. |
| `io.camera.urlStateId` | Aktuelle HTTP(S)-URL | Optionale dynamische Quelle vor den festen Kamera-URLs. |

Statusdatenpunkte werden ausschließlich gelesen. Fehlende, ungültige oder
veraltete Statuswerte bleiben mit eigener `fieldQuality` unbekannt/ungültig/stale;
es wird kein künstlicher Batterie- oder Fehlerwert erzeugt. Gesunde Zusatzwerte
maskieren keine ungültige Hauptmessung. Ein gültiges UNREACH-/ERROR-Signal
übersteuert dagegen den zusammengefassten Gerätestatus.

Eine dynamische Kameraquelle übernimmt nur die State-ID in die Konfiguration.
Der Import persistiert keinen URL-Schnappschuss und keine darin enthaltenen
Token. Zur Laufzeit sind ausschließlich HTTP(S)-URLs ohne eingebettete
Benutzernamen/Passwörter zulässig. Bei fehlender, ungültiger oder veralteter URL
bleibt das Bild leer; ein alter Snapshot wird nicht als aktueller Wert benutzt.
Es findet kein serverseitiger URL-Abruf statt. Bestehende Kameras ohne
`urlStateId` behalten ihren bisherigen statischen Vertrag.

## Wartung und Prüfnachweise

Maßgebliche Quellen:

- `src-ts/runtime-executables/lib/smarthome-import.ts`: typisierter, reiner
  Vorschlags-/Abgleichshelper.
- `src-ts/runtime-executables/lib/smarthome-contract.ts`: additive Normalisierung
  und Lese-/Schreib-ID-Sammlung.
- `src-ts/runtime-executables/main.ts`: `buildSmartHomeDevicesFromConfig`,
  `getSmartHomeDevicesWithState`, `nwShcfgTdBuildSuggestion` und
  `/api/smarthome/type-detect`.
- `src-ts/runtime-executables/www/smarthome-config.ts`:
  `nwImportTypeDetectedSuggestion`, `nwApplyTypeDetectedUpdate` und
  `nwRenderShcfgDetector`; zugehöriger Hilfetext in
  `www/smarthome-config.html`.

Die ausführbaren JS-Spiegel werden ausschließlich mit dem zentralen
Runtime-Generator erzeugt. Neue Helper werden mit
`node node_modules/typescript/bin/tsc -p tsconfig.smarthome-import.json` unter der
strikten Projektbasis geprüft.

Die Laufzeitsuite
`node scripts/verify-smarthome-import-runtime.js --report docs/reports/smarthome-import-2026-11-19/runtime-evidence.json`
transpiliert die aktuellen kanonischen Module in ein temporäres Verzeichnis und
führt den echten installierten Type-Detector aus. Tatsächliche Handler-,
Normalisierungs-, Zustands- und Entwurfsfunktionen werden mit synthetischen
Objekten/Stateantworten ausgeführt. Der Nachweis bindet sich an Quellenhashes.

Die Suite prüft 13 fachliche Gruppen: Datentypen, vollständige isolierte
Erkennungs-/Zustandskette, ungültige/stale Indikatoren, Störungen, Metadaten,
Aliaspräferenz, Aliasfehler, gemeinsame Statuspunkte, manuelle Zuordnungen und
Cache, ausdrückliche Updates, rein lesende Zusatz-IDs, Kameras und historische
Blindverträge. Das ist **keine HTTP-/Authentifizierungs-, Browser-, ioBroker-
oder Hardwareintegration**. Die zentralen Build-/Regressions-/Release-Gates und
die anlagenspezifische Inbetriebnahme bleiben eigene Nachweise.
