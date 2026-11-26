# NexoWatt EOS 9.0.19 – Geräte, EMS und Energiefluss zusammen übernehmen

Diese Version korrigiert die Übergabe aus dem Gerätebereich, die Aktualität unveränderter Messwerte und den Energiefluss. Die vorhandene EOS-Instanz aktualisieren; gespeicherte Geräte und EMS-Einträge nicht löschen und die Bestandsübernahme nicht erneut ausführen.

## SMA, FENECON und SolaX einrichten

1. Unter **Geräte** den SMA-Zähler bearbeiten und **Regelpunkt NVP · Netzanschlusszähler → M0** wählen.
2. Bei FENECON und SolaX **Speicherfarm-Mitglied** wählen. **Im EMS verwenden und aktivieren** auswählen; fehlende reale Lade-/Entladegrenzen und AC-/DC-Anbindung direkt dort ergänzen. Bereits gültige vorhandene EMS-Grenzen bleiben erhalten.
3. Gerätefenster speichern und oben einmal **Speichern und übernehmen** wählen.
4. Der Gerätestatus zeigt die automatische Übernahme. Die benötigten Basis-Apps und Speicherzeilen werden eingerichtet; bekannte Alias-Datenpunkte müssen nicht erneut im App-Center ausgewählt werden.

Das gilt auch für bereits in 9.0.18 gespeicherte Rollen: Das erste ausdrückliche Übernehmen beauftragt die Einrichtung. Spätere Umbenennungen, Neustarts und Updates aktivieren eine bewusst deaktivierte App nicht erneut. Für eine ausdrückliche erneute Freigabe EMS-Verwendung im Gerätefenster aus- und wieder einschalten und übernehmen.

**EMS eingerichtet** bedeutet, dass die Konfiguration und App-Freigabe übernommen wurden. Tatsächliche Regelung setzt weiterhin verfügbare Messwerte, passende Grenzen, Lizenz und bestehende Schutzfreigaben voraus. Fehlt etwas, nennt der Status die konkrete offene Einrichtung; ein bereits gespeichertes Gerät nicht erneut anlegen.

## Was sich ändert

- Der gemeinsame Gerätestart berücksichtigt erfolgreiche Objektbereitstellung statt pauschal nach zehn Sekunden abzubrechen. Zehn Sekunden ohne Fortschritt oder spätestens 120 Sekunden insgesamt bleiben feste Abbruchgrenzen; Stoppen und Lizenz-/Betriebsfreigaben behalten ihre Schutzwirkung.
- SMA-Speedwire baut seinen Empfänger nach Socket-/Bindfehlern wieder auf. Gemeinsame Empfänger und gespeicherte Verbindungsdaten bleiben erhalten; neue Zeitstempel entstehen nur durch empfangene Telegramme.
- Die Gerätestatuszeile wird während der geöffneten Seite regelmäßig aktualisiert. Startfreigabe, laufendes Modul und bestätigte Verbindung werden getrennt angezeigt; gespeicherte Eingaben bleiben davon unberührt.
- Unterstützte Geräte werden über geprüfte Alias-V1-Fähigkeiten zugeordnet. Eine eindeutig zugehörige bestehende FENECON-Zeile wird übernommen; andere manuelle Zuordnungen und Grenzen bleiben erhalten.
- Neue tatsächliche Messungen bleiben auch bei unverändertem Zahlenwert frisch. Ein ausgefallenes Gerät oder ein alter Telegramm-Cache wird nicht künstlich frisch gehalten.
- Die EMS-Konfiguration wechselt erst nach Abschluss alter Regelarbeit. Ein nicht abgeschlossener alter Zyklus verhindert einen überlappenden neuen Regelbetrieb.
- FENECON-Batteriefluss und ESS-Konverter-Rückmeldung sind getrennt; DC-PV wird nicht als Batterieentladung gezählt.
- Ladeleistungsanzeigen verwenden dieselbe Datenquelle. Boolesche Ein/Aus-Zustände werden nicht als Watt-Messwert akzeptiert.
- Die Farm-Gesamtübersicht zeigt Kapazität, arithmetischen Ø SoC, Netto-Batterieleistung, getrennte Lade-/Entladesummen und PV-Leistung. Aktuelle Mitglieder und unvollständige Messabdeckung sind sichtbar; im App-Center führt „Farm-Gesamtübersicht öffnen“ direkt dorthin.
- Fehlende Ladepunktobjekte `evcs.N.dataFresh` und `evcs.N.chargingState` werden beim Start und bei neuen Ladepunkten angelegt; vorhandene Messwerte bleiben erhalten.
- Tibber-Preise werden als tatsächliche Viertelstundenintervalle angezeigt. Die Preisansicht bleibt von der gezielten Aktivierung einer Tarifregelung getrennt; fehlende Preise werden nicht als 0 € ausgewertet. Bestehende Zugangsdaten bleiben gespeichert. Nach dem Update die Webseite neu laden.
- Der Gerätebereich gliedert Aufgabe, Anlagenbereich und Betriebsgrenzen. Profilfunktionen und optionale Hinweise sind kompakt dargestellt.

Die [vollständige Einrichtungshilfe](../reports/unified-9.0.19/GERAETE_EMS_EINRICHTUNG.md) beschreibt Zähler, Speicher, Ladepunkte und Energiefluss. Die [Abdeckungsmatrix](../reports/unified-9.0.19/EMS_KATEGORIEN_ABDECKUNG.md) nennt unterstützte automatische Zuordnungen und noch nicht automatisch eingerichtete PV-/Wärme-/IO-Spezialfunktionen. Kategoriezugehörigkeit allein schaltet keine nicht vorhandene Gerätefähigkeit frei. Zusätzliche Betriebsstrategien bleiben gezielte App-Einstellungen; sie dürfen nicht gleichzeitig unkoordiniert auf einen Aktor schreiben.

## Update, Abnahme und Rückfall

Vor dem Update die vorhandene Konfiguration sichern und den bisherigen Lieferstand behalten. Die Instanz aktualisieren und neu starten, nicht deinstallieren. Danach vorhandene Geräte, Anlagenlimits und Zuordnungen prüfen. Auf der Testanlage die genannten Geräte einmal gemeinsam übernehmen und kontrollieren: zwei getrennte Farmmitglieder, SMA als M0, frische Messwerte, plausibles Vorzeichen, Batteriefluss ohne doppelt gezählte PV sowie unveränderte Kundenlimits. Kommunikationsausfall und anschließende Wiederkehr unter kontrollierten Bedingungen prüfen.

EOS verwendet weiterhin seine eigene Weboberfläche und Sitzung. Standard-ioBroker-Admin auf 8081 und Standard-Backitup bleiben eigenständig; neue EOS-Instanzen verwenden HTTPS 8188. Das Update ersetzt keine fremden Icons, Rechte oder Konfigurationen.

Bei einem Rückfall nur einen bekannten geprüften Paketstand mit der passenden gesicherten Konfiguration einsetzen. Nicht parallel zwei Schreibzuständigkeiten für dieselben Geräte aktivieren. Eine Wiederherstellung betrifft die ausdrücklich gewählte Sicherung; sie ist kein notwendiger Bestandteil dieses Updates.

## Wie gewohnt aus der Repo-ZIP veröffentlichen

Die Repo-ZIP enthält den vollständigen Ordner `iobroker.eos-admin`. PowerShell im tatsächlich entpackten Adapterordner öffnen:

```powershell
node -p "require('./package.json').version"
npm publish
```

Die Versionsabfrage muss **9.0.19** ausgeben. Die Veröffentlichung im darüberliegenden Ordner ohne `package.json` funktioniert nicht. Bekannte unveränderte alte Admin-/Installer-Artefakte werden beim Überkopieren geschützt ausgelagert; eigene unbekannte Änderungen werden nicht blind gelöscht. Prüfungen bleiben aktiv. Der Kanal bleibt `next`, die Lizenz proprietär und die zentrale NWL3-Freigabe unverändert.

[Prüfbericht](../reports/unified-9.0.19/PRUEFBERICHT.md) und separater Liefernachweis unterscheiden Softwaretests, Paketprüfungen und offene reale Geräte-/Browserprüfungen. Diese Lieferung ist keine pauschale Produktions- oder CRA-Freigabe.
