# Begrenzter Worker für ausdrücklich gestartete EOS-Updates

Stand: 24.11.2026. Gegenstand ist `src/lib/eosCustomerUpdateWorker.ts` im
Arbeitsstand 9.0.21. Dieser Bericht betrifft den lokalen Installationsablauf;
Registryprüfung, HTTP-/Sitzungsgrenze, verschlüsselte Konfigurationssicherung,
Bedienoberfläche und abschließende Gesamtfreigabe haben eigene Nachweise.
Es wird keine allgemeine CRA-Konformität oder vollständige Anlagenprüfung
bescheinigt.

## Entscheidung und Controllerbefund

Der ausdrücklich freigegebene Kundenweg besitzt eine eigene, enge
Updatefähigkeit. Er vergibt keine allgemeinen Administrator-, Shell- oder
`cmdExec`-Rechte. Der Worker akzeptiert ausschließlich einen zuvor vorbereiteten
privaten Auftrag für die eigene EOS-Instanz. Der Dienst prüft davor nochmals die
aktuelle Sitzung, CSRF, Erstpasswort, Hostbelegung und Konfiguration.

Die vorhandene Controllerimplementierung 7.2.5 wurde direkt eingesehen:

- `iobroker.js-controller/build/esm/main.js:1754` zerlegt `cmdExec`-Argumente
  über Leerzeichen. Shell-Quoting bietet dort keine verlässliche Argumentgrenze.
- `@iobroker/js-controller-cli/build/cjs/lib/setup.js:521` nimmt mit
  `url <Datei> eos-admin` ein lokales TGZ entgegen.
- `setup/setupInstall.js:1211` / `installAdapterFromUrl()` stoppt Instanzen nur
  unter Windows automatisch. Das im EOS-Paket vorhandene `stopBeforeUpdate`
  wird in diesem Linux-URL-Pfad nicht ausgewertet; der andere Paketpfad
  `downloadPacket()` berücksichtigt es dagegen.
- `_npmInstallWithCheck()` kann ohne Installationsverzeichnis zurückkehren;
  der URL-Aufrufer kann anschließend trotzdem mit Code 0 enden. Ein erfolgreicher
  Prozessabschluss ist deshalb kein Installationsnachweis.

Diese Befunde begründen den getrennten Worker: feste Argumentlisten ohne Shell,
bestätigtes Stoppen vor dem Austausch, anschließend Versions-/Inhaltsprüfung und
beobachteter Neustart. Eine größere, beliebig parametrierbare Ausführungsschnittstelle
wurde dafür nicht geschaffen.

## Grenzen und Ablauf

Unterstützt wird zunächst Linux unter einem normalen Dienstkonto mit geprüftem
Controller 7.2.5. Root, andere Plattformen/Controller, nicht kanonische oder
verlinkte Pfade, fremde Paketnamen, zusätzliche Instanzen im Auftrag,
Versionsrückschritte, andere Hauptversionen und instabile Versionsbezeichner
werden abgewiesen. Der Dienst sperrt zusätzlich weitere EOS-Instanzen desselben
Hosts, auch deaktivierte; diese Hostprüfung liegt nicht im Worker.

Das Auftragsverzeichnis ist kanonisch, gehört dem Dienstkonto und ist für andere
Benutzer/Gruppen gesperrt. Die festen Dateien heißen `job.json`, `release.tgz`,
`configuration.enc.json`, `worker.claim` und `result.json`. Ein exklusiv angelegter
Claim verhindert die erneute Ausführung desselben Auftrags. Der Worker wird vor
dem Austausch als eigenständige Datei in das Auftragsverzeichnis kopiert und
verwendet ausschließlich Node-Bordmittel.

Vor jeder Änderung prüft er Auftragsformat/-alter, alte Paketidentität,
Controlleridentität, SHA-512 des Archivs und SHA-256 der verschlüsselten Sicherung.
Das Paketverzeichnis und der Controller müssen kanonische Geschwister sein.
Der normale Installationsablauf ist:

1. Eigene zuvor aktivierte Instanz über den Controller stoppen; ihren tatsächlichen
   `alive`-Zustand als exakt `false` lesen.
2. Ausschließlich das vorher geprüfte lokale TGZ über den Controller installieren.
3. Paketname und Version in `package.json` und `io-package.json` sowie alle im
   geprüften Archivverzeichnis enthaltenen unveränderlichen Paketdateien prüfen.
4. Eigene Instanz starten und `alive` als exakt `true` beobachten.
5. Ergebnis atomar und mit Synchronisation von Datei und Verzeichnis festhalten.

`io-package.json` wird nach Installation auf Identität und Version geprüft, aber
nicht auf unveränderte Gesamtbytes: der Controller ergänzt dort regulär
Installationsmetadaten. Der Dienst prüft nach dem Neustart zusätzlich, ob die
gesicherte Konfiguration erhalten blieb. `alive=true` allein beweist weder eine
funktionsfähige EMS-Regelung noch eine physische Aktorreaktion.

## Fehler, Unterbrechung und Wiederherstellung

Der Worker protokolliert Phasen vor ihrer Ausführung. Sobald ein Installationsversuch
begonnen hat, führen Fehler oder Unterbrechung zum Ergebnis `uncertain`; es gibt
keinen automatischen zweiten Installationsversuch und keinen ungeprüften Start.
Timeout und SIGTERM/SIGINT beenden die isolierte Prozessgruppe einschließlich
üblicher Kindprozesse. Rohe Controllerausgabe, Geheimnisse und Dateipfade werden
nicht in das öffentlich verwendete Fehlerergebnis übernommen.

Ein enger Sonderfall erhält die Verfügbarkeit: Wurde bereits ein Stoppen versucht,
aber noch keine Installation aufgerufen, darf ausschließlich die zuvor aktivierte
eigene Instanz wieder gestartet werden. Dafür müssen alte Identität und ein vor
dem Stoppen aufgenommener Hashbestand unverändert sein. Dieser Bestand umfasst die
tatsächlich installierten EOS-Dateien unter `build`, `ui`, `modules`, `public`,
`adminWww`, `admin` sowie beide Paketdateien. Nicht vorhandene optionale Wurzeln
sind zulässig; `build/main.js` ist erforderlich. Das gesamte Repository-Siegel ist
dafür ungeeignet, weil es auch nicht ausgelieferte Quellen/Tests enthält.

Das Ergebnis bleibt in diesem Fall **fehlgeschlagen**, ergänzt um
`recovery: restored-old`. Geänderter alter Code, nicht bestätigter Wiederanlauf
oder eine weiter bestehende Unterbrechung verhindern diese Wiederherstellung.
Nach einem gestarteten Installationsversuch ist nötigenfalls ein administrativer
Wiederherstellungsweg erforderlich; ein unklarer Zustand wird nicht automatisch
erneut abgespielt.

## Ressourcen- und Vertrauensgrenzen

| Gegenstand | Grenze |
| --- | --- |
| Auftrags-JSON | 2 MiB, Lesen mit begrenztem Buffer |
| Komprimiertes Archiv | 64 MiB |
| Geprüfte Paketdateien | 8.192 Dateien, zusammen 256 MiB |
| Verschlüsselte Sicherung | 24 MiB plus 1 KiB Metadaten |
| Controllerausgabe | zusammen 2 MiB; Zustandsausgabe höchstens 1 KiB |
| Prozessbudget | insgesamt 10 Minuten; Installation höchstens 8 Minuten |
| Reguläre Stop-/Start-/Zustandsphasen | jeweils höchstens 30 Sekunden innerhalb des Gesamtbudgets |

Datei-Hashes werden gestreamt und begrenzt. Ein nicht abbrechbarer Betriebssystem-
Dateisystemaufruf, etwa `open`, Metadatenlesen oder `fsync`, kann trotzdem länger
hängen. Der Bericht behauptet deshalb keine harte Gesamtfrist für jeden denkbaren
OS-/Dateisystemfehler. Ein Stromausfall oder SIGKILL kann nur anhand des zuletzt
dauerhaft gespeicherten Zustands eingeordnet werden.

Die Hashprüfung bestätigt das geprüfte **EOS-Paket**, nicht den gesamten nachträglich
von npm installierten Abhängigkeitsbaum oder alle Wirkungen von Installationsskripten.
Der Controller und normale npm-Installationspfad bleiben vertraute Komponenten.
`node_modules` ist bewusst auch nicht Teil der alten Paketaufnahme; deren
Wiederherstellung ist ausschließlich vor einem Installationsversuch zulässig.
Alle ioBroker-Adapter teilen weiterhin ein Betriebssystemkonto. Diese Begrenzung
ist keine Sandbox gegen Code, der bereits unter demselben Konto läuft.
Registry-Signaturen sichern die Zuordnung zum Registry-Artefakt; sie ersetzen
keine gesonderte Herstellerfreigabe oder den Gesamtprozess für Lieferkettensicherheit.

## Nachweise und verbleibende Integration

`test/eos-customer-update-worker.test.cjs` prüft den tatsächlichen Worker mit
temporären Dateien und echten Node-Unterprozessen. Eine kontrollierte Test-CLI
simuliert Controllerantworten und Installationsfehler. Die zwölf Fälle bestehen
auf Node 22.23.4 und Node 24.22.3 ohne übersprungene Tests. Erfasst sind unter
anderem Scope-/Pfad-/Versionsverletzungen, geänderte Stagingdateien, exklusiver
Claim, autonome kopierte Workerdatei, falscher CLI-Erfolg, unbekannter Stopzustand,
Stop-/Start-Timeout, Abbruch mit Kindprozess, private Dateirechte und die enge
Wiederherstellung nach einem Fehler vor Installation. Eine verschlüsselte
Sicherung oberhalb der früheren 2-MiB-Grenze ist ausdrücklich abgedeckt.

Der unabhängige Zweitbericht `CUSTOMER_WORKER_ZWEITPRUEFUNG.md` ergänzt konkurrierende
Claims und weitere echte Prozess-/Ressourcenproben. Quellhashes und Rohbelege des
Worker-Laufs befinden sich unter `raw/customer-update-worker/`. Die strenge
TypeScript-Konfiguration `tsconfig.eos-customer-updates.json` und der fokussierte
ESLint-Lauf bestehen.

Diese kontrollierte CLI ist **kein** vollständiger Controller-/npm-Ende-zu-Ende-Test.
Die tatsächliche lokale TGZ-Installation mit Controller 7.2.5, das abschließend
gebaute Paket, Konfigurationserhalt und die gemeinsame HTTP-/Bedienintegration
müssen im übergeordneten Releasebericht getrennt nachgewiesen werden. Kein
Livegerät und keine physische Anlage wurden durch diese Workerprüfung verändert.
