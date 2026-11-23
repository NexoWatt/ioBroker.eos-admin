# NexoWatt EOS 9.0.11 – Veröffentlichungs- und Übergabeprüfung

Stand: 23.11.2026. Ausgangspunkt ist das gelieferte 9.0.10-Repository. Dies ist ein Integrations-Teststand, keine allgemeine Produktivfreigabe oder CRA-Konformitätserklärung.

## Gemeldeter npm-Fehler

Der konkrete Windows-Log stammt aus 9.0.9 und meldet vor Ausführung der Tests `RELEASE_CONTENT_CHANGED` für zahlreiche Admin-Bundles. Er belegt einen veränderten oder gemischten Dateibestand. Node.js 24.22.1 ist vom Paket zugelassen. Das Integritätsgate bleibt aktiv; es erhält eine lesende Diagnose zusätzlicher, fehlender und veränderter Dateien. Es gibt keine automatische Reparatur oder Neuversiegelung beim Veröffentlichen.

Der geprüfte Veröffentlichungsweg verwendet das fertig gebaute TGZ. npm 11.19.1 führt Repository-Lifecycle-Hooks bei Verzeichnisquellen aus; ein vorhandenes TGZ wird als Paketartefakt veröffentlicht. Diese Trennung verhindert, dass ein Windows-Upload nebenbei die Linux-/POSIX-Entwicklungstests ausführt oder einen abweichenden Quellordner packt. Trockenläufe werden ohne externe Veröffentlichung durchgeführt. Rechte, freie npm-Versionsnummer und Herstellerfreigabe werden dadurch nicht zugesagt. Offizielle Grundlage: https://docs.npmjs.com/cli/v11/commands/npm-publish/ und die lokal geprüfte npm 11.19.1-Implementierung.

## Korrigierte Übergabegrenzen

Bei der angefragten Live-Übernahme wurden konkrete Lifecycle-Lücken festgestellt: Die Altadapter konnten bereits gestoppt sein, während der Startmonitor erst nach erfolgreichem HTTPS-Listen aktiviert wurde. Ein TLS-/Port-/Initialisierungsfehler ließ die Übernahme dann unüberwacht. Zudem bedeutete das Vorhandensein eines Modulobjekts noch keinen abgeschlossenen Start. Ein früh aufgelöstes Stop-Promise konnte parallel zu später fertig werdenden Startversuchen fälschlich einen sicheren Rückfall signalisieren.

9.0.11 startet die Überwachung vor Initialisierung und HTTPS. Frühe Fehler melden sich beim Übergabekoordinator; neue Schreib-/Startfreigaben werden sofort gesperrt. Die Rückgabe der Zuständigkeit verlangt bestätigtes Ende laufender Starts und abschließendes Cleanup. Bei fehlender Bestätigung bleibt eine sichtbare Wiederherstellungsanforderung bestehen. Angenommene Controller-Schreiboperationen werden bis zu ihrem Promise-/Callback-Abschluss verfolgt. Die UI begrenzt offene Aufträge auf 1.024 und verwendet eine gemeinsame Stop-Grenze von 4 Sekunden; der Modulhost begrenzt auf 4.096 je Modul und 3,5 Sekunden. Es gibt keine neue Warteschlange oder Wiederholung. Ein fehlender Abschluss verhindert den Rückfall. `ROLLBACK_REQUIRED` bleibt über Neustarts hinweg sichtbar gesperrt. Ein persistierter `ROLLING_BACK`-Status darf nur mit vorher bestätigtem und gespeicherten Runtime-Stopp fortgesetzt werden. Diese Bestätigungen betreffen Controller-Aufträge und Laufzeiten, keine physische Aktorquittung.

Die Herkunft der alten Konfiguration wird unmittelbar vor ihrer Wiederaktivierung erneut geprüft. Der Zugriff auf die authentisierte Wiederherstellungsoberfläche bleibt von der Betriebsfreigabe getrennt.

Die Versionsallowlist, zentrale Lizenz, Rolle, Schutz privater Zugangsdaten, Vorprüfung aller Kandidaten und Erhalt der bisherigen Namespaces bleiben unverändert. Unbekannte Versionen werden nicht zur Beschleunigung der Live-Übernahme freigegeben. Die ursprünglichen Adapterobjekte und Daten werden nicht gelöscht.

## Prüfungen

Die folgenden Ergebnisse gehören zum Quell-/Buildstand 9.0.11:

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1168 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 24.22.3 | 1168 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Migrationsjournal, Startüberwachung, Rückfall | 39 gezielte Fälle auf beiden Node-Versionen; in Gesamtsuite enthalten |
| Modulhost, Schreibabschluss und Stop | 35 gezielte Fälle auf beiden Node-Versionen; in Gesamtsuite enthalten |
| Eingebettete UI, lokale/auswärtige Schreib-APIs, Start und Stop | 30 gezielte Fälle auf beiden Node-Versionen; in Gesamtsuite enthalten |
| Paketdiagnose | Unveränderte, zusätzliche, fehlende und veränderte Dateien sowie Versionswechsel geprüft; keine schreibende Reparatur |
| Typprüfung und Linting | Gesamte konfigurierte Typprüfung auf Node 22/24 sowie gezieltes ESLint bestanden; neue Stop-/Adapterhelfer mit strikten Typen |
| Builds | Admin-Frontend, Installer, Backend und finale UI-Runtime erfolgreich |
| Quellen-/Dokumentationsabgleich | 185 produktive Runtime-Dateien und 297 deutsche Modulbeschreibungen synchron |
| Geheimnissuche | 3.706 Dateien ohne Treffer innerhalb der unterstützten UI-Regeln; zusätzlich gezielte Prüfung im Release-Gate |
| Sicherheitsgate | 207 Quellen; 0 neue blockierte Befunde; historische Baseline unverändert |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Build-/Testumgebung | 14 moderate, 0 high/critical; Entwicklungsbestand weiter offen |
| SBOM | Root, Laufzeit, Admin-Frontend und Installer auf 9.0.11; Vendoring-Abgleich bestanden |

Die beiden ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`.
Die Lizenzkette Keygen 1.0.4 → lokaler HTTPS-Import → Aktivierung → verschlüsselte Speicherung → Neustart wurde mit der vorhandenen Keygen-Quelle ausgeführt. Testschlüssel und Tresore entstehen nur temporär und sind nicht Teil der Lieferung.

Ein erster Gesamtlauf deckte sechs nicht mehr passende Testaufbauten auf: Zwei aus dem echten Quellcode extrahierte Klassen benötigten die hinzugekommenen Recovery-/Cleanup-Helfer. Vier Schreibzählungen erfassten durch das geschlossene lokale API nun zusätzlich `eos-admin.0.info.connection` mit `ack:true`. Die korrigierten Fälle prüfen die exakten Statusschreibargumente und verweigern weiter jeden Aktorschreibzugriff. Die komplette Suite wurde danach erneut ausgeführt. Die Produktionssperren wurden dafür nicht gelockert.

Das Sicherheitsgate enthält 3199 aktuelle Scannerfundstellen: 2952 historische offene Hinweise und 247 einzeln bewertete Fundstellen. Das bedeutet keine Bereinigung sämtlicher Altbefunde. Die Bewertung der Änderung steht in `SECURITY_DELTA_REVIEW.md`; die Stop-Grenzen in `HOSTED_UI_LIFECYCLE.md`.

Die bereinigten Rohbelege und ihre Prüfsummen stehen unter `raw/INDEX.json`. Teilmengen der Gesamtsuite werden nicht nochmals als zusätzliche Gesamterfolge gezählt. Die abschließenden ZIP-/TGZ-Bytevergleiche, die frische Extraktion, das abgelehnte Altdatei-Overlay und der npm-11.19.1-Artefakt-Trockenlauf werden in `NexoWatt_EOS_9.0.11_Lieferpruefung.json` dem ausgelieferten Paket zugeordnet. Es wurde nichts auf npm oder auf der Kundenanlage veröffentlicht/installiert.

## Grenzen

Keine Kundenanlage, realen Aktoren oder Busse wurden in dieser Umgebung umgeschaltet. Gemeldet sind EOS Admin 8.0.2, NexoWatt UI 1.0.37 und NexoWatt Devices 0.5.176. Die tatsächlichen Instanzkonfigurationen, Anlagenlimits und Geräte wurden hier nicht eingelesen. Die letzten beiden Versionsstände sind in der Vorprüfungsliste enthalten; daraus folgt keine Bestätigung aller Laufzeitvoraussetzungen. Simulationen und lokale HTTP-/Lifecycle-Tests sind keine Geräteabnahme. Windows-PowerShell wurde nicht nativ ausgeführt; der Artefaktweg wurde mit der konkreten npm-Version geprüft. Keine Nullunterbrechungsgarantie.

Private Controller-Objekt-/Stateschreiboperationen besitzen keinen allgemeinen Abort. Ein Zeitlimit ist keine Rücknahme eines bereits übergebenen Auftrags. Unsichere Start-/Stoppzustände dürfen deshalb nicht als erfolgreich rückgängig gemacht ausgegeben werden. Bestehende historische Scannerhinweise und Entwicklungs-Advisories bleiben separat offen; die frühere SmartHome-Browser-/Touch-Abnahme ist weiterhin offen.

Die NexoWatt-Anteile bleiben proprietär. Öffentliche npm-Verteilung macht das Paket herunterladbar und ist keine Vertraulichkeitsmaßnahme. SBOMs, Lizenz-/Notice-Texte, Quellbindung, Prüfbelege und Archivprüfung werden dem konkreten Lieferstand zugeordnet.
