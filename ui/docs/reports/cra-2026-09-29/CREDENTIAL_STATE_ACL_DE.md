# Zugriffsschutz der geheimnistragenden Konfigurations-States

| Feld | Nachweis |
| --- | --- |
| Bezug | UI-CRA-SECRET-06; Providerzugangsdaten nur in geschützter Adapterkonfiguration, keine allgemein lesbaren Sicherungskopien |
| Stand | NexoWatt UI 1.0.22, Nachbesserung vom 29.09.2026; endgültiger Bezug über Release-Manifest |
| Betroffene Quelle | `src-ts/runtime-executables/main.ts` und fachlich mitgeführter Parallelspiegel |
| Befund | `installer.configJson` kann Tarifzugangsdaten enthalten; userdata-Sicherungen und die Simulationssicherung kopieren diese Konfiguration und hatten keinen spezifischen Admin-ACL-Schutz |
| Prüfkommando | `node scripts/verify-cra-credential-state.cjs --source`; am synchronisierten Runtime-Stand ohne `--source` |
| Ergebnis | 8 isolierte Adapter-/Objekt-/State-Prüfgruppen bestanden; `credential-state-source.json` und `credential-state-source.log` |
| Umgebung | Linux, Node.js 24.19.0; keine echten Kundenzugangsdaten oder ioBroker-Datenbank |

Der eng begrenzte Helfer `_nwProtectCredentialState` schützt `installer.configJson`, `simulation.backupConfigJson`, `0_userdata.0.nexowattVis.backupJson` und `0_userdata.0.nexowattVis.backupJsonPrev`. Lokale IDs werden aus dem tatsächlichen Adapter-Namespace gebildet, einschließlich anderer Instanznummern. Beliebige lokale oder fremde IDs werden abgewiesen.

Bei Erstellung und Bestandsmigration gelten Eigentümer `system.user.admin`, Eigentümergruppe `system.group.administrator`, Objekt-ACL `0x600`, State-ACL `0x600` und `common.read:false`. Der Helfer liest das Objekt nach dem Schreiben zurück und akzeptiert nur den bestätigten Schutz. Die Prüfung erfolgt auch vor jedem geheimnistragenden JSON-Write; die Backup-Rotation prüft zunächst beide Ziele. Fehler verhindern diesen Credential-Write und verwenden feste bereinigte Meldungen. Ein erfolglos geschütztes Simulationsbackup verhindert die nachfolgende Anwendung des Simulationspatches; reguläre EMS-Aktoren werden dadurch nicht abgeschaltet.

Die Prüfungen decken offene Altobjekte, erste Anlage, dynamische Instanznummern, bestätigtes ACL-Rücklesen, verweigerte oder wirkungslose ACL-Änderungen, Konfigurationserhalt, Backup-Rotation und den Simulations-Kopierpfad ab. Fehlerfixtures enthalten ausschließlich erkennbare Testmarkierungen; ihre Werte dürfen nicht in Logs erscheinen. JSON-Parsefehler der Installerkonfiguration werden ebenfalls ohne Quelltextausschnitt protokolliert.

Grenzen: ACL ist keine Verschlüsselung der ioBroker-Datenbank. Prozesse mit Controller-/Adminrechten und Serveradministratoren liegen innerhalb der Vertrauensgrenze; Backups und Betriebssystemzugriffe müssen geschützt bleiben. Die Tests belegen den Adaptervertrag und das ausfallsichere Verhindern ungeprüfter Writes mit Fixtures. Die tatsächliche Rechteauswertung im eingesetzten ioBroker-Controller und Raspberry-Pi-5-Betrieb bleibt eine Integrationsprüfung. Eine atomare Transaktion zwischen Objekt-ACL und Statewert existiert hier nicht; privilegierte parallele Objektmanipulation ist deshalb kein abgedecktes Angreifermodell. Keine Zertifizierung oder vollständige Normerfüllung wird aus diesen Tests abgeleitet.
