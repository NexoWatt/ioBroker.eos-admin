# EOS 9.0.24 – unabhängiger OCPP-Regelpfad-Review

Stand: 25.11.2026. Review der Namespace-Erweiterung in Discovery, Installer, Normalisierung, Engine und Charging-Management durch einen separaten Bearbeiter. Der Reviewer änderte ausschließlich Regressionstests und diesen Prüfvermerk. Die koordinierten Produktkorrekturen erfolgten beim verantwortlichen Implementierer; nach dessen Freeze wurden keine Produktänderungen vorgenommen.

## Geprüfte Grenzen

- Automatische Inventarisierung und Registrierung begrenzen integrierte IDs auf `eos-admin.N.ocpp.*` des tatsächlichen EOS-Owners. Die `hostNamespace`-Eigenschaft stammt unveränderlich aus dem gehosteten Adapter; ein erhaltener alter UI-Namespace erweitert diesen Zugriff nicht.
- Native und historische Alias-IDs werden stationsgenau kanonisiert. Gleichnamige Stationen in unterschiedlichen EOS-/OCPP-Instanzen bleiben getrennt. Der Installer-Identitätsvergleich wurde mit gleichnamigen Stationen der Instanzen 0, 1 und 10 geprüft.
- Fremde integrierte Namespaces und mehrere native Stationsbasen in einer Zeile werden im CM vor Registrierung der gerätebezogenen DP-Einträge gesperrt. Es entsteht dabei weder ein fremder Stellwert-/Stop-Schreiber noch eine stationsfremde Lease.
- Doppelte native Aggregate erhalten keine positive Vorgabe und keine Lease; nur eine Zeile darf den konservativen Null-Stellwert schreiben. Getrennte frühere `ocpp.N`-Connectoren behalten ihre separate Steuerung.
- Worker-Liveness verlangt Originalquellzeit, gültiges ACK/Qualität und maximal 15 Sekunden Alter. Fehlender oder ungültiger Hosted-Marker wird nicht durch das Alive des Admin-/Altadapterprozesses ersetzt. Nur explizit gültiges `false` erlaubt den dokumentierten externen Rollbackpfad.
- Atomare Profilbestätigung, Sessionidentität, Wattwert und lokale Schreibbestätigung bleiben getrennt. Eine bestätigte Profilgrenze 0 W ist keine Behauptung eines physisch bestätigten Ladestopps.

## Gefundene und korrigierte Abweichungen

| Befund | Reproduktion | Korrektur und unabhängiger Nachweis |
| --- | --- | --- |
| Neue manuell erkannte OCPP-Zeile wurde aktiviert und als AC mit 6 A vorbelegt | Tatsächliche `_applyOcppConnectorToRow` setzte fehlendes `enabled=true`, `chargerType=ac`, `minCurrentA=6` | Neue Zeilen bleiben deaktiviert; keine erfundenen elektrischen Einstellungen. Drei Tests der tatsächlichen Installerfunktionen prüfen neue hosted/native Stationen, bestehende geprüfte DC-/Aktivierungswerte und getrennte Stationsidentitäten. |
| Teilweise gefüllter erster Cache konnte Hosted-OCPP als vor-Lease-Vertrag behandeln | Frischer Worker, Socket und Session; Capability und atomarer Status noch nicht vorhanden. Tatsächlicher CM schrieb 4200 W ohne Lease. | Bei bestätigtem Hosted-Vertrag bleibt die Lease erforderlich, auch wenn beide Zustände fehlen. Echte Writerregression für neue und erhaltene Namespaces: 0 W, kein positiver Writer und keine erfundene Leasebestätigung. Externer früherer Vertrag bleibt separat kompatibel. |
| Explizites generisches Telemetrieprofil umging den nativen Hosted-Vertrag | `telemetryProfile=generic` führte zu 4200 W ohne Lease; dies gelang auch bei `runtimeAlive=false`. | Native Hosted-Verträge erzwingen die OCPP-Prüfung unabhängig vom frei gewählten Profil. Ein verspäteter Markerwechsel sperrt bis zum nächsten vollständig aufgebauten Tick; fehlende Worker-Liveness sperrt auch profilunabhängig. Echte Writerprüfung über beide Namespacevarianten und `generic/polling/modbus/http/mqtt/udp`, jeweils mit laufendem und gestopptem Worker. |

Die beiden Regelpfadfehler wurden vor ihrer Korrektur als rote Regression protokolliert. Diese erwarteten historischen Fehlschläge sind `raw/current/ocpp-lease-registration-before.txt` und `ocpp-native-generic-before.txt`; sie beschreiben nicht den abschließend geprüften Stand.

## Ergebnis

Auf Node **22.23.4** und **24.22.3** wurden jeweils **47 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen**:

```text
test/eos-ocpp-auto-discovery.test.cjs
test/eos-ocpp-runtime-feedback.test.cjs
test/eos-ocpp-limit-feedback.test.cjs
test/eos-ocpp-installer-review.test.cjs
```

Die optionale tatsächliche externe OCPP-Quelle war über `EOS_TEST_OCPP21_MAIN` eingebunden; dieser Test wurde nicht übersprungen. Rohbelege: `raw/current/ocpp-namespace-independent-node22.txt` und `ocpp-namespace-independent-node24.txt`. ESLint der geänderten Tests und `git diff --check` waren erfolgreich. Produkt-Typprüfung, vollständiger kanonischer Build und gesamte Regression werden zusätzlich im übergreifenden Release-Nachweis geführt.

Alle drei konkret reproduzierten Befunde sind im geprüften Stand geschlossen. Darüber hinaus ergab dieser begrenzte Review keinen weiteren konkret belegten Namespace-/Leasefehler. Controllerzustände und Gerätetransport der CM-Tests sind simuliert; die ausgeführten Methoden, Writer und Installerfunktionen stammen aus dem Produkt. Es wurde kein physisches Ladegerät oder reale Kundenanlage angesteuert. Dieser Review liefert keinen allgemeinen Fehlerfreiheits- oder Hardware-Sicherheitsnachweis.
