# Anmeldung und iPhone-Webapp: öffentliche Bilddateien über HTTPS

Stand: 24.11.2026. Geprüft wurde der tatsächliche EOS-HTTPS-Server mit produktivem Owner-Mount und erzeugter UI-Laufzeit. Nur ioBroker-Persistenz, Benutzeridentität und das lokale Zertifikat sind Testfixtures. Der Client prüft das Testzertifikat gegen seine ausdrücklich konfigurierte CA; die TLS-Prüfung wird nicht abgeschaltet.

## Befund und Änderung

Die vorhandenen ausdrücklichen Bild-/Manifestpfade waren vor der Änderung bereits öffentlich erreichbar. Für sie wurde keine neue generelle Anmeldesperre reproduziert. Die konventionellen iOS-Abfragepfade `apple-touch-icon-precomposed.png`, `apple-touch-icon-180x180.png` und `apple-touch-icon-180x180-precomposed.png` führten hingegen zur Anmeldung statt zu einem Bild.

Diese drei exakten GET-/HEAD-Pfade liefern nun dasselbe vorhandene 180×180-PNG. Dafür wurden ausschließlich die bestehende äußere Bootstrap-Grenze (`src/lib/web.ts`), die innere Seiten-Positivliste (`ui-access-policy.ts`) und drei feste Routennamen in der Hauptlaufzeit ergänzt. Der Dateipfad wird nicht aus Benutzereingaben abgeleitet. Es gibt keine neue öffentliche Verzeichnisfreigabe und keine Ausnahme für APIs oder Schreibmethoden.

Die Frontend-Änderung verwendet ausdrücklich `/assets/icons/nexowatt-180.png?v=083e11ab28ec` mit `sizes="180x180"` als Apple-Touch-Icon und zeigt das bestehende Emblem auch direkt im Anmeldeformular. Das ursprüngliche 1024×1024-PNG unter `/apple-touch-icon.png` bleibt unverändert: SHA-256 `952ceb9cef3f7f22a150dd8ea396285f70b9d8c19de8e7c1452bf2ff983ae6bd`. Manifest-Identität, Startpfad und Scope bleiben unverändert.

## Prüfungen

`test/eos-pwa-anonymous-https.test.cjs` prüft eine zusammenhängende frische HTTPS-Sitzung:

- Anonymer Aufruf `/` führt zur Anmeldung; deren tatsächliche Bildreferenzen liefern PNG ohne Anmeldeumleitung.
- Apple-Metadaten und tatsächliche PNG-Abmessungen stimmen überein. Alle Manifest-Icons sind erreichbar und haben die angegebenen Größen.
- Die drei neuen iOS-Aliase liefern bytegleich das bestehende 180-PNG; der ursprüngliche 1024-Pfad bleibt bytegleich zum gelieferten Original.
- `HEAD` liefert passende MIME-Angaben ohne Bildkörper; anonymer `POST` ist abgewiesen.
- Geschützte EMS-/Installer-APIs, Konfiguration und geschützte HTML-Seiten bleiben anonym gesperrt.
- Angemeldete Benutzer ohne Freischaltung beziehungsweise mit erforderlichem Passwortwechsel erhalten weiterhin ihre vorgesehenen Umleitungen/API-Sperren; die Bild-/Manifestdateien bleiben in beiden Zuständen erreichbar.

Der vollständige Fall besteht unter Node 22.23.4 und 24.22.3 jeweils mit dem Quell-Owner und dem erzeugten Backend-Owner, immer zusammen mit der erzeugten UI-Laufzeit: vier Durchläufe, jeweils 1/1 bestanden. Die vorhandenen PWA-, Richtlinien- und Frontendprüfungen ergänzen diese konkrete HTTPS-Transportprüfung. Rohprotokolle und Dateihashes liegen unter `raw/pwa-https/`.

## Aussagegrenze

Dies belegt die lokale Softwareauslieferung, MIME-Typen, Bildidentität und unveränderten Anmeldegrenzen. Es ist kein Test auf einem echten iPhone und keine Bestätigung, dass das Zertifikat der Kundenanlage auf dem Smartphone bereits vertraut wird. Das Erstellen eines neuen Home-Bildschirm-Eintrags und das Verhalten bereits zwischengespeicherter iOS-Icons bleiben eine Prüfung am tatsächlichen Endgerät.
