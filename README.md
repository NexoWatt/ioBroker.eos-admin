# NexoWatt EOS

**Erste zusammengeführte Version: 9.0.0-alpha.1 · technisches Paket: `iobroker.eos-admin`**

NexoWatt EOS verbindet die Systemverwaltung aus EOS-Admin 8.0.2 mit Dashboard,
Installer und Energiemanagement aus NexoWatt UI 1.0.38. Eine ioBroker-Instanz betreibt
die gemeinsamen Module. Die bisherige UI wird im Zielbetrieb nicht zusätzlich gestartet.
Der technische Paketname bleibt für bestehende Integrationen erhalten.

Dies ist ein Integrations-Teststand. Der genaue Prüfumfang, verbleibende Grenzen und
ausstehende Anlagenabnahmen stehen im [Prüfbericht](docs/unified/PRUEFBERICHT.md).
Die Bereitstellung ist keine CRA-Konformitätserklärung oder allgemeine Produktivfreigabe.

## Anmeldung und einmalige Aktivierung

Der Geräteeinstieg ist `https://<Geräte-IP>/`. Die Anwendung läuft intern auf
`127.0.0.1:8188`; ein fest eingerichteter HTTPS-Eingang übernimmt Port 443.
Die Konfiguration `native.eosExternalOrigin` muss genau zur HTTPS-Adresse passen.
Zertifikat, Geräte-IP und Vertrauen auf den Endgeräten gehören zur Systeminstallation.
Ein npm-Upload richtet keine Betriebssystemdienste oder Zertifikate ein.

1. Mit dem eigenen ioBroker-Konto auf der NexoWatt-Anmeldeseite anmelden.
2. Einen erforderlichen Erstpasswortwechsel abschließen.
3. Als Administrator einmal die zentrale EOS-Lizenz aktivieren.
4. Dashboard, Installer und berechtigte Systemfunktionen über dieselbe Anmeldung nutzen.

**Anmeldegrenze dieser Alpha-Version:** Gemeinsame OAuth-Anmeldung und
Erstpasswortwechsel sind implementiert. Ein TOTP-Challenge- oder Passkey-Flow ist
noch nicht verfügbar. Konten mit gesetztem `common.externalAuthentication.totp`
(außer `null`/nicht vorhanden) sowie fehlerhaft aufgebautem `externalAuthentication`
werden sicher gesperrt; sie fallen nicht auf eine reine Passwortanmeldung zurück.
Für solche Konten ist dieser Alpha-Login nicht nutzbar. Die MFA-Konfiguration darf
nicht allein zum Umgehen dieser Sperre abgeschaltet werden.

**Abmeldung:** Der zentrale Logout widerruft in dieser Alpha-Version die globale
Sitzungsgeneration. Dadurch werden **alle gleichzeitig angemeldeten Nutzer** erneut
zur Anmeldung aufgefordert, einschließlich offener Socket-/SSE-Verbindungen.
Es handelt sich noch nicht um einen auf eine einzelne Sitzung begrenzten Logout.

Die signierte NWL3-Lizenz wird lokal geprüft und verschlüsselt gespeichert; normales
Abmelden oder Neustarten erfordert keine erneute Eingabe. Öffentliche Prüfschlüssel
werden vom Hersteller passend zum verwendeten Keygen gesichert bereitgestellt.
Private Signierschlüssel und der Keygen-Tresor sind kein Bestandteil dieses Repositorys.
NWL2 wird mit seinen signierten Bestandsrechten unterstützt; eine alte UI-Einzellizenz
ist keine automatische neue EOS-Systemlizenz. Details: [Lizenzbetrieb](docs/unified/LICENSING.md) und
[Grenzen der laufenden Regelung](docs/unified/LICENSING_RUNTIME_LIMITS.md).

## Entwicklung und Prüfpaket

Node.js: `>=22.23.4 <23 || >=24.22.1 <25`. Die hier ausgeführten Prüfungen benennen
ihre tatsächliche Laufzeit im Prüfbericht; nicht geprüfte Plattformen sind nicht freigegeben.

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
Paket und die Git-Zieladresse müssen in deinem Konto bestehen. Der unscoped Name
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
