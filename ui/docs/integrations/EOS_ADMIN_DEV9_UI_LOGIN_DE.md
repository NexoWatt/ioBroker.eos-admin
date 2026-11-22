# EOS dev9: Rollenabhängiger Einstieg in die NexoWatt UI 1.0.37

## Zweck und Umfang

Der Baustein in `integrations/eos-admin-dev9/` verbindet den vorhandenen
zentralen EOS-Einstieg mit der UI. Er ist ausschließlich für die beiden unten
genannten Dateien aus `NexoWatt_EOS_dev9_Erststart_PiUpdate_FULL_2026-10-04.zip`
vorgesehen. Das eigenständige ioBroker-Anmeldeprofil bleibt davon unabhängig.

| Bestätigte zentrale Sitzung | Verhalten nach der Anmeldung |
| --- | --- |
| Endkunde (`enduser`), Erstpasswort erledigt | Direkte Weiterleitung zur gewählten UI-Instanz am gemeinsamen HTTPS-Ursprung. |
| Endkunde, Erstpasswort erforderlich | Bestehender zentraler Erstpasswortdialog; keine vorzeitige UI-Weiterleitung. |
| Installateur (`installer`) | Bestehendes Installateurportal mit freigegebenen Einstellungen; der Cockpit-Link führt zur gemeinsamen UI-Proxyroute. |
| Administrator (`admin`) | Bestehende Admin-Oberfläche; zusätzlicher Link „NexoWatt UI“ in der Werkzeugleiste. |
| Keine bestätigte Sitzung | Bestehende zentrale Anmeldung beziehungsweise gesperrte Fehleransicht. |

Die Weiterleitung ist eine Bedienfunktion. Die UI prüft zusätzlich jede
geschützte Anforderung serverseitig. Der Baustein ändert keine Konten, Gruppen,
Passwörter, Berechtigungen oder Gerätewerte. Installateure erhalten keine
pauschalen Administratorrechte. Ein bewusst aufgerufener eigener Passwortwechsel
bleibt vor der Weiterleitung erreichbar.

## Belegter Ausgangsstand

Beide Archivdateien haben denselben SHA-256-Hash:

`0804f7a98c25bbddb588f84c9408a88be31687211afc84c68d705109d3303548`

- `components/admin/src-admin/public/js/eos-role-bootstrap.js`
- `components/admin/adminWww/js/eos-role-bootstrap.js`

Die unveränderte Textreferenz, der Diff für Instanz 0 und deren Hashes liegen
im Integrationsverzeichnis. `apply-ui-login.cjs` bindet beide Originale an den
exakten Hash. Unbekannte, bereits gepatchte oder abweichende Stände werden
abgewiesen. Instanzwerte müssen kanonische ganze Zahlen von 0 bis 999999 sein.
Der Diff dient der Prüfung; zur Anwendung ist der prüfende Applier vorgesehen.

## Erforderliche Verbindung

Der geprüfte EOS-dev9-Admin stellt die Route
`/proxy/nexowatt-ui.<Instanz>/` nicht selbst bereit. Der gemeinsame HTTPS-Zugang
muss deshalb separat im vorhandenen Reverse Proxy eingerichtet werden. Ein
Frontend-Link allein stellt keine Proxyverbindung her.

Beispiel für einen öffentlichen Admin-Einstieg unter `https://eos.example/`:

- Zentraler Admin und Anmeldung: `https://eos.example/`
- Geschützte UI-Instanz 0: `https://eos.example/proxy/nexowatt-ui.0/`
- Zentraler Sitzungsendpunkt: `/nexowatt/security/session`

Bei einem Admin-Präfix `/admin/` liegt die öffentliche UI-Route unter
`/admin/proxy/nexowatt-ui.0/`. Präfix, Instanz und Adapterport müssen zur
Installation passen. `nginx-ui-location.conf.example` ist nur ein Fragment für
einen bestehenden HTTPS-Server, keine vollständige Konfiguration und keine
automatische Installation. Es überschreibt `Host`, `X-Forwarded-Host`,
`X-Forwarded-Proto`, `X-Forwarded-Prefix` und `X-Forwarded-For` an der
Vertrauensgrenze. Die tatsächliche Verbindung zur UI muss vom erlaubten
Proxy-Peer kommen; Browserheader allein begründen kein Vertrauen. SSE wird ohne
Proxy-Pufferung und ohne Proxycache weitergereicht.

In der UI müssen gemäß [Anmeldeprofil-Anleitung](../operations/ANMELDEPROFILE_1_0_37_DE.md)
das Profil `auth.mode: eos`, die feste `auth.eosSessionUrl`, die zentrale
`auth.eosLoginUrl` und `auth.eosLogoutUrl` eingerichtet sein. Optional sind eine
PEM-CA und konkrete `auth.trustedProxyIps` erforderlich. Der Browserzugang ist
HTTPS; ausschließlich die interne Sitzungsprüfung darf bei einer wörtlichen
Loopback-IP HTTP verwenden. TLS-Prüfung wird nicht deaktiviert.

Das zentrale `access_token`-Cookie muss an der gemeinsamen UI-Route ankommen.
Unterschiedliche Ports bilden keine Cookie-Isolation. Cookie-Host, Cookie-Pfad,
öffentlicher Ursprung und Proxyroute sind zusammen zu prüfen. Der zentrale
Sitzungsendpunkt bleibt ein serverseitig konfiguriertes Ziel; Passwörter oder
vom Browser behauptete Rollen werden nicht weitergegeben.

Für einen UI-seitig gestarteten zentralen Login kann der belegte EOS-Login
einen **fest konfigurierten** `href` verwenden, beispielsweise
`/index.html?login&href=%2Fproxy%2Fnexowatt-ui.0%2Flogin.html`.
Bei `/admin/` beide Pfade anpassen. Der Wert darf nicht aus beliebigen
Browser-Rücksprungparametern übernommen werden. Der zentrale Einstieg ohne
`href` nutzt nach Anwendung des Bausteins die rollenabhängige Weiterleitung.

## Prüfen und gezielt anwenden

Node.js 22 oder neuer ist erforderlich. `<EOS-Checkout>` bezeichnet das
Verzeichnis mit dem Ordner `components`. Vor einer Anwendung den Quellstand
und die bestehende Installation sichern. Diese Lieferung hat weder den
ursprünglichen EOS-Quellbaum noch einen laufenden Dienst verändert.

Zunächst ausschließlich den Quellstand prüfen:

```sh
node integrations/eos-admin-dev9/apply-ui-login.cjs --root /pfad/zum/EOS-Checkout --instance 0
```

Dieser Aufruf liest beide Dateien, prüft die Hashes und zeigt den geplanten
Ergebnishash. Er schreibt nichts und ruft keinen Server auf.

Nach Einrichtung des gemeinsamen HTTPS-Proxys ausdrücklich anwenden:

```sh
node integrations/eos-admin-dev9/apply-ui-login.cjs --root /pfad/zum/EOS-Checkout --instance 0 --apply --public-admin-url https://eos.example/
```

Der zweite Aufruf prüft die öffentliche UI-Statusroute ohne Cookies und
Passwort. Die Antwort muss das konfigurierte EOS-Profil bestätigen und den
anonymen Zugang verweigern. Weiterleitungen, ungültige Antworten, mehr als
64 KiB Antwortinhalt und Ablauf des 5-Sekunden-Budgets brechen die Anwendung ab.
Die normale CA- und Hostnamenprüfung bleibt aktiv. Bei eigener Infrastruktur-CA
muss der ausführende Node-Prozess dieser CA ausdrücklich vertrauen; kein
`NODE_TLS_REJECT_UNAUTHORIZED=0` verwenden.

Danach werden beide Originale in einem neuen Verzeichnis unter
`<EOS-Checkout>/nexowatt-integration-backups/ui-1.0.37-…/` gesichert. Das Manifest
enthält Pfade und ursprüngliche/neue Hashes. Erst danach werden die Dateien
einzeln atomar ersetzt. Eine Veränderung seit der Prüfung bricht die Anwendung
ab. Bei einem Fehler nach dem ersten Austausch werden ausschließlich noch
unveränderte eigene Ersetzungen zurückgenommen; fremde Zwischenänderungen
werden nicht überschrieben.

Die Anwendung startet, baut oder veröffentlicht keinen Dienst. Die Übernahme
in eine EOS-Installation und deren Neustart bleiben eigene Betriebsschritte.
Wiederholte Anwendung oder Instanzwechsel auf bereits gepatchten Dateien werden
bewusst abgewiesen.

## Rückfall und Betriebsprüfung

Für einen Rückfall beide gesicherten Dateien gegen die `beforeSha256`-Werte
des Sicherungsmanifests prüfen. Beide aktuellen Zieldateien gegen dessen
`afterSha256`-Werte prüfen. Nur bei Übereinstimmung beider Paare die beiden
Originale aus derselben Sicherung zurücksetzen; bei Abweichung zuerst den
Zwischenstand klären. Die zurückgesetzte Basis ist wieder mit dem lesenden
Prüfaufruf prüfbar. Die Sicherung bis zur Betriebsabnahme aufbewahren.

Am vorgesehenen EOS-System sind vor Freigabe die drei Rollen, Erstpasswort,
eigener Passwortwechsel, gemeinsamer Login/Logout, abgelaufene oder widerrufene
Sitzungen, geänderte Gruppenrechte und die direkte UI-Port-/API-Sperre zu
prüfen. Ein Browser-Tab aus dem Verlauf muss erneut geprüft werden. Der
Rollenlink ersetzt keine serverseitige Kontrolle.

## Ausgeführte Prüfung und Grenzen

`node scripts/verify-eos-dev9-ui-integration.cjs --report` führt tatsächliche
gepatchte Rollenfunktionen in isolierten JavaScript-Kontexten aus. Geprüft
werden außerdem Quellhash, Syntax, Instanzen, beide Zielversionen, Symlinks,
Sicherungsinhalte, Race-Abbruch und Proxyvertrag mit HTTP-Doubles. Acht
Prüfgruppen sind am 19.11.2026 unter Node.js 24.22.3 bestanden. Ohne `--report`
bleibt der beigefügte Nachweis unverändert.

Der hashgebundene Beleg liegt in
`docs/reports/auth-profiles-2026-11-19/eos-integration-evidence.json`.
Kein laufender EOS-Admin, kein Nginx, kein echter Browser und keine Anlage
wurden dabei umgestellt oder geprüft. Daraus wird keine allgemeine
Produktivfreigabe oder Sicherheitszertifizierung abgeleitet.
