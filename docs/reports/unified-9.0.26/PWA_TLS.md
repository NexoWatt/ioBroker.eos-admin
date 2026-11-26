# Web-App-Symbol und Zertifikatseinrichtung – EOS 9.0.26

Stand: 25.11.2026. Diese Prüfung betrifft die bereitgestellten Dateien und lokale HTTP-/HTTPS-/Browserprüfungen. Das iPhone und die HTTPS-Identität der Kundenanlage wurden nicht aus dieser Umgebung bedient.

## Befund und Korrektur

- Das erneut übermittelte Original `nexowatt-logo.png` ist bytegleich mit `ui/www/assets/icons/nexowatt-1024.png`: SHA-256 `952ceb9cef3f7f22a150dd8ea396285f70b9d8c19de8e7c1452bf2ff983ae6bd`. Das Bild wird nicht verändert oder neu gezeichnet. Das bestehende 180-Pixel-Symbol bleibt ebenfalls bytegleich (`083e11ab28ec00b37d3d47776946c5fad4d79277fdc440cdbb20181a7f064f76`).
- Die HTML-Verknüpfung auf das PNG war bereits vorhanden. Ein reproduzierbarer Auslieferungsfehler bestand bei konventionellen Apple-Rootpfaden: Mit gestopptem UI-Prozess beziehungsweise einem Timeout beim Lesen der Prozesskonfiguration antwortete `/apple-touch-icon.png` in 9.0.25 mit **503**. Die neue Regression gegen die unveränderte 9.0.25-Quelle reproduziert beide Fälle; `raw/pwa/pwa-926-baseline.log` enthält den Negativnachweis. Dies ist kein Nachweis, dass genau dieser Zustand den Kundenscreenshot ausgelöst hat.
- Alle vier festen Apple-Rootpfade werden jetzt im Administrationsprozess bereitgestellt. Sie benötigen weder Anmeldung noch einen laufenden UI-Prozess. Die Antworten enthalten echte PNG-Bytes und den korrekten Content-Type, auch bei HEAD. Es wird kein öffentliches Verzeichnis und keine Dateipfad-Auswahl eingeführt.
- Für öffentliche PNGs erlaubt `public, max-age=0, must-revalidate` bedingte Anfragen: Ein wiederholter unveränderter Abruf liefert HTTP 304 ohne Bilddaten. HTML, Skripte, Fehler und Zertifikatseinrichtung bleiben `no-store`. Es gibt keine neuen Polling-Timer, UI-Starts oder Zustandsabonnements. Eine RAM-Einsparung auf dem Pi wird hieraus nicht behauptet.

## Zertifikat beim Öffnen bereitstellen

Die Anmeldeseite enthält jetzt **HTTPS auf diesem Gerät einrichten**. Die öffentliche Hilfeseite `/security/trust/` zeigt den Download und SHA-256-Fingerabdruck ausschließlich einer bereits durch die bestehende EOS-Verwaltung geprüften Stamm-CA. `/security/trust/root.cer` liefert genau deren öffentliche DER-Bytes.

Bei einem noch nicht eingerichteten NexoWatt-Zertifikat erscheint stattdessen der Hinweis auf **Administration → Zertifikate**. Ein ioBroker-Standardzertifikat wird nicht ungeprüft zur Stamm-CA erklärt. Es gibt keine automatische CA-Erzeugung, Signierung, Zertifikatsrotation, Betriebssystem-Installation oder Vertrauensfreigabe. Private Geräte-/CA-Schlüssel, CSR, ausstehende Anfragen, Benutzer- und Konfigurationsdaten werden nicht öffentlich ausgegeben. Die bestehende TLS-Verwaltung bleibt administratorgeschützt. Der neue Pfad ist nur lesbar; fremder Origin, Schreibmethoden und nicht freigegebene Pfade werden abgewiesen.

Auf iPhone/iPad bestätigt der Benutzer den Profil- beziehungsweise Zertifikatsimport in den Systemeinstellungen und aktiviert anschließend das volle Vertrauen unter **Einstellungen → Allgemein → Info → Zertifikatsvertrauenseinstellungen**. Der Fingerabdruck ist unabhängig vom zunächst noch ungeprüften HTTPS-Kanal zu bestätigen. Der verwendete Name beziehungsweise die lokale oder VPN-IP muss im Gerätezertifikat enthalten sein. Eine Bestätigung der Browserwarnung genügt nicht; das Produkt schaltet keine TLS-Prüfung ab.

## Prüfungen

| Prüfung | Ergebnis / Grenze |
| --- | --- |
| Ursprüngliche Logo-Bytes und Metadaten | Originaldatei und vorhandenes PNG stimmen per SHA-256 überein; bestehende Brandingtests bestanden. |
| Fokussierte PWA-/TLS-Suite | 18 Tests unter Node 22.23.4 und 24.22.3 bestanden. |
| Frische Anmeldung bei UI-Pause / Konfigurations-Timeout | 2 Tests je Node bestanden; echte HTTPS-Verbindung mit aktivierter Zertifikatsprüfung; Rootbilder, HEAD, 304 und öffentliche Einrichtung funktionieren ohne UI-PID. |
| Öffentliche CA über HTTPS | Neue Regression in `eos-tls-management.test.cjs`: wirkliche validierte CA-Übernahme, DER-Identität, keine Auth-Abfrage für öffentliche Hilfeseite, private APIs 401, fremder Origin 403, POST 405, fremde Dateipfade 404. Fehlende CA hat weder Downloadbutton noch irreführenden Attachment-Header. |
| Browser | `test/eos-pwa-trust-browser.cjs`: 4 Prüfgruppen je Node mit Chromium 158 bestanden. Sichtbarer Link ab Anmeldung, fehlende/vorhandene CA, tatsächlicher Browser-Download, Logo, 390-Pixel-/Desktoplayout, keine Anmeldungen oder Geräteschreibvorgänge. |
| Typen / Lint | `tsc -p tsconfig.build.json --noEmit` und ESLint für `web.ts` / `eosTlsHttp.ts` bestanden. |
| iPhone / Kundenanlage | Offen: tatsächlicher iOS-Profilimport, Zertifikatsvertrauen, SAN-Abdeckung, Verhalten der Home-Screen-Vorschau und bereits gespeicherter Verknüpfungen. |

Die Browserprüfung verwendet den echten Web-Mount und die Produktdateien auf lokalem HTTP, einen synthetischen Controller und eine synthetische öffentliche CA. Sie ist kein iOS-Test. Die getrennten HTTPS-Tests verwenden echte TLS-Sockets und prüfen gegen ihre testweise ausgestellte CA; sie bestätigen nicht das Zertifikat auf Dominiques Anlage. Gesamttest und Auslieferungsbindung stehen im Hauptprüfbericht.

## Primärquellen

Am 25.11.2026 geöffnet und geprüft:

- [Apple: manuell installierte Zertifikate vertrauen](https://support.apple.com/en-us/102390): Ein manuell installiertes Zertifikat ist nicht automatisch für SSL/TLS vertrauenswürdig; die Vertrauensfreigabe erfolgt separat.
- [Apple: Zertifikatsverwaltung](https://support.apple.com/en-au/guide/deployment/depb5eff8914/web): Vertrauenskette und manuell installierte Root-Zertifikate auf Endgeräten.
- [Apple: Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html): `apple-touch-icon`, PNG, Größen und Rootpfad-Fallback.
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/): Monogramm als Ersatzsymbol und Vorrang von Apple-Touch-Icons gegenüber Manifest-Icons.

Der Benutzer hat eine Zertifikatswarnung bestätigt. Das macht die Vertrauenseinrichtung zu einem offenen Anlagenschritt; die Quellen und der Screenshot allein beweisen nicht, dass TLS die einzige Ursache des Monogramms ist.
