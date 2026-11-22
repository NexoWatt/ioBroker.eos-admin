# Installation, Git und npm

**NexoWatt EOS · `iobroker.eos-admin` · 9.0.0-alpha.1**

Der Lieferstand ist eine erste gemeinsame Entwicklungsversion. Die tatsächlich
bestandenen Prüfungen und Grenzen stehen im mitgelieferten Abschlussbericht. Vor
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
ungeprüft darüberkopieren. Für Git den Repositorynamen `ioBroker.eos-admin` verwenden;
die für den eigenen Account richtige URL vor Upload prüfen. Kein fremdes Repository
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
expliziten Testtag veröffentlichen, damit sie nicht unbeabsichtigt zum Standard wird:

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

## Auf einem EOS-Testsystem einrichten

1. Vollständige Sicherung einschließlich Objekt-/State-Konfiguration, Benutzer,
   Lizenzablage und Wiederherstellungsschlüssel prüfen. Den vorhandenen gesicherten
   Recovery-Zugang erhalten.
2. Die alte `nexowatt-ui`-Instanz kontrolliert stoppen und automatischen Neustart
   verhindern, bevor die integrierte Regelung übernommen wird. Den tatsächlichen
   Prozessstopp und ausbleibende Stellbefehle prüfen. Migrationswerkzeug/-anleitung
   des Lieferstands verwenden; `native.eosUi` nicht aus einem ungeprüften Backup erraten.
3. Das geprüfte Paket über den vorgesehenen ioBroker-/EOS-Installationsweg installieren.
   Erst Konfiguration und Schreibzuständigkeit prüfen, dann die neue Regelung aktivieren.
4. Den festen HTTPS-Eingang auf 443 mit gerätebezogenem Zertifikat einrichten und die
   folgenden Werte setzen. Diese Systemeinrichtung ist kein npm-Postinstall-Hook.

| Einstellung | EOS-Profil / Beispiel |
| --- | --- |
| `port` | `8188` |
| `bind` | `127.0.0.1` |
| `secure` | `false` ausschließlich für den internen Loopback-Transport hinter TLS |
| `eosExternalOrigin` | `https://192.168.1.10` mit der tatsächlichen Geräte-IP, ohne Pfad/abschließenden Slash |
| HTTPS-Eingang | Feste Weiterleitung auf `http://127.0.0.1:8188`, kein beliebiges Ziel |
| Truststore | Siehe [LICENSING.md](LICENSING.md); öffentliche Ausstellerschlüssel, gegen Adapteränderungen geschützt |

Kein HTTP-Login im LAN freischalten. IPv4- und IPv6-Erreichbarkeit kontrollieren.
WebSocket-Upgrades und SSE ohne verzögernde Pufferung durchleiten. Der Eingang muss
fremde Forwarding-/Identitätsheader entfernen oder kontrolliert ersetzen. TLS443
benötigt begrenzte Systemrechte am Eingangsdienst; dem gemeinsamen Node-Interpreter
oder ioBroker-Prozess werden dafür keine pauschalen Root-/Port-Capabilities gegeben.

Der mitgelieferte [HTTPS-Eingang und Offline-Migrationsplan](../../deploy/README.md)
beschreibt die konkreten Werkzeuge und verbleibenden Grenzen. Der Migrationsplan
übernimmt keine Daten selbst in eine laufende Anlage.

5. `https://<Geräte-IP>/` öffnen. Die einzige sichtbare Anmeldung liegt unter
   `/login.html`. Nach der ersten berechtigten Anmeldung die zentrale Lizenz
   aktivieren; danach kein erneutes Lizenzieren der UI. Gemeinsame OAuth-Anmeldung
   und Erstpasswortwechsel sind unterstützt; TOTP-Challenges/Passkeys noch nicht.
   Ein vorhandenes `common.externalAuthentication.totp` (außer `null`/nicht vorhanden)
   beziehungsweise fehlerhaftes `externalAuthentication` sperrt den Zugang ohne
   Passwort-only-Rückfall. Solche Konten können diesen Alpha-Login nicht nutzen.
   Bestehende MFA nicht allein zum Umgehen dieser Sperre abschalten. Ablauf: [LICENSING.md](LICENSING.md).
6. Dashboard `/`, Installer `/installer/` und System `/system/` mit den jeweiligen
   Rollen prüfen. Authentisierung nutzt `/api/auth/status`, `/api/auth/login` und
   `/api/auth/logout`; zentrale Lizenzrouten liegen unter `/nexowatt/license`.
7. Neustart, Logout, Rechteentzug, Offlinebetrieb und Wiederherstellung prüfen. Der
   zentrale Alpha-Logout meldet über eine globale Sitzungsgeneration **alle parallelen
   Nutzer** einschließlich Socket/SSE ab; er ist kein isolierter Einzelsitzungslogout.
   Dieses Verhalten mit mindestens zwei gleichzeitig angemeldeten Nutzern prüfen und
   Befunde protokollieren. Erst dann den freigegebenen Praxistestumfang erweitern.

Wenn der HTTPS-Eingang fehlt, liefert `https://IP` nicht automatisch Port 8188.
Ein Portkonflikt oder Zertifikatsfehler wird behoben; kein Ausweichen auf einen
unbekannten Port oder ungeschützten Login. `/system/` ist kein zweiter offener Admin.
