# Historie-Einrichtung in EOS 9.0.22

Die bestehende geschützte Installer-Seite `#/history-setup` unterstützt neben dem
ioBroker-Historieadapter und InfluxDB 2 das lokale PostgreSQL-Profil. Die Route
bleibt auf Installer/Admin begrenzt; die Berechtigung und Konfigurationsrevision
werden weiterhin im Backend geprüft.

## Neuanlage und Bestand

- Laden der Seite übernimmt ausschließlich den gespeicherten Anbieter. Auch eine
  leere Konfiguration löst keine automatische Umstellung aus.
- Nur wenn das Backend `config.newInstallationAllowed: true` meldet, bietet die
  Seite „Neue Anlage mit PostgreSQL einrichten“ an. Das Backend ermittelt diese
  Freigabe aus dem tatsächlichen Installationsbestand; das Frontend leitet sie
  weder aus einer leeren Zeichenkette noch aus dem werkseitigen `influxdb.0` ab.
- Die Aktion verändert zunächst nur den Entwurf. Erst Speichern sendet die
  ausdrückliche Neuanlagenbestätigung zusammen mit der bekannten
  Konfigurationsrevision.
- Bestehende InfluxDB-Auswahl, Tokenbehandlung, CA-Verwaltung, Revision und
  Entwurferhalt bleiben erhalten. Es erfolgt keine Datenübernahme oder Löschung.
- Eine serverseitige Ablehnung wegen inzwischen vorhandener Historie bleibt
  maßgeblich. Die UI-Freigabe ersetzt diese Prüfung nicht.

## PostgreSQL-Vertrag

Öffentliche Konfiguration: `postgresql: {profile: 'local', provisioned: boolean}`.
`provisioned` bezeichnet das vorhandene geschützte Verbindungsprofil, nicht einen
bestandenen Schreibtest. Zugangswerte, Connection-Strings und private Schlüssel
werden weder als Eingabefelder angeboten noch aus Serverantworten übernommen.

Die erste ausdrückliche Auswahl sendet:

```json
{
  "provider": "postgresql",
  "postgresql": {"profile": "local"},
  "newInstallation": true
}
```

Bei bereits gespeichertem PostgreSQL entfällt `newInstallation`. Eine fehlende
Systemvoraussetzung wird als Einrichtungsbedarf angezeigt. Die Seite führt keinen
Root-Befehl aus und installiert keinen Systemdienst.

„Verbindung prüfen“ verwendet weiter `/api/installer/history/check` und bestätigt
nur Erreichbarkeit/Lesezugriff. Ein fremdes `writeVerified`-Flag in dieser Antwort
wird ignoriert. Tatsächliche Schreibzeitpunkte stammen aus dem Betriebsstatus.
Statuslesen aktualisiert Profilverfügbarkeit und Betriebswerte, ohne den
ungespeicherten Entwurf oder seine Ausgangsrevision zu ersetzen.

## Prüfungen

`test/eos-history-setup-ui.test.cjs` prüft die tatsächliche React-Komponente mit
einer kontrollierten Hook-/API-Gegenstelle sowie die reinen Vertragsfunktionen:
bestehende Influx-Abläufe, Neuanlagenbestätigung, Bestandsschutz, Geheimnisfilter,
fehlende Systemvoraussetzung, ausschließlich lesende Verbindungsprüfung,
Status-/Entwurfstrennung und Fehlertexte. Dies ersetzt keinen Browser- oder
Anlagentest. Build-/Typprüfnachweise werden mit dem gesamten Lieferstand geführt.

Zusätzlich wurde `test/eos-history-setup-browser-smoke.cjs` tatsächlich in einem
frischen Chromium ausgeführt: Desktop 1440 px und Smartphone 375 px, ausdrückliche
PostgreSQL-Auswahl, Prüfung/Speichern, Bestandsschutz für InfluxDB, Profil- und
TLS-Fehler, keine Geheimnisfelder und keine horizontalen Überläufe oder
Browserfehler. Die Testseite ist sichtbar als Simulation gekennzeichnet. Alle
Backendantworten sind simuliert; dieser Test belegt keine Datenbankverbindung oder
Installation auf einer Kundenanlage. Die Screenshots dienen nur interner Prüfung.

Reproduzierbarer Aufruf mit bereits bereitgestelltem Testbrowser:

```sh
EOS_CHROMIUM_PATH=/path/to/chromium node test/eos-history-setup-browser-smoke.cjs
```

Prüfergebnisse und Testbrowser-Herkunft:
`docs/reports/unified-9.0.22/raw/history-ui/`.
