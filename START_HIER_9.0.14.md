# NexoWatt EOS 9.0.14 – Bestandsübernahme fortsetzen

## Dein aktuell bestätigter Stand

Auf der Live-Anlage läuft laut Protokoll noch **9.0.12**. EOS wurde zunächst ohne gültigen Vertrauensanker gestartet; erst danach wurden Prüfschlüssel und Lizenz aktiviert. Die Übernahmeseite bestätigt weiterhin **„Systemfreigabe erforderlich“**. Das bedeutet: Die automatische Bestandsprüfung wurde in diesem Adapterlauf noch nicht ausgeführt. Es ist kein Nachweis, dass die alten Einstellungen fehlen.

Du hast bestätigt, dass **NexoWatt UI und NexoWatt Devices beide eingeschaltet sind**. Lass sie bis zur geprüften Übergabe in diesem Zustand und lösche weder die Instanzen noch deren Datenpunkte. Nicht vorsorglich abschalten, eine leere Gerätekonfiguration speichern oder das App-Center-Backup darüber wiederherstellen.

## Update und Prüfung der Übernahme

1. Vor dem Update eine vollständige, rücksicherbare Sicherung der bestehenden Anlage bereithalten. Dazu gehören die alten Konfigurationen, Objekte/States, Instanzdateien sowie der aktuelle Lizenzspeicher und die ursprünglichen Pakete.
2. In der zentralen EOS-Lizenzverwaltung prüfen, dass die Lizenz **jetzt gültig** ist. Bereits aktivierte Lizenz und Prüfschlüssel behalten; weder einen neuen Tresor noch eine weitere UI-Lizenz anlegen.
3. **Die vorhandene EOS-Admin-Instanz** auf 9.0.14 aktualisieren. Keine zweite EOS-Instanz anlegen. Alte UI und Devices bleiben vor der Übergabe eingeschaltet. Das Update allein verändert keine bewusst gespeicherten Port-/Bindungswerte.
4. Beim anschließenden Start von EOS muss im Protokoll **Version 9.0.14** stehen. Mit der nun bereits gültigen Lizenz führt EOS die vollständige Bestandsprüfung aus. Nur wenn diese erfolgreich ist, deaktiviert EOS die passenden Altinstanzen selbst, wartet auf deren bestätigtes Prozessende und startet die integrierten Module mit den übernommenen Einstellungen.
5. An der **aktuell funktionierenden EOS-Adresse** den Pfad **`/migration/`** öffnen. Beispiel: aus `https://<Gerät>:8081/` wird `https://<Gerät>:8081/migration/`. Der Pfad gehört zur EOS-Oberfläche, nicht automatisch zu einer getrennten ioBroker-Admin-Instanz. Als EOS-Administrator anmelden und „Status aktualisieren“ verwenden.

| Anzeige | Vorgehen |
| --- | --- |
| `TRANSFERRED` | Einstellungen übernommen; die Prüfung des Betriebsstarts läuft noch. |
| `COMMITTED` | Übernahme und Startbedingungen bestätigt. Anschließend die tatsächlichen Geräte und Funktionen prüfen. |
| `BLOCKED` | Angezeigten Grund prüfen. Keine Zielkonfiguration löschen und Altadapter nicht blind umschalten. |
| `EOS_MIGRATION_RESTART_REQUIRED` | Die Lizenz wurde erst nach diesem Start gültig. Die EOS-Instanz einmal regulär neu starten, damit die Bestandsprüfung vor dem Betrieb erfolgt. |
| `ROLLED_BACK` / `ROLLBACK_REQUIRED` | Rücknahmestatus prüfen; keine weitere Aktorinstanz manuell daneben aktivieren. Ein unbestätigter Stopp wird durch einen Neustart nicht bestätigt. |

Nach `COMMITTED` Geräteanzahl, ursprüngliche Datenpunkt-IDs, EMS-Zuordnungen, frische Messwerte, Geräteverbindungen und Regeltakte prüfen. Danach History, SmartHome und einen normalen Neustart kontrollieren. Die alten Instanzen bleiben deaktiviert installiert; ihre weiterverwendeten Objekte und Dateien nicht löschen. Ein grüner Migrationsstatus ersetzt diese Anlagenabnahme nicht.

## Welche Meldungen weiterhin eine Prüfung erfordern

- **`EOS_MIGRATION_DESTINATION_CONFIGURED`**: Für das Ziel wurde bereits eine Konfiguration gespeichert. EOS überschreibt sie nicht, auch wenn sie leer wirkt. Erst den tatsächlichen Quell- und Zielbestand klären.
- **`EOS_MIGRATION_DISABLED_UI_REVIEW`**: Die alte UI ist deaktiviert. EOS macht daraus nicht ohne Prüfung eine aktive Regelung. Die aktuell gemeldeten eingeschalteten Altinstanzen erfüllen diese konkrete Sperrbedingung nicht.
- **`EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE`**: ioBroker gibt bestimmte geschützte Altadapterfelder nicht an EOS heraus. Das betrifft insbesondere mögliche Zugangsdaten und Schlüssel eines Backup-Adapters. Die Übergabe dieser Daten muss gesondert geprüft werden; leere Ersatzwerte sind keine vollständige Migration.
- **`EOS_MODULE_IMPORT_REQUIRES_DISABLED`**: Der separate manuelle Geräteimport benötigt ein gespeichert deaktiviertes Ziel. Er ist eine Konfigurationskopie mit neuen Datenpunkt-Pfaden, keine Alternative zur automatischen Übernahme mit erhaltenen Original-IDs. Für deinen laufenden Bestand zuerst die automatische Übernahme prüfen.

Die zugelassenen Quellversionen sind UI 1.0.35–1.0.38, NexoWatt Devices 0.5.176, EEBus 0.3.0 und NexoWatt Backup 1.0.10. Versionsgleichheit allein bestätigt weder vollständige Zugangsdaten noch eindeutige Instanzen und konfliktfreie Zielkonfiguration. Der Standardadapter `backitup` ist keine automatisch zugelassene Quelle.

9.0.14 korrigiert außerdem die Altgeräteform mit leerem `devices` und gefülltem `devicesJson`, verhindert konkurrierendes Speichern während eines manuellen Imports und schützt bereits übernommene Original-Namespaces vor erneutem Import. Die EMS-Ansicht und eine gesperrte Wiederherstellung nennen nun den tatsächlichen Start-/Migrationsgrund statt ausschließlich `STOPPED` beziehungsweise `EOS_UI_STARTING`.

## Port 8188 gezielt einstellen

Das aktuelle Live-Protokoll nennt **8081 für EOS**. Diese gespeicherte Einstellung wird nicht ungefragt verschoben. Neue Instanzen verwenden HTTPS auf 8188; ein Update bestehender Instanzen übernimmt deren gespeicherten Port.

Für die gewünschte Trennung **EOS auf 8188 und ioBroker Admin auf 8081** zuerst den erreichbaren Verwaltungs-/SSH-Zugang und einen freien Port 8188 prüfen. Dann unter **Instanzen → eos-admin.0 → Konfiguration → Haupteinstellungen** den EOS-Port gezielt auf **8188** setzen. HTTPS, Anmeldung und die passenden bestehenden Zertifikate beibehalten; für die IPv4-Schnittstellen ist die IP-Bindung `0.0.0.0` vorgesehen. Nach dem Speichern die neue Adresse **`https://<Geräte-IP>:8188/`** prüfen. Browser-Lesezeichen und gegebenenfalls einen vorhandenen HTTPS-Proxy anschließend passend aktualisieren.

Die separate Instanz `admin.0` wird durch EOS weder automatisch aktiviert noch verschoben. Ihr tatsächlicher Zustand muss geprüft werden, bevor sie auf dem frei gewordenen Port 8081 bereitgestellt wird. Solange EOS selbst dort lauscht, dürfen nicht beide Dienste denselben Port verwenden. Eine Portänderung ist keine Lizenz- oder Migrationsreparatur und sollte als eigener kontrollierter Schritt erfolgen.

## Wie gewohnt aus dem Repository veröffentlichen

1. `NexoWatt_EOS_9.0.14_FULL_REPOSITORY.zip` entpacken.
2. Den **vollständigen Inhalt** des darin enthaltenen Ordners `iobroker.eos-admin` in deinen bisherigen Repository-Ordner kopieren und vorhandene Dateien ersetzen. Nicht nur einzelne Tools oder `package.json` kopieren.
3. PowerShell in diesem Ordner öffnen:

```powershell
cd C:\Users\User\Desktop\ioBroker\ioBroker.eos.admin
node -p "require('./package.json').version"
npm publish
```

Die Versionsanzeige muss **9.0.14** sein. Der vorbereitete Repository-Weg benötigt weder eine separate TGZ noch einen eigenen Build oder `npm install`. npm-Anmeldung und Veröffentlichungsrechte bleiben erforderlich. `npm publish --dry-run` prüft den lokalen Veröffentlichungsablauf, ohne hochzuladen; der konfigurierte Kanal bleibt `next`.

Die vorhandene Vorbereitung für kopierte Repositories bleibt erhalten: bytegenau bekannte alte Admin-Dateien werden vor der Entfernung in einen neuen Ordner neben dem Repository gesichert. Unbekannte Zusatzdateien oder geänderte aktuelle Dateien führen weiterhin zu einem Abbruch. Die Sicherheitsprüfung wird nicht abgeschaltet und ein gemischter Build nicht automatisch neu versiegelt.

NexoWatt-Anteile bleiben proprietär; Drittanbieterhinweise bleiben erhalten. Öffentliches Herunterladen des npm-Pakets erteilt keine freie Nutzungslizenz. Tatsächliche Prüfungen und offene Grenzen stehen im [Prüfbericht](docs/reports/unified-9.0.14/PRUEFBERICHT.md). Eine vollständige Kundenmigration oder allgemeine Produktivfreigabe ist damit nicht zugesichert.
