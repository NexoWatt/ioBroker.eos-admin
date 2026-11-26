> **EOS 9.0.26:** Korrekturen für Git-Auslieferung und Modulaktivierung, Ladepunkt-Löschung und Tibber-Anzeige beim Neustart. Übersichtliche Sicherungsdialoge und HTTPS-/Web-App-Einrichtung. [Installation und Bedienung](START_HIER_9.0.26.md) · [Prüfbericht](docs/reports/unified-9.0.26/PRUEFBERICHT.md).

Die folgenden Versionshinweise beschreiben frühere Lieferstände.

> **9.0.25:** Die optionale Übernahme eines separaten OCPP-Adapters blockiert den bestehenden Geräte-/EMS-Start nicht mehr. Die Prozessseite bietet gespeichertes Aktivieren, Deaktivieren und Neustarten für die EOS-Kindprozesse. Gemeinsames Paket und getrennte Prozesse bleiben erhalten. [Anleitung](START_HIER_9.0.25.md) · [Prüfbericht](docs/reports/unified-9.0.25/PRUEFBERICHT.md).

> **9.0.24:** OCPP ist zusammen mit Devices, EEBUS, UI/EMS und Backup Bestandteil eines EOS-Adapters und läuft als eigener Prozess. Kiosk-Dashboard und geschützte Administration. Die nach Auslieferung gemeldete globale OCPP-Startsperre wird in 9.0.25 korrigiert. [Historischer Prüfbericht](docs/reports/unified-9.0.24/PRUEFBERICHT.md).

> **9.0.23:** Getrennte Prozesse für UI/EMS, Geräte, EEBUS und Backup; OCPP bleibt separat. Automatische Stationszuordnung, Prozessdiagnose und unabhängige OCPP-Ausfallfreigabe. [Anleitung](START_HIER_9.0.23.md) · [Prüfbericht](docs/reports/unified-9.0.23/PRUEFBERICHT.md).

> **9.0.21:** MQTT-Reconnects und Warteschlangen, EMS-Messwertwiederkehr sowie konkurrierendes Speichern abgesichert. Neue EOS-Updateanzeige und ausdrücklich gestartete Updates auch für angemeldete Kunden. [Anleitung](START_HIER_9.0.21.md) · [Prüfbericht](docs/reports/unified-9.0.21/PRUEFBERICHT.md).

> **9.0.20:** Gerätebefehle unabhängig vom Browser, korrekte Farm-/Schreibdiagnose, dynamische Speichergrenzen und direkte InfluxDB-2-Historie; weitere Lebenszyklus- und Live-/History-Fehler korrigiert. NexoWatt-Symbol am Login und Apple-Home-Bildschirm-Verweise ergänzt. [Anleitung](START_HIER_9.0.20.md) · [Prüfbericht](docs/reports/unified-9.0.20/PRUEFBERICHT.md).

> **9.0.19:** Geräteauswahl, EMS-Zuordnung und ausdrückliche Aktivierung in einem Ablauf; Messwertaktualität und Energiefluss korrigiert. [Anleitung](START_HIER_9.0.19.md) · [Prüfbericht](docs/reports/unified-9.0.19/PRUEFBERICHT.md).

> **9.0.18:** Geräte über gemeinsame Alias-V1-Rollen direkt dem EMS und Energiefluss zuordnen; Kundentarif unter Einstellungen verbinden. Bestehende Zuordnungen bleiben erhalten; veraltete App-Center-Formulare werden erkannt. [Anleitung](START_HIER_9.0.18.md) · [Prüfbericht](docs/reports/unified-9.0.18/PRUEFBERICHT.md).

> **9.0.17:** Getrennte EOS-Browsercookies und keine automatischen Änderungen fremder ioBroker-Rechte oder Metadaten. Standard-Admin und Backitup bleiben eigenständige Adapter. [Anleitung](START_HIER_9.0.17.md) · [Prüfbericht](docs/reports/unified-9.0.17/PRUEFBERICHT.md).

> **9.0.16:** Geräte speichern auch vor dem operativen Modulstart; bei ausstehender Übernahme klare Sperranzeige. Nachgewiesene Überschreibungen gespeicherter Einstellungen beim Start korrigiert; alte Installer-Dateien beim Überkopieren für `npm publish` berücksichtigt; Website-Abmeldung nach zehn Minuten ohne Bedienung. [Anleitung](START_HIER_9.0.16.md) · [Prüfbericht](docs/reports/unified-9.0.16/PRUEFBERICHT.md).

> **9.0.15:** Gemeinsames Smartphone-App-Symbol mit dem NexoWatt-Logo und klar benannter Zugang zur Bestandsübernahme. [Anleitung](START_HIER_9.0.15.md) · [Prüfbericht](docs/reports/unified-9.0.15/PRUEFBERICHT.md).

> **9.0.14:** Bestandsübernahme nach später Lizenzaktivierung und altes Geräteformat korrigiert; EMS-Startblockaden werden konkret angezeigt. [Anleitung](START_HIER_9.0.14.md) · [Prüfbericht](docs/reports/unified-9.0.14/PRUEFBERICHT.md).

> **9.0.13:** Wieder direkt aus dem Repo mit `npm publish` veröffentlichen. Bekannte alte Frontend-Dateien werden gesichert bereinigt. SmartHome-Dropdown korrigiert. [Anleitung](START_HIER_9.0.13.md) · [Prüfbericht](docs/reports/unified-9.0.13/PRUEFBERICHT.md).

> **9.0.12:** SmartHome-Einrichtung mit Dropdowns, Dialogen und kompakter Geräteerkennung. Anleitung: [START_HIER_9.0.12.md](START_HIER_9.0.12.md). Prüfstand: [Bericht](docs/reports/unified-9.0.12/PRUEFBERICHT.md).

> **9.0.11 – abgesicherte Übernahme und Veröffentlichung:**
> [Update / npm unter Windows](START_HIER_9.0.11.md) · [Prüfbericht](docs/reports/unified-9.0.11/PRUEFBERICHT.md).

> **9.0.10 – Geräteprofile, Alias-Zuordnung und SmartHome-Konfiguration über die volle Breite:**
> [Update und Einrichtung](START_HIER_9.0.10.md) · [Prüfumfang und Grenzen](docs/reports/unified-9.0.10/PRUEFBERICHT.md).

> **9.0.6 – integrierte Geräte-/EEBus-Module und lokale Geräteerkennung:**
> [Update und Inbetriebnahme](START_HIER_9.0.6.md) · [Prüfumfang](docs/reports/unified-9.0.6/PRUEFBERICHT.md).
> Eine zentrale EOS-Systemlizenz. Die Übernahme vorhandener Einzeladapter erfolgt kontrolliert; hardwarebezogene Abnahme bleibt erforderlich.

# NexoWatt EOS

**Version 9.0.26 · technisches Paket: `iobroker.eos-admin` · Vertriebskanal: `next`**

NexoWatt EOS verbindet die Systemverwaltung aus EOS-Admin 8.0.2 mit Dashboard,
Installer und Energiemanagement aus NexoWatt UI 1.0.38. Eine ioBroker-Instanz betreibt
die gemeinsamen Module. Die bisherige UI wird im Zielbetrieb nicht zusätzlich gestartet.
Der technische Paketname bleibt für bestehende Integrationen erhalten. OCPP 0.4.4 auf Basis
der bisherigen 0.4.3 ist integriert; im Zielbetrieb wird dafür kein zusätzlicher
`ocpp21`-Adapter benötigt. Admin/HTTPS, UI/EMS, Devices, EEBUS, OCPP und Backup haben
getrennte Betriebssystemprozesse. UI und EMS bleiben innerhalb ihres gemeinsamen
Kindprozesses. Kontrollierte Bestandsübernahmen erhalten vorhandene OCPP-Datenpunkt-IDs.
Ein separat betriebener OCPP-Adapter wird ausschließlich nach ausdrücklicher Auswahl
übernommen. Seine bloße Existenz löst keine automatische Übernahme mehr aus.

Version 9.0.26 bleibt ein Integrations-Teststand für `next`. Die Versionsnummer ist
kein Nachweis einer allgemeinen Produktivfreigabe oder CRA-Konformität. Tatsächliche
Ergebnisse und Artefakthashes stehen im [Prüfbericht 9.0.26](docs/reports/unified-9.0.26/PRUEFBERICHT.md).
Die [Berichte zu 9.0.4](docs/reports/unified-9.0.4/PRUEFBERICHT.md),
[9.0.3](docs/reports/unified-9.0.3/PRUEFBERICHT.md) und früheren Versionen bleiben
historische Belege; ihre Ergebnisse bestätigen keine späteren Änderungen.

## Update 9.0.5: History, Startanzeige und Ressourcen

Die vorhandene Instanz und ihre gültige zentrale Lizenz werden weiterverwendet.
Einstieg und Abnahme: [START_HIER_9.0.5.md](START_HIER_9.0.5.md).

**EOS-HTTP-QUERY-001:** Der Feldbericht aus 9.0.4 zeigt den konkreten History-Abbruch:
`Cannot read properties of undefined (reading 'from')` in `ui/main.js`, gefolgt von
einer unbehandelten Promise-Ablehnung und Exitcode 6. Die eingebettete Express-4-UI
übernimmt Requests vom Express-5-Verwaltungsserver. Beim Wechsel des Request-Prototyps
konnte der geerbte Query-Zugriff verloren gehen. 9.0.5 sichert diese Übergabe und
behandelt asynchrone Routenfehler als kontrollierte HTTP-Fehler.
`EOS_UI_UNAVAILABLE` und die späteren Stop-Abmeldemeldungen waren Folgeerscheinungen.

Zusätzlich werden History-Eingaben, Antwortdaten und Ressourcenverbrauch begrenzt.
Die EMS-Datenpunktregistry speichert nur benötigte Quell-/Alias-/Verbindungswerte;
fachfremde Admin-State-Payloads bleiben nicht in einem zweiten EMS-Cache liegen.
Die Systemverwaltung erhält das NexoWatt-Logo für ihre Startanzeige. Eine ungeprüfte
Schätzung der RAM-Einsparung wird nicht angegeben: Die gemeldeten rund 750 MB stammen
vom Zielgerät; Messbedingungen und tatsächlich nachgewiesene Optimierungen stehen im
versionsgebundenen Bericht.

Die Korrekturen aus 9.0.3/9.0.4 bleiben erhalten: HTTPS-Bereitschaft unabhängig von
verzögerter operativer Initialisierung, begrenzte History-Startabfragen, rechtzeitige
MultiUse-Objektanlage sowie Socket-Ereignisbegrenzung mit getrenntem EMS-Abonnementbedarf.
Die Meldungen „Unsubscribe from all states …“ und „Subscribe to all states again“
kennzeichnen den Lastwechsel der Oberfläche; allein beweisen sie keinen Neustart.
Für einen Absturz sind die erste Fehlerzeile, Stacktrace und Prozess-/Exitmeldung maßgeblich.

Der hier beschriebene historische Stand 9.0.5 verwendete eine gemeinsame Laufzeit.
Seit 9.0.23 bestehen getrennte Modulprozesse; 9.0.24 ergänzt OCPP. Last-, Dauerlauf-
und Anlagenabnahme bleiben eigene Nachweise. Details: [Architektur](docs/unified/ARCHITECTURE.md),
[Prüfplan](docs/unified/COMMISSIONING.md) und
[historischer Prüfbericht 9.0.10](docs/reports/unified-9.0.10/PRUEFBERICHT.md).

## Anmeldung und einmalige Aktivierung

Nach der ioBroker-Neuinstallation ist der direkte EOS-Einstieg
`https://<Geräte-IP>:8188/`. Der neue Adapter verwendet standardmäßig TLS und
Authentisierung (`secure: true`, `auth: true`) auf `0.0.0.0:8188`. Als
ioBroker-Zertifikatsnamen sind `defaultPublic` und `defaultPrivate` eingetragen;
die zugehörigen Zertifikats-/Schlüsseldaten müssen auf dem Gerät vorhanden und
für die verwendete Adresse geeignet sein. Das normale erste ioBroker-Setup erzeugt
Standardzertifikate; deren SAN deckt nicht automatisch die Geräte-IP oder den Namen
`NexoWattEOS` ab. `eosExternalOrigin` bleibt im neuen HTTPS-Profil auch mit optionalem
443-Proxy leer, damit die vorgesehenen IP-/Namenszugänge parallel nutzbar sind.
Es gibt keinen unverschlüsselten Ersatzlogin. Details zur Zertifikatseinrichtung
und zum Schutz bestehender Schlüssel stehen in der Installationsanleitung.

Der bestehende ioBroker-Adminzugang, üblicherweise Port 8081, wird durch EOS nicht
automatisch deaktiviert oder auf einen anderen Port verschoben. Auch gespeicherte
Legacy-Sperrflags lösen diese frühere Aktion nicht mehr aus. Den vorhandenen
Administrationszugang für die Einrichtung erhalten.

`https://NexoWattEOS:8188/` funktioniert erst, wenn `NexoWattEOS` im lokalen Netz
auf die Geräte-IP aufgelöst wird und zum Zertifikat passt. Der Adapter erzeugt
keinen DNS-Eintrag. Für den Zugriff ohne Portangabe ist optional ein HTTPS-Eingang
auf 443 einzurichten; dieser verbindet sich ebenfalls per HTTPS und mit
CA-/Namensprüfung zum EOS-Upstream. Ein npm-Upload konfiguriert weder DNS,
Betriebssystemdienste noch Firewall oder Rootrechte. Details:
[Installation](docs/unified/INSTALL_PUBLISH.md) und
[Zugangserhalt 9.0.1](docs/unified/ACCESS_RECOVERY_9.0.1.md).

1. Mit dem eigenen ioBroker-Konto auf der NexoWatt-Anmeldeseite anmelden.
2. Einen erforderlichen Erstpasswortwechsel abschließen.
3. Bei fehlendem Prüfschlüssel im Reiter „Prüfschlüssel & Wiederherstellung“ die öffentliche Keygen-Datei `license-trust.json` prüfen und übernehmen. Nur bereits autorisierte Hersteller- oder OS-Schlüssel sind zulässig.
4. Als Administrator einmal die zentrale EOS-Lizenz aktivieren.
5. Dashboard, Installer und berechtigte Systemfunktionen über dieselbe Anmeldung nutzen.

**Anmeldegrenze diesem Teststand:** Gemeinsame OAuth-Anmeldung und
Erstpasswortwechsel sind implementiert. Ein TOTP-Challenge- oder Passkey-Flow ist
noch nicht verfügbar. Konten mit gesetztem `common.externalAuthentication.totp`
(außer `null`/nicht vorhanden) sowie fehlerhaft aufgebautem `externalAuthentication`
werden sicher gesperrt; sie fallen nicht auf eine reine Passwortanmeldung zurück.
Für solche Konten ist dieser Login nicht nutzbar. Die MFA-Konfiguration darf
nicht allein zum Umgehen dieser Sperre abgeschaltet werden.

**Abmeldung:** Der zentrale Logout widerruft in diesem Teststand die globale
Sitzungsgeneration. Dadurch werden **alle gleichzeitig angemeldeten Nutzer** erneut
zur Anmeldung aufgefordert, einschließlich offener Socket-/SSE-Verbindungen.
Es handelt sich noch nicht um einen auf eine einzelne Sitzung begrenzten Logout.

Die signierte NWL3-Lizenz wird lokal geprüft und verschlüsselt gespeichert; normales
Abmelden oder Neustarten erfordert keine erneute Eingabe. Öffentliche Prüfschlüssel
werden vom Hersteller passend zum verwendeten Keygen gesichert bereitgestellt.
Private Signierschlüssel und der Keygen-Tresor sind kein Bestandteil dieses Repositorys.
Der neue [Wiederherstellungsablauf](docs/unified/LICENSE_RECOVERY_9.0.2.md) beschreibt öffentlichen Import/Export, die Vertrauensrangfolge sowie den Unterschied zwischen Generator-PC- und EOS-Gerätewechsel.
NWL2 wird mit seinen signierten Bestandsrechten unterstützt; eine alte UI-Einzellizenz
ist keine automatische neue EOS-Systemlizenz. Details: [Lizenzbetrieb](docs/unified/LICENSING.md) und
[Grenzen der laufenden Regelung](docs/unified/LICENSING_RUNTIME_LIMITS.md).

## Kiosk und Stationsanzeigen

Ein bewusst aktivierter Kiosk zeigt das Kundendashboard ohne automatische
Sitzungsabmeldung. Administration und geschützte Einstellungen benötigen weiterhin
eine frische Anmeldung mit Administrator-Benutzername und Passwort; ein offener
Kiosk erteilt keine technischen Rechte. Der allgemeine Migrationsbutton entfällt
aus dem Dashboard. Die kontrollierte OCPP-Bestandsübernahme erfolgt im geschützten
OCPP-Einrichtungsbereich.

Stations-Anzeigeseiten bleiben über ihren vorhandenen separaten Display-Link
ohne Login- oder Inaktivitätssperre nutzbar. Dieser Display-Zugang ist keine
OCPP-Protokollauthentifizierung und schaltet keine Administration frei.

## Entwicklung und Prüfpaket

Node.js: `>=22.23.4 <23 || >=24.22.1 <25`. Der versionsgebundene Prüfbericht benennt die tatsächlich verwendeten Laufzeiten; nicht geprüfte Plattformen sind dadurch nicht freigegeben.

```sh
npm ci --ignore-scripts
npm --prefix src-admin ci --ignore-scripts
npm --prefix ui/src-admin-tab ci --ignore-scripts
npm run build:frontend
npm run build:installer
npm run build:unified-backend
npm run build:ui-runtime
npm test
```

TypeScript-Quellen bleiben maßgeblich. `ui/src-ts/runtime-executables` wird in die
ausgelieferten JavaScript-Dateien übersetzt. `src-admin` und `ui/src-admin-tab` enthalten
die Quellen der beiden eingebundenen React-Bereiche.

Nach einer Änderung müssen Build, passende Tests, SBOMs und Prüfbericht neu erstellt
und geprüft werden. Erst dann wird ausdrücklich mit `npm run seal:unified` versiegelt.
`npm run check:unified` und die npm-Publish-Hooks prüfen ohne stillen Neubau.
Ein Hashmanifest schützt gegen unbemerkte Änderungen; es ist keine Herstellersignatur.

## Installation und Veröffentlichung

[Installation und npm/Git](docs/unified/INSTALL_PUBLISH.md) enthält die vollständigen
Schritte. Den Teststand bewusst unter dem Kanal `next` veröffentlichen:

```sh
npm run check:unified
npm pack
npm publish --tag next
```

Diese Befehle wurden nicht gegen dein npm-Konto ausgeführt. Eigentümerrechte am
Paket müssen in deinem Konto bestehen. Git-Ziel ist
[NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin). Der unscoped Name
`iobroker.eos-admin` bedeutet bei npm öffentliche Downloadbarkeit; der eigene Code
bleibt proprietär und lizenzpflichtig. Ein privates Git-Repository ist möglich.

Bestehende Anlagen zuerst sichern. Keine parallelen Regelungsinstanzen aktivieren.
Die neue Laufzeit prüft deaktivierte/gestoppte Altinstanzen und sperrt Gerätewrites bei
Konflikten. Namespace-/Historienmigration erfordert eine bewusste Übernahme; ein
Paketupdate allein ist keine bestätigte Anlagenmigration. Siehe
[Inbetriebnahme](docs/unified/COMMISSIONING.md), [Architektur](docs/unified/ARCHITECTURE.md)
und [HTTPS-Eingang/Migrationsplanung](deploy/README.md).

## Sicherheit und Rechte

Eigene NexoWatt-Anteile stehen unter der [proprietären Lizenz](LICENSE-NEXOWATT.md).
Die Rechte und Copyright-Hinweise der enthaltenen Open-Source-Komponenten bleiben
erhalten, insbesondere der ioBroker-Admin-Basis. Siehe [Drittanbieterhinweise](THIRD-PARTY-NOTICES.md).
Sicherheitsanforderungen, STRIDE-Risiken, CRA-/DSGVO-Bezug und offene Nachweise sind in
[SECURITY_CRA.md](docs/unified/SECURITY_CRA.md) dokumentiert.

## Einstieg und Nachweise

[Update und History-Prüfung 9.0.5](START_HIER_9.0.5.md) ·
[Lizenzwiederherstellung seit 9.0.2](docs/unified/LICENSE_RECOVERY_9.0.2.md) ·
[Historischer Prüfbericht 9.0.2](docs/reports/unified-9.0.2/PRUEFBERICHT.md).
Der [Prüfbericht 9.0.5](docs/reports/unified-9.0.5/PRUEFBERICHT.md) ordnet die tatsächlich ausgeführten Prüfungen und offenen Punkte diesem Lieferstand zu.


## Archivierter Änderungsvermerk 8.0.0

Der älteste Eintrag wurde für die ioBroker-Grenze von höchstens 20 `common.news`-Versionen aus den Paketmetadaten hierher verschoben. Der Wortlaut bleibt erhalten:

```json
{
  "8.0.0": {
    "en": "Native migration to ioBroker Admin 8.3.5 with EOS security, roles, licensing and authenticated instance proxy.",
    "de": "Native Umstellung auf ioBroker Admin 8.3.5 mit EOS-Schutzmaßnahmen, Rollen, Lizenzen und authentifiziertem Instanzproxy."
  }
}
```
