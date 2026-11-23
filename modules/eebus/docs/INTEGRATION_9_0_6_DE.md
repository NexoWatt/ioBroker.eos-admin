# EEBus im NexoWatt EOS 9.0.6

## Lieferumfang und Funktionsgrenze

Der echte TypeScript-Protokollkern aus `NexoWatt/ioBroker.eebus` 0.3.0, Commit `1c0eb410d516b90d60f6e475e6822bf5836bfd66`, läuft als Modul im EOS-Prozess. Enthalten sind mDNS-Discovery und -Ankündigung, SHIP über TLS/WebSocket in beiden Verbindungsrollen, CMI/Hello/Protokoll/PIN, explizite Kopplung, SPINE-NodeManagement, generische Messwertauswertung und der vorhandene IF_CLS_CTRL-Parser mit direkter §14a-Bridge. Es wird keine zweite Adapterinstanz gestartet und keine zweite Lizenz verlangt. Die zentrale EOS-Lizenz und die Eigentümerprüfung des Hosts müssen vor Start und Befehlsausgabe gültig sein.

Der übernommene Kern ist ausdrücklich ein Feldteststand. Herstellerabhängige Feature-Adressen, Limit-IDs, Bindings, Wallbox-/Wärmepumpen-/Speicher-Kommandos und reale SHIP/SPINE-Interoperabilität sind nicht pauschal bestätigt. Die Standardvorgabe `commandDryRun=true` unterbindet ausgehende Steuerbefehle und aktive eingehende CLS-Übernahme. Read-only NodeManagement folgt erst nach vertrauenswürdigem Datenaustausch. Aktive CLS-Vorgaben benötigen zusätzlich `autoApplyClsLimits=true` und die betriebsbereite vorhandene EOS-§14a-Regelung. Diagnose „controllerApplied“ ist kein Nachweis einer tatsächlichen physischen Gerätewirkung.

## Einrichtung und Bedienung

In der Systemverwaltung EEBus öffnen. Das Modul zunächst mit Testmodus aktivieren, SHIP-Port (Standard 4712), Gerätenamen und Discovery prüfen. Die Rolle ist fest NexoWatt EOS als EnergyManagementSystem; „NexoWatt EOS“ ist der mDNS-Gerätename, kein Web-DNS-Name. Der HTTPS-Webzugang auf 8188 beziehungsweise über `https://nexowatt` wird zentral eingerichtet und gehört nicht zum SHIP-Port.

Die Geräteansicht zeigt SKI, beobachteten TLS-Zertifikat-Fingerabdruck, Kopplung und Verbindungszustand. Gegenstelle identifizieren, SKI/Fingerabdruck vergleichen und „Gerät freigeben“ ausdrücklich bestätigen. Nur ein aktuell beobachtetes TLS-Zertifikat kann freigegeben werden. Die Bestätigung auf der Gegenstelle bleibt erforderlich. „Freigabe widerrufen“ sperrt die laufende Verbindung. Konfigurationsänderungen werden serverseitig geprüft; private Hersteller-Lizenzschlüssel gehören niemals in EEBus.

`ianaPen=999999` ist ein sichtbarer Platzhalter. Vor einer Serienfreigabe muss der Hersteller eine zutreffende Kennung festlegen. Falls eine Kopplungs-PIN konfiguriert wird, muss auch die Gegenstelle den passenden PIN-Ablauf unterstützen. Ein vom Gegenüber behauptetes „PIN ok“ genügt nicht als Kenntnisnachweis für die lokale PIN.

## Migration und Rückfall

Die alte `eebus.N`-Instanz erst deaktivieren und vollständig stoppen; der Host kontrolliert die Doppelzuständigkeit. Die Importfunktion übernimmt unterstützte Konfiguration deaktiviert, erzwingt zunächst Testmodus und deaktiviert aktive CLS-Übernahme. Sie übernimmt weder private Schlüssel, Zertifikate, PIN noch Kopplungsfreigaben. Die alte Instanz samt Zuständen bleibt bestehen. Bei der Integration werden neue Zustände unter `eos-admin.N.eebus.*` angelegt; externe Zuordnungen und Automationen ausdrücklich auf die neuen IDs umstellen. Ein Export-/Importwert ist keine automatische Gerätefreigabe.

Das neue Modul erzeugt eine eigene lokale SHIP-Identität; Gegenstellen müssen bewusst neu gekoppelt werden. Automatischer Import privater Legacy-Schlüssel ist nicht Bestandteil dieses Releases. Für Rückfall das integrierte Modul deaktivieren und auf vollständig geschlossene Verbindungen warten, bevor die vorher gesicherte Legacy-Instanz wieder aktiviert wird. Niemals beide SHIP-Listener bzw. Regler parallel betreiben. Bereits wirksame Netz-/Gerätegrenzen nicht im Zuge des Rückfalls ungeprüft zurücknehmen.

## Identität, Vertrauen und Ressourcen

`ship-identity.json` wird im vom Host bereitgestellten privaten Datenverzeichnis gespeichert (Verzeichnis 0700, Datei 0600). Enthalten sind ausschließlich die lokale Geräteidentität und ihr privater Schlüssel, niemals ein Hersteller-Lizenzsignierschlüssel. Geschützte, verschlüsselte Sicherung dieses Datenverzeichnisses zusammen mit den zugehörigen ioBroker-Zuständen vorsehen. Bei Wiederherstellung aus einer autorisierten Sicherung müssen Rechte, zusammenpassender Schlüssel und Zertifikat erhalten bleiben. Beschädigte, abgelaufene, unerwartet lesbare oder nicht passende Identitäten führen zum Startfehler und werden nicht still ersetzt. Ein geplanter Identitätswechsel erfordert erneute Kopplung auf allen betroffenen Gegenstellen.

Der SHIP-spezifische TLS-Listener akzeptiert zunächst selbstsignierte Geräte-Zertifikate, prüft aber deren Format, P-256-Schlüssel, Gültigkeit, tatsächlichen SKI und anschließend den ausdrücklich freigegebenen SHA-256-Fingerabdruck. Ausgehende TLS-Identität muss mit dem angekündigten SKI übereinstimmen. Das ist gerätespezifisches SHIP-Pinning; es ersetzt nicht die Web-PKI-Prüfung anderer EOS-HTTPS-Verbindungen und setzt keine globale TLS-Umgehung.

Grenzen: höchstens 32 SHIP-Sitzungen, 64 TCP-Verbindungen am Listener, 256 KiB pro WebSocket-Nachricht, 8 wartende Nachrichten pro Sitzung, 8 MiB insgesamt wartende Frames, 1 MiB ausgehender Socket-Puffer, 128 erkannte Geräte und 16 parallele Discovery-Persistierungen. Verbindungsaufbau maximal 5 Sekunden, SHIP-Kopplungsphase maximal 120 Sekunden. Bereits beim Verbinden wird eine begrenzte Nachrichtenwarteschlange installiert, damit langsame Objektanlage die erste CMI-Nachricht nicht verliert. Discovery akzeptiert private IPv4-/Linklocal- und ULA-/Linklocal-IPv6-Adressen; öffentliche geroutete Geräteadressen sind in diesem lokalen Profil nicht automatisch freigegeben.

Stop schließt Sockets, mDNS und Timer auch bei bereits widerrufenen Host-Schreibfähigkeiten. Timer- und WebSocket-Fehler werden lokal abgefangen. Diagnose-/Metadatenzyklen überlappen nicht. Beim Lizenzentzug werden keine zusätzlichen automatischen Release-Kommandos erzeugt; bestehende EMS-/Geräte-Failsafes und physische Schutzfunktionen bleiben eine eigenständige Anforderung.

## Prüfungen und verbleibende Freigaben

Prüfumgebung: Linux, Node.js 24.22.3, OpenSSL aus der Buildumgebung, Abhängigkeiten des Root-Lockfiles. Befehle vom Repositorywurzelverzeichnis:

```sh
node node_modules/typescript/bin/tsc -p modules/eebus/tsconfig.json
node node_modules/typescript/bin/tsc --allowJs --checkJs --noEmit --strict --target ES2022 --module Node16 --moduleResolution Node16 --skipLibCheck --types node modules/eebus/admin/index.js --ignoreConfig
node --test modules/eebus/test/security.test.js modules/eebus/test/hosted.test.js modules/eebus/test/mdns-errors.test.js
node modules/eebus/test/config.js
node modules/eebus/test/cls-control-parser.js
node modules/eebus/test/nexowatt-bridge.js
node modules/eebus/test/implementation-result-order.js
```

Die gezielten Sicherheitsprüfungen verwenden echte lokale TLS/WebSocket-Verbindungen und temporär erzeugte Zertifikate; die Hosted-/CLS-/Bridge-Prüfungen verwenden simulierte ioBroker-Schnittstellen. Keine produktiven Schlüssel oder Kundendaten sind Testfixtures. Die positive Gegenstellenprüfung ist zwischen zwei lokalen Implementierungen dieses Kerns erfolgt, nicht mit einer realen Wallbox oder CLS-Box.

Bekannte upstream-Vertrauens- und Lebenszyklusfehler sind in diesem integrierten Stand korrigiert; der unveränderte separate EEBus-Adapter wird dadurch nicht nachträglich als korrigiert ausgegeben. Zu den Regressionen gehören falsches/fehlendes Zertifikat, mDNS-SKI-Spoofing, ungepaarte Daten, verfrühte PIN-/Protokollzustände, PIN-Behauptung ohne Nachweis, explizite Freigabe, Wiederverbindung, verspäteter Lizenzwiderruf, verzögerte Objektanlage, Stop und geschützte Identitätswiederherstellung. Der vollständige Teststand wird in den Release-Prüfberichten festgehalten.

Offen: reale Geräte-/Firmwarekombinationen und deren Protokollprofile, LAN-mDNS im Zielnetz, PIN-Interoperabilität, Dauerlast/RAM auf dem EOS-Zielgerät, tatsächliche §14a-Gerätewirkung und notwendige Hersteller-/Serienfreigaben. Keine vollständige EEBus-, IEC- oder CRA-Konformität bzw. Zertifizierung wird aus diesen Tests abgeleitet. Für die Hausanlage zuerst Backup und Testmodus, dann Kopplung/Messwerte/Neustart prüfen, bevor einzelne ausdrücklich freigegebene Geräte-Steuerfunktionen erprobt werden.
