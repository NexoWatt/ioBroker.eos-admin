# Optionaler HTTPS-Zugang auf Port 443 ohne TLS-Terminierung

Diese beiden Units sind Vorlagen für ein Linux-Gerät mit systemd. Sie werden
nicht beim npm-Installieren oder beim Adapterstart aktiviert. Der Betreiber
prüft und installiert sie einmalig für das konkrete Geräteimage.

Systemd besitzt den privilegierten TCP-Listener auf 443. Der getrennte
`systemd-socket-proxyd` läuft mit einer dynamischen unprivilegierten UID und
ohne Capabilities. Er reicht ausschließlich TCP-Daten an `127.0.0.1:8188`
weiter. TLS endet erst im EOS-Adapter. Weder Proxy noch Vorlage benötigen
einen privaten TLS-Schlüssel. Der Browser prüft das tatsächlich von EOS
ausgelieferte Zertifikat. HTTP wird nicht automatisch in HTTPS umgewandelt.

## Voraussetzungen und Prüfung

- EOS erreicht man bereits über HTTPS auf 8188; `secure=true`, `auth=true`.
- EOS lauscht auch auf `127.0.0.1:8188` (typischerweise Bind `0.0.0.0`).
- Das vorhandene EOS-Zertifikat enthält die gewünschten DNS-/IP-SANs, also
  beispielsweise `nexowatt.local`, optional `nexowatt` und die Geräte-IP.
  Es ist auf den Bediengeräten vertrauenswürdig eingerichtet.
- Port 443 ist frei. Einen vorhandenen Webserver oder Dienst nicht verdrängen.
- Der Pfad `/usr/lib/systemd/systemd-socket-proxyd` existiert auf dem Ziel und
  stammt aus dessen gepflegtem Systempaket. Falls die Distribution einen
  anderen Pfad verwendet, ausschließlich `ExecStart` im lokalen Entwurf anpassen.
- IPv4 und IPv6 sind aktiviert. Bei bewusst deaktiviertem IPv6 im lokalen
  Entwurf die IPv6-`ListenStream`-Zeile und `BindIPv6Only` entfernen.

Lesende Zielprüfungen:

```sh
systemd --version
test -x /usr/lib/systemd/systemd-socket-proxyd
ss -ltn '( sport = :443 or sport = :8188 or sport = :8081 )'
systemd-analyze verify deploy/systemd/nexowatt-https.socket deploy/systemd/nexowatt-https.service
```

Die Dateien vor Installation lesen. Vorhandene Units gleichen Namens dürfen
nicht ungeprüft überschrieben werden. Das folgende Beispiel ist nur für eine
Ersteinrichtung ohne solche Dateien; bei vorhandenem Dienst zuerst dessen
Konfiguration und Besitzer feststellen und sichern.

Ein berechtigter Administrator führt anschließend bewusst aus:

```sh
sudo install -o root -g root -m 0644 deploy/systemd/nexowatt-https.socket /etc/systemd/system/nexowatt-https.socket
sudo install -o root -g root -m 0644 deploy/systemd/nexowatt-https.service /etc/systemd/system/nexowatt-https.service
sudo systemd-analyze verify /etc/systemd/system/nexowatt-https.socket /etc/systemd/system/nexowatt-https.service
sudo systemctl daemon-reload
sudo systemctl enable --now nexowatt-https.socket
```

Jeden Schritt prüfen und bei Fehlern stoppen. Keine `sudo`-Regel für den
Adapter einrichten. Keine Rechte oder Capabilities auf die Node-Binärdatei
übertragen. Firewallregeln werden hier nicht verändert. Zugang nur in den
vorgesehenen lokalen Netzsegmenten zulassen; keine Router-Portfreigabe erzeugen.

## Abnahme

Die Socket-Unit darf erst nach erfolgreicher Zielprüfung als eingerichtet
gelten. Auf einem Bediengerät die Namensauflösung und danach
`https://nexowatt.local/` beziehungsweise den tatsächlich eingerichteten Namen
prüfen: korrekte Zertifikatsprüfung, Anmeldung, Dashboard bei bestehender
Sitzung dieses Hostnamens, Installer, Systemverwaltung, History, Livewerte und
Abmeldung. EOS:8188 und der bestehende ioBroker-Admin:8081 müssen weiter
erreichbar sein. Das Ergebnis nach kontrolliertem Geräte-/Adapterneustart
erneut prüfen.

```sh
systemctl status nexowatt-https.socket nexowatt-https.service
journalctl -u nexowatt-https.socket -u nexowatt-https.service -n 50 --no-pager
```

Der Passthrough ergänzt keine Proxy-/Identitätsheader. EOS sieht für diese
Verbindungen den lokalen Peer `127.0.0.1`. IP-basierte Limits und
Verbindungsprotokolle fassen solche Clients deshalb zusammen; Benutzerrechte
und Sitzungswiderruf bleiben sitzungsbezogen. Dieses Profil benötigt keine
Blindfreigabe für Forwarding-Header. Bereits genutzte IP-ACLs oder
IP-spezifische Betriebsregeln vor Auswahl dieses Profils prüfen. Es ist keine
client-IP-erhaltende Proxyimplementierung.

## Rückfall

Für eine ausschließlich hierfür neu eingerichtete Unit:

```sh
sudo systemctl disable --now nexowatt-https.socket
sudo systemctl stop nexowatt-https.service
```

Damit endet nur der zusätzliche 443-Zugang. EOS auf 8188 und ioBroker Admin auf
8081 bleiben eigenständige Listener. Vorher vorhandene Units nach deren
gesichertem Betriebsverfahren wiederherstellen; keine fremde Proxykonfiguration
löschen. Die beigefügten Units wurden in der Entwicklungsumgebung nur mit
`systemd-analyze verify` geprüft, nicht auf einem Kundengerät installiert oder
als root gestartet.

Quelle: [offizielle systemd-socket-proxyd-Dokumentation](https://www.freedesktop.org/software/systemd/man/latest/systemd-socket-proxyd.html), geprüft am 23.11.2026. Socket-Aktivierung mit `Accept=no`, begrenzte Verbindungen und unveränderte bidirektionale TCP-Weiterleitung.
