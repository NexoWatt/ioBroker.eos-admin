# HTTPS-Eingang für NexoWatt EOS

Die erste gemeinsame Adapterversion enthält einen prüfbaren Nginx-Eingang für
`https://Geräte-IP` → `http://127.0.0.1:8188`. **npm-Installation verändert keine
Betriebssystemdienste.** Nginx, Zertifikate, Firewall und deren Betrieb gehören
zum separat einzurichtenden Geräteimage. Der ioBroker-/Node-Prozess bleibt
unprivilegiert; keine Capabilities auf die gemeinsame Node-Binärdatei setzen.

Beispiel (IPv4; Pfade sind Betreiberwerte, keine mitgelieferten Geheimnisse):

```sh
node deploy/render-ingress.cjs --ip 192.168.10.192 \
  --certificate /etc/nexowatt/tls/device-fullchain.pem \
  --private-key /etc/nexowatt/tls/device-key.pem \
  --output /tmp/nexowatt-eos-nginx.conf
```

Der Renderer überschreibt keine Datei. Die erzeugte Datei ist für den `http`-
Kontext vorgesehen, beispielsweise als separat geprüfte Site-Konfiguration.
`native.bind="127.0.0.1"`, `native.port=8188`, `native.secure=false`,
`native.eosExternalOrigin="https://192.168.10.192"` müssen dazu passen.
Keine Host-Wildcards, wechselnden Ports oder ungeprüften Proxyziele ergänzen.
Der IPv4-Renderer ist bewusst eng begrenzt; ein Zugriff über eine IPv6-Origin
braucht eine eigene geprüfte Konfiguration und ein passendes IP-SAN.

Das individuelle Zertifikat enthält die Geräte-IP als IP-SAN; die verwendete
CA muss auf den Bediengeräten vertrauenswürdig installiert sein. Schlüssel sind
außerhalb des Repositories geschützt zu erzeugen/zu verwahren. Erneuerung,
Ablaufkontrolle und CA-Wechsel sind Betreiber-/Geräteimageaufgaben. Keine
gemeinsamen Schlüssel, kein TLS-Prüfungs-Bypass und kein unverschlüsselter
Ersatzlogin. Ein HTTPS-Aufruf direkt an 8188 ist in diesem Profil falsch.

Vor Umschalten das gerenderte Fragment im vollständigen Nginx-Kontext mit
`nginx -t` prüfen. Danach Login, Erstpasswortwechsel, NWL3-Aktivierung, Installer,
Systemverwaltung, Socket und SSE über 443 testen; LAN-Zugriff auf 8188 sowie alte
öffentliche Adminports muss scheitern. IPv4 und IPv6, Zertifikatswechsel,
Portbelegung, Neustart und Login mit falschem Host/Origin separat prüfen.
Das Template begrenzt Uploads auf 16 MiB. Größere Support-/Backupwege sind
separat zu bewerten; nicht pauschal sämtliche Limits abschalten.

Headers werden über eine Allowlist weitergeleitet. Benutzeridentität und Rolle
kommen ausschließlich aus der geprüften Sitzung; Loopback und Forwarding-
Headers authentifizieren keinen Benutzer. Der Adapter prüft die konfigurierte
öffentliche Origin selbst. Gleichberechtigte lokale Prozesse bleiben eine
gemeinsame Vertrauenszone; zusätzliche OS-Netz-/Dateirechte gehören zur
Gerätehärtung. Das Template ist keine bereits installierte oder auf einer
Kundenanlage abgenommene Konfiguration.

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
