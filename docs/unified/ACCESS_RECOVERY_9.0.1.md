# Zugangserhalt und Wiederherstellung – 9.0.1

**Änderung:** EOS-ACCESS-002 · **betroffener Ausgangsstand:** 9.0.0-alpha.1  
**Zielstand:** 9.0.1 (`next`, Teststand) · **Datum:** 22.11.2026  
**Verantwortung:** NexoWatt / Dominique Manteufel

Dieser Vermerk beschreibt den belegten Zugangsfehler, die Korrekturanforderung und
die noch zu erbringenden Nachweise. Er ersetzt keine neuen Testergebnisse. Der
[Alpha-1-Prüfbericht](PRUEFBERICHT.md) bleibt als historische Dokumentation erhalten;
seine bestandenen Teilprüfungen bestätigen nicht den hier nachträglich untersuchten
Erhalt eines vorhandenen Administrationszugangs.

## Festgestellter Fehler

Der Alpha-1-Quellstand enthält in `src/main.ts` die Methode
`ensureLegacyAdminLocked()`. Bei aktiviertem `eosLockLegacyAdmin` setzt sie
`system.adapter.admin.0.common.enabled` auf `false` und ändert dessen
`native.port` und `native.bind` auf die konfigurierten Sperrwerte. Die ausgelieferten
Vorgaben waren `eosLockLegacyAdmin: true`, Port `18081` und Bindung `127.0.0.1`.
Der Pfad wird über `enforceEosSecurity()` beim Start und wiederkehrend aufgerufen.

Diese Änderung ist nicht von einem bereits erfolgreich geprüften EOS-Login oder
einem funktionierenden HTTPS-Eingang abhängig. Somit kann ein vorhandener
Administrationszugang wegfallen, während der neue externe Zugang noch nicht
fertig eingerichtet ist. Bei erneutem Start des alten Admins kann der aktive
Alpha-1-Guard dessen Konfiguration nochmals verändern. Das ist ein
Verfügbarkeits-/Wiederherstellungsfehler mit hoher Priorität; daraus folgt keine
nachgewiesene Kompromittierung eines Kundengeräts.

Beim untersuchten Alpha-1-Profil richtete der interne HTTP-Dienst auf Loopback:8188
keinen öffentlichen HTTPS-Port ein. Version 9.0.1 ändert dieses Profil ausdrücklich:
Der neue Standardzugang ist direktes **HTTPS** auf 8188 mit Authentisierung. Das ist
keine ungeschützte LAN-Freigabe des früheren HTTP-Dienstes.

## Korrekturumfang für 9.0.1

| Bereich | Vorgesehenes Verhalten und Abnahmekriterium |
| --- | --- |
| Alter Admin | Der bisherige Legacy-Admin-Sperrpfad entfällt. EOS deaktiviert oder verschiebt `admin.0` nicht mehr automatisch wegen dieser Migration, auch bei gespeichertem `eosLockLegacyAdmin: true`. |
| Neue Voreinstellung | `eosLockLegacyAdmin: false`; gespeicherte Legacy-Lock-Flags bleiben ohne Wirkung auf den entfernten Sperrpfad. Kein Flag darf eine verborgene Abschaltung oder Port-/Bind-Migration auslösen. |
| Bereits beschädigter Zugang | Kein automatisches Zurücksetzen auf angenommene frühere Werte. Ursprünglicher Transport, Authentisierung und Port können unbekannt sein; Wiederherstellung erfolgt bewusst anhand des vorhandenen Zustands. |
| EOS-Webdienst | Neue Instanzen: `bind: 0.0.0.0`, `port: 8188`, `secure: true`, `auth: true`, `certPublic: defaultPublic`, `certPrivate: defaultPrivate`, `eosExternalOrigin` leer. Aufruf `https://<Geräte-IP>:8188/`. Kein HTTP-Login-Fallback. |
| Optionaler Port 443 | Gesonderte Nginx-/Geräteimagekonfiguration mit konkretem Frontend-Zertifikat und CA-/namensgeprüftem HTTPS-Upstream auf 8188. `eosExternalOrigin` bleibt für parallele IP-/Namenszugänge leer. Kein HTTP-Fallback oder TLS-Prüfungs-Bypass. |
| Lokaler Gerätename | `NexoWattEOS` muss im lokalen Netz auf die Geräte-IP aufgelöst werden und zum DNS-SAN passen; bei IP-Zugriff passenden IP-SAN verwenden. npm legt keinen DNS-Eintrag an. |
| Authentisierung | Kein Standardpasswort, Passwortlos-Login oder Recovery-Bypass wird eingeführt. Ein berechtigtes Konto mit unterstützter Authentisierung bleibt erforderlich. |
| Rechte | Der Erhalt eines Recovery-Zugangs erweitert keine Benutzer-/Installerrechte. Die regulären serverseitigen Zugriffsprüfungen bleiben verbindlich. |

Im geänderten Backendquellstand sind `ensureLegacyAdminLocked()` und die zugehörigen
Flag-/Port-/Bind-Helfer entfernt. Start, periodische Prüfung und
Objektänderungsabgleich führen diesen Sperrpfad damit nicht mehr aus. Alle neuen
Voreinstellungen sind zusätzlich am endgültigen
9.0.1-Liefermanifest und bei einer frischen Instanz zu prüfen; übernommene
Instanzwerte können davon abweichen. Der vorhandene Adminzugang, üblicherweise
8081, wird durch die EOS-Migration nicht umgestellt.
Unabhängige vorhandene Mechanismen, etwa die Prüfung ausdrücklich zurückgezogener
Adapterversionen, werden durch diese Korrektur nicht pauschal ausgenommen. Es wird
keine allgemeine Garantie gegeben, dass andere autorisierte Verwaltungs- oder
Sicherheitsaktionen nie eine Instanz deaktivieren.

Der zentrale OAuth-/Lizenzfluss wird durch diese Korrektur nicht durch einen zweiten
Login ersetzt. Die bisher dokumentierten Grenzen für TOTP/Passkeys und globalen Logout
bleiben bestehen, soweit ein neuer Prüfbericht keine gesonderte Änderung ausweist.

## Warum die Alpha-1-Prüfung den Fehler nicht abdeckte

Der damalige Integrationstest `test/integration-unified.cjs` legte ausdrücklich
ein eigenes Konto `system.user.eosintegration` mit generiertem Passwort-Hash und
Administrator-Gruppenmitgliedschaft an. Er verwendete HTTP auf
`127.0.0.1:18188` mit leerer `eosExternalOrigin`. Dieser Test prüfte den gemeinsamen
Login und die Aktivierungsweiterleitung unter diesen Voraussetzungen.

Er enthielt im untersuchten Alpha-1-Stand keine Prüfung, dass ein zuvor laufendes
`admin.0` seine Aktivierung, Port-/Bind-Konfiguration und Erreichbarkeit behält.
Ebenso prüft er nicht den tatsächlichen Browserzugang über HTTPS:443 oder die
Provisionierung eines vorhandenen Kunden-Administratorkontos. Die neue Erhaltprüfung wurde für 9.0.1 gezielt ergänzt: tatsächlicher EOS-Prozess und Admin-Objektbestand bei Start, wiederholten Änderungen, Stop und Neustart; kein paralleler alter Admin-Webserver.

**Passwortstatus:** Aus dieser Untersuchung ist keine allgemeine Aussage über ein
leeres oder gesetztes ioBroker-Standard-Administratorkennwort ableitbar. Der Fall
eines nicht provisionierten beziehungsweise fehlenden Passworts ist separat zu
prüfen. Dabei dürfen nur Statusinformationen, niemals Passwort-Hashes oder
Passwörter ausgegeben werden. Falls ein Kennwort fehlt, ist es über eine bestehende
berechtigte Oberfläche oder den vorgesehenen interaktiven CLI-Weg einzurichten;
es gibt keinen Anmelde-Bypass.

## Vorgehen bei verlorenem Zugang

Die konkrete Diagnose und die einzelnen Wiederherstellungsschritte stehen ausschließlich
in [deploy/ACCESS_RECOVERY.md](../../deploy/ACCESS_RECOVERY.md). Diese Anleitung ist
maßgeblich für den Recovery-Ablauf; hier werden keine parallelen Shellbefehle gepflegt.

Grundprinzip: Zunächst den wiederholt schreibenden Alpha-1-EOS-Guard kontrolliert
anhalten. Danach den tatsächlichen Bestand prüfen und einen geschützten lokalen
Zugang gegebenenfalls über SSH/PuTTY herstellen. Authentisierung und bestehende
TLS-Einstellungen nicht pauschal abschalten oder überschreiben. Ein notwendiger
Passwortwechsel erfolgt interaktiv, ohne Geheimnisse in Befehlszeilen oder Logs.
Erst nach geprüftem Zugang und Korrekturstand den gemeinsamen EOS-Betrieb wiederaufnehmen.

Nach der ioBroker-Neuinstallation zuerst den vorhandenen Adminzugang nutzen und
das berechtigte Konto sowie das Zertifikatsmaterial für `defaultPublic` und
`defaultPrivate` prüfen. EOS dann direkt unter `https://<Geräte-IP>:8188/` testen.
Das normale erste ioBroker-Setup erzeugt Standardzertifikate, aber deren SAN passt
nicht automatisch zu Geräte-IP oder `NexoWattEOS`. Namen allein beweisen weder
passenden SAN noch Clientvertrauen. `iobroker setup first` nicht als Reparatur
wiederholen, da es das globale Standard-Schlüsselpaar erneut erzeugt; die gezielte
Zertifikatseinrichtung ist in [INSTALL_PUBLISH.md](INSTALL_PUBLISH.md) beschrieben.
Für `https://NexoWattEOS:8188/` ist zusätzlich die lokale Namensauflösung einzurichten.

Nur für Zugang ohne Portangabe gilt die optionale 443-Einrichtung nach
[deploy/README.md](../../deploy/README.md). npm konfiguriert keine OS-Dienste,
DNS-Einträge oder Firewall und verleiht weder Rootrechte noch pauschale Node-
Portcapabilities. Eine lokale Recovery-Verbindung ist kein Nachweis eines
funktionierenden direkten TLS-Zugangs oder eines optionalen 443-Proxys.

## Neue Nachweise für 9.0.1

| Prüfung | Erforderlicher Nachweis | Status dieses Vermerks |
| --- | --- | --- |
| Bestehendes `admin.0` erhalten | Aktiviert, individuelle Port-/Bind-Werte; Vergleich vor/nach EOS-Start und wiederkehrender Prüfung. Zusätzlich gespeichertes Sperrflag `true` testen. | Bestanden mit echtem EOS-Prozess und Datenbanken; Admin-Objektbestand erhalten. |
| Bereits gesperrten Bestand nicht erraten | Vorhandene Werte bleiben ohne explizite Recovery unverändert; keine ungefragte LAN-/TLS-/Auth-Änderung. | Entsprechende negative beziehungsweise erhaltende Regressionen bestanden; realer Erstbenutzerablauf bleibt Zielgeräteprüfung. |
| Benutzer-/Passwortzustand | Vorhandenes gültiges Konto; fehlendes/unprovisioniertes Passwort separat; sicherer Fehler statt Passwortlos-Fallback. | Entsprechende negative beziehungsweise erhaltende Regressionen bestanden; realer Erstbenutzerablauf bleibt Zielgeräteprüfung. |
| Recovery-Werkzeug | Nur bereinigte Statusdaten; keine Geheimnisse; feste lokale Grenzen und interaktiver Passwortweg. | 11 Diagnosewerkzeugtests bestanden; keine Geheimnisse in Statusausgabe. |
| Direkter HTTPS-Zugang | Neue Defaults, Zertifikatsauswahl/SAN/CA, Login, Erstpasswortwechsel und Aktivierung auf 8188; negative TLS-/Host-/Originfälle. | TLS-/Origin-Softwareprüfungen und installierter HTTPS-Login bestanden; Gerätevertrauen und reale Aktivierung offen. |
| Optionaler 443-Zugang | Frontend-TLS und CA-/Namensprüfung des HTTPS-Upstreams; externe Origin leer, parallele IP-/Namenszugänge, WebSocket/SSE; falsche CA/Name wird abgelehnt. | Nur bei Nutzung gesonderte Zielgerät-/Browserprüfung. |
| Regressionsumfang | Zentrale Sitzung/Lizenz, unveränderte Rollen, Schreibzuständigkeit, Stop/Restart und Paketintegrität. | 203 Unified- und 48 weitere Regressionen sowie 11 installierte Fälle bestanden; ein Nginx-Syntaxfall wegen fehlendem Binary übersprungen. |

Repositoryzuordnung für diesen Arbeitsstand: `NexoWatt/ioBroker.eos-admin`
([GitHub-Ziel](https://github.com/NexoWatt/ioBroker.eos-admin)). Der technische
npm-Paketname bleibt `iobroker.eos-admin`. Die Adressangabe bestätigt weder einen
bereits erfolgten Upload noch eine Freigabe der neuen Version.

**Freigabestatus:** Die Softwareprüfungen und Grenzen stehen im [Prüf- und Lieferbericht 9.0.1](../reports/unified-9.0.1/PRUEFBERICHT.md). Quell-/Runtimebindung und finale SHA-256-Summen gehören zur Lieferung. Hardwareabnahme, Serienfreigabe und CRA-Konformität werden damit nicht behauptet.
