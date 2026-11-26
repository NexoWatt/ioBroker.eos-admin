# NexoWatt EOS 9.0.1 – Start nach der ioBroker-Neuinstallation

Dominique, der direkte Einstieg ist **`https://<Geräte-IP>:8188/`**.
Der normale ioBroker-Admin auf Port **8081** bleibt erhalten.
Version 9.0.1 ist weiterhin ein Teststand für den npm-Kanal `next`.

## 1. Bestehende Lizenz vor der Neuinstallation sichern

Zur vollständigen ioBroker-Sicherung gehören die **System-UUID**
(`system.meta.uuid`) und der Ordner `licensing/` im Datenverzeichnis der
EOS-Instanz, insbesondere **`storage.key` und `license.enc` gemeinsam**.
Außerdem den öffentlichen Hersteller-Truststore sichern:
`/etc/nexowatt-eos/license-trust.json` oder den bisher verwendeten
`/etc/nexowatt/license-trust.json`.

Diese Sicherung geschützt außerhalb des Rechners aufbewahren, nicht ins Repository
legen. Wird bei der Neuinstallation eine neue System-UUID erzeugt, muss die Lizenz
für diese tatsächliche UUID neu ausgestellt werden. Eine gespeicherte Lizenzdatei
allein ersetzt weder UUID, Speicherschlüssel noch öffentlichen Vertrauensanker.

## 2. ioBroker zuerst einrichten

Den normalen ioBroker-Admin auf Port 8081 verwenden, ein persönliches
Administratorkennwort einrichten und Zertifikate/TLS prüfen. Das reguläre erste
Setup erzeugt `defaultPublic` und `defaultPrivate`; deren SAN passt nicht automatisch
zur Geräte-IP oder zu `NexoWattEOS`. Ein passendes Zertifikat und das Vertrauen auf
PC/Handy herstellen. `setup first` nicht als Zertifikatreparatur wiederholen,
da dadurch das globale Standard-Schlüsselpaar erneut erzeugt wird.

## 3. Das vollständige Paket übernehmen

Das Repository-ZIP entpacken. Für Git gehören die enthaltenen Repositorydateien
ins Hauptverzeichnis, sodass dort direkt `package.json` liegt.
Der Name lautet **`ioBroker.eos-admin`**: Punkt nach `ioBroker`, Bindestrich zwischen
`eos` und `admin`. Ziel ist
[NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin).

Zur Installation das vorgebaute **npm-TGZ für 9.0.1** über den vorgesehenen
ioBroker-Installationsweg verwenden. Installation aus Git erst nach Upload des
geprüften 9.0.1-Inhalts wählen; diese Anleitung behauptet keinen bereits erfolgten
Git-/npm-Upload. Bei einer Bestandsübernahme darf die alte `nexowatt-ui`-Regelung
nicht gleichzeitig mit der neuen EOS-Regelung laufen.

## 4. Einmal anmelden und aktivieren

EOS startet mit TLS und Anmeldung auf `0.0.0.0:8188`; im Browser die tatsächliche
Geräte-IP verwenden. `secure` und `auth` sind `true`, die Zertifikatsnamen
`defaultPublic`/`defaultPrivate`; `eosExternalOrigin` bleibt leer.

Vor der Aktivierung muss der **öffentliche Aussteller-Trust** aus dem vorhandenen
**Keygen 1.0.4** geschützt auf dem Gerät bereitstehen. Private Signierschlüssel und
Keygen-Tresor bleiben auf dem Herstellerrechner. Über
`https://<Geräte-IP>:8188/` anmelden, erforderlichen Erstpasswortwechsel abschließen
und als Administrator die passende **NWL3-Lizenz einmalig** eintragen. Nach gültiger
Aktivierung nutzen Admin und UI dieselbe Freigabe; Neustarts verlangen keine neue
Lizenzeingabe. Details: [Lizenzbetrieb](../unified/LICENSING.md).

## 5. Optional ohne Port und mit Gerätenamen

`https://NexoWattEOS/` benötigt lokale DNS-/Hosts-Auflösung, ein passendes
Zertifikat und den separaten Eingang auf 443. Dieser nutzt ebenfalls HTTPS mit
CA-/Namensprüfung zum EOS-Dienst. npm richtet DNS, Nginx und Systemrechte nicht
automatisch ein. Einrichtung: [Deploymentanleitung](../../deploy/README.md).

Für Zugangserhalt, Testgrenzen und Abnahme:
[Installation](../unified/INSTALL_PUBLISH.md),
[Recovery](../../deploy/ACCESS_RECOVERY.md) und
[Prüfplan](../unified/COMMISSIONING.md).
