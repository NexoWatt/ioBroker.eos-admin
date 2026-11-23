# Änderungs- und Prüfvermerk: Bestandsübernahme 9.0.7

Datum: 23.11.2026. Ausgangspunkt: ausgeliefertes EOS 9.0.6 mit manuellem deaktiviertem Geräte-/EEBus-Import und neuen Datenpunktpfaden. Auftrag: Einstellungen und Funktionen bei Bestandsupdates erhalten, Devices-Sitzungsfehler korrigieren und eigenen Backup-Adapter aufnehmen.

## Umsetzung

- Separate verschlüsselte Konfigurationsobjekte vermeiden den Controller-Neustart beim Speichern. Die aktuelle UI-Konfiguration wird nach Speicherung aus dem aktuellen Speicherstand gelesen, statt aus der alten Instanzkonfiguration zurückgesetzt zu werden.
- Konservative automatische Vorprüfung, verschlüsseltes Phasenjournal, bestätigter alter Prozessstillstand und nachfolgende Startprüfung. Ursprüngliche Native-Werte, Datenpunkt-IDs, History-/Custom-Einstellungen und UI-Dateiverzeichnisse bleiben erhalten. Ein Zwischenabbruch oder unklarer Stop erzeugt keine zweite Freigabe für dieselben Geräte.
- Namespace-Fassaden erhalten alten UI-Namen/Instanz 0 auch bei EOS-Instanz 1/2. Lokale Schreib-APIs bleiben an die aktuelle Zuständigkeit gebunden; Installer-Credential-States behalten ihre enge Allowlist und bestätigte Admin-ACL. Die private EEBus-Bridge bleibt an den zuständigen EOS-Prozess gebunden.
- EEBus-Vorprüfung erhält geeignete SHIP-Identitäten und Pins; atomare Installation vollständiger Identitätsdateien ohne Überschreiben. Ungeprüfte Gegenstellen, nicht verfügbare geschützte Daten, unbekannte aktive Konfiguration und vorhandene abweichende Identität blockieren vor der Umschaltung.
- Backup verwendet die gemeinsame Lizenz mit Erhalt historisch signierter NWL2-Modulgrenzen. Backup-Credentials inklusive `pass`, OAuth-JSON und Mount-Zeichenfolgen werden redigiert; Passwörter in Mehrfachlisten werden anhand eindeutiger Endpoint-Identität statt der Zeilenposition erhalten. Benachrichtigungen sind auf die konfigurierte Zielinstanz/Empfänger und feste Nachrichtenbefehle begrenzt.
- Wiederanlauf prüft die fortbestehende geschützte Zielkonfiguration und die feste Quell-/Namespace-Zuordnung. Verlorene oder fremd zugeordnete Daten führen nicht zu einem Start mit Paketvorgaben. Spätere gespeicherte UI-/Moduländerungen bleiben zulässig. Eine deaktivierte alte UI wird vor jeder Übernahme zurückgestellt; die Abschlussprüfung verlangt aktuelle Schreibberechtigung und erneut bestätigte alte Prozessstillstände.
- Backup-Dateistreams werden auch bei verspätetem Öffnen nach Timeout oder Stop geschlossen; höchstens vier Downloads sind gleichzeitig zugelassen. Die Backup-Datenverzeichnis-Inventur gibt ausschließlich begrenzte Verzeichnispfade über eine feste, erneut autorisierte Lesefähigkeit heraus. Das ursprüngliche private UI-Verzeichnis wird ausschließlich als validierter Namespace an das Backupmodul übergeben.

## Durchgeführte Prüfungen

Umgebung: Linux, Node.js 24.22.3, OpenSSL, festgelegte Projektabhängigkeiten. Synthetische ioBroker-Objekt-/State-Schnittstellen und bei EEBus tatsächlich temporär erzeugte Schlüsselpaare. Keine Kundengeheimnisse als Fixtures.

Befehl und vollständiges Ergebnis: `migration-tests.log` in diesem Verzeichnis. 43 Tests bestanden, keine ausgelassen. Abgedeckt sind normaler Transfer, idempotenter Neustart, Quell-/Zielkonflikte, genaue Namespaces/Instanz 0, unveränderte History-Objekte, Verschlüsselung, fehlende geschützte Felder, Absturz während der Übergabe, Schreibfehler, erfolgreicher Rückfall, unklarer Transportstop, Quelländerung während der Vorprüfung, paralleler EOS-Prozess, begrenzter Datenbanklesevorgang, bekannte externe RPC-Ziele, UI-Credential-ACL, private Bridge, tatsächliche SHIP-Schlüssel-/Zertifikatprüfung, Pins und Dateirechte. Hinzu kommen fehlende/falsch zugeordnete Wiederanlaufziele, legitime spätere Einstellungsänderungen, fehlende aktuelle Schreibberechtigung, bewusst deaktivierte alte UI sowie Download- und Inventurgrenzen.

Zusätzlich bestanden: strikte TypeScript-Prüfung des nun typisierten HostedAdapter (`ui/tsconfig.hosted-adapter.json`), strikte EEBus-Modulprüfung, bestehende Devices-Hosting-Typprüfung sowie gezielte Backend-/UI-Security-Lintprüfungen. Der Gesamtbuild, die vollständigen Regressionen und Tests mit dem realen Controller werden getrennt im Gesamtprüfbericht aufgeführt. Die vorliegenden 43 Tests sind keine reale Kundenmigration und keine Hardwareabnahme.

Eine ergänzende Quellprüfung des Sitzungs-/Konfigurationsbereichs identifizierte und behob unter anderem gemischte gefilterte/ungefilterte Objektlesezugriffe, fehlende Fehler-Sperre, falsche Instanz-0-Auswertung, veraltete UI-Konfigurationsreads und das Umgehen der Schreibsperre durch die neue lokale Namespace-Abbildung. Die abschließende separate Prüfung dokumentiert ihre Wiederanlauf-, Ownership- und Deaktivierungsbefunde mit Regressionen in `MIGRATION_CODE_REVIEW.md` und `migration-independent-review-tests.log`. Diese Zusammenarbeit ist keine unabhängige Sicherheitszertifizierung.

## Offene Grenzen

Keine pauschale 1:1-Zusage für andere Quellversionen, mehrere Instanzen, andere Hosts, lokal geänderten Quellcode, nicht lesbare ProtectedNative-Werte, dynamische/externe RPC-Aufrufer oder nicht geprüfte Backup-Ziele. Vorprüfung und Diagnose legen diese Grenzen offen; erkannte Probleme lassen vorhandene Adapter vor der Umschaltung unverändert. Datenbankschreiben sind keine verteilte atomare Transaktion; Timeout ist kein Beleg für ein abgebrochenes Schreiben. Reale Prozess-/Transportwechsel können eine kurze Unterbrechung erzeugen. Geräte-, Last-, Wiederherstellungs- und Anlagenprüfungen sind vor Serienfreigabe erforderlich.

Betriebsanleitung und Rückfallgrenzen: `docs/unified/BESTANDSUEBERNAHME_9_0_7.md`. Keine vollständige CRA-/IEC-Konformität oder Produktionsfehlerfreiheit wird aus diesen Prüfungen abgeleitet.
