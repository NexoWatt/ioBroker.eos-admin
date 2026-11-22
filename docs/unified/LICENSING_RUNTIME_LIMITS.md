# Lizenzfreigabe und laufende Anlagenregelung

> Einordnung für 9.0.1: Der nachfolgende Text und seine Testzahlen stammen aus dem
> benannten Alpha-1-Stand. Sie werden durch das neue HTTPS-/Zugangsprofil nicht zu
> neuen 9.0.1-Prüfergebnissen. Aktuelle Zugangsvorgaben stehen in
> [INSTALL_PUBLISH.md](INSTALL_PUBLISH.md) und
> [ACCESS_RECOVERY_9.0.1.md](ACCESS_RECOVERY_9.0.1.md). Neue versionsgebundene
> Ergebnisse werden im 9.0.1-Abschlussbericht geführt. Die dokumentierten offenen
> Laufzeitgrenzen sind bis zu einer gesondert belegten Änderung zu berücksichtigen.

Stand: 22.11.2026 · NexoWatt EOS 9.0.0-alpha.1. Dieses Dokument beschreibt den implementierten Alpha-Vertrag und seine offenen Abnahmegrenzen. Es ist keine Geräte-, Produktions- oder Konformitätsfreigabe.

## Eine zentrale Lizenzinstanz

`src/lib/eosLicenseService.js` prüft die Signatur und Systembindung. Die eingebettete UI erhält über den Host ausschließlich einen öffentlichen Status; sie verifiziert und speichert keinen zweiten Lizenzcode. Ihre alten Konfigurationsfelder, Status-States oder lokalen Boolean-Werte sind keine Lizenzquelle. Der zentrale Status muss `valid === true` und `coreEnabled === true` enthalten. Signierte NWL2-Einschränkungen werden nicht allein durch die Edition erweitert.

NWL3 entspricht dem gelieferten Keygen 1.0.4: systemweite, unbefristete Home-/Pro-Lizenz mit Ed25519-Signatur. Home umfasst 3 Ladepunkte und 2 Speicher; Pro 50 Ladepunkte und 10 Speicher. Die zentral abgeleiteten Feature-Freigaben und die ursprüngliche NWL2-Unterstützung sind in [ISSUER_AND_STORAGE.md](../licensing/ISSUER_AND_STORAGE.md) beschrieben. Eine NWL2-Lizenz ausschließlich für `eos-admin` schaltet den eingebetteten EMS-/UI-Kern nicht frei; hierfür muss bei NWL2 `nexowatt-ui` enthalten sein.

Die einmalige Aktivierung erfolgt nach der ersten Anmeldung und gegebenenfalls erforderlichen Passwortänderung. Der Code wird verschlüsselt persistent abgelegt und beim Neustart erneut geprüft. Ein ungültiger Ersatzcode überschreibt eine gültige Aktivierung nicht. Weder Ausstellerwerkzeug noch private Signierschlüssel werden ausgeliefert. Der öffentliche Vertrauensanker wird administrativ außerhalb der Weboberfläche provisioniert.

## Öffentliche Bedienung und bestehende Regelung

| Situation | Verhalten |
| --- | --- |
| Start ohne aktuell gültige Kernfreigabe | Nur die eingebettete HTTP-Oberfläche für Anmeldung und Aktivierung startet. Keine vollständige EMS-/Geräteregelung wird initialisiert. |
| Aktivierung erfolgreich | Die betriebliche Initialisierung wird höchstens einmal begonnen. Der zentrale Lizenzstatus bleibt die einzige Freigabequelle. |
| Aktueller Status ungültig, abgelaufen, veraltet oder nicht verfügbar | HTTP-Bedienung, neue Konfigurationsänderungen und neue unbestätigte Bedien-States werden durch die aktuellen Zugriffs-/Lizenzprüfungen gesperrt. Die öffentliche Feature-Antwort meldet keine gültige Edition oder erweiterte Rechte. |
| Bereits initialisierte Regelung verliert den aktuellen Lizenzstatus | Die Laufzeit darf ihre letzte tatsächlich zentral validierte Freigabe mit unveränderten Grenzen im Arbeitsspeicher weiterverwenden. Die Snapshot-Daten und das Feature-Array sind eingefroren. Sie werden nicht aus UI-States rekonstruiert und gelten nicht als neue aktuelle Aktivierung. |
| Neustart nach Lizenzverlust | Die im Arbeitsspeicher gehaltene Fortsetzungsfreigabe wird nicht persistiert. Ohne erneut erfolgreich geprüfte Lizenz bleibt die Regelung beim Neustart gesperrt. |
| Verlust der alleinigen Schreibzuständigkeit | Die vier fremden State-Schreibschnittstellen der eingebetteten UI weisen weitere Schreibversuche zurück. Lizenzfortsetzung hebt die Zuständigkeitsprüfung nicht auf. |

Diese Trennung verhindert, dass ein vorübergehender Fehler der Lizenzprüfung allein die bereits eingerichtete Energiebegrenzung unkontrolliert abschaltet. Die Fortsetzung ist keine pauschale sicherheitstechnische Abnahme. Ein neu erfolgreich validierter Lizenzstand aktualisiert die Freigaben; physische Auswirkungen eines Downgrades müssen an der konkreten Anlage geprüft werden.

Der zentrale Dienst selbst liefert bei abgelaufener NWL2-Lizenz, Zeitrücksprung oder überalterter Auswertung keine gültige öffentliche Freigabe. Die besondere Fortsetzung im eingebetteten Regelungsteil ist davon bewusst getrennt. Bei NWL2 kann deshalb eine bereits laufende Regelung nach dem Lizenzablauf bis zum Neustart mit den zuvor validierten Grenzen weiterlaufen.

## Microgrid-Rollen

Die allgemeine Sichtbarkeit der Microgrid-App ersetzt keine Rollenfreigabe. `microgridSlave` erlaubt keinen Master. Die zentrale Freigabe für die konkrete Rolle wird beim Speichern geprüft; Paarungen benötigen eine aktuell gültige `microgridMaster`-Freigabe. Eine bestehende Rolle kann für die laufende Regelung nur ihre zuletzt validierte Rollenfreigabe weiterverwenden. Fehlt die zentrale Prüffunktion, gilt die Rolle als nicht freigegeben. Bereits vorhandene technische Sperren und Rückfallgrenzen bleiben erhalten.

## Signierte Feature-Teilmengen

Eine gültige Pro-Edition allein umgeht keine engeren NWL2-Featurefreigaben. Die API-Präfixe `/api/smarthome` und `/api/logic` prüfen eine aktuell gültige `smartHome`-Freigabe, `/api/ledger` und die Mesh-Abrechnungsverwaltung `wallet`; die Erstellung eines Mesh-Abrechnungsreports benötigt zusätzlich `billing`. SmartHome-Szenen, Timer, Logikuhren sowie NexoLogic-Initialisierung und -Ausgänge prüfen die tatsächlich validierte Laufzeitfreigabe. Eine niemals erteilte SmartHome-Freigabe kann nicht durch alte Konfiguration aktiviert werden. Bereits autorisierte Rücksetzimpulse und vorhandene Anlagenbegrenzungen werden dadurch nicht pauschal unterbrochen.

Das Operator-Wertkonto benötigt `wallet` und `billing`, das standortübergreifende Wertkonto `wallet` und `multisite`. Die öffentliche Feature-Antwort verwendet einen einzigen aktuellen Snapshot; ein zuvor gültiger, inzwischen gesperrter Stand wird nicht als Pro-Freigabe zurückgegeben.

## Tatsächlich ausgeführte Nachweise

Umgebung: Node.js 24.22.3, isolierte Linux-Entwicklungsumgebung, synthetische ioBroker-Objekte und Messwerte. Die folgenden Prüfungen wurden ausgeführt; sie sind keine Tests an einer Hausanlage, im Tailnet oder mit realen Ladepunkten/Speichern.

| Prüfung | Ergebnis |
| --- | --- |
| `node --test ui/test/unified/mesh-license.test.cjs` | 4 bestanden: Home darf keinen Master konfigurieren/paaren; expliziter Master funktioniert; laufende Fortsetzung erlaubt keine neue Konfiguration/Paarung; fehlende Autorität sperrt. |
| `node ui/scripts/verify-mesh-coordinator.cjs` | 20 Prüfgruppen bestanden, einschließlich 99 synthetischer Slaves über lokale HTTP-Kanäle, Replay-/Ausfall-/Neustartverhalten. |
| `node ui/scripts/verify-mesh-app-lifecycle.cjs` | 4 Prüfgruppen bestanden: Installation, Aktivierung, Migration und geschützter Rückfall. |
| `node ui/scripts/verify-mesh-transformer-accounting.cjs` | 14 Prüfgruppen bestanden. |
| `node ui/scripts/verify-admin-mesh-boundaries.cjs` | 7 Prüfgruppen bestanden. |
| `node ui/scripts/verify-cra-network.cjs` | 12 Prüfgruppen bestanden; der Name des Tests bezeichnet keine CRA-Konformitätsbewertung. |
| `node --test ui/test/unified/feature-grants.test.cjs` | 3 bestanden: reale HTTP-Routen sperren fehlende Featurefreigaben, erlaubte SmartHome-Schreib-/Ledger-Lesefälle funktionieren, autonome SmartHome-/NexoLogic-Pfade und spätere NexoLogic-Ausgänge beachten die tatsächlichen Freigaben. |
| `node ui/scripts/verify-nexologic-lifecycle-hardening.js` | Bestanden; explizite synthetische zentrale Freigabe im Testadapter. |
| `node ui/scripts/verify-actuator-c3-nexologic.js` | Bestanden; explizite synthetische zentrale Freigabe im Testadapter. |

Die bestehenden Mesh-Testfixtures erhalten ausdrücklich eine synthetische zentrale Freigabefunktion. Im Produkt gibt es dafür keinen permissiven Ersatz. Weitere zentrale Lizenztests und der ausgeführte Abgleich mit dem originalen Keygen stehen unter [reports/unified/licensing](../../reports/unified/licensing/PRUEFVERMERK.md). Die gesamte Host-/HTTP-/Sitzungsintegration wird separat im Gesamtprüfbericht ausgewiesen.

Rohbelege der Feature-Prüfungen: [feature-grants.tap](../../reports/unified/licensing/feature-grants.tap), [nexologic-lifecycle.log](../../reports/unified/licensing/nexologic-lifecycle.log), [nexologic-actuator.log](../../reports/unified/licensing/nexologic-actuator.log). Mesh-Prüfzusammenfassung mit Dateihashes: [mesh-license-review.json](../../reports/unified/licensing/mesh-license-review.json).

## Offene Abnahmegrenzen

**LIC-RUNTIME-01 — Trennung der laufenden Optimierung von Schutzfunktionen:** Der vorhandene Regelungsbestand unterscheidet noch nicht an jedem automatisierten Aufruf zuverlässig zwischen notwendiger Anlagenbegrenzung und einem neuen wirtschaftlichen/komfortbezogenen Auftrag. Bereits konfigurierte Automatik kann bei Lizenzverlust mit dem letzten validierten Snapshot weiterlaufen. Eine vollständige Sperre jedes neuen kommerziellen Jobs ist in diesem Alpha-Stand nicht nachgewiesen und wird nicht behauptet. Erforderlich sind gerätespezifische Zustandsverträge, gezielte Auftragsgrenzen und Tests für Ablauf, Widerruf und Wiederaufnahme. Verantwortlich: NexoWatt Produkt-/Regelungsentwicklung; vor Serienfreigabe zu entscheiden und abzunehmen.

**LIC-RUNTIME-02 — Gerätespezifisches Fehler- und Downgradeverhalten:** Reale Ladepunkte, Speicher, NVP-Begrenzungen, Microgrid-Ausfall und Wiederanlauf wurden in diesem Arbeitsschritt nicht an Hardware abgenommen. Eine rein lizenzbedingte pauschale Nullsetzung oder Abschaltung wurde deshalb nicht eingeführt. Unabhängige Geräte-/Anlagenschutzfunktionen bleiben erforderlich. Verantwortlich: NexoWatt Regelungsentwicklung und fachliche Anlagenabnahme; offen vor Produktiveinsatz.

**LIC-RUNTIME-03 — Vollständige Bestandstypisierung:** Die eingebettete UI enthält vorhandene nur teilweise typisierte Laufzeitquellen. Erfolgreiche Transpilierung, einzelne Tests und die Lizenzprüfung sind kein Nachweis vollständiger statischer Typ- oder Sicherheitsabdeckung des Bestands. Offene Typ-/Lintbefunde und ihr tatsächlicher Prüfumfang werden im Gesamtprüfbericht geführt.

Der zusätzliche historische `build-ts-runtime-mirrors.js`-Lauf wurde versucht und ist am manuell typisierten, nicht produktiven `main.js`-Parallelspiegel mit Exitcode 1 abgebrochen. Dieser alte Migrationsspiegel wurde nicht durch eine bloße Hashanpassung als aktuell ausgegeben. Die zwei hier betroffenen NexoLogic-Prüfskriptspiegel enthalten dieselbe fachliche Fixture-Änderung; ihre kommentarfrei transpilierten Inhalte wurden mit den Originalskripten verglichen, bevor die Herkunftshashes aktualisiert wurden. Der produktive Build aus `src-ts/runtime-executables` ist davon getrennt.

Die drei Punkte begrenzen die Freigabe dieses Entwicklungsstands. Eine allgemeine Produktionsfreigabe oder vollständige CRA-Konformität lässt sich daraus nicht ableiten.
