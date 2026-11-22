# Auslieferung, sicherer Betrieb und Abnahme

Stand: 1.0.22 Security Review, 29.09.2026. **Nicht produktiv freigegeben.**
Der verbindliche maschinenlesbare Status steht in
[`release-manifests/release-status.json`](../../release-manifests/release-status.json).
Ein bestehender Dateiname mit „STABLE“ oder ein bestandener Build ist keine
Sicherheits-/Serienfreigabe.

Die Produkt-/Serienfreigabe wird mit `npm run release:production-check` getrennt
vom normalen npm-Upload geprüft. Dieser Befehl führt `release:approval` und danach
`release:check` aus. Bei `productionApproved: false` meldet die gesonderte Prüfung
weiterhin die fehlende Freigabe; `npm publish` und `PUBLISH_NPM.cmd` durchlaufen
die technischen Paketprüfungen ohne diese zusätzliche Freigabesperre.
Der Nutzer hat Tests auf seinem eigenen Livesystem ausdrücklich vorgesehen.
Dieser Testablauf wird durch die offene allgemeine Produktivfreigabe nicht
technisch gesperrt; dokumentierte Ergebnisse der Eigentests stehen noch aus.

## Gates

| Gate | Vor Freigabe erforderlicher Nachweis | Aktueller Abnahmeort |
| --- | --- | --- |
| G1 Lieferidentität | Eindeutige Version, Eingangshash, aktuelle Quellen-/Artefakthashes, Paketinhalt und Herkunft stimmen überein | Release-Manifest und aktueller Prüfbericht |
| G2 Sicherheit | Keine ungeklärte bekannte ausnutzbare Schwachstelle im vorgesehenen Profil; Befunde mit Nachtest bewertet | [Befundregister](../security/BEFUNDREGISTER_DE.md) |
| G3 Regression | Vorgeschriebene Builds/Tests einschließlich Auth-, API-, Regelungs- und Geheimnisprüfungen tatsächlich erfolgreich | [Prüfbericht](../reports/cra-2026-09-29/PRUEFBERICHT_DE.md); fehlende Tests bleiben offen |
| G4 Lieferkette | Aufgelöste Komponentenliste/SBOM, Lizenzen und aktuelle Advisory-Bewertung; kein automatisches unkontrolliertes Major-Update | Komponenten-/SBOM-Unterlagen des Lieferstands |
| G5 Endgerät | Hardware/OS/Node/Controller/Adapter/Firmware fixiert; Netz-/Rechte-/TLS-Profil und Ressourcenlast geprüft | **Offen**, kein vollständiges Gerät geliefert |
| G6 Anlagenfunktion | Kommunikationsverlust, ungültige/veraltete Werte, Ausfall/Neustart und sichere Wiederaufnahme gerätespezifisch bestanden | **Offen**, Hardware-/Integrationsprotokoll nötig |
| G7 Wartung | Neuinstallation, Overlay, Update, Rückfall und Restore einschließlich Geheimnisse/Archive nachgewiesen | Paketprüfung im Bericht; Endgerät-/Restore-Abnahme **offen** |
| G8 Hersteller | Klassifizierung, Verfahren, Support, Meldestelle, Verantwortlichkeit, Unterlagen und Freigabeentscheidung abgeschlossen | **Offen**, siehe Supportakte |

Bekannte ausnutzbare Schwachstellen, fehlgeschlagene kritische Prüfungen oder
ungeklärte Integrität sperren die Auslieferung im betroffenen Profil. Ein akzeptiertes
Restrisiko braucht Verantwortlichen, Begründung, Kompensation, Geltungsbereich und
Überprüfungstermin; es ersetzt keine gesetzliche Anforderung.

## Endgeräteprofil

1. Betriebssystem und Node-Version mit Hersteller-Support, minimalen Diensten und
   eigenem unprivilegiertem ioBroker-Konto bereitstellen; Dateisystemrechte prüfen.
2. Nur freigegebene, konkret versionierte Adapter installieren. Administrations-
   und Kundenkonto trennen; gemeinsame Werks-/Standardpasswörter vermeiden.
   Beliebige Paketquellen und zusätzliche Adapter verändern den geprüften Stand.
3. Browserzugang verschlüsselt und mit überprüfbarem Zertifikat bereitstellen.
   Der EOS-HTTP-Listener darf im TLS-Proxy-Profil nicht separat erreichbar bleiben.
   Proxyheader dürfen nur aus der vorgesehenen Vertrauensgrenze wirken. Cookie-
   Attribute, Hostnamen, Authentifizierung und Origin-Regeln am echten Zugang testen.
4. ioBroker-Admin, Datenbanken, Protokollports und Wartungszugänge nur für notwendige
   Systeme freigeben. Keine Internet-Portweiterleitung auf EOS oder ioBroker.
   Fernwartung/VPN benötigt individuelle Zugänge und Widerruf; dies ist Zusatzschutz.
5. Optionale Wetter-/Tarif-/SMTP-Verbindungen und Mesh für jedes Anlagenprofil
   dokumentieren. Für ein vollständig getrenntes Netz externe Funktionen deaktivieren
   bzw. lokale Datenquellen verwenden und den Offlinebetrieb tatsächlich testen.
6. Zeitbasis, begrenzte Logs und freien Speicher überwachen. Steuerbare Geräte,
   Messwertalter, Leistungsgrenzen und Rückfallstrategie vor Aktivierung abnehmen.

## Reproduzierbare Paketprüfung

Die Befehle sind vorgeschriebene Prüfschritte, keine Aussage über ihren Erfolg:

```sh
npm run test:all
npm run build:ts
npm run docs:check
npm run check:secrets
npm run publish:check
npm pack --dry-run --json --ignore-scripts
```

Release-Artefakte erst nach dem fachlichen Review erzeugen und prüfen. Ein Publish-
Schritt darf getestete Produktquellen/Bundles nicht heimlich neu bauen oder neu
versiegeln. Die Erzeugung von SBOM-Nachweisen ist von einem Neubau oder einer
Neuversiegelung des Produktcodes zu unterscheiden. Die automatische SBOM-Erzeugung
ist vor der Artefaktversiegelung durch `release:generate-manifest` eingeordnet.
Beim Publish prüft `verify-cra-sbom.cjs` die Nachweise ausschließlich lesend.
Den konkreten Upload-/SBOM-Ablauf und seine Nachtests dokumentiert der
[ergänzende Prüfbericht](../reports/cra-2026-09-29/NPM_UPLOAD_SBOM_KORREKTUR_DE.md).
Die zunächst in den normalen Upload eingebaute Produktivfreigabeprüfung wird
separat aufgerufen; ihr Ergebnis bleibt unabhängig vom technischen Paketerfolg.

Neu entpacktes Repository und Overlay auf den vorherigen Stand getrennt prüfen,
einschließlich alter Admin-Bundles, unverändertem aktuellen Build, Geheimnisfehlern
und wiederholter Vorbereitung. Die gesamte Publish-Kette nur gegen eine isolierte
lokale Testregistry prüfen. Ein externer npm-Upload ist keine Testvoraussetzung.

## Update und Wiederherstellung

Vor einem Testupdate: gewählte Zielversion/Hash prüfen, Konfiguration und alle
Instanzdaten konsistent sichern, ioBroker-Systemschlüssel geschützt mitsichern,
alte Version verfügbar halten und geplantes Wartungsfenster festlegen. Die
zusammengehörigen Sicherungen enthalten u. a. SMTP-Konfiguration, Mesh-Schlüssel,
lokale Journale, Benutzer-/Gruppenstände und relevante Historien-/Gerätedaten.
Eine Sicherung nur dieses Quellrepositorys ist kein Anlagenbackup.

Nach Update zuerst Diagnose-/Lesebetrieb prüfen: Anmeldung/Rechte, aktuelle
Messwerte, Kommunikationsstatus, gerätespezifische Limits und erforderliche
Persistenz. Umfang und Beobachtungen des vorgesehenen aktiven Eigentests dokumentieren;
eine allgemeine Produktfreigabe wird damit nicht vorweggenommen. Beim Rückfall keine
inkompatiblen Datenstrukturen ohne geprüfte Migration weiterverwenden.

Für einen Restore-Test wird ein separates System empfohlen: Entschlüsselbarkeit, Konfiguration,
Archive, Benutzerrechte, Gegenstellen/Widerruf und Gerätereaktionen kontrollieren.
Reale Aktoren während des Tests isolieren. Ein erfolgreiches Entpacken allein
ist keine Wiederherstellungsprüfung.
