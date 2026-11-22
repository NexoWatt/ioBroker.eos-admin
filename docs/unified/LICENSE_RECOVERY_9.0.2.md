# Lizenzierung und öffentliche Schlüssel wiederherstellen – 9.0.2

Stand: 22.11.2026 · NexoWatt EOS `iobroker.eos-admin@9.0.2` · Teststand für `next`.
Dieser Vermerk beschreibt das Verfahren und seine Sicherheitsgrenzen. Neue
Prüfergebnisse und die endgültige Lieferfreigabe stehen im zugehörigen Prüfbericht;
hier werden keine bestandenen Tests oder CRA-Konformität behauptet.

## Öffentliche Datei im EOS-Lizenzreiter importieren

Nach Anmeldung als Administrator und gegebenenfalls erforderlichem
Erstpasswortwechsel den Reiter **„Öffentliche Prüfschlüssel & Wiederherstellung“**
öffnen. Im Feld **„Öffentliche Schlüsseldatei (JSON, höchstens 32 KiB)“** den
öffentlichen Export aus Keygen 1.0.4 wählen, beispielsweise
`license-trust (1).json`. Danach **„Öffentliche Schlüssel prüfen und importieren“**
verwenden. Der Dateiname ist beliebig; der geprüfte Inhalt entscheidet.

Der für 9.0.2 autorisierte Herstellerexport besitzt:

- Schlüssel-ID: `nexowattEOS-3cb665e3fc6f4085a04b8db3e692cac5`
- SHA-256 des kanonischen öffentlichen SPKI-DER:
  `a485fd6e28195a0a0e458b304e95025c0bd516d97f3cb1443beb78ed9cfe4856`

Eine vorhandene Herstellerfreigabe im Release allein ist noch kein aktiver
Geräte-Vertrauensanker. Dafür ist der ausdrückliche Import oder eine gültige
OS-Provisionierung erforderlich. Der Import erlaubt ausschließlich bereits
autorisierte Schlüssel-IDs und Schlüssel; ein beliebiger selbst erzeugter
Schlüssel wird auch für einen angemeldeten Administrator abgewiesen.

**„Vertrauen und Lizenz erneut prüfen“** lädt den aktuellen Zustand neu. Ist eine
passende Lizenz bereits verschlüsselt gespeichert, muss sie nicht vorsorglich
gelöscht oder erneut ausgestellt werden. Andernfalls im Reiter **„Lizenz“** die
NWL3-Lizenz für die angezeigte tatsächliche System-UUID einmal eingeben. Danach
verwenden Systembereich und gehostete UI dieselbe Freigabe.

Der Export über **„Öffentliche Schlüssel exportieren“** enthält ausschließlich
öffentliche Prüfschlüssel. Er ersetzt weder die gesicherte Lizenzablage noch den
privaten Generator-Tresor. Tresor, Passphrase und private Signierschlüssel gehören
niemals in dieses Uploadfeld oder auf das EOS-Gerät.

## Welche Quelle entscheidet?

| Zustand | Wirkung |
| --- | --- |
| Gültiger Standard-OS-Trust | Seine Schlüssel sind direkt autorisiert. Bevorzugter Pfad: `/etc/nexowatt-eos/license-trust.json`; nur bei fehlendem Pfad wird `/etc/nexowatt/license-trust.json` verwendet. |
| Explizit importierter Release-Pin | Neben den Standard-OS-Schlüsseln eine unabhängige Autorität. ID und Schlüssel müssen zum freigegebenen Pin passen. |
| Explizites `NEXOWATT_LICENSE_TRUST_FILE` | Abschließende erlaubte Schlüsselmenge; Release-Pins dürfen sie nicht erweitern. Fehlender oder ungültiger Inhalt sperrt. |
| Vorhandener unsicherer OS-Trust oder Schlüsselkonflikt | Sichere Ablehnung; kein Ausweichen auf lokale Daten. Die bestehende OS-Einrichtung muss durch einen berechtigten Administrator korrigiert werden. |

`licensing/imported-public-keys.json` ist nur eine lokale Auswahl. Bei laufender
Prüfung und Neustart wird ihre Autorisierung erneut kontrolliert. Das Entfernen
eines ausschließlich OS-autorisierten Schlüssels entzieht dessen Freigabe. Ein
unabhängig importierter Release-Pin braucht für den Widerruf ein Pin-Update oder
eine explizite OS-Allowlist. Das bloße Löschen der Standard-OS-Datei ist kein
vollständiger Widerruf. Es gibt keinen individuellen Onlinewiderruf für
unbefristete NWL3-Codes und keinen garantierten Schutz gegen vollständiges
Datenträger-/Paket-Rollback.

## Speicher und Rechnerwechsel

Zum EOS-Backup gehören System-UUID und der gesamte Instanzordner `licensing/`,
insbesondere **`storage.key` und `license.enc` gemeinsam**, die importierten
öffentlichen Schlüssel und gegebenenfalls der OS-Truststore. Geschützt und
außerhalb des Repositorys aufbewahren.

Die Speicheränderung in 9.0.2 berücksichtigt die aus dem tatsächlichen
Controllerpfad abgeleitete Laufzeitgrenze: Gruppenbeschreibbare übergeordnete
Verzeichnisse sind dort nur mit passender Prozess-UID und primärer Prozess-GID
zulässig. Das eigentliche Lizenzverzeichnis bleibt 0700, Dateien bleiben 0600.
Es gibt kein automatisches `chmod`/`chown` bestehender Hostverzeichnisse und
keinen neuen Root-Helfer. Erneute Trustprüfung kann eine zuvor unvollständige
Initialisierung fortsetzen, darf aber weder Zeit-Höchststand noch festgestellten
Uhr-Rollback zurücksetzen.

Bei einem **neuen Generator-PC** das vorhandene verschlüsselte Tresor-Backup mit
seiner Passphrase im Keygen wiederherstellen. Derselbe Tresor erhält denselben
Aussteller; bestehende Kundenlizenzen bleiben verwendbar. Ein öffentlicher Export
kann einen verlorenen privaten Tresor nicht wiederherstellen. Ein neuer Aussteller
nach verlorenem Tresorzugang verlangt eine gesonderte Herstellerautorisierung.
Ein **neues EOS-Gerät mit neuer System-UUID** benötigt dagegen eine Lizenz für
diese UUID.

NexoWatt-Anteile bleiben proprietär; der öffentliche Schlüssel verleiht keine
Nutzungsrechte. Laufende Automatik bei Lizenzverlust bleibt nach
[LIC-RUNTIME-01](LICENSING_RUNTIME_LIMITS.md) gesondert zu bewerten. Vollständiger
Vertrag: [Aussteller und Speicherung](../licensing/ISSUER_AND_STORAGE.md).
