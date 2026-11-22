# Hersteller, zentrale Aktivierung und verschlüsselte Lizenzablage

Stand: NexoWatt EOS Zusammenführung, 22.11.2026. Vertrag aus dem vorhandenen
Offline-Key-Generator **1.0.4** übernommen. Die frühere NWL2-Beschreibung wird um
NWL3 ergänzt; Bestandsrechte werden nicht erweitert. Vertrauensanker und
Wiederherstellung sind für **9.0.2** beschrieben. Die bisherigen Testbelege unter
`reports/unified/licensing/` stammen aus dem dort benannten Alpha-1-Stand; neue
versionsgebundene Ergebnisse müssen im jeweiligen Abschlussbericht eigens
ausgewiesen werden. Dieser Vermerk enthält keine neue Testfreigabe.

## Eine Aktivierung nach der Erstanmeldung

Nach erfolgreicher Anmeldung und einem gegebenenfalls erforderlichen
Erstpasswortwechsel aktiviert ein berechtigter Administrator die zentrale
Systemlizenz. Das aktive Ergebnis gilt für das integrierte EOS und über den
Lizenzclient für passende Erweiterungen. Eine zusätzliche UI-Lizenz ist nicht
erforderlich. Der Code wird verschlüsselt auf dem Gerät gespeichert und nach
Neustarts erneut lokal geprüft. Eine erneute Eingabe ist ohne Lizenz-/Gerätewechsel
oder Verlust des geschützten Speichers nicht erforderlich.

Anmeldung, Wiederherstellung, Diagnose und Sicherheitswartung bleiben auch ohne
kommerzielle Betriebsfreigabe möglich. Eine Lizenz ersetzt keine Benutzerrechte,
Gerätezulassung, Objekt-ACL oder betriebliche Schutzgrenze. Der private
Herstellerschlüssel und der Generator werden nicht in das Adapterpaket übernommen.

## Vorhandenen Key-Generator verwenden

1. Auf dem Herstellerrechner den vorhandenen Offline-Key-Generator 1.0.4 öffnen.
   Der vorhandene verschlüsselte Tresor bleibt bestehen; dieses Adapterupdate
   erzeugt keine neuen Herstellerschlüssel.
2. Den öffentlichen Trust-Export erzeugen. Im EOS-Lizenzreiter die öffentliche
   JSON-Datei importieren und Schlüssel-ID/Fingerabdruck prüfen. Der Import
   akzeptiert ausschließlich die nachfolgend beschriebenen autorisierten Schlüssel.
3. Die tatsächliche System-UUID in der geschützten Lizenzverwaltung ablesen,
   im Generator die gewünschte Edition Home oder Pro wählen und signieren.
4. Den vollständigen NWL3-Code einmalig in der EOS-Lizenzverwaltung eingeben.
   Nach bestätigter Aktivierung führt „Weiter zum EOS-Dashboard“ zu `/`.
5. Edition, Funktionen und Mengen prüfen. Tresor, Passphrase und privater
   Signierschlüssel bleiben auf dem Herstellerrechner und dessen geschütztem Backup.

NWL3 ist signiert, aber sein Transporttoken ist lesbar. Der Code gehört nicht in
Browserlogs, öffentliche States, Supportberichte, URLs oder Repositories. Eine
fehlgeschlagene Aktivierung ersetzt den bisher gültigen Lizenzspeicher nicht.
Verlorene Herstellerpassphrasen lassen sich durch den Adapter nicht wiederherstellen.
Ein Wechsel des Generatorrechners mit demselben verschlüsselten Tresor und der
zugehörigen Passphrase erhält den Aussteller und verlangt keine neue Kundenlizenz.
Ein neues EOS-Gerät mit neuer System-UUID benötigt dagegen eine Lizenz für diese
UUID. Bei verlorenem Tresorzugang erfordert ein neuer Aussteller einen autorisierten
Release-Pin oder eine privilegierte OS-Provisionierung; der Adapter bietet keinen
Mastercode. Bereits ausgestellte gültige Lizenzen verlieren durch den bloßen
Verlust des Tresorzugangs nicht automatisch ihre Gültigkeit.

## Signaturvertrag

Beide Formate bestehen aus exakt drei Teilen:
`NWL2.<payload64>.<signature64>` beziehungsweise `NWL3.<payload64>.<signature64>`.
Base64url ist kanonisch und ohne Padding. Ed25519 prüft die exakten ASCII-Bytes
aus Formatpräfix, Punkt und unverändertem `payload64`. Die Signatur ist 64 Bytes
lang. Der Text darf maximal 16.384 Zeichen enthalten. UTF-8, JSON-Feldmenge,
Datentypen, UUID, Zeitgrenzen und Edition werden strikt geprüft. Fremde Felder,
unbekannte Schlüssel-IDs, andere Algorithmen und private Schlüssel im Trust-Export
werden zurückgewiesen.

| NWL3-Claim | Vertrag |
| --- | --- |
| `v` | Exakt `3` |
| `kid` | Vorhandener Ed25519-Vertrauensanker; 1–64 ASCII-Zeichen |
| `licenseId` | Vom Aussteller erzeugte Kennung; maximal 128 erlaubte ASCII-Zeichen |
| `uuid` | Normalisierte tatsächliche System-UUID; optional zweibuchstabiges Herstellerpräfix |
| `edition` | Exakt `home` oder `pro` |
| `issuedAt` | Ganze UTC-Epochenzeit in Millisekunden |
| `notBefore` | Identisch mit `issuedAt` |
| `expiresAt` | Exakt `null`, unbefristet |
| `scope` | Exakt `system` |

NWL3 akzeptiert keine Adapter-, Mengen- oder Funktions-Claims. Die geprüfte
Edition wird gegen die versionierte Produktpolitik in `src/lib/eosLicensePolicy.js`
ausgewertet. Diese Politik stimmt mit Keygen 1.0.4 überein:

| Berechtigung | Home | Pro |
| --- | --- | --- |
| Ladepunkte | 3 | 50 |
| Batteriesysteme | 2 | 10 |
| Grundfunktionen | `energy`, `wallet`, `smartHome`, `microgridSlave` | dieselben |
| Zusätzliche Funktionen | keine | `microgridMaster`, `multisite`, `billing` |

Ein Produktpolitik-Eintrag ist keine Zusage, dass jede optionale Erweiterung
bereits installiert, eingebunden oder an allen Geräten abgenommen ist.

## NWL2-Bestand und ältere Formate

NWL2 behält `v: 2`, dieselben Basisfelder, seine eindeutige `adapters`-Liste
(1–64 Namen ohne Instanz und ohne Wildcard), `limits.chargePoints` und
`limits.batteries`. Die Grenzen bleiben Home maximal 3/2 und Pro gemäß signiertem
Wert maximal 1.000/10. Kleinere signierte Werte werden unverändert durchgesetzt.
`notBefore >= issuedAt`; `expiresAt` ist `null` oder strikt später als
`notBefore`. Eine NWL2-Lizenz wird nie als NWL3-Systemfreigabe behandelt.

Für die integrierte EMS-/UI-Laufzeit erfordert NWL2 ausdrücklich `nexowatt-ui`
in der signierten Liste. Ein alter Eintrag `eos-admin` allein oder ausschließlich
ein Geräteadapter erweitert seine historischen Rechte nicht um das EMS.
Die öffentliche Statusprojektion meldet dies als `valid: true`, aber
`coreEnabled: false`. Bei NWL3 ist der gültige Systemumfang die Kernfreigabe.

NW1-/NW1T-/andere HMAC-Altformate werden nicht mit einem eingebauten Geheimnis
übernommen. NexoWatt prüft die Bestandsberechtigung und stellt bei Bedarf eine
NWL3-Ersatzlizenz für dieselbe tatsächliche UUID aus. Die Migration darf erst
umschalten, wenn passende Rechte bestätigt sind. Ein bloßes Umbenennen des Präfixes
ist niemals gültig.

## Öffentlicher Vertrauensanker

Der Trust-Export ist ein JSON-Objekt aus Schlüssel-ID und öffentlichem
Ed25519-SPKI-PEM. Es können maximal 32 öffentliche Schlüssel eingetragen sein.
Der Public-Trust-Export des bestehenden Keygen 1.0.4 entspricht diesem Format;
der Dateiname, etwa `license-trust (1).json`, begründet keine Vertrauensstellung.
Private Schlüssel, fremde Algorithmen und beliebige selbst erzeugte Aussteller
werden beim Import abgewiesen.

**Autorisierter Hersteller-Pin für 9.0.2:**

- Schlüssel-ID: `nexowattEOS-3cb665e3fc6f4085a04b8db3e692cac5`
- SHA-256 über kanonisches SPKI-DER:
  `a485fd6e28195a0a0e458b304e95025c0bd516d97f3cb1443beb78ed9cfe4856`

Diese öffentlichen Metadaten stammen aus dem freigegebenen Herstellerexport.
Sie sind kein privater Signierschlüssel und keine Aktivierung. Der UI-Import
vergleicht **Schlüssel-ID und tatsächlichen Schlüssel** mit einer bereits
autorisierten Quelle; ein vom Upload selbst angegebener Fingerabdruck reicht nicht.

| Quelle / Zustand | Verbindliches Verhalten |
| --- | --- |
| Standard-OS-Trust | Bevorzugt `/etc/nexowatt-eos/license-trust.json`, nur bei `ENOENT` der bisherige Pfad `/etc/nexowatt/license-trust.json`. Gültige OS-Schlüssel sind direkt wirksam. |
| Explizit importierter Release-Pin | Der bereits im Release autorisierte Schlüssel darf im Lizenzreiter importiert und lokal aktiviert werden. Er ist neben gültigen Standard-OS-Schlüsseln eine unabhängige Autorität. Ein vorhandener Pin allein ersetzt den ausdrücklichen Import nicht. |
| `NEXOWATT_LICENSE_TRUST_FILE` | Dieser vor Start gesetzte absolute Pfad legt die **abschließende erlaubte Schlüsselmenge** fest. Release-Pins erweitern sie nicht; fehlende oder ungültige Daten führen nicht zu einem Fallback. |
| Vorhandener unsicherer Standard-OS-Trust | Falsche Rechte, Symlinks, beschädigter Inhalt oder unzulässige Schlüssel sperren auch den lokalen Importpfad. Kein Umgehen durch einen gültigen Release-Pin. |
| Gleiche ID, anderer Schlüssel | Konflikte zwischen OS- und Release-Identität werden abgewiesen, nicht durch Rangfolge aufgelöst. |

Die lokale Datei `imported-public-keys.json` im privaten `licensing/`-Verzeichnis
ist nur eine gespeicherte Auswahl, **keine eigene Autorität**. Bei laufender Prüfung,
erneuter Prüfung und Neustart wird sie gegen die aktuell erlaubten Quellen
validiert. Eine lokale Kopie darf entfernte, allein durch OS-Trust autorisierte
Schlüssel nicht wieder freigeben. Fehlerhafte Imports ersetzen weder den bisherigen
Importbestand noch die verschlüsselte Lizenz.

Für den OS-Trust müssen unter Linux Datei und gesamte Verzeichniskette root gehören
und dürfen nicht gruppen-/weltbeschreibbar sein, beispielsweise Datei 0644 und
Verzeichnisse 0755. Der Adapter liest nur; er benötigt keine Root-Rechte und
darf diese Dateien nicht aus der Weboberfläche ersetzen. Symlinks, Hardlinks und
Dateiwechsel beim Lesen werden geprüft. Windows benötigt eine eigene geprüfte
ACL-Implementierung und bleibt mit `TRUST_PLATFORM_UNSUPPORTED` gesperrt.

Das Entfernen eines **nur durch OS-Trust** erlaubten Schlüssels entzieht dessen
Autorität. Ein unabhängig importierter Release-Pin wird dadurch nicht widerrufen:
Dafür braucht es ein entsprechendes Release-Pin-Update oder eine explizite
OS-Allowlist über `NEXOWATT_LICENSE_TRUST_FILE`. Das bloße Löschen einer
Standard-OS-Datei ist deshalb **kein vollständiger Schlüsselwiderruf**.
Ein Schlüsselwechsel wird bewusst autorisiert; der Upload einer neuen beliebigen
öffentlichen Datei reicht nicht. Mehrere autorisierte Anker erlauben einen
geplanten Übergang. Details und Bedienung: [Lizenzwiederherstellung 9.0.2](../unified/LICENSE_RECOVERY_9.0.2.md).

## Gerätespeicher und laufende Prüfung

`EncryptedLicenseStore` schreibt `license.enc` mit AES-256-GCM, frischer
12-Byte-Nonce, 16-Byte-Authentifizierungstag und UUID-gebundener AAD. Der
geräteindividuelle 32-Byte-Schlüssel liegt in `storage.key`. Verzeichnis 0700,
Dateien 0600, Eigentümerprüfung, begrenzte Reads, atomarer Austausch und `fsync`
schützen den lokalen Speicher. Bestehende NWL2-Dateien bleiben lesbar; das
Speicherenvelope ändert seine Version nicht. Ein fehlender Speicherschlüssel bei
vorhandener Lizenz führt zu einer Diagnose und wird nicht still neu erzeugt.

Die 9.0.2-Speicherprüfung berücksichtigt ausschließlich den aus dem tatsächlichen
Controllerverzeichnis abgeleiteten vertrauenswürdigen Laufzeitpfad. Innerhalb
dieser Grenze dürfen übergeordnete Verzeichnisse gruppenbeschreibbar sein, wenn
Eigentümer und Gruppe der Prozess-UID und primären Prozess-GID entsprechen;
Weltbeschreibbarkeit wird nicht freigegeben. Das eigentliche `licensing/`-Verzeichnis
bleibt 0700, seine Dateien 0600. Webeingaben und Instanzkonfiguration bestimmen
diese Vertrauensgrenze nicht. Der Adapter führt dafür kein `chmod` oder `chown`
an bestehenden Hostverzeichnissen aus und benötigt keinen neuen Root-Helfer.

Eine erneute Trustprüfung kann die beim Start fehlende Initialisierung nachholen,
ohne eine vorhandene Lizenz zu löschen. Sie darf weder den gespeicherten
Zeit-Höchststand noch einen bereits festgestellten Zeitrücklauf zurücksetzen.
Initialisierung, Import und Freigabe werden weiterhin serialisiert; erneutes
Prüfen startet keinen zweiten Lizenzdienst.

Der Dienst prüft bei jeder Freigabe und spätestens im Fünf-Sekunden-Takt erneut
UUID, Signatur, Zeitgrenzen und Datei. Der Nachrichtenclient erhält höchstens
15 Sekunden gültige Freigaben. Die synchrone Kernprojektion prüft zusätzlich
Ablauf, Zeitrücklauf und maximal 15 Sekunden alte erfolgreiche Auswertung.
Sie blockiert den Regelpfad nicht mit Dateizugriffen. Ein hängender Datenbankread
erzeugt keine unbegrenzte Warteschlange oder dauerhaft gültige Kopie.

Die vollständige Signatur, Lizenzkennung und geheimes Schlüsselmaterial verlassen
den Dienst weder über Status/API noch Messagebox. Der geschützte Truststatus zeigt
öffentliche Schlüssel-IDs, Fingerabdrücke, Herkunft und Importmöglichkeit.
Widerruf durch Entfernen der Lizenz oder autorisierten Trust-Wechsel folgt den
oben beschriebenen Autoritäten. Ein individueller Online-Widerruf unbefristeter
NWL3-Codes ist nicht implementiert. Die Fortführung bereits konfigurierter Automatik
bleibt gesondert unter [LIC-RUNTIME-01](../unified/LICENSING_RUNTIME_LIMITS.md) beschrieben.

Die gemeinsame ioBroker-UID und ein Angreifer mit Root-/Dateisystemkontrolle sind
keine kryptografisch isolierte DRM-Grenze. Vollständige Datenträger-/UUID-Klone
oder Zurückrollen von Datenträger und Uhr erfordern zusätzliche Hardwareanker.
Das Produkt behauptet hierfür keinen absoluten Kopierschutz.

## Transport und Nachweise

Lizenzschreiben, Trustimport und erneute Trustprüfung erfordern zentrale
Administratorautorisierung, passenden Origin, den Header `X-EOS-License: 1`,
begrenzte JSON-Bodies und Ratenbegrenzung. Auch Statusrouten sind geschützt.
Der Standardzugang in **9.0.2** ist HTTPS auf `0.0.0.0:8188` mit
`secure=true`, `auth=true`, `certPublic=defaultPublic` und
`certPrivate=defaultPrivate`. `eosExternalOrigin` bleibt leer, auch bei einem
optionalen 443-Proxy mit geprüftem HTTPS-Upstream. So bleiben die vorgesehenen
IP-/Namenszugänge parallel möglich.

Die Origin muss zur kanonisch aus dem validierten `Host` und dem HTTPS-Profil
gebildeten Origin passen. Ein kanonischer HTTPS-Standardport wird entsprechend
normalisiert. Ungültige Hostangaben oder eine fehlende/abweichende Origin bei
Schreibaufrufen werden abgelehnt. Forwarded-Header setzen weder Benutzeridentität
noch TLS-Vertrauen. Der 443-Proxy verwendet eine feste HTTPS-Gegenstelle sowie
CA-/Namensprüfung; eine öffentliche Anmeldung beendet die Lizenzprüfung nicht.
Der Code wird nach dem Absenden aus dem Eingabefeld entfernt.

Nur das ausdrücklich gewählte ältere HTTP-Loopback-Profil verwendet
`secure=false`, Bindung an `127.0.0.1` und eine exakte externe HTTPS-Origin.
Es erlaubt keine direkte HTTP-Anmeldung im LAN und ist kein automatischer
TLS-Fehlerfallback. Konkrete Profile: [Deploymentanleitung](../../deploy/README.md).

### Historische Lizenzprüfungen

Die nachfolgenden Aussagen beschreiben die bisherigen Alpha-1-Nachweise und
werden nicht als neue 9.0.2-Testergebnisse ausgegeben. Die damaligen Prüfungen
verwendeten echte Node-Kryptografie und lokale verschlüsselte Dateien mit
simulierter ioBroker-Datenbank/Messagebox. Der originale Keygen 1.0.4 wurde
zusätzlich gegen Verifizierer und Dienst ausgeführt; Testschlüssel wurden je Lauf
nur im Speicher erzeugt. Tabellen und Rohbelege unter `reports/unified/licensing/`
bleiben unverändert.

Neue Trust-/Recovery-, HTTPS-/Host-/Originprüfungen und die optionale
443-/Upstreamprüfung gehören in den jeweiligen versionsgebundenen Abschlussbericht.
Browser-/Hardwareabnahme und
eine unabhängige Sicherheitsprüfung bleiben separate Nachweise. Diese Dokumentation
ist keine CRA-Konformitätserklärung oder allgemeine Produktivfreigabe.
