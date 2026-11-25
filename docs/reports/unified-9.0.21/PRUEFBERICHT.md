# NexoWatt EOS 9.0.21 – Änderungs- und Prüfbericht

24.11.2026. Ausgangspunkt ist der unveränderte ausgelieferte Stand 9.0.20. Dieser Bericht gehört zum vollständigen Repository und npm-Paket 9.0.21, Kanal `next`. Es wurde keine Kundenanlage verändert und nichts auf npm veröffentlicht. Allgemeine Produktivfreigabe, reale Geräteabnahme und CRA-Konformität werden nicht aus Softwaretests abgeleitet.

## Bestätigte Fehler und Korrekturen

| Bereich | Bestätigter Fehler / Änderung | Nachweis |
| --- | --- | --- |
| MQTT, `921-DEV-01..04` | Alte QoS-Befehle nach Rechteentzug/Reconnect, unbestätigtes Stoppen, verspätete Mess-/Aliaswrites und unbegrenzte Eingangswarteschlangen korrigiert. Generation, begrenzte FIFO, Stopfrist und tatsächliche Callback-Lebensdauer werden berücksichtigt. | [Geräte](DEVICE_STABILITY_REVIEW.md), [Zweitprüfung](MQTT_ZWEITPRUEFUNG_EMS.md) |
| EMS, `921-EMS-001..002` | Fehlender NVP-Filterzustand wurde zu Null; nach Ausfall konnte ein alter Filter das Vorzeichen verfälschen. Überlappende Farm-Snapshots konnten nach Konfigurationswechsel/Stop alte Ergebnisse veröffentlichen. Beides gezielt korrigiert. | [EMS](EMS_STABILITAET.md) |
| Konfiguration, `921-CFG-01..03` | Eine abgelaufene HTTP-Antwort beendete die tatsächliche Speichermutation zu früh; Stop/Save überlappten; veraltete zweite Geräteformulare konnten neue Einstellungen ersetzen. Tatsächliche Transaktion und Formularrevision werden geprüft. | [Persistenz](PERSISTENZ_STABILITAET.md) |
| Tarif, `921-HIS-001..002` | Fehlender Erstwert umging den Backoff; externe Preisabfragen konnten den lokalen EMS-Tick blockieren. Ein begrenzter Hintergrundabruf mit Generation und Abbruch ersetzt das Warten im Regeltick. | [Tarif und Historie](HISTORY_TARIFF_STABILITY_REVIEW.md) |
| Upload, `921-SEC-001` | Unbegrenzte Warteschlange vor der eigentlichen Zulassungszählung. Zulassung und Deadline beginnen nun vor Dateisystemarbeit und bleiben bis zum tatsächlichen Abschluss gebunden. | [Sicherheit](SECURITY_STABILITY_REVIEW.md) |

Die Gegenproben trennen Fehler des unveränderten 9.0.20-Standes von zusätzlich während der Entwicklung gefundenen Fehlern des neuen Kundenupdaters. Kein Geräte-Register, bestehender Datenpunktname, Benutzerpasswort oder Anlagenlimit wurde für diese Korrekturen neu definiert. Historische Fehler und offene Aufgaben werden nicht durch eine neue Versionsnummer geschlossen.

## Repository-Veröffentlichung

Der tatsächliche Überkopiertest 9.0.20 → 9.0.21 fand 22 bisher nicht katalogisierte alte Admin-Builddateien. Ihre exakten Hashes wurden ausschließlich aus dem bytegeprüften alten Inhaltssiegel übernommen. Der bestehende Publishweg sichert und entfernt dadurch diese bekannten Altdateien; unbekannte oder geänderte Dateien bleiben geschützt. Kein automatisches Neuversiegeln und keine deaktivierten Publishhooks. [Herkunft und Regression](raw/release-overlay/obsolete-assets-920-added.json). Der erneute Test der vollständigen endgültigen Archive steht im Liefernachweis.

## Neue Kundenupdate-Funktion

Auf ausdrücklichen Nutzerwunsch dürfen auch angemeldete Kunden unter **Einstellungen → EOS-Updates** ein EOS-Update starten. Anzeige und stabile Versionsprüfung verwenden das fest definierte npm-Paket `iobroker.eos-admin` und dessen `latest`-Kanal. Eine Vorbereitung prüft Version, Node-Kompatibilität, Registry-Signatur, Paket-Hash, Archivstruktur und Paketidentität. Ein zeitlich begrenzter einmaliger Plan bindet den Start an die weiterhin gültige Sitzung und unveränderte Konfiguration.

Die eng begrenzten HTTP-Aktionen erteilen keine allgemeinen ioBroker-Administrator- oder `cmdExec`-Rechte. Ein getrennt laufender Worker mit demselben Dienstkonto verwendet feste CLI-Argumente, stoppt nur die eigene EOS-Instanz, bestätigt deren Stop, installiert ausschließlich das geprüfte lokale TGZ, prüft die installierten Dateien und bestätigt den Neustart. Ein unklarer Installationsausgang wird nicht automatisch wiederholt. Währenddessen sind EOS und die eingebettete EMS-Regelung zeitweise unterbrochen.

Vor dem Start wird die relevante EOS-Konfiguration verschlüsselt gesichert. Nach dem Wechsel müssen die bisherigen Werte erhalten sein; neu ergänzte Standardfelder sind zulässig. Die Sicherung ersetzt weder ein vollständiges ioBroker-/InfluxDB-Backup noch das zugehörige Systemgeheimnis. Standard-Admin und Backitup werden nicht umkonfiguriert.

Dieser erste Installationsweg ist auf Linux, einen nicht privilegierten Prozess, js-controller 7.2.5 und genau eine EOS-Instanz auf dem Host begrenzt. Das externe Abrufbudget beträgt zusammen fünf Sekunden; ein langsamer oder ausgefallener Abruf bricht vor der Installation ab. npm-Registry-Signatur/Hash sind keine unabhängige NexoWatt-Herstellersignatur. Die vom Controller verwendete npm-Abhängigkeitsauflösung und das gemeinsame Dienstkonto bleiben eigene Vertrauensgrenzen.

Einzelbelege: [Backend](CUSTOMER_UPDATE_BACKEND_REVIEW.md), [Worker](CUSTOMER_UPDATE_WORKER_REVIEW.md), [Worker-Zweitprüfung](CUSTOMER_WORKER_ZWEITPRUEFUNG.md), [HTTP und Konfiguration](UPDATE_HTTP_SNAPSHOT_PRUEFUNG.md), [Oberfläche](CUSTOMER_UPDATE_UI_REVIEW.md). Der tatsächliche Versionswechsel mit dem endgültigen TGZ wird zusätzlich im äußeren Liefernachweis gebunden, damit das Paket nicht nachträglich zur Aufnahme seines eigenen Installationsnachweises verändert wird.

## Abschließende Softwareprüfungen

<!-- FINAL_RESULTS_BEGIN -->
| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges npm test, Node 22.23.4 | 2118 Tests, 2116 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges npm test, Node 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Typprüfung und konfiguriertes Lint | Bestanden; neue Kundenupdate-Helper strikt typisiert, bestehende Altprofile gesondert dokumentiert |
| Builds | Admin, Installer, Backend, UI-Runtime und Module bestanden |
| Dokumentation / produktiver TS-Runtime-Abgleich | Bestanden |
| Sicherheitsgate | 227 Quellen, 3201 aktuelle Fundvorkommen; 2926 historisch offen, 275 einzeln geprüft; 0 zusätzliche blockierte Befunde |
| Geheimnisprüfung | Bestanden |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit Entwicklung | 14 moderate, 0 hohe, 0 kritische; kein pauschal befundfreier Gesamtstand |
| SBOM | Root, Runtime, Frontend, Installer und eingebettete UI neu erzeugt/geprüft; Frontend-/Installer-Zuordnung zu 9.0.21 korrigiert |

Die beiden ausgelassenen Fälle benötigen nginx beziehungsweise setfacl. Reale Hardware, Browsergeometrie/iOS, Dauerbetrieb und CRA-Konformitätsbewertung sind gesonderte Nachweise. Die vorliegenden Firmware-/Modbuswerte einer Kundenanlage wurden nicht verändert. Paket-/Publish- und tatsächliche Controllerprüfungen werden im äußeren Liefernachweis mit den endgültigen Artefakthashes belegt. Ein erster Gesamtlauf wurde durch korrekt ausgelöste Backup-Speicherplatzprüfung des vollen temporären Testlaufwerks abgebrochen; nach Entfernen abgeschlossener Wegwerf-Testkopien wurde die vollständige Suite erneut ausgeführt. Die Schutzprüfung wurde nicht gelockert.

<!-- FINAL_RESULTS_END -->

Rohlogs, Befundreproduktionen, Befehle, Laufzeitversionen und Hashbindungen liegen unter [raw/INDEX.json](raw/INDEX.json). Die jeweiligen Einzelberichte benennen Aussagekraft und Grenzen ihrer Prüfungen. Das UI-Sicherheitsgate wurde für die konkreten geänderten Fundstellen erneut bewertet; [Einzelbewertung](UI_SECURITY_GATE_REVIEW.md). Offene historische Hotspots bleiben sichtbar.

## Verbleibende Grenzen und Inbetriebnahme

- Keine Prüfung an realen FENECON-/SolaX-/SMA-Geräten, Wallboxen oder Hersteller-Firmware in dieser Umgebung. Der Fall leerer FENECON / geladener SolaX bleibt ein verpflichtender Anlagencheck von Auftrag, Quittierung, Geräte-Readback und wirklicher Entladung.
- Kein Dauerlauf-/RAM-/Regeltakt-Nachweis auf Raspberry Pi oder IPC. Netzwerk-/DB-/Reconnect-Fälle sind Software- und Protokolltests, keine Hardwarefreigabe.
- Chromium startet hier wegen einer gesperrten Socket-Funktion nicht. DOM-/HTTP-Tests ersetzen keine visuelle Desktop-/Mobilprüfung und keine echte iPhone-Installation.
- Die direkte InfluxDB-Verbindung bleibt erhalten; deren Warteschlange ist begrenzt und flüchtig. Zusätzliche Ausfallprüfungen lieferten keinen neuen bestätigten Influx-Produktfehler. Die konkrete Kunden-Datenbank wurde nicht angesprochen.
- Öffentliche Zertifikatsausstellung ohne Domain-/Vertrauenskonzept und zusätzliche Tarifanbieter sind weiterhin offen beziehungsweise aufgeschoben. Weitergehende automatische PV-/Wärme-/IO-Spezialrollen sind nicht pauschal vollständig umgesetzt; [bestehende Abdeckungsmatrix](../unified-9.0.20/ANFORDERUNGEN_UND_INBETRIEBNAHME.md).
- Normenausrichtung, technische Nachweise und rechtliche Konformität sind getrennt: [CRA-Nachweisstand und offene Herstelleraufgaben](CRA_NACHWEISSTAND.md). Kein Serienfreigabe- oder Zertifizierungsversprechen.

Für Installation, npm-Veröffentlichung aus der ZIP und Sollverhalten der Hausanlagenprüfung gilt [START_HIER_9.0.21.md](../../../START_HIER_9.0.21.md). Bestehende Instanzen aktualisieren, nicht löschen oder vorsorglich neu migrieren.
