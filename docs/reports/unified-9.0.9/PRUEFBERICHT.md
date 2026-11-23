# NexoWatt EOS 9.0.9 – Änderungs- und Prüfbericht

Stand: 23.11.2026. Ausgangspunkt ist der vom Nutzer als funktionierend gemeldete
Lieferstand 9.0.8. Der Auftrag betrifft ausschließlich die SmartHome-Bedienoberflächen
im NexoWatt-Look, einschließlich Druckfeedback und geeigneter Bedienmuster der
bereitgestellten Referenz ioBroker.devices 4.4.0.

## Änderung und Erhalt

Die vorhandenen zehn Kacheltypen erhalten gemeinsame Gestaltung, Typbeschriftung,
Zustandsdarstellung und Bedienrückmeldung. Dimmer/Farblicht besitzen direkt erreichbare
Helligkeitsregler. Jalousiepositionen werden ohne neue Interpretation ihrer Richtung
visualisiert. RTR-Ist/Soll und Medieninformationen werden aus vorhandenen Werten gelesen.
Fehlende/veraltete Werte werden in den neuen Zusammenfassungen nicht als Messwerte ausgegeben.

Die drei neuen Helfer für Darstellung, Touch und Rückmeldung sind streng typisiert
und unabhängig von React/MUI. Es gibt keine neue Laufzeitabhängigkeit, keine zusätzliche
Adapterinstanz, keine Geräteerkennung und keinen neuen externen Abruf.
Bestehende APIs, Mappings, Konfiguration, serverseitige Rollen-/Lizenzprüfung,
Blind-Sperren und separate Stopp-Freigabe bleiben maßgeblich.

## Rückmeldung und Ressourcen

Druckzustand, API-Anfrage und zurückgemeldeter Gerätezustand sind getrennt.
HTTP-Erfolg wird als „An EOS übergeben“ angezeigt. Keine automatische Wiederholung
von Befehlen. Ein Timeout ist keine Aussage darüber, ob die Gegenstelle den Befehl
bereits ausgeführt hat. Eine spätere Antwort kann keinen neueren Stoppstatus überschreiben.

Touch-Regler puffern die Vorschau lokal; erst absichtliches Loslassen sendet den Wert.
Vertikales Wischen, Multitouch, Abbruch und Fokusverlust verwerfen den Vorschauwert.
Polling ersetzt während der Reglergeste nicht deren DOM-Element.
Globale Ereignisbehandlung wird einmal installiert, Reglerbindungen verwenden WeakMaps.
Statusverwaltung und parallele Anfragen sind begrenzt; Stopp besitzt eigene Kapazität.
Diese Änderung ist keine Messung oder Zusage einer Reduktion des Adapter-RAMs.

## Tatsächliche Prüfungen

Die abschließenden Läufe verwenden den unveränderten Quellstand dieser Lieferung.

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| `npm test`, Node 24.22.3 | 879 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| `npm test`, Node 22.23.4 | 879 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Gebaute SmartHome-Runtime mit realen Helfern, Node 22 und 24 | jeweils 7/7 DOM-/API-Simulationen bestanden |
| Bestehende moderne SmartHome-Bedienung, Node 24 | 9/9 bestanden |
| API-Vertrag, transaktionale Konfiguration, Szenenschutz, UI-Fähigkeiten, Appcenter-Auth | vorhandene Prüfprogramme bestanden |
| Strikte Typprüfung, Node 22 und 24 | beide bestanden; drei neue Helfer ohne `any`/`ts-nocheck` |
| Gezieltes ESLint einschließlich neuer Helfer | bestanden |
| UI-Security-Regressionsgate | 193 Quellen; 0 neue blockierte Befunde; Altbefunde siehe unten |
| Backend, Admin-Frontend, Installer, Module | Builds erfolgreich |
| Kanonische UI-Laufzeit / Quellverknüpfungen | 171 Runtime-Ausgaben synchron; 283 Modulbeschreibungen synchron |
| Repository-Geheimnisregeln | 3.607 Dateien geprüft, keine Treffer innerhalb der unterstützten Regeln |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Entwicklungsumgebung | 14 moderate, 0 high/critical; derselbe Bestand wie 9.0.8 |
| SBOM | Root, Laufzeit, Admin-Frontend und Installer auf 9.0.9 aktualisiert; Vendoring-Abgleich bestanden |

Die beiden ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`, die in
dieser Testumgebung fehlen. Daraus folgt kein Nachweis eines echten 443-Proxys oder
geerbter POSIX-ACLs. Die aktuellen Controller-/Hardwareprüfungen stehen unten als offen.

Die neuen 26 Helferfälle und sieben Integrationsfälle sind bereits in den 879
`npm test`-Erfolgen enthalten, keine zusätzlich anzurechnenden Produktfunktionen.
Der Test der gebauten Oberfläche deckt ausdrücklich den zuvor beim Zwischenbuild
gefundenen doppelten Farb-Commit ab: nach Regeneration genau ein Befehl. Ebenso
geprüft: `Stopp → Ab → Stopp` bei offener erster Antwort, große Timerantworten,
Schreibschutz, Fokus-/Touch-Abbruch, Scrollen, Timeout, HTTP-Fehler und der Erhalt
des berührten Regler-DOM während eines Polls.

Das Security-Gate führt 3.104 aktuelle Fundstellen: 2.955 historische offene
Scannerhinweise und 149 einzeln bewertete Fundstellen. Der erfolgreiche Lauf ist
keine Behauptung eines bereinigten Gesamtbestands. Die 14 Entwicklungs-Advisories
werden ebenfalls nicht als behoben ausgegeben; es wurden keine zusätzlichen
Abhängigkeiten eingeführt. Die begrenzte Bewertung steht im Sicherheitsdelta.

Antwortgrenzen: 128 KiB für normale Befehle, 1 MiB für die vollständige
Timerantwort (oberhalb des bestehenden 512-KiB-Vertrags für erhaltene UI-Daten).
Größere Antworten werden abgebrochen. Bis zu 48 normale offene Anfragen plus
16 reservierte Stoppplätze und höchstens 256 kurzlebige Statusmeldungen werden gehalten.

## Offene Abnahme und Grenzen

- Kein visueller Browsernachweis: lokaler Chromium-Start scheiterte vor der Seite
  an einer Sandbox-Umgebungsbeschränkung. Der verfügbare Cloud-Browser erreichte
  die lokale Prüfansicht nicht; der anschließende Zugriff wurde von seiner
  Sicherheitsrichtlinie abgewiesen. Es wurde kein alternativer Umgehungsweg verwendet.
- Echte Pointer-/Touch-Ereignisreihenfolge, Layout auf kleinen Displays,
  Safari/iOS/Android und optionales Vibrationsfeedback sind am Endgerät offen.
- Keine physische Geräteabnahme oder Kundenanlage für diesen Stand; DOM-/Netzwerk-
  Simulationen bestätigen keine tatsächlich bewegte Jalousie oder geschaltete Last.
- Frühere Controller-Integrationsberichte bleiben historische Nachweise für ihre
  jeweiligen Pakete; sie sind kein neuer Controllerlauf mit 9.0.9.
- Frühere Grenzen der Bestandsmigration, TLS-Vertrauensverteilung und lokalen
  Namensauflösung bleiben bestehen. Der UI-Auftrag ändert diese Bereiche nicht.
- Keine allgemeine Produktivfreigabe, Normzertifizierung oder CRA-Konformität aus
  diesen Entwicklungsnachweisen. Für die Freigabe ist die gezielte Anlagenabnahme erforderlich.

## Referenz und weitere Nachweise

- [Update und Bedienung](../../../START_HIER_9.0.9.md)
- [Referenzabgleich und Lizenz](DEVICE_UI_REFERENCE.md)
- [Sicherheitsdelta](SECURITY_DELTA_REVIEW.md)
- [Prüfprotokolle](raw/INDEX.json)
- SBOM und Integritätsliste: `release-manifests/unified/`

Die Integritätsliste ist keine Hersteller-Signatur. Download-Hashes und der
Vergleich der Archivbytes mit den geprüften Quellen werden separat mitgeliefert.
