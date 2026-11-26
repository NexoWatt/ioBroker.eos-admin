# NexoWatt EOS 9.0.3 – Update und HTTPS-Start

Dominique, **die bestehende EOS-Instanz und ihre gültige Lizenz bleiben erhalten**.
Für dieses Update weder die Lizenz löschen noch den öffentlichen Prüfschlüssel
erneut importieren. Der Adapter heißt weiterhin `iobroker.eos-admin`, die Instanz
`eos-admin.N`. 9.0.3 ist ein Teststand für den Kanal `next`.

## 1. Sichern und bestehende Instanz aktualisieren

Vor dem Update eine vollständige ioBroker-Sicherung anlegen, einschließlich
System-UUID, Instanzkonfiguration und `licensing/` im EOS-Datenverzeichnis.
**`storage.key` und `license.enc` gemeinsam** sowie importierte öffentliche
Prüfschlüssel und einen vorhandenen OS-Truststore sichern. Die Sicherung geschützt
außerhalb des Rechners aufbewahren.

Das bereitgestellte **9.0.3-npm-TGZ** über den vorgesehenen ioBroker-Installationsweg
übernehmen und die vorhandene Instanz aktualisieren. Eine neue Instanz oder
ioBroker-Neuinstallation ist für diese Korrektur nicht erforderlich. Konfiguration,
System-UUID, Prüfschlüssel und gültige Lizenz beibehalten. Keine alte
`nexowatt-ui`-Regelung parallel starten.

Für einen Git-Upload gehören die Repositorydateien direkt ins Hauptverzeichnis
von [NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin),
mit `package.json` auf dieser Ebene. Eine Installation aus Git/npm setzt den
tatsächlichen Upload des geprüften 9.0.3-Stands voraus; diese Anleitung bestätigt
keine Veröffentlichung.

## 2. Tatsächliche HTTPS-Bereitschaft prüfen

Nach dem Start im Adapterlog nach **`EOS_HTTPS_READY`** suchen. Beim Standardprofil
lautet die Meldung:

```text
EOS_HTTPS_READY: https server listening on 0.0.0.0:8188; login and system console available
```

`0.0.0.0` ist die Bindadresse, keine Browseradresse. Öffne
**`https://<tatsächliche-Geräte-IP>:8188/`** und prüfe die Anmeldung. Der bisherige
ioBroker-Admin, üblicherweise auf **8081**, bleibt erhalten. Zertifikatsvertrauen
und SAN müssen weiterhin zur verwendeten IP oder zum Namen passen.

**Der korrigierte Fehler:** 9.0.2 konnte bereits `LICENSE_VALID` und einen
Engine-Start melden, anschließend aber vor dem HTTPS-Listener auf eine
unbeantwortete History-Anfrage warten. 9.0.3 macht die geschützte Weboberfläche
unabhängig vom vollständigen operativen Start erreichbar. Die Bereitschaftsmeldung
bestätigt den Webstart, nicht die vollständige Anlagenabnahme. Ein operativer
Startfehler wird gesondert diagnostiziert.

Die eigene EOS-Instanz-/Übersichtskachel verwendet bei ihrem Standardlink den
aktuellen funktionierenden HTTPS-Browserzugang. Andere Instanzen oder bewusst
eingetragene externe Links werden dadurch nicht umgestellt.

## 3. Betriebsdiagnosen getrennt beurteilen

| Anzeige | Bedeutung für die Prüfung |
| --- | --- |
| `LICENSE_VALID` | Lizenz gültig; allein kein Nachweis eines offenen HTTPS-Ports. |
| Engine-Start oder `0` Ladepunkte | EMS- beziehungsweise Konfigurationsstatus. Falls Ladepunkte erwartet werden, deren Zuordnung prüfen; daraus folgt kein Listenerergebnis. |
| NVP `stale` / `split-stale` | Schutzdiagnose zu Messdaten/Aktualität. Ursache gesondert prüfen; die Meldung wird durch die Webkorrektur nicht unterdrückt. |
| PV-Forecast-Information | Status der Prognoseverarbeitung; allein kein Beleg für einen funktionierenden oder blockierten Webzugang. |
| `EOS_HISTORY_TIMEOUT` | Die betroffene History-Abfrage hat ihr begrenztes Budget ausgeschöpft. Vorhandene gültige CO₂-Werte behalten ihren bisherigen Zeitpunkt; fehlende Daten werden nicht als frische Nullwerte ausgegeben. |

MultiUse legt seine vier Steuerobjekte jetzt auch im deaktivierten Zustand an,
bevor der Manager den Deaktivierungsstatus schreibt. Das aktiviert MultiUse nicht
und setzt keine bestehenden Anlagenparameter zurück.

Neue Prüfergebnisse stehen ausschließlich im versionsgebundenen Abschlussbericht.
Dieser Startzettel nimmt keine Testerfolge oder CRA-Produktfreigabe vorweg.
Weiterführend: [Prüfplan](../unified/COMMISSIONING.md),
[Installation](../unified/INSTALL_PUBLISH.md) und nur bei tatsächlich fehlendem
Lizenz-/Schlüsselbestand [Lizenzwiederherstellung](../unified/LICENSE_RECOVERY_9.0.2.md).
Die NexoWatt-Lizenz bleibt proprietär.
