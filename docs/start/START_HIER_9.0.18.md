# NexoWatt EOS 9.0.18 – Geräte direkt im EMS einrichten

Die neue Auswahl **Geräte → Gerät bearbeiten → EMS-Zuordnung** verbindet unterstützte Geräte über ihre vorhandenen Alias-V1-Datenpunkte mit dem EMS und dem Energiefluss. Die vollständige Feldmatrix und Statushilfe stehen in [Geräte und EMS einrichten](../reports/unified-9.0.18/GERAETE_EMS_EINRICHTUNG.md).

## Ablauf

1. Geräteprofil und Verbindung wie bisher einrichten.
2. Bei Zählern **M0**, **M1**, **Erzeugung** oder **Verbrauch** wählen. Bei PV-Wechselrichtern das gewünschte Erzeugungsfeld auswählen; bei Speichern Einzelregelung oder Speicherfarm festlegen.
3. Im Gerätefenster speichern und danach **Speichern und übernehmen** wählen. Unterstützte Wallboxen erhalten automatisch einen zugeordneten Ladepunkt. Geräte-ID und bestehende Alias-Pfade bleiben maßgeblich.
4. Den angezeigten Zuordnungsstatus prüfen. Falls das EMS oder die Geräte-Datenpunkte noch starten, bleibt die Zuordnung sichtbar ausstehend und wird später erneut versucht. Das bereits gespeicherte Gerät nicht erneut anlegen.
5. Im App-Center Messrichtung, Limits und Betriebsfreigabe prüfen. Neue steuerbare Einträge bleiben zunächst deaktiviert; vorhandene Apps werden durch die Zuordnung nicht automatisch eingeschaltet.

Ein PV-Feld verwendet eine Quelle. Diese Version summiert nicht automatisch mehrere Wechselrichter zu einer Gruppe. Belegte Felder und konkurrierende Zuordnungen werden angezeigt und nicht überschrieben. M1-Messwerte sind von der noch nicht implementierten automatischen M1-Speicherregelung zu unterscheiden. Manuelle Fremdgeräte können weiter im App-Center zugeordnet werden.

## Einheitliche Aliase und Kundentarif

Gleiche unterstützte Gerätefunktionen verwenden gemeinsame Alias-V1-Namen und Einheiten. Herstellerregister werden im Geräteprofil übersetzt; vorhandene Alias-Pfade bleiben bestehen. Die Übersicht [Alias-V1-Vertrag](../reports/unified-9.0.18/ALIAS_V1_VERTRAG.md) beschreibt die zusätzlich geprüften Quellen einschließlich SolaX und FENECON sowie Funktionen, für die ein Profil keine Quelle besitzt. Ein optional fehlender Messwert wird nicht als erfundener Nullwert angelegt. Schreibvorgabe und echte Rückmeldung sind getrennt; eine bestätigte Schreibanforderung beweist keine tatsächliche Gerätewirkung.

Unter **Einstellungen → Tarif → Stromtarif verbinden** kann der Kunde den gemeinsamen Anlagentarif verwalten. Angeboten werden die vorhandenen festen Preisquellen und Anbieterprofile mit klarer Unterscheidung zwischen direkter Anbindung und Preisformel. Vorhandene Expertenanbindungen bleiben erhalten. Ein Anbieterwechsel aktiviert keine zusätzliche Regelung. Einrichtung und Grenzen stehen in [Kundentarif einrichten](../reports/unified-9.0.18/KUNDENTARIF_EINRICHTUNG.md).

## Update und gespeicherte Einstellungen

Die vorhandene EOS-Instanz aktualisieren; weder Instanz noch Objekte löschen und keine Bestandsübernahme allein wegen eines Updates erneut ausführen. Eine aktuelle Sicherung und die vorherige Version für einen Rückfall erhalten. Das Update ergänzt die neue Zuordnungslogik, überschreibt keine bestehenden nicht leeren manuellen Zuordnungen mit Standardwerten und löscht beim Start keine früher angelegten Ladepunkt-/Historienobjekte.

Die automatische Gerätezuordnung und manuelle App-Center-Speicherung verwenden denselben geschützten Konfigurationspfad. Ein bereits geöffneter veralteter App-Center-Tab kann deshalb mit einem Änderungskonflikt antworten. Seine Eingaben bleiben sichtbar: offene Änderungen zuerst sichern/notieren, den aktuellen Stand neu laden und abgleichen. Ein altes Formular darf neue Ladepunkte nicht wieder entfernen.

Gerätespeicherung und nachgelagerte EMS-Zuordnung sind zwei getrennte Schritte. „Geräte gespeichert“ bestätigt nicht automatisch eine abgeschlossene EMS-Zuordnung. Ein Fehlschlag oder eine fehlende Freigabe wird im Zuordnungsstatus angezeigt.

## Standard-Admin und Backitup

Die Trennung aus 9.0.17 bleibt erhalten: eigene EOS-Cookies und keine automatische Änderung fremder Rechte, Icons oder Updateeinstellungen. Standard-Admin auf 8081 und Standard-Backitup können weiterlaufen. Neue EOS-Instanzen verwenden HTTPS 8188. Die neue Zuordnung arbeitet mit den eigenen beziehungsweise kontrolliert übernommenen NexoWatt-Gerätepfaden; sie übernimmt keinen Standard-Backitup und beendet keinen Standard-Admin.

## Wie gewohnt mit npm veröffentlichen

Die vollständige Repo-ZIP entpacken. Ihr Adapterordner heißt `iobroker.eos-admin`. In PowerShell in den tatsächlich entpackten Ordner wechseln:

```powershell
cd "C:\Users\User\Desktop\ioBroker\iobroker.eos-admin"
node -p "require('./package.json').version"
npm publish
```

Die Versionsabfrage muss **9.0.18** ausgeben. Falls der eigene Ordner weiterhin `ioBroker.eos.admin` heißt, im `cd`-Befehl diesen Namen verwenden. Im übergeordneten Ordner ohne `package.json` schlägt die Veröffentlichung fehl.

Bekannte unveränderte alte Admin-/Installer-Dateien werden beim Überkopieren gesichert außerhalb des Repositorys abgelegt. Unbekannte oder veränderte Dateien werden nicht blind gelöscht. Die Integritätsprüfung bleibt aktiv; beim Publish erfolgt kein Neubau und keine automatische Neuversiegelung. Der Kanal bleibt `next`, die Lizenz proprietär und die zentrale EOS-Systemfreigabe unverändert. Ein öffentlich abrufbares Paket bedeutet keine freie Nutzungslizenz.

Der [Prüfbericht](../reports/unified-9.0.18/PRUEFBERICHT.md) trennt ausgeführte Softwaretests von offenen Browser-/Geräteprüfungen. Neue Inbetriebnahmen zuerst auf der Testanlage anhand frischer Messwerte und der vorgesehenen Grenzen abnehmen; die Lieferung enthält keine behauptete pauschale Hardware- oder CRA-Freigabe.
