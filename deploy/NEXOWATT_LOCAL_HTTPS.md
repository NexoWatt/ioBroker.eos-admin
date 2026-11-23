# NexoWatt lokal finden und per HTTPS öffnen

Stand: 23.11.2026 · NexoWatt EOS 9.0.6 · Beispiel-IP `192.168.10.153`.

EOS kündigt sich ab diesem Stand selbst im lokalen Netz als **`nexowatt.local`**
an. Dafür ist kein Routereintrag und kein Durchsuchen eines IP-Bereichs nötig.
Die Funktion ist standardmäßig aktiv; ein ausdrücklich gesetztes
`eosMdnsEnabled=false` bleibt respektiert. Die Ankündigung startet erst nach dem
sicheren EOS-Listener und endet beim Herunterfahren. Anmeldung, Rechte und
zentrale Lizenzprüfung bleiben erforderlich.

| Gewünschter Zugang | Voraussetzung |
| --- | --- |
| `https://nexowatt.local:8188/` | EOS läuft mit TLS; Client und Netz unterstützen lokale mDNS-Auflösung; passendes vertrautes Zertifikat. |
| `https://nexowatt.local/` | Zusätzlich einmalig der systemseitige 443-Zugang, unten beschrieben. |
| `https://nexowatt/` | Zusätzlich muss das jeweilige Netz/Betriebssystem den bloßen Kurznamen auflösen. mDNS garantiert nur `.local`. |
| `https://192.168.10.153:8188/` | Direkter vorhandener IP-Zugang, unabhängig von der Namensauflösung. |

Das Weglassen des Ports bedeutet bei HTTPS immer Port 443. Ein DNS-SD-Dienst
kann den tatsächlichen EOS-Port bekannt machen; normale Browser übernehmen ihn
beim Eintippen einer Adresse ohne Port nicht automatisch. EOS kündigt deshalb
seinen tatsächlich gestarteten Port an und behauptet keinen bereits
vorhandenen 443-Listener.

## 1. Automatische lokale Namensankündigung

Die Adapterkonfiguration enthält die Option zur lokalen mDNS-Ankündigung.
`eosMdnsHostname` ist der kurze Name ohne `.local`; Standard ist `nexowatt`.
Nur eigene lokale Adressen werden angekündigt, passend zur Bind-Einstellung.
Bei `0.0.0.0` sind das IPv4-Adressen; bei `::` IPv6-Adressen. Die aktuelle
Transportimplementierung sendet mDNS über IPv4-Multicast. Ein ausschließliches
IPv6-Netz ohne IPv4-mDNS ist damit noch nicht abgedeckt.

Es werden nur der eigene Hostname und die eigene HTTPS-Dienstinstanz abgefragt,
um Namenskonflikte vor der Ankündigung zu erkennen. Kein LAN-Scan, keine Suche
nach fremden Geräten und keine Änderung am Betriebssystem-Hostnamen. Das
DNS-SD-TXT enthält nur `path=/`, keine Lizenz, UUID, Benutzer- oder Anlagendaten.
Clients im gleichen freigegebenen Netzsegment können den Gerätenamen, die
angekündigten lokalen Adressen und den Dienstport sehen.

Wichtige Meldungen im EOS-Protokoll:

- `EOS_MDNS_READY`: lokale UDP-Ankündigung wurde gesendet. Das ist noch kein
  Nachweis, dass ein bestimmter Browser den Namen auflösen oder dem Zertifikat
  vertrauen kann.
- `EOS_MDNS_NAME_CONFLICT`: ein anderer Eigentümer des Namens wurde erkannt.
  Nur die Ankündigung stoppt; EOS bleibt auf seiner IP und seinem Port aktiv.
- `EOS_MDNS_START_TIMEOUT`, `EOS_MDNS_SOCKET_FAILED` oder
  `EOS_MDNS_NO_LOCAL_ADDRESS`: lokale Ankündigung nicht verfügbar. IP-Zugang
  verwenden und Interface-/Multicastkonfiguration prüfen.

Mehrere EOS-Geräte erhalten bewusst unterschiedliche kurze Namen, etwa
`nexowatt-haus` und `nexowatt-werkstatt`. Den gewählten Namen auch im
TLS-Zertifikat berücksichtigen. EOS hängt keinen stillen Namenszusatz an, weil
sonst die Zertifikatsidentität nicht mehr passen würde. Nach einem Konflikt
oder fehlgeschlagenen Start die Ursache beheben und den Adapter neu starten.
Normale IP-Adressänderungen bei laufender Ankündigung werden erneut geprüft.

mDNS ist linklokal. Gastnetze, VLAN-Grenzen, Multicastfilter, Client-Isolation,
VPN und Client-Unterstützung können die Auflösung begrenzen. Keine
Router-Portfreigabe und keine pauschale Firewallfreigabe ins Internet erzeugen.

## 2. Port 443 einmalig im Geräteimage einrichten

Der Adapter und seine Node-Laufzeit behalten normale Dienstrechte. Für den
Zugang ohne Portzusatz liegen zwei kleine systemd-Units bei:

- `deploy/systemd/nexowatt-https.socket` besitzt den systemseitigen Listener 443.
- `deploy/systemd/nexowatt-https.service` leitet verschlüsselte TCP-Daten mit
  einer getrennten unprivilegierten UID fest nach `127.0.0.1:8188` weiter.

**[Konkrete Prüfung, Einrichtung und Rückfall](systemd/README.md)** sind separat
beschrieben. Diese einmalige bewusste Geräte-/Imageeinrichtung ersetzt keine
Adapterrechte durch Rootrechte. Die Units werden nicht beim npm-Update
installiert oder gestartet. Ein bereits belegter Port 443 darf nicht verdrängt
werden. ioBroker Admin auf 8081 und der direkte EOS-Zugang auf 8188 bleiben
unverändert.

Der TCP-Passthrough verändert keine HTTP-Header, führt keine zweite Anmeldung
und keine TLS-Terminierung ein. Der Browser prüft direkt das EOS-Zertifikat.
EOS sieht für diesen Weg allerdings den lokalen Proxy als Netzwerkpeer;
IP-basierte Limits und Verbindungsprotokolle fassen diese Clients zusammen.
Benutzerrechte werden weiterhin anhand der Sitzung geprüft. Bestehende
IP-ACLs vor Verwendung dieses Profils prüfen.

## 3. TLS-Zertifikat und Vertrauen

Das vom EOS-Listener ausgewählte Zertifikat muss zum verwendeten Namen passen:

- `DNS:nexowatt.local` für den automatischen lokalen Standardnamen;
- optional `DNS:nexowatt`, wenn der Kurzname tatsächlich auflösbar ist;
- `IP:192.168.10.153` für den direkten IP-Zugang;
- bei einem geänderten Gerätenamen dessen tatsächliche `.local`-SAN.

Die vorhandenen Zertifikatsreferenzen im Adapter bleiben erhalten. Zertifikate
werden weder unbemerkt ausgetauscht noch mit einer gemeinsamen Geräte-CA
signiert. Individuelle Betreiberzertifikate über die bestehende ioBroker-
Zertifikatsverwaltung bereitstellen und die Adapterreferenzen passend wählen.
Die voreingestellten Referenznamen sind `defaultPublic` und `defaultPrivate`;
ihr Name sagt nichts über die enthaltenen SANs oder das Browser-Vertrauen aus.

Öffentlich vertraute CAs stellen keine Zertifikate für interne Kurznamen aus.
Eine individuelle lokale CA beziehungsweise ein ausdrücklich vertrautes
individuelles Zertifikat muss über den administrativen Vertrauensweg auf den
Bediengeräten eingerichtet werden. Keine Zertifikatsprüfung abschalten. Keine
privaten Schlüssel in Chat, Log oder Repository kopieren. Der Lizenz-Public-Key
ist kein HTTPS-Zertifikat und ersetzt dieses Vertrauen nicht.

An einer exportierten **öffentlichen** Zertifikatsdatei lassen sich Name und
Ablauf beispielsweise lesend prüfen:

```sh
openssl x509 -in eos-public.pem -noout -checkhost nexowatt.local
openssl x509 -in eos-public.pem -noout -checkip 192.168.10.153
openssl x509 -in eos-public.pem -noout -checkend 86400
```

Diese Prüfungen ersetzen weder die Vertrauenskette noch den Browsercheck.

## 4. Anmeldung, Sitzung und Abnahme

1. `https://nexowatt.local:8188/` vom Bediengerät öffnen. Ohne gültige Sitzung
   muss die Anmeldung erscheinen; Zertifikat und Name müssen stimmen.
2. Nach der einmaligen 443-Einrichtung auch `https://nexowatt.local/` prüfen.
3. Anmelden, dann denselben Namen erneut öffnen: Dashboard, sofern
   Erstpasswortwechsel und zentrale Lizenzaktivierung abgeschlossen sind.
4. Installer, Rückweg zur EOS-Administration, Systemverwaltung, Livewerte,
   History und Abmeldung prüfen.
5. IP:8188 und den bestehenden ioBroker Admin:8081 weiter prüfen.
6. Die Zugänge nach kontrolliertem Adapter-/Geräteneustart wiederholen.

Eine Sitzung an der IP ist keine Sitzung am Hostnamen. Browser senden die
hostgebundenen Sitzungscookies der IP nicht an `nexowatt.local`. Beim ersten
Wechsel ist deshalb eine Anmeldung unter dem neuen Namen erforderlich. Danach
diesen Namen als festen Einstieg verwenden. Sitzungstokens werden nicht in
URLs kopiert und nicht an andere Hosts übertragen.

Für `https://nexowatt` ohne `.local` bleibt eine vom Netz/Betriebssystem
bereitgestellte Kurznamensauflösung erforderlich. EOS richtet dafür bewusst
keinen falschen öffentlichen DNS-Eintrag, keinen fremden Routereintrag und
keinen versteckten Namensdienst mit Systemrechten ein. Der ohne Routeränderung
vorgesehene automatische Weg ist **`https://nexowatt.local`** nach Vorbereitung
von Port 443 und Zertifikatsvertrauen.

## Optional: bestehender Nginx-Zugang

Bei bereits vorhandenem Nginx kann dessen geprüfter TLS-Proxy weiter verwendet
werden. Der Renderer unterstützt ab 9.0.6 `--hostname nexowatt`; ohne diese
Option bleibt sein bisheriger Name `nexowatteos` erhalten. Für den automatisch
angekündigten `.local`-Namen zusätzlich `--include-local-name true` setzen.

```sh
node deploy/render-ingress.cjs --ip 192.168.10.153 \
  --hostname nexowatt --include-local-name true \
  --certificate /etc/nexowatt/tls/device-fullchain.pem \
  --private-key /etc/nexowatt/tls/device-key.pem \
  --upstream-name nexowatteos \
  --upstream-ca /etc/nexowatt/tls/eos-upstream-trust.pem \
  --output /tmp/nexowatt-https-candidate.conf
```

Die Beispiel-Dateien müssen bereits individuell bereitgestellt sein;
`--upstream-name` muss zum tatsächlichen EOS-Upstreamzertifikat passen.
Die Ausgabe ist ein neuer privater Entwurf, wird nicht installiert und ersetzt
keine vorhandene Datei. Erforderliche Datei-/Verzeichnisrechte nicht aufweichen.
Vor Übernahme die gesamte Zielkonfiguration mit `nginx -t` prüfen. Nginx und die
beigefügten systemd-Passthrough-Units sind alternative Besitzer von Port 443;
niemals beide gleichzeitig auf denselben Adressen starten. Die ausführlichen
TLS-/Host-Prüfungen stehen in [README.md](README.md).

## Prüfumfang und Quellen

Softwaretests prüfen den Lebenszyklus und Konflikt-/Fehlerfälle der Ankündigung
mit kontrolliertem Transport. Ein realer mDNS-Client, kundenseitiges
Zertifikatsvertrauen und ein laufender 443-Dienst sind noch am Gerät abzunehmen.
Die Anleitung ist keine Behauptung, diese Einrichtung sei dort bereits erfolgt.

Am 23.11.2026 geprüfte technische Quellen:

- [RFC 9110, HTTPS](https://www.rfc-editor.org/rfc/rfc9110.html#section-4.2.2): Standardport 443 und passende Serveridentität.
- [RFC 6762, Multicast DNS](https://www.rfc-editor.org/info/rfc6762/): linklokales `.local`, Probing und Namenskonflikte.
- [multicast-dns API](https://github.com/mafintosh/multicast-dns): paketbasierte lokale Abfrage, Antwort und Socketfreigabe; eingesetzte Version 7.2.5.
- [systemd-socket-proxyd](https://www.freedesktop.org/software/systemd/man/latest/systemd-socket-proxyd.html): Socket-Aktivierung und TCP-Passthrough.
- [CA/Browser Forum Baseline Requirements](https://cabforum.org/working-groups/server/baseline-requirements/requirements/): keine internen Namen in öffentlich vertrauten Zertifikaten.
