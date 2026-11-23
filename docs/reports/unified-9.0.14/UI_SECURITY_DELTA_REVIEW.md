# UI-Sicherheitsdelta 9.0.14

Stand: 23.11.2026. Geprüft wurde das tatsächliche UI-Quelldelta gegenüber dem ausgelieferten vollständigen Repository-ZIP 9.0.13, nicht der gesamte historische Produktcode neu auditiert.

## Umfang und neue Grenzen

Das Delta betrifft `main.ts` (lesende Startphasen und Diagnoseantworten), `www/ems-apps.ts` (Statusanzeige und Erklärung gesperrter Wiederherstellung), `lib/hosted-adapter.ts` (ausschließlich optionale Bridge-Typdeklaration) und den neuen strikt typisierten Helfer `lib/hosted-startup-status.ts` unter `ui/src-ts/runtime-executables/`.

Der Helfer erhält nur Host-Diagnosestatus und verändert weder Lizenz, Betriebsfreigabe, Konfiguration noch Aktorik. Phasen und Statusnamen kommen aus geschlossenen Mengen; Fehlercodes sind längen-/formatbegrenzt; höchstens 32 Blocker werden betrachtet und ausschließlich erlaubte Adapter-Instanznamen übernommen. Unbekannte Felder und freie Ausnahmetexte werden nicht ausgegeben. Ein Diagnoseproviderfehler erzeugt keine Freigabe.

Der vorhandene HTTP-Schreibschutz bleibt vor den Wiederherstellungsrouten wirksam. Authentifizierung und CSRF-Prüfung finden vorher statt. Erweiterte Diagnoseantworten werden nur bei `diagnostics.open` ausgegeben, die Bestandsübernahme-Verknüpfung zusätzlich nur bei administrativem `license.manage`. Die GET-EMS-Route behält ihren Installer-/App-Center-Zugriffsschutz. Der feste Link ist `/migration/`; URL-Daten aus dem Host werden nicht beliebig als Link übernommen. Die neue Textausgabe verwendet `textContent`, begrenzte Texte und fest vorgegebene Linkziele. Es entstehen keine automatischen Wiederherstellungsversuche oder zusätzlichen Engine-Starts.

Der neue Helfer wurde zusätzlich in die strikte Typmenge des bestehenden Security-Gates aufgenommen. Zwei negative Policytests bestätigen, dass `any` und `@ts-nocheck` dort auch durch einen passend konstruierten Befundbestand nicht als zulässig behandelt werden können. Regeln und historische Ausnahmen wurden nicht abgeschwächt.

## Nachprüfung vorhandener Einzelfundstellen

Die bestehenden neun Einzelfundstellen in `main.ts` und zwei in `hosted-adapter.ts` wurden im aktuellen Quelltext erneut gelesen. Das konkrete Delta verändert weder ihre Schlüsselherkunft noch ihre Schutzbedingungen. Regel, Fingerprint, Anzahl, ursprüngliche Begründung und ursprünglicher Beleg bleiben unverändert; nur Quellzeile, Ganzdatei-Codebindung und ergänzender Nachreviewvermerk werden aktualisiert.

| Bereich | Einzelbefunde | Nachgeprüfte Grenze |
| --- | ---: | --- |
| Mesh-Diagnosezähler | 1 | Zählziel `Object.create(null)`, keine Prototyp-Setter |
| Partner-App, Ressourcenstatus und Telemetrie | 4 | Validierte App-/Ressourcenherkunft, feste State-Aufrufer, Lizenz-/Aktivierungsprüfung und zeitlich geprüfte Verfügbarkeit |
| History-Abfrage und Binärsuche | 2 | Nur intern feste Querynamen; Zahlen-/Größenprüfung; ganzzahliger Arrayindex innerhalb normalisierter Daten |
| Dezimalgrammatik für Historywerte | 1 | Verankerte, disjunkte Grammatik; nicht endliche Werte verworfen |
| Geräteerkennungsfehler | 1 | Zugriff auf lokale Literalmap erst nach `Object.hasOwn`, fester Ersatzfehler |
| Hosted-Controller-Write-Wrapper | 2 | Geschlossene Methodenunions und feste Aufrufer; aktueller Schreibschutz und beobachteter Abschluss unverändert |

`ems-apps.ts` benötigt keine neue oder geänderte Einzel-Ausnahme. Der neue Statushelfer hat keine Scannerfundstellen. Es wurden keine neuen Fingerprints oder Befundbudgets aufgenommen.

## Scanner und Nachweise

Der Scan wurde mit dem im UI-Projekt installierten ESLint und dessen Konfiguration ausgeführt. Root- und UI-Projekt besitzen unterschiedliche Werkzeugversionen; deren Fingerprints dürfen nicht miteinander vermischt werden. Die historische Baseline ist bytegleich zum ausgelieferten ZIP 9.0.13; SHA-256: `c7fd7ea7039fdfff2c3f7e00abcbc00b76f4984c1f612edcf73bddaf62d8a3b9`.

Ergebnis des vollständigen UI-Regressionsscans: 209 Quellen, 3.222 aktuelle Scannerbefunde, davon 2.952 historische offene Hotspots und 270 bereits einzeln geprüfte Vorkommen; 0 neu blockierte Fundstellen, 108 frühere Befunde nicht mehr vorhanden. Das sind weiterhin offene Scannerhotspots, kein sauberer Gesamtscan und keine Aussage über vollständige ASVS- oder CRA-Konformität.

Der Policytest besteht mit 27 positiven/negativen Prüfungen. Strikte Typprüfung und typgestütztes Linting des neuen Helfers bestehen. Ausführbare Nachweise für tatsächliche HTTP-Routen, Rollen/CSRF, unveränderte Konfiguration bei gesperrter Wiederherstellung, sichere Textdarstellung und Stop-/Startreihenfolge sind in [UI_STARTUP_REVIEW.md](UI_STARTUP_REVIEW.md) dokumentiert. Keine zusätzliche Hardware- oder Browserabnahme wird durch diesen Nachreview behauptet.
