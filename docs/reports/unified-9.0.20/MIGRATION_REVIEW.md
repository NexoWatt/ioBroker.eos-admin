# Bestandsübernahme, Sitzung und Parallelbetrieb – 9.0.20

Stand: 24.11.2026. Unabhängige erneute Quellprüfung des ausgelieferten 9.0.19; Korrektur im Arbeitsstand 9.0.20. Keine Änderungen am Kundengerät, Standard-Admin oder Backitup.

## Befund EOS-920-MIG-01: Vorzeitiger Rückfall bei fortschreitendem Gerätestart

Priorität: hoch für automatische Bestandsübernahme. Der Gerätemodul-Host lässt in 9.0.19 bei bestätigten Metadatenschreibvorgängen einen Start bis höchstens 120 Sekunden zu; 10 Sekunden ohne Fortschritt brechen den Start ab. Der Migrationskoordinator begann jedoch schon vor Web-/Host-Initialisierung und brach unverändert nach 45 Sekunden ab. Damit konnte eine zulässig fortschreitende Initialisierung in `ROLLED_BACK` enden, bevor der neue Gerätehost bereit war. Die ursprünglichen Adapter wurden nach bestätigtem Stopp der neuen Runtime wieder aktiviert. Das ist eine Verfügbarkeitsregression der Übernahme, kein belegter Verlust gespeicherter Konfiguration.

Reproduktion: tatsächlichen Migrationskoordinator mit virtuellem monotonem Zeitgeber, kontrolliertem Gerätehost-Status und Datenbankfixture ausgeführt. Der neue Gerätehost berichtet laufend erfolgreich angelegte Objekte und wäre bei 60 Sekunden bereit. 9.0.19 stoppt ihn bei exakt 45 Sekunden und rollt zurück. Das neue Testmodul gegen den unveränderten alten Quellstand hat 6 bestandene und 3 absichtlich fehlgeschlagene Assertions. Der separate kleine Reproduzierer und die vollständigen Testlogs sind beigefügt.

Korrektur: Neue bestätigte Objektfortschritte eines tatsächlich `STARTING`/`pending` meldenden Devices-Moduls dürfen das 45-Sekunden-Fenster verlängern. Unveränderte Zähler, ungültige Zähler, Telemetrie und bloßes `READY` tun dies nicht. Gesamthöchstdauer: 165 Sekunden seit Beginn der Migrationsprüfung. Die eigene 10-/120-Sekunden-Begrenzung des Gerätehosts bleibt unverändert. Modulfehler, geordneter Stopp und bestehende Rückfall-/Stillstandsprüfungen bleiben wirksam. Ein fehlendes Web oder ein Start ohne Fortschritt behält die 45-Sekunden-Frist.

Änderungsdateien: `src/lib/eosLegacyMigration.js`, `test/eos-module-migration-start-budget.test.cjs`. Der Build der abgeleiteten Dateien erfolgt zentral mit dem vollständigen 9.0.20-Lieferstand.

## Ergebnisse

| Prüfung | Stand / Ergebnis |
| --- | --- |
| Neue Deadline-/Fortschritt-/Fehler-/Stopptests | 9.0.20, 9 bestanden |
| Neue und bestehende Migrations-/Rollbackprüfungen | Node 22.23.4 und 24.22.3 jeweils 52 bestanden, keine Fehler/Skips |
| Dieselben neuen Assertions gegen 9.0.19 | 6 bestanden, 3 fehlgeschlagen; erwarteter Vorher-Nachweis |
| ESLint, geänderter Migrationskoordinator | Bestanden, bestehendes `eslint.unified.config.mjs` |
| Cookie-Isolation, Sessiongrenze, zehn Minuten Inaktivität, tatsächliche HTTP-Wege, Modulspeicher, Kundeneinstellungserhalt | Unverändertes 9.0.19, Node 22 und 24 jeweils 75 bestanden |

Die Tests sind Software-/Datenbank-/Transportfixtures. Die monotone Zeit in den neuen Startbudgettests ist kontrolliert; es handelt sich nicht um eine Messung der Startzeit eines Kundengeräts. Keine angeschlossenen physischen Geräte, kein parallel gestarteter vollständiger Standard-Admin/Backitup und kein Produktionsbackup-Restore wurden ausgeführt. Der Node-24-Isolationslog wurde vollständig erhalten, jedoch ohne eigenen automatisch erfassten Startzeit-/Exit-Receipt; deshalb dafür keine nachträglich erfundene Metadatenbescheinigung. Die anderen Läufe enthalten Rohlog, tatsächlichen Befehl, Startzeit, Dauer, Rückgabecode und Loghash unter `raw/isolation/`.

## Erhaltungs- und Isolationsprüfung

- EOS liest und schreibt seine OAuth-Cookies über einen eigenen instanzbezogenen Namensraum. Normale Admin-Cookies werden nicht als EOS-Zugang angenommen, überschrieben oder gelöscht. Beide auf demselben Host/verschiedenen Ports bleiben im geprüften Cookiepfad getrennt.
- Die Zehn-Minuten-Frist ist serverseitig monoton. Abfragen, Messwerte und Token-Refresh verlängern sie nicht; bestätigte Bedienung verlängert nur die konkrete EOS-Loginfamilie. Abmeldung beendet keine lokale Anlagenregelung und keine fremde Browseranmeldung.
- Gerätekonfigurationen werden in eigenen verschlüsselten Konfigurationsobjekten mit Revisionsprüfung gespeichert. Ein Update/Start schreibt keine Paketdefaults über gültige gespeicherte Geräte-/EMS-Werte. Auch ausdrücklich leere Zuordnungen bleiben gültige Kundeneinstellungen.
- Standard-`backitup.*` ist keine automatische Migrationsquelle. Der tatsächliche Migrationsumfang bleibt auf bekannte NexoWatt-Altadapter beschränkt; Namensräume und Quellkonfigurationen werden bei zulässiger Übernahme erhalten.
- Globale ioBroker-ACLs, Standard-Admin-Port/Icons und bestehende Gruppen werden im betrachteten automatischen Pflegepfad nicht umgeschrieben. EOS darf weiterhin ausdrücklich autorisierte Verwaltungsaktionen über seine Adminoberfläche ausführen; das ist von einem automatischen Starteingriff zu unterscheiden.

Im erneut betrachteten Umfang wurde außer EOS-920-MIG-01 kein weiterer reproduzierter Isolations-/Einstellungserhaltungsfehler festgestellt. Das ist keine Garantie über alle Erweiterungen oder Geräte und keine allgemeine Produktions-/CRA-Freigabe.
