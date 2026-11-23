# NEXO-906-MDNS-01 / INGRESS-01: lokale Erkennung und HTTPS-Zugang

Stand: 23.11.2026. Ausgangspunkt: wiederhergestelltes Repository 9.0.5.
Prüfumgebung: Node.js 24.22.3; systemd 257.13-1~deb13u1.

## NEXO-906-MDNS-01: eigene lokale Namensankündigung

Auf die ergänzte Nutzerentscheidung hin stellt EOS die lokale Geräteerkennung
selbst bereit. `src/lib/eosDiscovery.ts` kündigt standardmäßig
`nexowatt.local` und die eigene HTTPS-Dienstinstanz an; ausdrücklich deaktivierte
Ankündigung bleibt deaktiviert. Die Einbindung in Listenerstart und Unload sowie
die Konfigurationsfelder erfolgen im gemeinsamen 9.0.6-Stand.

Direkte Laufzeitabhängigkeit: `multicast-dns` 7.2.5 (MIT), deren tatsächliche
NPM-Archivquellen und API geprüft wurden. Bonjour-Service allein wurde für
diesen Zweck verworfen: dessen Probe prüft den Dienstnamen, nicht die gesamte
Host-A/AAAA-Identität, und meldet Kollisionen nicht zuverlässig als Fehlerereignis.
Die verwendete Bibliothek übernimmt DNS-Paketkodierung und UDP-Multicast;
EOS begrenzt die eigene Namens-/Dienstankündigung.

Sicherheits- und Ressourcenverhalten:

- drei gezielte Probes ausschließlich für den eigenen Host und Dienst;
- konservativer Abbruch bei fremden A/AAAA-/SRV-Claims, auch nach Start;
- keine automatische Umbenennung, die einen TLS-SAN ungültig machen würde;
- maximal acht angekündigte eigene Adressen, je eingehender Recordgruppe
  maximal 64 ausgewertete Records, höchstens eine Abfrageantwort pro Sekunde;
- TXT nur `path=/`, keine UUID, Lizenz, Zugangsdaten oder Anlagenmetadaten;
- höchstens vier Sekunden Startphase; Timer werden beim Stoppen freigegeben;
  Goodbye-Übertragung endet spätestens nach 100 ms mit Socketfreigabe;
- wiederholte Starts/Stops und verspätete Callbacks erzeugen keine neue
  Ankündigung nach Shutdown; UDP-Fehler führen nicht zum Adapterabbruch;
- eigene Adressänderungen werden alle 60 Sekunden geprüft und neu geprobt.

Der Transport nutzt IPv4-Multicast. Ein auf `::` gebundener Listener kann über
dieses IPv4-mDNS passende AAAA-Records ankündigen; reine IPv6-LANs ohne
IPv4-Multicast sind nicht abgedeckt. Konflikte, Startfehler oder völliger Verlust
lokaler Adressen erfordern nach Behebung einen Adapterneustart. Discovery
ersetzt keine Serverauthentifizierung: mDNS selbst ist nicht authentifiziert,
darum bleiben vertrauenswürdige TLS-Zertifikate und passende SANs erforderlich.

## NEXO-906-INGRESS-01: expliziter Kurzname im optionalen Nginx-Profil

Der bestehende Ingress-Renderer führte ausschließlich `nexowatteos` und optional
`nexowatteos.local` in der Host-Allowlist. Eine Konfiguration für den gewünschten
Browsernamen `https://nexowatt` war über seine Parameter nicht erzeugbar.

`deploy/render-ingress.cjs` akzeptiert nun ausdrücklich `--hostname nexowatt`.
Der Wert wird als kleingeschriebener DNS-Name ohne Port, Wildcard, URL-Schema,
Metazeichen oder leere Labels geprüft. Der Renderer erzeugt ausschließlich die
genauen Einträge für die Geräte-IP und den gewählten Host, jeweils optional mit
Port `:443`. Die optionale `.local`-Variante folgt dem gewählten Namen.

Bestehende Aufrufe ohne diese Option behalten `nexowatteos`. Der interne
TLS-Prüfname bleibt davon unabhängig: feste Verbindung nach
`https://127.0.0.1:8188`, eingeschaltete Zertifikatsprüfung, explizite
Vertrauensdatei und SNI. Der Browser-Host bleibt unverändert. Das vorhandene
ausdrückliche HTTP-Legacyprofil akzeptiert keinen benutzerdefinierten Hostnamen.

Dateipfad-, Eigentümer- und Rechteprüfungen, exklusive Ausgabe mit Modus 0600,
Authentifizierung, Origin-/CSRF-Verhalten und Ports des Adapters wurden durch
diese Rendereränderung nicht gelockert. Der Renderer benötigt keine neue
Abhängigkeit und installiert oder startet keinen Proxy-/Root-Dienst.

`deploy/NEXOWATT_LOCAL_HTTPS.md` beschreibt den konkreten, noch auszuführenden
Einrichtungsweg für `192.168.10.153`: automatische mDNS-Ankündigung, individuelle
TLS-Zertifikate, systemseitiger 443-Zugang, Abnahme und Rückfall. Es erklärt insbesondere,
dass eine Sitzung an der IP nicht automatisch am neuen Hostnamen gilt. Die
vorhandene README verlinkt den Einrichtungsweg und dokumentiert die neue Option.

## NEXO-906-SYSTEMD-01: optionaler unprivilegierter TLS-Passthrough

Die neuen Units in `deploy/systemd/` trennen den von systemd verwalteten
Port-443-Socket vom unprivilegierten `systemd-socket-proxyd`-Prozess:
DynamicUser, leere Capability-Mengen, NoNewPrivileges, schreibgeschütztes System,
verborgenes Home, begrenzte Verbindungen/Dateideskriptoren/Tasks/Speicher.
Ziel ist fest `127.0.0.1:8188`. TLS endet weiterhin ausschließlich in EOS;
Benutzer-/Proxyheader werden nicht verändert. EOS sieht dabei den lokalen
Proxy als Netzwerkpeer; vorhandene IP-ACLs und IP-bezogene Limits müssen im
Zielprofil berücksichtigt werden. Die Vorlagen werden nicht automatisch
installiert, gestartet oder als Bestandteil von npm-Skripten ausgeführt.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| `node --test --test-reporter=tap test/eos-ingress-renderer.test.cjs` | 9 bestanden, 0 fehlgeschlagen, 1 übersprungen |
| `node --test test/eos-discovery.test.cjs` | 12 bestanden; kontrollierter Transport und Zeitablauf, tatsächlicher DNS-Paketcodec für Roundtrip |
| Strikte Typprüfung von `src/lib/eosDiscovery.ts` | Exit 0 |
| Projekt-ESLint für Discovery, begrenzter JS-Lint für dessen Tests | Exit 0 |
| Strikte JavaScript-Typprüfung des Renderers mit TypeScript, `--types node` | Exit 0 |
| ESLint für Renderer und dessen Testdatei | Exit 0 |
| `systemd-analyze verify deploy/systemd/nexowatt-https.socket deploy/systemd/nexowatt-https.service` | Exit 0; Units nicht installiert oder gestartet |
| Nginx-Syntaxprüfung | Nicht ausgeführt: Nginx ist in dieser Umgebung nicht installiert |
| DNS, Port 443, Zertifikatsvertrauen und Browser am Kundengerät | Nicht ausgeführt: kein Zugriff auf Gerät/Router/Bedienrechner |

Die fokussierten Tests prüfen bisherige Standardwerte, den gewünschten Host,
die getrennte Upstream-Identität, optionale `.local`-Namen, ungültige Authorities,
CLI-Verhalten, fehlende TLS-Vertrauensangaben, Pfad-/Symlinkangriffe und
Nichtüberschreiben vorhandener Ausgaben. Zertifikat und Testschlüssel werden nur
flüchtig in einem privaten temporären Verzeichnis erzeugt und wieder gelöscht.
Es werden keine privaten Produktionsschlüssel mitgeliefert.

Typprüfbefehl:

```sh
node node_modules/typescript/bin/tsc --ignoreConfig --allowJs --checkJs --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitReturns --esModuleInterop --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node deploy/render-ingress.cjs
```

Lintbefehl:

```sh
node node_modules/eslint/bin/eslint.js -c eslint.unified.config.mjs deploy/render-ingress.cjs test/eos-ingress-renderer.test.cjs
```

Nachweise liegen neben diesem Bericht: `hostname-renderer-tests.tap`,
`hostname-renderer-typecheck.log`, `hostname-renderer-lint.log`. Die letzten
beiden Dateien sind bei Erfolg leer.

Discovery: `hostname-discovery-tests.tap`, `hostname-discovery-typecheck.log`,
`hostname-discovery-lint.log`, `hostname-discovery-test-lint.log`.
Unitprüfung: `hostname-systemd-verify.log`. Zusätzliche lesende Teamprüfung der
Discovery-/Unitänderung ergab keinen konkreten kritischen Befund; sie ist keine
unabhängige Zertifizierung oder Geräteabnahme.

Dateihashes der konkreten Discovery-/Ingress-/Unitquellen und ihrer Tests:
`hostname-sources.sha256`. Der gemeinsame Lieferstand führt zusätzlich seine
vollständigen Paket-/Repositoryhashes.

## Verbleibende Inbetriebnahme

Das Adapterupdate stellt mDNS für `.local` bereit. Es richtet kein DNS für den
bloßen Kurznamen auf anderen Geräten, kein dortiges Zertifikatsvertrauen und
keinen systemweiten Port-443-Listener ein. Der Betreiber
muss die Anleitung für seine tatsächliche Netzwerk-/Proxyumgebung ausführen und
am Ziel abnehmen. Kein funktionierender Kundenzugang, keine RAM-Verbesserung und
keine CRA-Konformität werden aus diesen Renderer-Prüfungen abgeleitet.

Die öffentliche TLS-Identität `nexowatt` und die lokale Namensauflösung müssen
beide passen. Öffentlich vertraute CAs stellen keine Zertifikate für interne
Kurznamen aus. `nexowatt.local` über mDNS ersetzt nicht die Einrichtung des
angefragten Kurznamens. Quellen und konkrete Abnahmeschritte stehen in der
Einrichtungsanleitung.
