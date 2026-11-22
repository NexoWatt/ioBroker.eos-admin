# Prüfbericht – NexoWatt UI 1.0.37

Stand: 19.11.2026. Ergebnis: **Testpaket / Security Review**, keine allgemeine
Produktivfreigabe. Die vollständig geordnet fortgesetzte Prüfmatrix umfasst
86 Prüfgruppen: **77 PASS, 9 BLOCKED_BROWSER_START, 0 verbleibende FAIL**.
`npm run test:all` als unveränderte verkettete Gesamtprüfung ist wegen des
Browserstarts **nicht vollständig bestanden**. Die übrigen Gruppen wurden
einzeln weitergeführt; kein Gate wurde entfernt oder als bestanden übersprungen.

## Gegenstand und Umgebung

Ausgangsstand ist das vollständige Repository 1.0.36. Archivname und SHA-256
stehen in der [Releaseunterlage](../../STABLE_1_0_37_RELEASE_DE.md).
Geprüft wurden Smarthome-Modernisierung, Geräteimport, Pflichtanmeldung und
getrennte ioBroker-/EOS-Anmeldeprofile einschließlich des begrenzten
EOS-dev9-Integrationsbausteins. Bestehende EMS-Regelalgorithmen wurden nicht
umgebaut. Keine Veröffentlichung, Installation auf Kundenanlagen oder Änderung
an einer laufenden EOS-Zentrale wurde vorgenommen.

Prüfumgebung: Linux x64, Node.js 24.22.3; Abhängigkeiten aus den Lockdateien,
Type-Detector 5.0.10, echte lokale HTTP-/TLS-Verbindungen zu Controller-/EOS-
Testfixtures. Keine Kundenkonten, realen Anlagen oder Geräte. Die Lieferung
enthält TypeScript-Quellen, erzeugte Runtime-Dateien, gebauten React-Admin,
Integrationshilfe, Dokumentation und Prüfscripte. `node_modules`, temporäre
Buildverzeichnisse und der fremde EOS-Referenzexport sind nicht im ZIP.
Für Installation/Build gilt Node.js >=22.

## Ergebnisse

| Bereich | Ergebnis und Nachweis |
| --- | --- |
| Gesamtmatrix | 77 von 86 Prüfgruppen bestanden; neun beim Browserstart blockiert. [Endmatrix](evidence/matrix-final.json), einschließlich Erstversuch, Wiederholungen, Exitcodes und SHA-256 der Logs. |
| Verketteter Pflichtlauf | `npm run test:all` erneut tatsächlich ausgeführt. Exit 1 bei `test:rc66-station-display-browser`; vorherige Gruppen bestanden. [Originalausgabe](evidence/test-all-final.log). |
| Neue Zugriffsschranke | 32 HTTP-/TLS-Prüfgruppen bestanden: Rollen, Kontoänderungen, Legacy-Policies, Profile, CSRF/Origin, Sitzung, Parser, Rate-Limit, Widerruf, Zeit-/Größenlimits und SSE. |
| Geräteimport | 13 Laufzeit-Prüfgruppen mit tatsächlichem Type-Detector bestanden; Alias-/Typverträge, Dubletten, manuelle Angaben und Zustandsqualität geprüft. Siehe benachbarte Importnachweise. |
| Moderne Smarthome-UI | Neun DOM-/Runtime-Prüfungen bestanden: große Dialoge, Fokus, Eingabestabilität bei Liveupdates, Zustandsqualität und erhaltene Bedienverträge. Keine visuelle Browserabnahme. |
| Anmelde-Frontend | Acht VM-/DOM-Prüfgruppen bestanden; Profiltrennung, CSRF-Zuordnung, Abmeldung, Rückkehr und verspätete Ergebnisse. Ergänzende echte HTTP-Fixture-Verträge der Browserscripte bestanden. |
| EOS-dev9-Integration | Acht Prüffälle bestanden: Originalhashbindung, sichere Anwendung, abweichender Stand, Sicherung und Rückfall. Kein Versuch auf laufender Zentrale. [Integrationsanleitung](../../integrations/EOS_ADMIN_DEV9_UI_LOGIN_DE.md). |
| TypeScript und Build | Gesamt-Typecheck, `npm run build:ts`, Admin-Build und Spiegelprüfungen bestanden. Neue Auth-/Importmodule und Browser-Anmeldedateien in strikten Scopes. Sieben aufgelöste Grenzkonfigurationen und 23 negative Guard-Fälle bestanden. |
| Bestehende Funktionstests | Unter anderem dynamischer Netzanschluss, Partnerkanal, Gruppen-/Adminrollen, Lizenz-Ersteinrichtung, Admin-HTTPS-/Proxyverträge und Sicherheitsstandards bestanden. Softwaretests mit Fixtures, keine Anlagenabnahme. |
| Paket | `publish:check`, Dokumentationsbindung, Secret-Guard, Produkt-SBOM, Release-Metadaten und `npm pack --dry-run --json --ignore-scripts` bestanden. 534 explizite Paketdateien, 535 npm-Einträge einschließlich `package.json`. |
| Frisches Repository / Update | Vor der abschließenden Berichtsergänzung ein ZIP tatsächlich erzeugt, frisch entpackt und über das unveränderte 1.0.36-Archiv gelegt. Artefakt- und Stable-Prüfung beider Verzeichnisse bestanden. Ein altes Admin-Bundle wurde außerhalb des Overlayverzeichnisses gesichert; Sicherung hashidentisch, zweiter Vorbereitungsaufruf ohne Änderung. [Paketnachweis](evidence/artifact-prefinal/artifact-verification.json). |
| Veröffentlichungsablauf | Gesamter lokaler `prepublishOnly`-/Overlay-Test gegen eine isolierte Testregistry bestanden. Keine echte Veröffentlichung. |

Die Rohlogs liegen neben `matrix-final.json`. Historische fehlgeschlagene
Erstversuche bleiben mit Kennzeichnung und unverändertem Hash erhalten; für den
Abschluss zählt jeweils `result` des aktuellen Eintrags. Der fachliche Quellstand
blieb bei der abschließenden Berichtsergänzung unverändert. Das endgültige
Lieferarchiv wird danach erneut entpackt und gegen seine versiegelten
Produktdateien geprüft. Seine Prüfsumme steht außerhalb des ZIPs, um eine
selbstreferenzierende Archivprüfsumme zu vermeiden.

## Browserprüfungen: ausdrücklich offen

Chromium scheitert beim Prozessstart mit `socket() Operation not permitted`
und teilweise zusätzlichem `ptrace`-Fehler. Scripte mit unterdrückter
Browserausgabe enden am wartenden `DevToolsActivePort`. Das sind fehlende
Browserausführungen, keine bestandenen Tests und kein Beleg für einen
funktionsfähigen Browserablauf.

Betroffen sind `rc66-station-display-browser`, `rc69-dashboard-lp-feedback`,
`rc70-dashboard-lp-status-polish`, `rc72-weather-pv-forecast-auto`,
`rc74-pv-forecast-customer-ui`, `rc75-pv-forecast-admin-location`,
`rc76-pv-forecast-runtime-hardening`, `rc92` und
`stable-1.0.3-home-appcenter`. Auch die zusätzliche neue
`test:auth-profiles-browser`-Abnahme ist nicht als Browser-PASS nachgewiesen.
Die Scripte bleiben für eine geeignete Prüfumgebung enthalten. Es gibt keine
behaupteten neuen Browser-Screenshots oder visuelle Geräteabnahme.

## Unabhängige Gegenprüfung und Korrekturen

| Befund | Reproduktion und Korrektur |
| --- | --- |
| UI37-R01: fremder Port desselben Hosts erhielt Credential-CORS | Reale HTTP-Reproduktion; jetzt gemeinsame exakte Prüfung von Schema, Host und Port einschließlich negativer Preflight- und CSRF-Prüfung. |
| UI37-R02: Kontolesung konnte eine Sitzung unbeschränkt warten lassen | Absichtlich nie aufgelöste Controllerlesung; jetzt gemeinsames 5-s-Sitzungsbudget und begrenzte Objektlesung, durch HTTP-Timeouttest belegt. |
| UI37-R03: verspätete React-Sitzungsantwort nach Abmeldung | Lebenszyklus-/Generationsprüfung verhindert nachträgliche Freigabe und Zustandsübernahme; tatsächlicher Routenvertrag mit negativen Fällen geprüft. |
| UI37-R04: Login-Rücksprung verlor Proxy-Unterpfad | Rücksprung übernimmt ausschließlich verifizierten Instanzpräfix; Runtime-/Proxy-Vertrag und HTTP-Rücksprung geprüft. |

Alte Testfixtures wurden auf tatsächlich erforderliche Sitzung und CSRF
angepasst. Die Lizenz-Ersteinrichtung prüft jetzt 126 reale HTTP-Aufrufe mit
anonymer und rollenfremder Ablehnung. Der Service-Worker-Test führt den echten
Fetch-Handler mit tatsächlichen Logo-PNG-Bytes aus: öffentliche Assets können
gecacht werden, private Antworten und APIs bleiben ausgeschlossen. Kein Test
erhielt einen produktiven Authentifizierungs-Bypass. Ein vorhandener falscher
Dateisystem-Typstub wurde mit dem tatsächlichen Buffer-/Dateigrößenvertrag
korrigiert; die globale Typprüfung wurde nicht abgeschwächt.

## Sicherheit und nachvollziehbarer Altbestand

Die Anmeldung speichert keine zusätzlichen Kontopasswörter; die zuständige
Kontenverwaltung bleibt für Passwortregeln verantwortlich. Rollen werden auf
dem Server überprüft. UI-Seiten, Daten, Konfiguration und Livekanal benötigen
eine gültige Sitzung; Schreibzugriffe zusätzlich CSRF und passenden Origin.
Technische Maschinenkanäle behalten ihren eigenen geprüften Tokenvertrag.
Alte Optionen `auth.enabled=false`, `protectWrites=false`, `all` und `lan`
sind kein anonymer Ersatzweg mehr.

Die abschließende ESLint-Policyprüfung erfasst 181 Dateien und 3097 Fundstellen:
2957 historische offene Fundstellen und 140 einzeln begründete Review-Fälle.
Es gibt keine neue unzugeordnete oder verbotene Fundstelle in diesem Gate.
25 Policy-/Negativtests bestanden. Dies bedeutet **nicht**, dass der Gesamtaltbestand
frei von Sicherheitsmängeln oder vollständig strikt migriert ist. Der alte
Baselinehash blieb unverändert; Review-Erneuerungen sind dokumentiert.

Historischer Lizenzvertrag, externe Abhängigkeits-/Gesamt-EOS-Nachweise,
Remote-CodeQL und offene ASVS-/Herstellerprüfungen bleiben in
`release-manifests/release-status.json` erhalten. Keine allgemeine
NIST-/OWASP-/CRA-Zertifizierung oder Produktivfreigabe wird behauptet.

## Bestand, Einrichtung und verbleibende Abnahme

Der [Bestandsvergleich](BESTANDSKOMPATIBILITAET_DE.md) belegt byteidentische
108 EMS-Quelldateien und 15 gemeinsame Verträge gegenüber 1.0.36. Die 22
Smarthome-Routen bleiben erhalten; 21 Handler bleiben unverändert, der
Importhandler wird erweitert. Browser-Speicherschlüssel, bestehende
Gerätezuordnungen und Betriebsalgorithmen werden fortgeführt. Ein Wechsel
von Schema/Host/Port kann die Sichtbarkeit browserlokaler Favoriten ändern;
die alten Werte werden dadurch nicht gelöscht. Beim HTTPS-Einstieg beachten.

Auf der konkreten Zielanlage sind noch zu prüfen:

- ioBroker-/EOS-Admin-Version, HTTPS-Zertifikat, Bind-Adresse, Cookies und
  tatsächliche gemeinsame Proxyroute. Der EOS-dev9-Baustein muss separat nach
  Originalhashprüfung und eingerichteter Proxyroute angewendet werden.
- Kunden-, Installateur- und Administratorrollen, Abmeldung, Kontosperre,
  Passwort-/Gruppenänderung, zentrale Störung und direkter Port-/API-Zugriff.
- Smartphone, Tablet und Desktop, helle/dunkle Ansicht, Touch und Tastatur,
  Dialoge, echte Geräte-Rückmeldungen und Bestandskonfiguration.
- Bestehende Anlagen-/EMS-Regelung mit realen Zeit- und Ausfallreaktionen.
  Ein Softwarevergleich ist keine Hardwaregarantie.

Standalone-Konten mit aktiviertem ioBroker-TOTP werden durch den reinen
Passwortpfad gesperrt; keine eigene TOTP-/Passkey-Challenge und kein
zweiten-Faktor-Bypass. EOS prüft die vollständige zentrale Sitzung. Vor dem
Update einen funktionierenden vorgesehenen Zugang prüfen. Die
[Testanleitung](../../operations/TESTANLEITUNG_1_0_37_DE.md) enthält Sicherung,
Profilwahl, Abnahme und Rückfall. Der Lieferstand bleibt `review`,
`productionApproved:false`.
