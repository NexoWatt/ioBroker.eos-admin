# Entwicklungsabhängigkeiten und Grenzen des Scans

Für 9.0.38 weist der [Auditbericht der Laufzeitabhängigkeiten](../reports/unified-9.0.38/raw/npm-runtime-audit.json) zwei moderate Einträge aus der Kette ocpp-rpc/ajv aus.

Historischer Entwicklungsstand vom 22.11.2026 mit npm 11.19.1 und Node 24.22.3.

Die aus dem tatsächlich installierten Baum erzeugten npm-audit-Berichte liegen unter
`reports/unified/root/`. Laufzeitbaum: 0 bekannte Befunde; Admin-Frontend und Installer:
jeweils 0 bekannte Befunde. Der vollständige Backend-Entwicklungsbaum meldet 14 moderate
Paketbefunde (einschließlich transitiv betroffener Werkzeuge), keine hohen/kritischen.
Die Anzahl ist keine Zahl unabhängiger Schwachstellen.

Betroffen sind Entwicklungs-/Testwerkzeuge aus den Ketten esbuild/register, glob/minimatch
und typescript-eslint. Diese werden nicht als Backend-Laufzeitabhängigkeiten installiert.
Es wird kein Entwicklungsserver auf Kundengeräten gestartet. Das ist eine Eingrenzung des
Einsatzpfads, keine generelle Nichtbetroffenheit oder Schließung der Advisories. Ungeprüfte
Beiträge dürfen nicht mit Herstellergeheimnissen oder auf produktionsnahen Runnern bauen.
Vor Serienfreigabe bleiben kompatible Werkzeugupdates und Nachprüfung offen (NexoWatt).
Keine automatischen Major-Downgrades aus `npm audit fix --force` wurden ausgeführt.

Der bei der Zusammenführung hinzugekommene Express-4-Laufzeitzweig wurde nach realem
Auditbefund von 4.22.2 auf 4.22.3 aktualisiert (qs-Abhängigkeit). Die Express-5-Plattform
bleibt separat bestehen; die UI nutzt den expliziten Alias `express4`, damit ihre
bisherigen Routingregeln erhalten bleiben. Nachprüfung des Laufzeitbaums: 0 Befunde.

SBOMs trennen den Laufzeitbaum, vollständige Backend-Buildumgebung, Admin-Frontend und
Installer. Die Build-SBOM enthält auch Werkzeuge und Herkunft gebündelter Ressourcen;
sie behauptet nicht, jedes Entwicklungspaket sei zur Laufzeit vorhanden. Die Hashliste
bindet tatsächlich ausgelieferte Dateien. Ein Live-Geräteinventar ist nicht enthalten.
