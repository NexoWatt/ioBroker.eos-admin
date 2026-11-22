# NW-SECRET-01 – Lizenzgeheimnis getrennt bereitstellen

Stand: NexoWatt UI 1.0.22, 29.09.2026. Änderung an den Lizenzmethoden der
autoritativen `src-ts/runtime-executables/main.ts` und dem manuell typisierten
`src-ts/runtime-mirrors/main.ts`; `main.js` wird im abschließenden Build erzeugt.

## Befund und Änderung

Der bisherige Quellstand enthielt denselben festen HMAC-Schlüssel in drei
Lizenzmethoden. Ein gemeinsames Prüfgeheimnis im veröffentlichten Code kann auch
zum Erzeugen gültiger Lizenzen verwendet werden. NW-SECRET-01 wird deshalb nicht
allein durch Entfernen des Literals als vollständig behoben bewertet.

Alle Lizenz-HMACs lesen jetzt ausschließlich die geschützte Prozessumgebung
`NEXOWATT_LICENSE_HMAC_SECRET`. Zulässig sind 16 bis 4096 druckbare ASCII-Zeichen,
die nicht ausschließlich Leerzeichen sind. Fehlende, leere, zu kurze, überlange
oder anders kodierte Werte erzeugen **keine** Signatur. Es gibt keinen
eingebauten Ersatzwert. Die Hauptprüfung meldet einen verständlichen
Konfigurationsfehler; der Wert wird weder protokolliert noch in öffentliche
Konfigurations- oder Statusobjekte geschrieben. Die Abfrage benötigt keine
Dateioperation und keinen Netzwerkzugriff. Ungültige Umgebung verändert keine
gespeicherten Trial-Daten.

Die vorhandenen Lizenz-Gates bleiben wirksam. Es wurde keine zusätzliche
pauschale Geräteabschaltung eingebaut. Ohne vorherige Bereitstellung der privaten
Umgebung können Bedienung und lizenzabhängige Funktionen gesperrt bleiben;
der Betreiber muss die private Dienstumgebung **vor** dem Adapterupdate laden.

## Getrennte private Serverbereitstellung

Der Bestandswert wurde ohne Ausgabe in Protokollen in ein separates privates
Installationspaket übernommen. Dieses Paket gehört weder in die Repository-ZIP
noch in npm. Es enthält `license.env`, `install-private-license.sh` und eine
deutsche Installationsanleitung. Kein tatsächlicher Server wurde geändert.

Der Installer unterstützt einen bestehenden Linux/systemd-ioBroker-Dienst und
legt `/etc/nexowatt-ui/license.env` mit `root:root`, Modus `0600`, in einem
Verzeichnis mit Modus `0700` an. systemd liest diese Datei als root und übergibt
die Variable an ioBroker. Das Dienst-Drop-in enthält nur den Dateipfad. Der
Installer verweigert Symlinks, fremde Dienstnamenformate, ungültige Quelldateien
und das Überschreiben abweichender Konfiguration; er lädt nur die
Dienstdefinition neu. Ein **separater, bewusst geplanter** ioBroker-Neustart im
Wartungsfenster ist vor dem Adapterupdate erforderlich. Ein `export` in einer
SSH-Sitzung genügt für einen bereits laufenden Dienst nicht.

Root und Prozesse mit demselben ioBroker-Benutzer können Prozessumgebungen lesen.
Die Auslagerung verhindert die Mitveröffentlichung und ist kein Schutz gegen
einen bereits kompromittierten Host. Für Docker, Windows und andere
Prozessmanager muss die geschützte Umgebung gesondert eingerichtet werden;
diese Varianten wurden hier nicht praktisch geprüft.

## Tatsächliche Prüfungen

`scripts/verify-license-secret-externalization.cjs` führt die echten
Lizenzmethoden aus deren Syntaxbaum aus. Nur Umgebung und ioBroker-State-I/O
werden isoliert; Testmaterial und UUIDs werden zufällig erzeugt. Fehlerausgaben
enthalten keine Signaturen oder Schlüssel.

| Prüfung | Ergebnis |
| --- | --- |
| Legacy Voll-/Trial-Lizenzen sowie EOS/HEMS Voll-/Trial-Lizenzen | Sechs Formate akzeptiert; HMAC-Nachrichten unverändert |
| Falsche UUID | Abgewiesen |
| Neun fehlende/ungültige Umgebungswerte | Abgewiesen; kein HMAC und keine Trial-State-Schreiboperation |
| Schlüsselwechsel und Wiederherstellung | Alter Lizenzwert wird beim Wechsel abgewiesen; ursprüngliche Umgebung stellt Kompatibilität wieder her |
| Getrennter realer Bestandswert gegen ursprüngliche 1.0.21-Formeln | Alle sechs Signaturformeln identisch; keine Werte ausgegeben |
| Manuell typisierter Spiegel | Dieselben funktionalen Prüfungen bestanden |
| Privater Bash-Installer | Syntax, striktes Ein-Variablen-Format und ungültige Dateien geprüft; Quelldatei/Verzeichnis auf 0600/0700 geprüft |
| Raspberry Pi 5, echter systemd-Dienst, Live-Regelung | Nicht ausgeführt; Inbetriebnahme bleibt offen |

Rohbelege: `license-secret-source-check.json` und
`license-secret-source-check.log` in diesem Berichtsverzeichnis. Die finale
generierte JavaScript-Laufzeit muss zusätzlich denselben Test im Gesamtlauf
bestehen; deren Paketbindung erfolgt im finalen Release-Manifest.

## Verbleibende Maßnahmen

Der bisher in Quellpaketen enthaltene Schlüssel gilt als potenziell offengelegt.
Die bestehende Lizenzkompatibilität wurde bewusst erhalten; es fand keine
stillschweigende Schlüsselrotation statt. Herstellerseitig müssen Rotation und
Bestandslizenzmigration geplant und nachgewiesen werden. Als Ziel ist ein
asymmetrisches Lizenzverfahren geeignet, bei dem auf der Kundenanlage nur ein
öffentlicher Prüfschlüssel benötigt wird. Diese Änderung belegt weder eine
vollständige CRA-/IEC-Konformität noch eine Produktivfreigabe.
