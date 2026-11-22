# NexoWatt EOS 1.0.23 – Heizstab-Teststand

Stand: 08.10.2026, auf Basis des vollständigen Sicherheits-Prüfstands 1.0.22
vom 29.09.2026. **Dieser Stand ist nicht für den Produktivbetrieb freigegeben.**
Der Dateiname folgt der vorhandenen Struktur und bescheinigt keine Stable-
oder Konformitätsfreigabe. Historische Prüfberichte gelten nur für ihren
jeweiligen Quell- und Buildstand.

## Änderung

Im PV-Automatikbetrieb muss die Nachtsperre die Heizlast abschalten und darf
nicht durch eine noch aktive Rückmeldung oder einen fehlgeschlagenen AUS-Befehl
als vermeintliche Handfreigabe umgangen werden. Mindestlaufzeiten dürfen die
Nachtabschaltung nicht verzögern. Am Ende des Nachtfensters wird die Regelung
wieder freigegeben; Heizleistung entsteht erst bei passender PV-Freigabe und
wird schrittweise aufgebaut. Batterieentladung ist kein PV-Angebot.

Die PV-Freigabe wird zusätzlich auf Aktualität und Datentypen geprüft:
Veraltete Prognosen und Cachewerte dürfen keine belastbare Freigabe erzeugen,
fehlende Batteriewerte sind keine gemessene Nullentladung. Umgekehrt darf
eine fehlende Prognose ausreichend nachgewiesene aktuelle PV nicht allein
blockieren.

Die Bedienung muss Sollvorgabe und tatsächliche Gerätewirkung unterscheiden.
Explizite Manual-/Boost-Bedienung sowie Temperatur-, Anschluss- und Gerätegrenzen
bleiben gesondert wirksam. Der konkrete Änderungs- und Prüfstatus steht im
[Heizstab-Prüfvermerk](reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md).

## Update und eigener Anlagentest

Vor dem Update ioBroker und EOS-Konfiguration sichern und den vorherigen
Installationsstand bereithalten. Controller-Uhrzeit/Zeitzone und die tatsächlich
gespeicherten Nachtzeiten prüfen. Der ausdrücklich vorgesehene Eigentest wird
durch eine offene allgemeine Produktivfreigabe nicht technisch gesperrt.

Die [kurze Testanleitung](operations/HEIZSTAB_NACHT_PV_TEST_DE.md) führt durch
Nachtabschaltung, verzögerte Rückmeldung, Neustart, Morgenanlauf und Wolken-
beziehungsweise Batterieverhalten. Die reale Abschaltung ist über Messung und
Geräterückmeldung zu bestätigen; ein Sollwert allein reicht nicht.

Die aus 1.0.22 bekannte geschützte Lizenzumgebung bleibt erforderlich und darf
nicht mit dem öffentlichen Repository oder npm veröffentlicht werden. Dieser
fokussierte Stand enthält keine neue zentrale Offline-Lizenzarchitektur und
keine privaten Installationsdateien.

## Lieferung und Nachweisgrenze

Vorgesehen ist das vollständige Repository einschließlich Quellcode,
generierter Laufzeit, Dokumentation und den zum Paket gehörenden SBOM-/Hash-
Nachweisen. Die vorhandenen technischen Releaseprüfungen bleiben verbindlich;
beim npm-Upload dürfen Produktcode und Freigaben nicht automatisch neu versiegelt
werden. Tatsächliche Ergebnisse und offene Anlagentests stehen ausschließlich
im aktuellen Prüfvermerk und seinen Rohbelegen.

Die offenen Punkte im [Befundregister](security/BEFUNDREGISTER_DE.md) und der
[CRA-Akte](cra/README.md) bleiben bestehen. Ein Softwaretest oder erfolgreicher
Upload weist keine vollständige IEC-/CRA-Konformität und keine Abnahme einer
Feldanlage nach.
