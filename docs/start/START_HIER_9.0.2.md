# NexoWatt EOS 9.0.2 – Update und einmalige Aktivierung

Dominique, der Adapter bleibt **`iobroker.eos-admin`**, die bestehende Instanz
**`eos-admin.N`**. Der bisherige ioBroker-Admin auf **8081** bleibt erhalten;
EOS erreichst du direkt unter **`https://<Geräte-IP>:8188/`**.
9.0.2 ist ein Teststand für den npm-Kanal `next`.

## 1. Bestand sichern und Paket aktualisieren

Vor dem Update ioBroker sichern, einschließlich `system.meta.uuid` und des
gesamten Ordners `licensing/` im Datenverzeichnis der EOS-Instanz.
**`storage.key` und `license.enc` gehören zusammen**. Vorhandene importierte
öffentliche Schlüssel und einen OS-Truststore unter `/etc/nexowatt-eos/`
beziehungsweise dem bisherigen `/etc/nexowatt/` ebenfalls sichern.
Die Sicherung geschützt außerhalb des Rechners aufbewahren.

Für das Update das bereitgestellte npm-TGZ für **9.0.2** über den vorgesehenen
ioBroker-Installationsweg verwenden und die bestehende EOS-Instanz behalten.
Keinen zweiten Adapter als Ersatz-Lizenzdienst anlegen.

Für Git gehören die Dateien aus dem Repository-ZIP direkt ins Hauptverzeichnis,
sodass dort `package.json` liegt. Das Repository heißt **`ioBroker.eos-admin`**
(Punkt nach `ioBroker`, Bindestrich zwischen `eos` und `admin`), Ziel:
[NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin).
Eine Installation aus Git oder npm setzt voraus, dass genau dieser geprüfte
9.0.2-Stand dort hochgeladen wurde; diese Anleitung bestätigt keinen Upload.
Die alte `nexowatt-ui`-Regelung darf nicht parallel weiterregeln.

## 2. Anmelden und öffentlichen Schlüssel übernehmen

Bei einer frischen ioBroker-Installation zuerst im bisherigen Admin auf 8081
das persönliche Administratorkonto und TLS einrichten. Dann EOS über HTTPS auf
8188 öffnen, anmelden und einen erforderlichen Erstpasswortwechsel abschließen.

Im Lizenzbereich den Reiter **„Öffentliche Prüfschlüssel & Wiederherstellung“**
öffnen. Die **öffentliche** JSON-Datei aus Keygen 1.0.4 auswählen, zum Beispiel
`license-trust (1).json`, und **„Öffentliche Schlüssel prüfen und importieren“**
anklicken. Der Adapter nimmt nur den bereits freigegebenen Herstellerschlüssel
oder einen gültig per OS autorisierten Schlüssel an. **Keinen privaten Tresor,
keine Passphrase und keinen privaten Signierschlüssel hochladen.**

Danach **„Vertrauen und Lizenz erneut prüfen“** verwenden. Ist die vorhandene
Lizenz wieder gültig, ist keine neue Eingabe nötig. Sonst im Reiter **„Lizenz“**
den NWL3-Code für die angezeigte System-UUID einmalig eintragen. Systembereich
und UI nutzen anschließend dieselbe gespeicherte Freigabe, auch nach Neustarts.
Falls die Oberfläche einen vorhandenen unsicheren OS-Truststore meldet, muss
dessen Einrichtung gezielt korrigiert werden; der Import umgeht diese Sperre nicht.
Für den normalen freigegebenen Dateiimport ist kein neuer Root-Helfer nötig.

## 3. Tresor und Geräteidentität behalten

Beim Wechsel des **Keygen-PCs** das vorhandene verschlüsselte Tresor-Backup und
die zugehörige Passphrase behalten und im Keygen wiederherstellen. Dadurch bleibt
der Aussteller gleich; bestehende Kundenlizenzen müssen nicht neu ausgestellt
werden. Die öffentliche Datei allein ersetzt keinen verlorenen Tresor.

Erhält das **EOS-Gerät** nach Wechsel oder Neuinstallation eine neue System-UUID,
ist dagegen eine Lizenz für diese neue UUID erforderlich. Lizenzdateien oder
öffentliche Schlüssel machen eine fremde UUID nicht gültig.

## 4. HTTPS und optionaler Gerätename

EOS verwendet weiter TLS und Anmeldung auf 8188 mit
`defaultPublic`/`defaultPrivate` und leerer `eosExternalOrigin`. Zertifikats-SAN
und Vertrauen müssen zur tatsächlich aufgerufenen IP beziehungsweise zum Namen
passen. Das normale erste ioBroker-Setup erzeugt Standardzertifikate, aber nicht
automatisch den passenden IP-/`NexoWattEOS`-SAN. `setup first` nicht als
Zertifikatreparatur wiederholen.

`https://NexoWattEOS/` benötigt zusätzlich lokale Namensauflösung und die getrennte
443-Einrichtung; npm erledigt das nicht automatisch. Siehe
[Deployment](../../deploy/README.md). Schlüssel-ID, Fingerprint und genaue
Wiederherstellungsregeln stehen unter
[Lizenzwiederherstellung 9.0.2](../unified/LICENSE_RECOVERY_9.0.2.md).
Die NexoWatt-Lizenz bleibt proprietär; dieser Teststand ist keine CRA-Produktfreigabe.
