# Direktes HTTPS und Web-App: Laufzeitprüfung 1.0.38

## Ergebnis und Prüfumfang

Die gezielte Laufzeitprüfung am 22.11.2026 ist erfolgreich: **34 Prüfgruppen und
66 tatsächliche HTTP(S)-Anfragen**, ausgeführt mit Node.js **24.22.3**, Exit-Code
**0**. Der maschinenlesbare [Prüfnachweis](direct-https-runtime-evidence.json)
enthält Prüfzeit, Einzelgruppen, Laufzeiten und SHA-256-Werte der geprüften
Dateien. Er wird nur nach vollständig erfolgreichem Lauf geschrieben.

Das Prüfwerkzeug [verify-ui-direct-https.cjs](../../../scripts/verify-ui-direct-https.cjs)
lädt die tatsächlich ausgelieferte `main.js` und ruft deren `startServer()` und
`onUnload()` auf. Express, HTTP-/HTTPS-Server, TLS, Zugriffsschutz, Sitzungen und
HTTP-Routen laufen unverändert. Die lokalen Controller-Grenzen
für Benutzer, Zertifikatsabruf, Lizenzstatus und Datenpunkte werden durch
kontrollierte Testobjekte ersetzt. Datenpunktänderungen erreichen diese
Testobjekte; es werden keine Anlagen angesteuert.

Zusätzlich läuft die tatsächliche Methode `onReady()`. Ihre nachgelagerten
fachlichen Initialisierungen werden an ausdrücklich benannten Ersatzgrenzen
protokolliert. Dadurch wird nachgewiesen, ob der Startablauf EMS-/SmartHome-
Initialisierung erreicht oder beim Shutdown unterbindet. Die Fachmodule führen
in diesen Ablaufprüfungen keine EMS- oder Hardware-Regelzyklen aus.

## Nachgewiesene Eigenschaften

| Bereich | Konkreter Nachweis |
| --- | --- |
| Getrennter HTTP-/HTTPS-Betrieb | Bei deaktiviertem TLS startet ein echter HTTP-Server ohne Zertifikatsabfrage. Bei aktiviertem TLS startet ein echter HTTPS-Server. Das jeweils falsche Protokoll liefert keine nutzbare UI; TLS-Startfehler erzeugen keinen HTTP-Rückfall. |
| Zertifikatsprüfung | Eigene temporäre CA und ein Zertifikat mit IP-SAN `127.0.0.1`; der Client vertraut ausdrücklich dieser CA. TLS-Zertifikatsprüfung bleibt eingeschaltet. Fehlendes Vertrauen, falscher Servername und TLS 1.1 werden abgewiesen. |
| Zwischenzertifikat | Tatsächlicher erfolgreicher Handshake mit Root-CA → Intermediate → IP-Leaf, während der Client ausschließlich der Root-CA vertraut. Ohne ausgeliefertes Intermediate scheitert der entsprechende Kontrollfall. |
| Anmeldung und private Daten | Anonymer Root-Aufruf führt zur Anmeldung. Private API- und Live-Zugriffe werden mit 401 abgewiesen. Eine echte lokale Anmeldung erzeugt die Produktsitzung; Kunden- und Admin-Zugriffe werden getrennt geprüft. HTTPS-Sitzungscookies tragen `Secure`, `HttpOnly` und `SameSite=Lax`. |
| Schreibschutz | Fehlender oder falscher CSRF-Wert und abweichender Origin verhindern den Schreibvorgang. Ein berechtigter Aufruf mit korrektem Schutz erreicht genau den vorgesehenen lokalen Datenpunkt. Logout ohne CSRF wird verweigert; regulärer Logout entwertet die Sitzung. |
| Tatsächlicher Browsercode | Über HTTPS ausgelieferte `runtime-base.js` und `auth.js` werden unverändert in einer DOM-/VM-Umgebung ausgeführt. Ein anschließender `fetch('/api/set')` erhält den CSRF-Wert durch den Produkt-Wrapper und schreibt erfolgreich. Nach Logout unterbleibt ein weiterer Schreibversuch. Der Test setzt diesem Aufruf selbst keinen CSRF-Header. |
| Dashboard-Start | Die tatsächliche Dashboard-Antwort lädt `runtime-base.js` → `auth.js` → `app.js`, jeweils einmal und ohne `async`-Reihenfolgerisiko. |
| Web-App-Ressourcen | Login-Assets, EOS-Logo, Manifest, Service Worker sowie Manifest- und Apple-Icons sind vor Anmeldung über HTTPS abrufbar, mit passendem Inhaltstyp und den ausgelieferten Bytes. Die Manifest-Startadresse führt anonym zur Anmeldung und nach Anmeldung zur erwarteten Bedienoberfläche. |
| Sitzungswiderruf | Kontensperre, geänderte Passwortversion und entzogene Gruppenzuordnung entwerten bestehende HTTPS-Sitzungen. |
| Fehlerfälle | Fehlende bzw. ungültige Zertifikatsauswahl, fehlende Controller-API oder Antwort, Lesefehler, ungültiges PEM, unpassender Schlüssel, abgelaufenes Zertifikat, falscher Aussteller, Größen- und Anzahlgrenzen verhindern den Serverstart. Ausgaben enthalten weder Schlüsselmaterial noch den simulierten internen Controller-Fehlertext. |
| Zeit- und Lebenszyklusgrenzen | Der Zertifikatsabruf endet tatsächlich nach etwa 5 Sekunden. Wiederanlauf mit noch offener Controller-Abfrage wird verhindert; ein verspäteter Callback öffnet keinen Listener. Ein unvollständiger TLS-Handshake wird nach etwa 5 Sekunden beendet. Belegter Port sowie Unload mit aktiver HTTPS-SSE-Verbindung und begonnenem TLS-Socket sind separat geprüft. |
| Shutdown während des Starts | Ein zunächst offener Zertifikatsabruf erhält nach tatsächlichem `onUnload()` gültige Zertifikate. Trotzdem startet kein HTTP-/HTTPS-Listener. Derselbe Ablauf innerhalb von `onReady()` erreicht weder EMS-/SmartHome-Initialisierung noch Verbindungs-Heartbeat; die Konfigurationssperre wird freigegeben. |
| Autonome Initialisierung bei TLS-Fehler | `onReady()` erreicht nach einem tatsächlichen TLS-Konfigurationsfehler weiterhin die EMS- und SmartHome-Initialisierungsgrenzen in der vorgesehenen Reihenfolge. Der Webport bleibt geschlossen und wird nicht als online gemeldet. Ein echter Portkonflikt bleibt als Kontrollfall ein allgemeiner Startfehler; er wird nicht zur TLS-Ausnahme umgedeutet. |

## Ausführung und Bindung an den Quellstand

Nach dem normalen Runtime-Build wird im Repository ausgeführt:

```sh
node scripts/verify-ui-direct-https.cjs --report
```

Voraussetzungen sind installierte Projektabhängigkeiten, Node.js ab Version 22,
das lokale OpenSSL-Werkzeug und freie Loopback-Ports. Das Werkzeug öffnet nur
lokale Testlistener. Temporäre Zertifikate und private Schlüssel werden außerhalb
des Repositorys erzeugt und im Abschlussweg entfernt; das Entfernen wird geprüft.
Der Bericht enthält keine Schlüssel, Kennwörter oder Sitzungstokens.

Die Hashliste bindet insbesondere `main.js`, die kanonische `main.ts`, den
TLS-Helfer mit seiner TypeScript-Quelle, Zugriffsschutz, Auth-/Login-Code,
Dashboard, PWA-Ressourcen, Icons und das Prüfskript. Die Werte werden vor und
nach dem Lauf verglichen. Eine Änderung während der Prüfung lässt den Lauf
scheitern. Admin-Bundles und nicht aufgeführte Produktbereiche gehören nicht
zur Hashbindung dieses gezielten Nachweises.

## Abgrenzung

Dies ist eine tatsächliche lokale Server-/TLS-Integration mit kontrollierten
Controller-Grenzen. Es ist keine Prüfung eines realen Controller-Zertifikatsspeichers,
keiner Kundeninstallation und keiner Hardware. Die DOM-/VM-Ausführung belegt
den Auth-Wrapper-Vertrag, keine visuelle Browserabnahme. Manifest und Assets
wurden real ausgeliefert; Installation, Update und Darstellung auf einem
Mobilgerät wurden damit nicht geprüft. Diese Prüfung ersetzt weder die übrigen
Release-Gates noch eine Inbetriebnahme mit dem konkreten Zertifikat und dem
Vertrauensspeicher der vorgesehenen Endgeräte.

Der Prüflauf verändert keinen Produktcode und installiert keine Abhängigkeiten.
