<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt EOS 1.0.34 – Individuelle Benutzer und Gruppenrechte

Vollständiger Folgestand auf 1.0.33, damit auf 1.0.32 und 1.0.31. Dieser Stand ist nicht für den Produktivbetrieb freigegeben.

Jedes lokale ioBroker-Konto meldet sich mit seinem eigenen unveränderten Passwort an. Kurzkennung, auflösbarer Anzeigename und vollständige Konto-ID bleiben nutzbar. Die EOS-Rolle hängt ausschließlich von tatsächlicher Mitgliedschaft in gültigen, zugeordneten ioBroker-Gruppen ab. Benutzer dürfen beliebig heißen; auch `admin` und `installer` verleihen keine Rolle. Alte Benutzerlisten werden nicht mehr als Berechtigung ausgewertet.

Standardgruppen sowie bekannte EOS-Aliasgruppen bleiben zugeordnet. Eigene Anbietergruppen lassen sich unter Sicherheit in der ioBroker-Adapterkonfiguration zusätzlich Administrator, Installateur oder Kunde zuordnen. Ohne passende Gruppe gibt es keine EOS-Freigabe. Bei mehreren Mitgliedschaften gilt Admin vor Installateur vor Kunde. Gruppenobjekte werden auf Identität und Struktur geprüft; Fehler und Zeitablauf verweigern Zugriff. Bestehende Sitzungen lesen Gruppen erneut und übernehmen Entzug/Demotion beim nächsten geschützten Zugriff.

Vor dem Update Konfiguration sichern und Mitgliedschaften prüfen – auch das eingebaute `admin`-Konto benötigt eine tatsächliche Administratorgruppe. Benutzer, Passwörter oder Gruppen werden nicht automatisch geändert. Konten, die bisher ausschließlich über ihren Namen berechtigt waren, müssen bewusst einer passenden Gruppe zugeordnet werden. Rückfallstand 1.0.33 bereithalten; dessen dokumentierte Namensausnahmen bleiben bei einem Rückfall bestehen.

Die separate, ausdrücklich aktivierte Trusted-Header-Gatewaydelegation bleibt bestehen; sie ist keine lokale Benutzer-/Passwortanmeldung. Die produktiven Abhängigkeiten, Anlagenregelung und Partnerkonfiguration werden nicht erweitert.

[Einrichtung und Abnahme](operations/BENUTZER_GRUPPENRECHTE_DE.md) · [Prüfbericht und Grenzen](reports/groups-auth-2026-11-03/PRUEFBERICHT_DE.md).
