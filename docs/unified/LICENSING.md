# Zentrale Aktivierung und Lizenzbetrieb

**NexoWatt EOS · 9.0.2**

## Erstinbetriebnahme

1. Den direkten EOS-Zugang `https://<Geräte-IP>:8188/` beziehungsweise den separat
   eingerichteten HTTPS-Eingang auf 443 öffnen und mit einem berechtigten ioBroker-Konto
   anmelden und einen erforderlichen Erstpasswortwechsel abschließen. TOTP-Challenges
   und Passkeys werden in diesem Teststand noch nicht unterstützt. Konten mit gesetztem
   `common.externalAuthentication.totp` (außer `null`/nicht vorhanden) oder fehlerhaftem
   `externalAuthentication` werden gesperrt, ohne Passwort-only-Rückfall. Für solche
   Konten ist zunächst der unterstützte MFA-Anmeldeweg zu entwickeln; die Sperre
   nicht durch Abschalten der bestehenden MFA umgehen.
2. Ohne gültige Kernlizenz den zentralen Aktivierungsdialog verwenden. Das erstmalige
   Hinterlegen übernimmt ein dazu berechtigter Administrator. Ein gewöhnlicher Nutzer
   erhält dadurch keine Lizenzverwaltungsrechte.
3. Den System-Identifier aus EOS für die Lizenzierung verwenden. NexoWatt stellt die
   passende Lizenz mit dem dazugehörigen privaten Ausstellerschlüssel außerhalb des
   Kundengeräts aus.
4. Den Lizenzcode einmal übertragen. EOS prüft Signatur, Aussteller, Gerätebindung,
   Schema und Vertragsdaten und speichert ihn geschützt. Anschließend beziehen UI,
   EMS und berechtigte eigene Erweiterungen ihre Freigaben aus demselben Dienst.
5. Nach Ab-/Anmeldung und Adapterneustart muss dieselbe gültige Lizenz weiterhin
   erkannt werden. Es erfolgt keine erneute Aktivierungsaufforderung pro Nutzer,
   Fachseite oder eigenem Adapter.

Der zentrale Logout widerruft derzeit die globale Sitzungsgeneration: Alle parallel
angemeldeten Nutzer sowie ihre Socket-/SSE-Verbindungen müssen sich erneut anmelden.
Die persistierte gültige Lizenz bleibt dabei erhalten. Ein isolierter Logout nur
einer einzelnen Sitzung ist in diesem Teststand noch nicht implementiert.

„Einmalig“ bezeichnet die normale Eingabe. Defekte Sicherung, Gerätewechsel,
Ausstellerwechsel oder eine bewusst ersetzte Lizenz benötigen eine geregelte
Wiederherstellung. Es wird weder eine Dauerfreigabe als Boolean gespeichert noch
ein ungeprüfter Lizenzstatus aus dem Browser übernommen.

## NWL3-Vertrag

Der Verifier orientiert sich am tatsächlichen Aussteller **NexoWatt EOS Keygen 1.0.4**.
NWL3 ist eine Ed25519-signierte dreiteilige Hülle. Die Signatur bezieht sich auf die
exakte ASCII-Folge `NWL3.<Base64url-Payload>`. Der Payload verwendet Version 3,
`scope: system`, eine Geräte-UUID, die Edition `home` oder `pro`, gleiche Werte für
`issuedAt` und `notBefore` und `expiresAt: null`. Frei beigefügte Feature-/Adapter-/
Limitfelder sind kein zulässiger Ersatz für diesen Vertrag.

Die aus der Ausstellerreferenz abgeleitete Mengenpolitik ist Home: 3 Ladepunkte /
2 Speicher und Pro: 50 Ladepunkte / 10 Speicher. Diese technische Politik ersetzt
keine individuelle kaufmännische Vereinbarung. Änderungen erfordern eine abgestimmte
Versionierung von Aussteller, Verifier und Erweiterungsclients.

Die bestehende NWL2-Prüfung bleibt ein gesonderter signierter Kompatibilitätsvertrag
mit eigenen Adapterlisten, Mengen und Zeiten. Eine Kernfreigabe setzt bei NWL2 den
signierten Eintrag `nexowatt-ui` voraus. Ein historischer `eos-admin`-Eintrag allein
schaltet die neu integrierte EMS-/UI-Funktion nicht nachträglich frei. Ein altes
Format darf nicht allein durch Umbenennen in NWL3 umgedeutet werden. Eine frühere
separate UI-Lizenz gilt nicht automatisch als neue gemeinsame Systemlizenz.

## Vertrauensanker und Ablage

Seit 9.0.2 kann der Administrator im Reiter **„Öffentliche Prüfschlüssel &
Wiederherstellung“** öffentliche JSON-Dateien importieren, exportieren und erneut
prüfen. Importierbar sind ausschließlich bereits durch Release-Metadaten oder
gültigen OS-Trust autorisierte Schlüssel. Ein öffentlicher Export ersetzt keinen
privaten Keygen-Tresor. Die genauen Regeln, der freigegebene Fingerprint und das
Verfahren stehen in [LICENSE_RECOVERY_9.0.2.md](LICENSE_RECOVERY_9.0.2.md).

Die importierte Auswahl liegt privat unter `licensing/imported-public-keys.json`
und ist selbst keine Autorität. Bei jeder Prüfung gelten erneut die aktuellen
Release-/OS-Regeln. Ein expliziter OS-Override begrenzt die gesamte erlaubte Menge;
ein unsicherer vorhandener OS-Trust sperrt auch den Importweg.

Der lokale Vertrauensanker enthält ausschließlich öffentliche Ausstellerschlüssel
als `kid` → SPKI-Zuordnung. Der bevorzugte Pfad ist
`/etc/nexowatt-eos/license-trust.json`; der bisherige Pfad
`/etc/nexowatt/license-trust.json` bleibt nur bei fehlender bevorzugter Datei als
Kompatibilitätsweg vorgesehen. Ein vorhandener fehlerhafter neuer Truststore darf
keinen automatischen Rückfall auf einen älteren auslösen. Der explizite Override
`NEXOWATT_LICENSE_TRUST_FILE` ist eine Betreiberkonfiguration, keine Webeingabe.

Die Vertrauensdatei ist als Sicherheitskonfiguration vom regulären Adapterkonto
gegen Änderungen zu schützen. Öffentliche Prüfschlüssel sind keine Signiergeheimnisse;
der private Keygen-Tresor gehört niemals in Git, npm oder auf das Kundengerät.
Die Lizenzablage verwendet lokal AES-256-GCM, eine separate `storage.key` mit
Dateimodus 0600 und einen geschützten Ordner mit Modus 0700. Auf Plattformen ohne
POSIX-Modi sind gleichwertige ACLs gesondert nachzuweisen. Der Statusendpunkt liefert
keinen vollständigen Lizenzcode.

## Fehler, Updates und Wiederherstellung

Ungültige Signaturen, unbekannte Aussteller, falsche Gerätebindung und ungültige
Payloads dürfen keine Freigabe erzeugen. Ablehnungsgründe bleiben ohne Geheimnisse
diagnostizierbar. Eine beschädigte Lizenzdatei darf nicht stillschweigend eine
Demo-/Vollfreigabe bewirken. Offlinebetrieb benötigt keinen Cloud-Lizenzabruf.

Geschäftliche Freigaben, Sicherheitspatches, Wiederherstellung und gerätespezifische
Schutzreaktionen sind getrennt zu behandeln. Kein Lizenzfehler darf unkontrollierte
physische Stellbefehle auslösen. Das konkrete Fehlerverhalten bei laufender Anlage,
Uhrzeitsprung und Neustart ist vor Produktivfreigabe zu prüfen. Die geschützte
Lizenzablage und die zur Entschlüsselung nötigen Daten gehören zum dokumentierten
Backup-/Restore-Verfahren; das Kopieren nur des Quell-Repositorys ist kein Backup.

Die implementierte Fortsetzung einer bereits initialisierten Regelung mit zuletzt
validierten Freigaben und ihre offenen Grenzen sind in
[LICENSING_RUNTIME_LIMITS.md](LICENSING_RUNTIME_LIMITS.md) beschrieben. Daraus darf
keine vollständige Sperre jedes neuen wirtschaftlichen Automatikauftrags bei
Lizenzverlust abgeleitet werden.

Die tatsächlich bestandenen Interoperabilitäts- und Negativtests stehen im
Release-Prüfbericht. Das Vorhandensein dieser Beschreibung allein ist kein Testbeleg.
