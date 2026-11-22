# Installation, Git und npm

**NexoWatt EOS · `iobroker.eos-admin` · 9.0.2**

Version 9.0.2 bleibt zur Erprobung bestimmt und wird über `next` bereitgestellt.
Der neue Abschlussbericht muss geprüfte Version und Artefakthash ausdrücklich nennen.
Vorherige Alpha-Berichte bleiben historische Belege; ihre Erfolge werden nicht
auf dieses geänderte HTTPS-/Zugangsprofil übertragen. Vor
Tests auf einer Anlage [COMMISSIONING.md](COMMISSIONING.md) durcharbeiten. Dieses
Dokument führt keine Veröffentlichung oder Änderung eines Kundengeräts aus.

## Paketname und Nutzungsrecht

Der sichtbare Name lautet **NexoWatt EOS**; `iobroker.eos-admin` und der Namespace
`eos-admin.<Instanz>` bleiben erhalten. Das vermeidet einen zusätzlichen Namespacewechsel
für bestehende EOS-Systemverträge. Der UI-/EMS-Bestand wird intern mitgeliefert.
Ein neues `iobroker.nexowatt-eos`-Paket wäre eine weitere gesonderte Migration.

NexoWatt-Anteile bleiben proprietär und dürfen nach dem NexoWatt-Vertrag genutzt
werden. Das npm-Metadatum `SEE LICENSE IN LICENSE` verweist auf diese Bedingungen;
vorhandene Drittanbieterrechte bleiben bestehen. ioBroker zeigt den kommerziellen
Status über `licenseInformation.type: paid` und einen Lizenzinformationslink.

**Sichtbarkeit ist davon getrennt:** Ungescopte npm-Pakete wie `iobroker.eos-admin`
sind öffentlich herunterladbar. Ein privates Git-Repository ändert das nicht. Wer
auch die Paketdateien vertraulich halten muss, benötigt einen dafür eingerichteten
privaten Registry-/Scope-Vertrieb und einen gesondert geprüften Installationsweg.
`private: true` verhindert npm-Publish insgesamt und ist keine kostenpflichtige
Produktlizenz. Signiergeheimnisse und Kundenlizenzen gehören in keinen dieser
Veröffentlichungswege. Quellen: [SOURCES.md](SOURCES.md), NPM-01 bis NPM-03.

## Repository vorbereiten

Das ZIP in ein neues leeres Arbeitsverzeichnis entpacken. Alte Quellordner nicht
ungeprüft darüberkopieren. Für Git ist
[NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin) vorgesehen;
Zieladresse und Kontorechte vor dem Upload prüfen. Kein fremdes Repository
überschreiben. Ein privates Git-Repository kann die Entwicklungsquellen begrenzen;
Git-/npm-Kontozugänge mit der dort unterstützten MFA und minimalen Rechten absichern.

Node-/npm-/Controlleranforderungen aus den gelieferten Manifesten und dem Prüfbericht
verwenden. `npm ci` installiert aus den Lockfiles; es ist kein Ersatz für die
Prüfung ausführbarer Installationsskripte und der Buildumgebung. Ein lokaler Neubau
ändert den Artefaktstand und erfordert neue Tests, SBOM und Hashbindung.

Die fokussierten Befehle dieses Lieferstands sind:

```sh
npm run test:unified
npm run check:unified
npm pack --dry-run --json
```

`prepack` und `prepublishOnly` prüfen den vorbereiteten Stand. Während Publish darf
kein automatischer Neubau oder erneutes Versiegeln ungeprüfter Dateien erfolgen.
`npm run seal:unified` ist ausschließlich der explizite Entwicklungs-/Release-Schritt
nach Build und Prüfung; er ist kein Reparaturbefehl für einen unerklärten Hashfehler.

Der vollständige Build einschließlich beider Frontends sowie alle erweiterten
Regressionstests sind anhand des Abschlussberichts auszuführen. Die drei Befehle
oben bescheinigen keine vollständige System-/Hardwareabnahme.

## npm-Testveröffentlichung

Vor dem Upload Paketinhalt, Version, Lizenz, Manifest und Prüfergebnisse kontrollieren.
Im für `iobroker.eos-admin` berechtigten npm-Konto anmelden. Die Testversion mit einem
expliziten Testtag veröffentlichen, damit sie nicht unbeabsichtigt zum Standard wird.
`9.0.2` besitzt keinen SemVer-Prerelease-Suffix; die Testverteilung wird bewusst
über den npm-Tag `next` festgelegt:

```sh
npm publish --tag next
```

Dieser Befehl veröffentlicht das Paket öffentlich und wird hier **nicht** ausgeführt.
Die konkrete Version muss auf npm noch unveröffentlicht sein. Repo-/npm-Eigentümer,
Authentisierung und ggf. Trusted Publishing werden im eigenen Account eingerichtet;
kein Token wird in ZIP, `.npmrc`, Git oder Beispielkonfiguration eingebettet.

Die technische npm-Veröffentlichung ist von der Aufnahme in ioBroker Latest/Stable
getrennt. Es wird keine erfolgte Adapter-Checker-Abnahme, Aufnahme, vertragliche
Vereinbarung mit ioBroker oder Serienfreigabe behauptet. Für offizielle Aufnahme
gelten zusätzliche Regeln einschließlich kommerzieller Bedingungen (IO-01/IO-02).

## Neuinstallation oder Übernahme

1. ioBroker regulär installieren beziehungsweise den vorhandenen Bestand vollständig
   sichern. Den bestehenden Adminzugang, üblicherweise auf 8081, für die Einrichtung
   behalten. EOS schaltet diesen Zugang nicht automatisch ab und verschiebt ihn nicht.
2. Ein berechtigtes ioBroker-Konto mit persönlichem Passwort einrichten beziehungsweise
   prüfen. Über einen angeblich allgemeinen Standardpasswortzustand wird keine Annahme
   getroffen. Ein fehlendes Passwort ist über die berechtigte vorhandene Oberfläche
   oder den vorgesehenen interaktiven CLI-Weg zu setzen; kein Login-Bypass.
3. Nur bei Übernahme einer bisherigen Anlage: alte `nexowatt-ui`-Regelinstanz kontrolliert
   stoppen, deren Prozessende bestätigen und die geprüfte Migration vorbereiten.
   Eine neue Installation benötigt keine erfundene Altinstanz. Das
   [Migrationswerkzeug](../../deploy/README.md) erstellt einen Offlineplan und
   verändert keine laufende Anlage automatisch.
4. Das geprüfte 9.0.2-Paket über den vorgesehenen ioBroker-/EOS-Weg installieren und
   die Instanzkonfiguration prüfen. Die Defaults gelten für neue Instanzen; bei
   übernommenen Instanzen nicht voraussetzen, dass gespeicherte Werte bereits passen.

| Einstellung | Direkter Zugang von 9.0.2 |
| --- | --- |
| `port` | `8188` |
| `bind` | `0.0.0.0` – IPv4-Schnittstellen des Geräts |
| `secure` / `auth` | `true` / `true` |
| `certPublic` / `certPrivate` | `defaultPublic` / `defaultPrivate` – vorhandene ioBroker-Zertifikatsnamen |
| `eosExternalOrigin` | Leer im neuen HTTPS-Profil, direkt und mit optionalem 443-/HTTPS-Upstream |
| `eosLockLegacyAdmin` | `false`; alte Legacy-Lock-Flags bleiben ohne automatische Sperrwirkung |
| Aufruf mit Geräte-IP | `https://<Geräte-IP>:8188/` |
| Aufruf mit lokalem Namen | `https://NexoWattEOS:8188/` erst nach passender Namensauflösung/Zertifikateinrichtung |
| Lizenz-Truststore | Öffentliche Ausstellerschlüssel nach [LICENSING.md](LICENSING.md) |

5. Zertifikat und privaten Schlüssel unter den eingetragenen Namen prüfen. Das normale
   erste ioBroker-Setup erzeugt `defaultPublic`/`defaultPrivate`. Beim untersuchten
   Controller 7.2.5 enthält das Standardzertifikat den Betriebssystem-Hostnamen als
   SAN, nicht automatisch die Geräte-IP oder `NexoWattEOS`. Keine mitgelieferten
   gemeinsamen Schlüssel erwarten. Das verwendete Zertifikat muss die verwendete
   IP als IP-SAN oder den verwendeten Gerätenamen als DNS-SAN enthalten. Sein
   Aussteller muss auf den Bediengeräten vertraut sein. Ein TLS-Fehler wird behoben;
   weder Authentisierung noch TLS als Umgehung deaktivieren. **`iobroker setup first`
   nicht als Zertifikatreparatur wiederholen:** Es erzeugt das globale Standard-
   Schlüsselpaar erneut und kann bestehende Zertifikatsbindungen/Vertrauensstellungen
   verändern. Benötigtes Zertifikat gezielt und kontrolliert bereitstellen.
6. `https://<Geräte-IP>:8188/` öffnen. `/login.html` ist die sichtbare Anmeldung.
   Gemeinsame OAuth-Anmeldung und Erstpasswortwechsel sind unterstützt; TOTP-Challenge
   und Passkeys noch nicht. Vorhandenes `common.externalAuthentication.totp` außer
   `null`/nicht vorhanden oder fehlerhaftes `externalAuthentication` sperrt sicher,
   ohne Passwort-only-Rückfall. Bestehende MFA nicht zur Umgehung abschalten.
7. Nach erster berechtigter Anmeldung bei fehlendem Prüfschlüssel zuerst den Reiter
   **„Öffentliche Prüfschlüssel & Wiederherstellung“** verwenden; siehe
   [Lizenzwiederherstellung 9.0.2](LICENSE_RECOVERY_9.0.2.md). Danach einmal die
   zentrale EOS-Lizenz aktivieren.
   Dashboard `/`, Installer `/installer/` und System `/system/` verwenden denselben
   Login. Es wird keine zusätzliche UI-Lizenz eingegeben. Neustart, Rollenentzug,
   Offlinebetrieb und Wiederherstellung nach [COMMISSIONING.md](COMMISSIONING.md)
   prüfen. Der zentrale Logout meldet derzeit alle parallelen Nutzer einschließlich
   Socket/SSE ab; das ist noch kein Einzelsitzungslogout.

`NexoWattEOS` wird nicht durch die Adapterinstallation als DNS-Name angelegt. Der
lokale DNS-/Routereintrag oder ein bewusst verwalteter Hosts-Eintrag muss auf die
Geräte-IP zeigen. Änderungen von IP oder Name erfordern einen erneut passenden
Zertifikatsbezug. Ohne diese Einrichtung zuerst die tatsächliche IP verwenden.

## Optional: Zugang ohne Port über 443

Für `https://NexoWattEOS/` oder `https://<Geräte-IP>/` wird ein gesonderter
HTTPS-Eingang benötigt. Die [Deploymentanleitung](../../deploy/README.md) beschreibt
dessen konkrete Zertifikate und CA-geprüften **HTTPS-Upstream** auf EOS:8188.
`eosExternalOrigin` bleibt auch hier **leer**, damit direkte IP-/Namenszugänge und
der optionale 443-Zugang im vorgesehenen HTTPS-Profil parallel möglich bleiben.
Ein fester Einzel-Origin würde die anderen Zugänge ausschließen. Nur das bewusst
gewählte ältere HTTP-Loopback-Profil erfordert eine exakte externe HTTPS-Origin;
seine abweichenden Bedingungen stehen in der Deploymentanleitung. Dieses Altprofil
nicht mit dem neuen HTTPS-Profil mischen und niemals die Upstream-Zertifikatsprüfung
als Fehlerumgehung deaktivieren.

Nginx, DNS, Zertifikate und Hostfirewall werden nicht durch npm automatisch
installiert oder umgestellt. Der gemeinsame Node-/ioBroker-Prozess erhält keine
Rootrechte und keine pauschale `CAP_NET_BIND_SERVICE` auf der Node-Binärdatei.
Direkter HTTPS-Zugang und optionaler 443-Proxy sind getrennt zu testen: Zertifikat,
Origin/Host, Login, WebSocket, SSE, Erreichbarkeit und Fehlerreaktion.

Bei einem verlorenen früheren Adminzugang gelten
[Zugangserhalt 9.0.1](ACCESS_RECOVERY_9.0.1.md) und die dort verlinkte
Recovery-Anleitung. Keine alten Bind-/TLS-/Passwortwerte raten. Portkonflikte
explizit auflösen; kein stilles Ausweichen auf einen anderen Port.
