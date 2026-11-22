# Testanleitung 1.0.37 – Smarthome und Anmeldung

## Vor dem Update

1. Mit dem vorhandenen ioBroker-/EOS-Backup die Instanzkonfiguration,
   Benutzer/Gruppen und relevanten States sichern. Zusätzlich den bisherigen
   Repository-/Installationsstand 1.0.36 bereithalten. Das neue ZIP enthält keine
   Kundensicherung und keine vorhandenen Passwörter.
2. Den getrennten ioBroker-/EOS-Admin-Zugang und ein berechtigtes Konto tatsächlich
   prüfen. Die neue UI legt weder Konten noch Standardpasswörter an.
3. HTTPS-Einstieg prüfen. Die Passwortanmeldung akzeptiert über das Netz nur TLS
   oder den ausdrücklich vertrauten HTTPS-Proxy. Direkter HTTP-Zugriff ist nur
   über Loopback für lokale Entwicklung zulässig. Ein beliebiger
   `X-Forwarded-Proto`-Header ist keine Freigabe.
4. Bisherige `auth.enabled=false`, `protectWrites=false` oder Kundenpolicy
   `all`/`lan` öffnen nach dem Update keine UI. Vorhandene Werte werden nicht aus
   der Konfiguration gelöscht; die wirksame Policy ist immer Sitzungspflicht.
5. Profil festlegen: Ohne ausdrückliche EOS-Konfiguration bleibt der eigenständige
   ioBroker-Modus aktiv. EOS benötigt die in der Profilanleitung beschriebenen
   zentralen URLs und einen passenden Cookie-/HTTPS-/Proxy-Einstieg.

## Paket übernehmen

Das ZIP ist ein vollständiger Quell-/Buildstand, kein Patch und keine Sicherung
einer Kundenanlage. In ein neues Verzeichnis entpacken und die Hauptversion in
`package.json`/`io-package.json` auf 1.0.37 prüfen. Die laufende Instanz wird mit dem
bisherigen geprüften Installationsverfahren aktualisiert. Für eine Installation
aus dem Repository gelten Node.js >=22 und die vorhandenen npm-/ioBroker-Schritte.
`node_modules` ist absichtlich kein Bestandteil der Repositorylieferung.

Adapterneustart beendet alte Browsersitzungen. Neu anmelden und die Oberfläche
einmal vollständig neu laden. Der neue Service Worker entfernt alte Shell-Caches.
Die neue Version darf keine historischen Seiten-/Datenkopien offline freigeben.
Ein bereits vor dem Update laufender alter Browser-/PWA-Tab muss aktualisiert
oder geschlossen werden; Serverprüfungen sperren auch dessen alte API-Zugänge.

## Abnahme auf der Testanlage

| Prüfung | Sollverhalten |
| --- | --- |
| Privates Browserfenster, direkter UI-Port und gespeicherte Unterseiten | Loginseite; keine Zustände, Historie oder Konfiguration vor Anmeldung |
| Direkte `/api/state`, `/config`, `/events` ohne Sitzung | 401; keine Anlagendaten |
| Kundenkonto | Bedienoberfläche; technische Smarthome-Konfiguration, EMS-Appcenter und Adminfunktionen gesperrt |
| Installateur | UI und ausdrücklich erlaubte technische Einrichtung; keine Admin-Lizenz-/Mailverwaltung |
| Administrator | Freigegebene UI-/Adminfunktionen gemäß Rollenvertrag |
| Zwei Adapterinstanzen/Profile im selben Browser | Keine gegenseitige Übernahme lokaler UI-Sitzungen |
| Abmelden, Passwort ändern, Konto sperren oder Gruppe entziehen | Weitere Daten-/Schreibzugriffe gesperrt; laufender Livekanal endet bzw. liefert kein weiteres Frame |
| Falsche/fehlende CSRF-Kennung oder fremde Browser-Origin | Schreibzugriff ohne Datenpunktschreibung abgewiesen |
| HTTPS-Admin-Proxy, gegebenenfalls Unterpfad | Login, CSS/JS, Rücksprung, Popup und Abmeldung funktionieren auf dem tatsächlichen Einstieg |
| EOS-Zentrale nicht erreichbar/falsches Zertifikat/Erstpasswort noch offen | UI bleibt gesperrt; kein lokaler Passwort-Fallback |
| Licht/Dimmer/Farbe | Bisherige Geräte werden bedient; Detailansicht bietet nur konfigurierte Funktionen und echte Schrittweiten |
| Heizung/Jalousie | Bisherige Sollwert-, Grenz-, Positions-/Lamellenverträge und Rückmeldungen erhalten |
| Bool-/Textsensor und Offlinegerät | Richtiger Werttyp und sichtbarer Qualitäts-/Fehlerzustand; kein erfundener Messwert |
| Favoriten, Räume, Szenen und Timer | Vorhandene Zuordnungen und Benutzerwerte bleiben bestehen |
| Geräteimport | Vorschläge zuerst prüfen, Raum/Funktion bewusst wählen, anschließend Konfiguration speichern |
| Erneuter Scan vorhandener Geräte | Keine stille Überschreibung; angebotene Änderungen einzeln und ausdrücklich übernehmen |
| Smartphone/Tablet/Desktop, helle/dunkle Ansicht | Lesbare Karten, große Touchziele, kein horizontal abgeschnittener Dialog ab 320 px |
| Tastatur, Escape, Fokuswechsel | Detaildialog erreichbar; Fokus bleibt im Dialog und kehrt zum Auslöser zurück |
| Mehrere Liveaktualisierungen bei offenem Detailregler | Eingabe bleibt erhalten; bestätigte Zustände/Qualität aktualisieren sich |
| Hintergrund/Offline/Browser-Zurück | Sitzung neu prüfen; keine Wiederfreigabe durch ein verspätetes Statusresultat |
| EMS ohne angemeldeten Browser | Bestehende automatische Regelung arbeitet unabhängig von der UI-Sitzung |

Beim Bedienen Rückmeldung am Gerät bzw. seinem tatsächlich bestätigten State
prüfen. Eine erfolgreiche HTTP-Annahme allein belegt keine physische Ausführung.
Keine zusätzlichen Grenzwert-/Leistungstests ohne die für die Anlage vorgesehenen
Diagnose- und Inbetriebnahmeschritte durchführen.

## Bekannte Integrationsbedingungen

- Für EOS wurde die vorhandene Schnittstelle `/nexowatt/security/session` des
  verfügbaren Admin-dev9-Quellstands verwendet. Die konkrete laufende Zentrale,
  deren Zertifikat, Cookiepfad und Benutzerweiterleitung sind auf der Anlage zu prüfen.
- Standalone-Konten mit aktiviertem ioBroker-TOTP erhalten über den reinen
  Passwortpfad keine Sitzung. Die UI implementiert keine eigene TOTP-/Passkey-
  oder Wiederherstellungscode-Verwaltung und umgeht den zweiten Faktor nicht.
- Vorhandene technische Maschinenkanäle, insbesondere Mesh und Stationsdisplay,
  behalten ihre eigenen Tokenverträge. Bisher anonyme HTTP-Skripte gegen normale
  UI-Daten-/Bedienendpunkte müssen einen legitimierten Zugang verwenden.

## Rückfall

Vor einem Rückfall zuerst die neue Konfiguration sichern und die Instanz stoppen.
Dann den vorherigen geprüften Adapterstand über das bestehende Installationsverfahren
einspielen und gegebenenfalls die vorherige Konfigurationssicherung wiederherstellen.
Neue additive Importmetadaten dürfen keine erforderlichen Altzuordnungen ersetzen.
Neu starten, Browser vollständig aktualisieren und Geräte/EMS kontrollieren.
Ein Rückfall auf 1.0.36 stellt auch dessen bisherige Zugriffsgrenzen wieder her;
er ist kein dauerhafter Ersatz für den neuen Zugriffsschutz.

Für Rückmeldungen Version, Browser/Endgerät, ioBroker-/Admin-/Controller-Version,
Profil, betroffenen Gerätetyp sowie Soll-/Ist-Verhalten festhalten. Nur bereinigte
Logs ohne Cookie, Passwort, zentrale Zugangstoken oder private Anlagenexporte teilen.

