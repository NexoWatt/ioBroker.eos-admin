# Zugang nach der Alpha-1-Installation wiederherstellen

Alpha 1 konnte `admin.0` deaktivieren und dessen Port auf `18081` sowie Bind-Adresse
auf `127.0.0.1` ändern. Gleichzeitig war EOS standardmäßig nur auf
`127.0.0.1:8188` erreichbar. Ein HTTPS-Eingang auf Port 443 wurde durch npm nicht
eingerichtet. Die vorherige Admin-Port-/Bind-Konfiguration wurde dabei nicht
gesichert. Bestehende TLS-Einstellungen und Zertifikatsnamen des Admin wurden
durch diese Sperre nicht umgeschaltet.

Ab Alpha 2 verändert diese Sperre `admin.0` nicht mehr. Ein Update stellt die
unbekannten früheren Werte jedoch nicht automatisch wieder her. Das hier
ausdrücklich gewählte Zielprofil ist Admin auf Port **8081** und EOS auf
**8188/HTTPS**, beide auf allen IPv4-Interfaces (`0.0.0.0`). HTTPS auf **443**
kommt über einen separat eingerichteten, zertifikatsprüfenden Eingang hinzu.
`0.0.0.0` ist eine Bind-Adresse, keine Browseradresse und keine IPv6-Zusage.

Die Befehle sind für die bestehende PuTTY-/SSH-Sitzung auf dem ioBroker-Gerät
gedacht. `/opt/iobroker` durch das tatsächliche Installationsverzeichnis ersetzen.
Keine zusätzlichen Root-Rechte oder pauschalen Firewalländerungen sind Teil
dieser Anleitung. Vor dem Stoppen von EOS muss die Anlage in einem passenden
Wartungszustand sein: Mit dem Adapter stoppt auch dessen eingebettete Regelung.
Unabhängige Geräteschutzfunktionen müssen weiter wirksam bleiben; keinen zweiten
Regler parallel starten.

## 1. Gezielt lesen

Das mitgelieferte Werkzeug ändert weder Objekte noch Dienste:

```sh
node /opt/iobroker/node_modules/iobroker.eos-admin/tools/eos-access-diagnostics.cjs --iobroker-dir /opt/iobroker --instance 0
```

Es prüft den festen Controller-Pfad und dessen Paketidentität und führt nur
fest definierte Leseaufrufe ohne Shell aus. Ergebnisfelder enthalten die
freigegebenen Zugangseinstellungen, `enabled`/`alive`, Zertifikatsnamen und
Passwortvorhandensein. Passwort-Hashes, private Schlüssel und vollständige
Objekte werden nicht ausgegeben. Die CLI liefert das Zertifikatsdictionary
intern; es wird sofort auf Namen und nichtleere Einträge reduziert. Namen mit
ungewöhnlichen Zeichen werden ausgelassen. Pro Aufruf gelten drei Sekunden und
16 KiB Ausgabegrenze, insgesamt 30 Sekunden. Exitcode 2 bedeutet unvollständige
Leseergebnisse; `null` bedeutet unbekannt, nicht ausgeschaltet oder leer.

`adminAccount.passwordPresent=true` bedeutet nur, dass ein Wert gespeichert ist;
das bestätigt keine gültigen oder bekannten Zugangsdaten. `false` bedeutet kein
Wert. Ein Controller-Standardpasswort wird hier weder angenommen noch behauptet.
`certificates.inventory.defaultPublic/defaultPrivate=true` bestätigt vorhandene
Einträge, nicht deren Gültigkeit, Schlüsselzuordnung, lesbare referenzierte
Dateien, SAN oder Vertrauen auf Browsern beziehungsweise Nginx.

Falls das Werkzeug noch nicht installiert ist, einzelne Werte lesen:

```sh
cd /opt/iobroker
iobroker object get system.adapter.admin.0 common.enabled
iobroker object get system.adapter.admin.0 native.port
iobroker object get system.adapter.admin.0 native.bind
iobroker object get system.adapter.admin.0 native.secure
iobroker object get system.adapter.admin.0 native.auth
iobroker object get system.adapter.admin.0 native.certPublic
iobroker object get system.adapter.admin.0 native.certPrivate
iobroker object get system.adapter.eos-admin.0 native.eosLockLegacyAdmin
```

Nicht das gesamte Benutzer- oder Zertifikatsobjekt ausgeben oder in einen Chat
kopieren. Optional zeigt `ss -ltn` lokale TCP-Listener; das allein bestätigt
keinen funktionierenden Login, Zertifikatsvertrauen oder LAN-Zugriff.

## 2. Alte Sperre kontrolliert anhalten

```sh
iobroker stop eos-admin.0
iobroker state getValue system.adapter.eos-admin.0.alive
```

Erst fortfahren, wenn der Controller `false` bestätigt und der Prozess beendet
ist. Bei weiteren aktiven EOS-Instanzen auch deren Sperren kontrollieren und
die betreffenden Instanzen geordnet stoppen; `iobroker stop eos-admin` stoppt
alle EOS-Admin-Instanzen. Das Diagnosewerkzeug untersucht nur die ausgewählte
Instanz, nicht alle Hosts. Keine noch laufende Alpha-1-Instanz darf den Admin
während der Wiederherstellung erneut sperren.

## 3. Admin auf 8081 wiederherstellen

Vor Aktivierung der Authentifizierung muss ein gültiges Adminpasswort bekannt
sein. Ist keines vorhanden oder keines bekannt, über die bestehende lokale
SSH-Berechtigung interaktiv setzen:

```sh
iobroker user passwd admin
```

Die Eingabe erfolgt verdeckt mit Bestätigung. Kein Passwort als Befehlsargument
oder in die Shell-Historie schreiben. Ist `system.user.admin` deaktiviert, muss
die Berechtigung zur Kontowiederherstellung zusätzlich geprüft werden; das
Diagnosewerkzeug aktiviert kein Konto.

Danach das ausdrücklich gewünschte Port-/Bind-Profil setzen und starten:

```sh
iobroker object extend system.adapter.admin.0 '{"native":{"bind":"0.0.0.0","port":8081,"auth":true}}'
iobroker start admin.0
iobroker state getValue system.adapter.admin.0.alive
```

`object extend` erhält andere Einstellungen, insbesondere `secure` und
Zertifikatsnamen. Bei zuvor aktiviertem TLS lautet der Zugang
`https://GERAETE-IP:8081`; bei zuvor deaktiviertem TLS spricht der Port weiterhin
HTTP. Dann Zugangsdaten zunächst über den SSH-Tunnel eingeben und gültiges TLS
für die normale Netznutzung konfigurieren. Authentifizierung nicht ausschalten,
TLS nicht als Fehlerbehebung deaktivieren. `alive=true` allein genügt nicht:
Listener, Browserzugang und Anmeldung gezielt prüfen.

## 4. PuTTY-Tunnel als lokaler Wiederherstellungsweg

Bei bestehender PuTTY-Verbindung im Fenstermenü **Change Settings → Connection
→ SSH → Tunnels** öffnen. Für den wiederhergestellten Admin:

- **Source port:** `18081` auf dem eigenen Rechner.
- **Destination:** `127.0.0.1:8081` auf dem ioBroker-Gerät.
- **Local** und **Auto**, dann **Add** und **Apply**.
- „Local ports accept connections from other hosts“ ausgeschaltet lassen.

Ohne Portumstellung, wenn der vorhandene Admin weiterhin lokal auf 18081 läuft,
lautet das Ziel stattdessen `127.0.0.1:18081`. Der Tunnel startet keinen Dienst.
Für einen HTTP-Admin führt `http://127.0.0.1:18081` durch den verschlüsselten
SSH-Tunnel. Für einen HTTPS-Admin bleibt HTTPS aktiv; der im Browser benutzte
Name muss zum vorhandenen Zertifikat passen. Bei einem Namensfehler TLS nicht
abschalten und die Zertifikatsprüfung nicht pauschal umgehen. Ein passender
lokaler Hostname mit Auflösung auf `127.0.0.1` kann den Tunnelzugang ermöglichen,
wenn das zugehörige Zertifikat auf dem Bediengerät vertrauenswürdig ist.

## 5. EOS auf 8188/HTTPS und anschließend auf 443

Vor dem EOS-Start vorhandene Zertifikatsnamen, Gültigkeit, passende SANs,
Schlüsselzuordnung und Vertrauen kontrollieren. Ein vorhandener Name allein
genügt nicht. **Kein blindes `iobroker cert create` oder `cert renew`:** diese
Befehle können globale Standardzertifikate ersetzen und andere Clients stören.
Bei fehlenden oder unpassenden Zertifikaten ist ein individuelles Gerätezertifikat
mit der tatsächlichen IP und den vorgesehenen Namen einzurichten; konkrete
Geräte-IP und Zertifikatsaussteller sind Betreiberwerte.

Wenn `defaultPublic` und `defaultPrivate` nach dieser Prüfung tatsächlich das
geeignete vorhandene Paar sind, lautet das explizite EOS-Profil beispielsweise:

```sh
iobroker object extend system.adapter.eos-admin.0 '{"native":{"bind":"0.0.0.0","port":8188,"secure":true,"auth":true,"certPublic":"defaultPublic","certPrivate":"defaultPrivate","eosExternalOrigin":"","eosLockLegacyAdmin":false}}'
iobroker start eos-admin.0
```

Bei eigenen Zertifikatsnamen diese beiden Namen gezielt ersetzen. Bestehende
Konfigurationen werden durch Alpha 2 nicht ungefragt auf dieses Profil migriert.
`https://GERAETE-IP:8188` muss vor dem nächsten Schritt mit gültigem TLS,
Anmeldung und dem vorhandenen Aktivierungsstatus geprüft werden. Die
Eigentümersperre für Gerätebefehle bleibt wirksam; ein Adminzugang erteilt keine
Freigabe für parallele Regler. Keine Konto- oder Lizenzdatenbank löschen.

Für `https://GERAETE-IP` und `https://NexoWattEOS` den in [README.md](README.md)
beschriebenen HTTPS-Eingang getrennt einrichten. Dessen Upstream ist
`https://127.0.0.1:8188` mit aktivierter Zertifikatsprüfung und festem, zum
Zertifikat passendem SNI-Namen. Kein `proxy_ssl_verify off`. Port 443 wird nicht
durch npm, den Renderer oder einen Adapterstart eingerichtet.

Der Name `NexoWattEOS` benötigt einen passenden Eintrag im lokalen DNS/Router
oder in der Hosts-Datei jedes Bediengeräts und einen passenden Zertifikats-SAN.
Ein funktionierendes `NexoWattEOS.local` setzt gesondert eingerichtetes mDNS
voraus und wird nicht automatisch bereitgestellt. Eine feste einzelne
`eosExternalOrigin` kann alternative Zugangsadressen absichtlich einschränken;
das obige direkte HTTPS-Profil lässt die geprüfte aktuelle HTTPS-Origin zu.

## Nachweisgrenze

Das Werkzeug ist durch lokale Regressionstests mit simulierten CLI-Ausgaben
geprüft. Hierdurch sind keine Änderungen oder erfolgreichen Recovery-Logins auf
einem Kundengerät belegt. Tatsächlicher Passwortwechsel, Browser-/TLS-Zugang,
Portbelegung, Namensauflösung, Nginx-Prüfung und Wiederanlauf der Anlage sind
bei der konkreten Wiederherstellung zu bestätigen.
