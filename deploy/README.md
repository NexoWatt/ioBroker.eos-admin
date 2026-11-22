# HTTPS-Zugänge für NexoWatt EOS

NexoWatt EOS unterstützt den direkten TLS-Zugang auf **Port 8188** und einen
separat eingerichteten Nginx-Zugang auf **Port 443**. Der normale ioBroker Admin
auf **Port 8081** bleibt ein eigener Dienst und wird durch dieses Template nicht
umkonfiguriert oder abgeschaltet. Nginx wird weder bei npm-Installation noch
bei Adapterstart automatisch installiert, aktiviert oder mit Rootrechten gestartet.

| Zugang | Voraussetzung |
| --- | --- |
| `https://192.168.10.192:8188` | EOS-TLS-Listener, eigene Geräte-IP einsetzen |
| `https://192.168.10.192` | Zusätzlich Nginx auf 443, unten beschrieben |
| `https://NexoWattEOS` | Zusätzlich lokale DNS-/Hosts-Auflösung von `nexowatteos` auf die Geräte-IP |
| `https://nexowatteos.local` | Nur bei vorhandener, geprüfter DNS-/mDNS-Auflösung und bewusst aktivierter Zusatzoption |

Der Name wird durch einen Nginx-`server_name`-Eintrag nicht im Netzwerk bekannt
gemacht. Es wird kein DNS-/mDNS-Dienst mitinstalliert. Mehrere Geräte benötigen
unterscheidbare lokale Namenszuordnungen; dieses enge Profil ist für ein Gerät
mit dem Namen `nexowatteos` vorgesehen.

## Standardprofil: HTTPS auch zum EOS-Upstream

EOS verwendet `native.port=8188`, `native.bind="0.0.0.0"` für alle IPv4-Interfaces
(oder eine passend geprüfte IPv6-/Dualstack-Konfiguration), `native.secure=true`
und `native.auth=true`. Die voreingestellten Zertifikatsreferenzen heißen
`defaultPublic` und `defaultPrivate`; passende Zertifikate müssen im ioBroker-
Zertifikatsspeicher vorhanden sein. Fehlende TLS-Konfiguration erlaubt keinen
unverschlüsselten Ersatzlistener. Für die parallelen direkten IP-/Namenszugänge
bleibt `native.eosExternalOrigin=""`; ein fest eingetragener Einzel-Origin
würde die anderen Zugänge absichtlich ausschließen.

Nginx verbindet ausschließlich zu `https://127.0.0.1:8188`. Dabei sind
`proxy_ssl_verify on`, eine ausdrücklich angegebene Vertrauensdatei,
`proxy_ssl_server_name on` und ein festes `proxy_ssl_name` aktiv. Der DNS-Name
für diese TLS-Prüfung muss zu einem DNS-SAN im **EOS-Upstreamzertifikat** passen;
DNS-Auflösung dieses Namens ist für den fest vorgegebenen Loopback-Socket
nicht erforderlich. Es gibt kein dynamisches Proxyziel und keinen Fallback auf
HTTP, wenn TLS fehlschlägt.

Beispiel mit zuvor bereitgestellten, individuellen Betreiberzertifikaten:

```sh
node deploy/render-ingress.cjs --ip 192.168.10.192 \
  --certificate /etc/nexowatt/tls/device-fullchain.pem \
  --private-key /etc/nexowatt/tls/device-key.pem \
  --upstream-name nexowatteos \
  --upstream-ca /etc/nexowatt/tls/eos-upstream-trust.pem \
  --output /tmp/nexowatt-eos-nginx.conf
```

`--upstream-protocol https` ist der Standard und kann ausdrücklich ergänzt
werden. `--upstream-name` und `--upstream-ca` bleiben Pflichtangaben. Nur wenn
`nexowatteos.local` bereits zuverlässig auflösbar ist, zusätzlich
`--include-local-name true` verwenden. Das Fragment gehört in Nginx' `http {}`-
Kontext. Es reserviert 443 für die Geräte-IP und die ausdrücklich erlaubten
Namen. Fremde Hostnamen und andere Host-Ports werden abgewiesen. Der ursprüngliche
Browser-Host wird mit `proxy_set_header Host $http_host` unverändert an EOS
übergeben; der interne TLS-Prüfname ist davon getrennt.

## Zertifikate, Dateien und Rechte

Das **öffentliche Zertifikat auf 443** benötigt die Geräte-IP als **IP-SAN** und
`nexowatteos` als **DNS-SAN**; bei aktivierter Zusatzoption außerdem
`nexowatteos.local`. Für den direkten Zugang auf 8188 muss auch das EOS-Zertifikat
die dort tatsächlich verwendeten IP-/DNS-SANs abdecken. Eine CA beziehungsweise
ein ausdrücklich vertrautes, individuelles selbstsigniertes Zertifikat muss
auf den Bediengeräten vertrauenswürdig eingerichtet sein. Ein Hostname im
Zertifikats-CN allein ersetzt die benötigten SAN-Einträge nicht.

Die Datei `--upstream-ca` enthält die PEM-Vertrauenszertifikate für EOS, nicht
etwa einen privaten Schlüssel. Öffentlicher Eingang und Upstream können
unterschiedliche Zertifikate und Vertrauensketten verwenden. Erneuerung,
Ablaufkontrolle, Geräte-IP-Wechsel und CA-Wechsel müssen für beide TLS-Strecken
geplant werden. Kein privater Schlüssel und keine gemeinsame Geräte-CA werden
im Repository mitgeliefert oder vom Renderer erzeugt.

Der Renderer verlangt vorhandene, nichtleere reguläre Dateien sowie eindeutige
absolute POSIX-Pfade. Er verwirft Symlinks in Dateien und Verzeichnisketten,
Konfigurations-Metazeichen, ungeschützte beschreibbare Pfade sowie öffentlich
lesbare Schlüsseldateien. Dateien/Verzeichnisse müssen Root oder dem aufrufenden
Dienstkonto gehören; bei Sticky-Tempverzeichnissen ist nur deren allgemeine
Beschreibbarkeit von der Verzeichnisprüfung ausgenommen.
Zertifikat und Schlüssel dürfen nicht dieselbe Datei oder Hardlinks auf dieselbe
Datei sein. Zertifikatsverwaltung mit Symlinkbäumen benötigt deshalb einen
separat geprüften Bereitstellungsschritt in tatsächliche geschützte Dateien;
keine Prüfung abschalten. Der Renderer prüft Pfade und Dateimetadaten, liest
keine Schlüssel und behauptet keine Prüfung des Zertifikatsinhalts oder der
SAN-Passung. Die kryptografische Prüfung erfolgt durch Nginx beim Laden und
beim TLS-Verbindungsaufbau.

Die Ausgabe wird exklusiv mit Dateimodus `0600` erstellt. Bestehende Dateien,
auch Symlinks, werden nicht überschrieben; übergeordnete Verzeichnisse werden
nicht angelegt. Das Werkzeug führt keine Shellbefehle aus, startet keinen
Dienst und ändert keine Firewall. Root und Prozesse desselben Betriebssystem-
kontos bleiben eine gemeinsame Vertrauenszone. Der ioBroker-/Node-Prozess
bleibt unprivilegiert; keine Capabilities auf die gemeinsame Node-Binärdatei
setzen. Der Betrieb des systemseitigen 443-Listeners ist eine getrennte,
prüfpflichtige Geräteimageaufgabe.

## Explizites Altprofil mit HTTP nur auf Loopback

Nur zur Kompatibilität mit einer bereits geprüften älteren Installation:

```sh
node deploy/render-ingress.cjs --ip 192.168.10.192 \
  --certificate /etc/nexowatt/tls/device-fullchain.pem \
  --private-key /etc/nexowatt/tls/device-key.pem \
  --upstream-protocol http \
  --output /tmp/nexowatt-eos-legacy-nginx.conf
```

Dazu müssen **ausschließlich** `native.bind="127.0.0.1"`, `native.port=8188`,
`native.secure=false` und `native.eosExternalOrigin="https://192.168.10.192"`
passen. Dieses Profil akzeptiert nur die kanonische öffentliche IP, nicht
`nexowatteos` oder `.local`; TLS-Upstreamparameter werden als widersprüchlich
zurückgewiesen. Es erfüllt nicht den neuen direkten HTTPS-LAN-Zugang auf 8188.
Niemals HTTP auf allen Interfaces aktivieren. Dieses Altprofil wird weder
automatisch gewählt noch als Fehlerfallback verwendet.

## Prüfung und Abnahme

Vor Installation das gerenderte Fragment im vollständigen Ziel-Nginx-Kontext
mit `nginx -t` prüfen. Danach beide TLS-Strecken mit richtigen und falschen
Trust-/SAN-Werten testen: nicht vertrauenswürdige oder unpassende Upstream-
Zertifikate müssen den Proxyzugriff sperren. Das Syntaxkommando allein prüft
noch keine tatsächlich aufgebaute Upstreamverbindung.

Anschließend IP:8188, IP:443 und den eingerichteten Namen getrennt auf Anmeldung,
Erstpasswortwechsel, zentrale einmalige Lizenzaktivierung, Installer,
Systemverwaltung, Socket und SSE prüfen. Zugriff auf ioBroker Admin:8081 nach
seinem eigenen Sicherheitsprofil bestätigen. Unverschlüsselte Zugriffe auf
EOS:8188 müssen im Standardprofil scheitern. Host-/Origin-Fremdwerte,
explizites `:443`, Portbelegung, IPv4/IPv6, Zertifikatswechsel und Neustarts
gehören zur Zielabnahme. Diagnose-/Wiederherstellungsschritte stehen in
[ACCESS_RECOVERY.md](ACCESS_RECOVERY.md).

Die Header-Allowlist übermittelt Transport-/Browserdaten, keine vertrauenswürdige
Benutzerrolle. Benutzerrechte kommen aus der geprüften Sitzung; Forwarding-
Header authentifizieren keinen Benutzer. Uploads bleiben auf 16 MiB begrenzt.
Ein größerer Backupbedarf muss gezielt bewertet werden.

Entwicklungsnachweis dieses Schritts: dedizierte Renderer-Tests mit nur temporär
zur Laufzeit erzeugtem Testzertifikat, Injektions-/Pfad-/Symlink-/Rechtetests,
Default-TLS-/Altprofil-Prüfung, Hostbewahrung und exklusiver Dateiausgabe.
In der Entwicklungsumgebung war **kein Nginx-Binary vorhanden**; `nginx -t` ist
hier ausdrücklich **nicht ausgeführt**. Der entsprechende Test meldet `SKIP`
und führt das Kommando nur bei tatsächlich vorhandenem Nginx aus. Keine reale
Kundenanlage, DNS-/mDNS-Auflösung oder Zertifikatsstrecke wurde damit abgenommen.

Ergebnis: 7 Renderer-Tests bestanden, der Nginx-Test offen/übersprungen;
zusätzlich 21 bestehende Ownership-/Migrationstests bestanden. Der Renderer
bestand die strikte JavaScript-Typprüfung einschließlich Index-/Optionalitäts-
prüfungen und einen ausdrücklich begrenzten ESLint-Regelsatz. Details und
Rohbelege: [Ingress-Prüfvermerk](../reports/unified/ingress/PRUEFVERMERK.md).

Offizielle Nginx-Quellen, am 22.11.2026 geprüft:

- [Proxy-TLS: Name, SNI, Vertrauensdatei und Verifikation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_name).
- [Servernamen und IP-Zugriff](https://nginx.org/en/docs/http/server_names.html).

## Besitzwechsel und Bestandsmigration

Der gemeinsame Adapter prüft alle `nexowatt-ui.*` und weitere `eos-admin.*`
Instanzen einschließlich fremder Hosts. Ein Altadapter muss `enabled=false`
haben; sein bestätigter `alive=false`-Zeitstempel darf nicht vor der letzten
Instanzänderung liegen. Sein Controller muss erreichbar sein. Ein unbekannter,
noch aktiver oder nicht bestätigter Altprozess sperrt Schreibbefehle. Alte
Instanzen werden dabei weder gestoppt noch gelöscht. Der Diagnose-State
`eos-admin.0.info.eosOwnership` erklärt den Sperrgrund; er erteilt selbst keine
Schreibberechtigung. Instanz-/Lebensstatusänderungen entziehen die Freigabe sofort,
eine periodische Inventur erneuert sie höchstens für 15 Sekunden.

Diese Sperre vertraut dem Controller und seiner Datenbank; sie ist keine atomare
verteilte Gerätesperre gegen manuell gestartete oder manipulierte Altprozesse.
Vor einem echten Besitzwechsel deshalb das Prozessende am jeweiligen Host
kontrollieren. Ein abgeschalteter oder nicht erreichbarer fremder Host kann
weiterhin seine Geräte steuern und wird nicht als sicher beendet gewertet.

Das Offlinewerkzeug akzeptiert einen JSON-Export mit den beiden Dictionaries
`objects` und `states`; `objects` muss auch die vollständige alte Instanz
`system.adapter.nexowatt-ui.0` enthalten:

```sh
node tools/eos-migration-plan.cjs --input /sicher/anlage-export.json \
  --source nexowatt-ui.0 --target eos-admin.0 \
  --output /sicher/eos-migrationsplan.json
```

Es erstellt einen Vorschlag für `native.eosUi`, Objekt-/Statekopien und eine
ID-Zuordnung. Transport, eigene UI-Anmeldung und Alt-Lizenzcodes werden nicht
übernommen. Erkennbare Credentials werden ausgelassen und mit ihrem Feldpfad zur
erneuten Eingabe aufgelistet. Offene Befehle (`ack=false`) werden nie als
auszuführende Migration kopiert. Fremdskripte, Historien und eingebettete
Referenzen sind sichtbar als manuelle Prüfpunkte; kein globales Ersetzen in
der Anlagendatenbank. Bestehende Ziel-IDs führen zum Abbruch.

Der Plan ist **keine automatische Live-Migration**. Vor Anwendung vollständige,
wiederherstellbare Sicherung erstellen, beide Regler stoppen, Zuordnungen
kontrollieren und die geprüften Vorschläge über die Controller-APIs übernehmen.
Historien und Drittverweise gesondert abgleichen. Die alte Instanz und ihre
Daten für den Rückfall erhalten; erst nach Geräteabnahme bereinigen. Auch die
Ausgabe enthält vertrauliche Anlagenkonfiguration: außerhalb des Repositories
und veröffentlichter Archive aufbewahren. Eine echte unterbrochene Migration
und Wiederherstellung auf Zielhardware ist mit diesem Werkzeug noch nicht
nachgewiesen.
