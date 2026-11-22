# Hersteller, zentrale Aktivierung und verschlüsselte Lizenzablage

Stand: NexoWatt EOS Zusammenführung, 22.11.2026. Vertrag aus dem vorhandenen
Offline-Key-Generator **1.0.4** übernommen. Die frühere NWL2-Beschreibung wird um
NWL3 ergänzt; Bestandsrechte werden nicht erweitert. Testbelege liegen unter
`reports/unified/licensing/`.

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
2. Den öffentlichen Trust-Export erzeugen und dessen Fingerabdruck über den
   autorisierten Bereitstellungsweg mit dem Geräte-Vertrauensanker vergleichen.
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

Bevorzugter Gerätepfad: `/etc/nexowatt-eos/license-trust.json`. Nur wenn der
aktuelle Pfad fehlt (`ENOENT`), wird der bisherige Admin-Pfad
`/etc/nexowatt/license-trust.json` gelesen. Falsche Rechte, Symlinks, beschädigter
Inhalt oder ein unzulässiger Schlüssel lösen keinen Fallback aus.
Ein vor Prozessstart gesetztes `NEXOWATT_LICENSE_TRUST_FILE` bezeichnet genau
einen absoluten Pfad und fällt bei Fehlern nicht auf andere Dateien zurück.

Der Trust-Export ist ein JSON-Objekt aus Schlüssel-ID und öffentlichem
Ed25519-SPKI-PEM. Es können maximal 32 öffentliche Schlüssel eingetragen sein.
Es wird kein produktiver Schlüssel in dieser Lieferung erfunden oder vorgegeben.
Der Public-Trust-Export des bestehenden Keygen 1.0.4 entspricht diesem Format.

Unter Linux müssen die Datei und ihre gesamte Verzeichniskette root gehören
und dürfen nicht gruppen-/weltbeschreibbar sein, beispielsweise Datei 0644 und
Verzeichnisse 0755. Der Adapter liest nur; er benötigt keine Root-Rechte und
darf diese Dateien nicht aus der Weboberfläche ersetzen. Symlinks, Hardlinks und
Dateiwechsel beim Lesen werden geprüft. Windows benötigt eine eigene geprüfte
ACL-Implementierung und bleibt mit `TRUST_PLATFORM_UNSUPPORTED` gesperrt.

Ein Schlüsselwechsel braucht privilegierte, nachvollziehbare Bereitstellung der
öffentlichen Anker und einen Dienstneustart. Mehrere Anker erlauben den geplanten
Übergang. Das Update ersetzt keinen bestehenden Anker. Ein verlorener privater
Schlüssel oder Tresor erfordert einen separat autorisierten Wechsel; kein
Mastercode oder allgemeiner Ersatzschlüssel ist vorgesehen.

## Gerätespeicher und laufende Prüfung

`EncryptedLicenseStore` schreibt `license.enc` mit AES-256-GCM, frischer
12-Byte-Nonce, 16-Byte-Authentifizierungstag und UUID-gebundener AAD. Der
geräteindividuelle 32-Byte-Schlüssel liegt in `storage.key`. Verzeichnis 0700,
Dateien 0600, Eigentümerprüfung, begrenzte Reads, atomarer Austausch und `fsync`
schützen den lokalen Speicher. Bestehende NWL2-Dateien bleiben lesbar; das
Speicherenvelope ändert seine Version nicht. Ein fehlender Speicherschlüssel bei
vorhandener Lizenz führt zu einer Diagnose und wird nicht still neu erzeugt.

Der Dienst prüft bei jeder Freigabe und spätestens im Fünf-Sekunden-Takt erneut
UUID, Signatur, Zeitgrenzen und Datei. Der Nachrichtenclient erhält höchstens
15 Sekunden gültige Freigaben. Die synchrone Kernprojektion prüft zusätzlich
Ablauf, Zeitrücklauf und maximal 15 Sekunden alte erfolgreiche Auswertung.
Sie blockiert den Regelpfad nicht mit Dateizugriffen. Ein hängender Datenbankread
erzeugt keine unbegrenzte Warteschlange oder dauerhaft gültige Kopie.

Die vollständige Signatur, Lizenzkennung und Schlüsselmaterial verlassen den
Dienst weder über Status/API noch Messagebox. Widerruf durch Entfernen der Lizenz
oder durch privilegierten Trust-Wechsel bleibt möglich. Ein individueller
Online-Widerruf unbefristeter NWL3-Codes ist nicht implementiert.

Die gemeinsame ioBroker-UID und ein Angreifer mit Root-/Dateisystemkontrolle sind
keine kryptografisch isolierte DRM-Grenze. Vollständige Datenträger-/UUID-Klone
oder Zurückrollen von Datenträger und Uhr erfordern zusätzliche Hardwareanker.
Das Produkt behauptet hierfür keinen absoluten Kopierschutz.

## Transport und Nachweise

Lizenzschreiben erfordert zentrale Administratorautorisierung, exakten Origin,
den Header `X-EOS-License: 1`, begrenzte JSON-Bodies und Ratenbegrenzung.
Im Ingressprofil ist die externe HTTPS-Origin fest konfiguriert, der lokale
HTTP-Transport bleibt auf Loopback beschränkt. Forwarded-Header setzen weder
Benutzeridentität noch TLS-Vertrauen. Fehlende oder gefälschte Origin/Host-Werte
werden zurückgewiesen. Der Code wird nach dem Absenden aus dem Eingabefeld entfernt.

Die Prüfungen verwenden echte Node-Kryptografie und lokale verschlüsselte Dateien,
mit simulierter ioBroker-Datenbank/Messagebox. Der originale Keygen 1.0.4 wurde
zusätzlich gegen diesen Verifizierer und Dienst ausgeführt; Testschlüssel werden
je Lauf nur im Speicher erzeugt. Browser-/Host-/Hardwareabnahme sowie eine
unabhängige Sicherheitsprüfung bleiben separate Nachweise. Diese Dokumentation
ist keine CRA-Konformitätserklärung oder allgemeine Produktivfreigabe.
