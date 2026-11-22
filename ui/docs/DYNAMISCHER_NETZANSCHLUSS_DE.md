# Dynamischer Netzanschluss – eigene App

Stand 1.0.28, 23.10.2026. Die App fasst die aktive M0/M1-Regelung und ihre Gerätezuordnungen an einem Ort zusammen. Herstellername und Geräteprofil entscheiden nicht über die Nutzbarkeit: Maßgeblich sind die dokumentierten Datenpunkte, Einheiten, Vorzeichen, Leistungsgrenzen und Rückmeldungen des angeschlossenen Geräts. TESVOLT, FENECON oder andere Hersteller sind keine Voraussetzung.

## Einrichtung

1. **EMS Apps** öffnen, im App-Katalog **Dynamischer Netzanschluss** installieren und speichern. Die Einrichtung anschließend im zugehörigen Reiter innerhalb von EMS Apps öffnen. Auf der Startseite gibt es dafür keine eigene Kachel.
2. **M0** kontrollieren. Die Messzuordnung stammt aus **Zuordnung → Allgemein** und wird hier angezeigt, nicht nochmals eingegeben. Eine signierte Netzleistung oder ein vollständiges, zeitlich zusammenpassendes Bezug-/Einspeisepaar ist erforderlich.
3. **M1** dem zweiten Zähler zuordnen. Einheit, Vorzeichen, zulässiges Alter und für beide Anschlusspunkte Import-/Exportgrenzen und Reserven festlegen. M1 liegt elektrisch innerhalb von M0.
4. Speicher hinzufügen. Je Speicher physischen Anschluss, Regelbereich, Gruppe, Betriebsart, Istleistung, SoC, Leistungs-/SoC-Grenzen und Schreibdatenpunkte zuordnen. Eine bereits installierte Einzel-Speicher- oder Speicherfarm-App ist keine Voraussetzung.
5. Bei Bedarf PV-Wechselrichter mit Anschlussbereich, aktueller AC-Erzeugung, Bezugsleistung und Ausgang für die Erzeugungsbegrenzung zuordnen. Eine Netzeinspeisegrenze ist kein austauschbarer Ersatz für eine Erzeugungsgrenze. Vorhandene EVU-Stufen werden nur auf ausdrücklich dafür zugeordnete Wechselrichter angewandt.
6. Entwurf speichern, Vorschau und Messwerte prüfen. **Speichern und aktivieren** aktiviert die dynamische Regelung als App-Zustand. Unvollständige Entwürfe dürfen gespeichert werden; Aktivierung setzt vollständige und widerspruchsfreie Zuordnungen voraus.

Der App-Zustand „installiert und aktiviert“ ist die einzige Aktivierung. Es gibt keinen zweiten versteckten Dynamik-Schalter in der Speicherfarm. Der bisherige Diagnosevertrag aus 1.0.24 bleibt für alte Konfigurationen kompatibel; seine historischen Diagnosewerte sind keine Freigabe für neue Befehle.

Die Speicherknöpfe im Einrichtungsformular übernehmen dessen Änderungen direkt. Danach ist kein zusätzlicher Klick auf den oberen globalen Speicherknopf nötig. Zeigt das App-Center einen inzwischen geänderten Stand an, vor weiteren Änderungen anderer Apps die Gesamtansicht über „Neu laden“ aktualisieren; noch ungespeicherte Eingaben zuvor prüfen.

## Datenpunkte auswählen und Übersicht

Die Einrichtung füllt die gesamte untere Kachel im EMS App-Center. Sie verwendet dieselben Karten, Eingabefelder, Buttons und den gemeinsamen Datenpunkt-Dialog wie die anderen EMS-Apps. Der zusätzliche innere Seitenkopf und die feste innere Scrollfläche entfallen.

Neben den Zuordnungsfeldern für M1, Speicher und PV öffnet **DP wählen** den vorhandenen Datenpunkt-Browser. Dort den Objektbaum oder die Suche verwenden und einen Datenpunkt auswählen. Die ID wird in das zugehörige Feld des aktuellen Entwurfs übernommen; eine vollständige ID lässt sich weiterhin direkt eingeben. Die Auswahl allein speichert keine Konfiguration und sendet keine Gerätebefehle. Erst der Speicherknopf übernimmt den Entwurf. **M0** bleibt eine schreibgeschützte Anzeige der Zuordnung unter **Allgemein**.

## Betriebsarten und generische Anbindung

| Einstellung | Bedeutung |
| --- | --- |
| Eigenverbrauch / EVO | Bestehende Eigenverbrauchs- und SoC-Regeln im zugeordneten Regelbereich |
| Nulleinspeisung | Lokale Exportvermeidung innerhalb des zugeordneten Messpunkts |
| Lastspitzenkappung | Speicherunterstützung für die konfigurierte Bezugsgrenze |
| Tarif | Bestehende Tarif- und Netzladefreigaben mit den eigenen Speichergrenzen |
| Arbitrage, EOS | Frische externe Leistungsanforderung als Wunschwert; die gemeinsame Netzbegrenzung bleibt wirksam |
| Arbitrage, extern | Ein externer Regler entscheidet innerhalb ausdrücklich bestätigter Lade-/Entladegrenzen |

Speicherleistung ist in EOS positiv beim Entladen, negativ beim Laden; Netzleistung positiv beim Bezug. Leistungsmessungen unterstützen W und kW mit explizitem Vorzeichen. Bei Ausgängen bezeichnet `scale` Watt je Rohwerteinheit: 1 für Watt, 1000 für kW. Ein einzelner signierter Sollwert und getrennte Lade-/Entladesollwerte sind unterstützt. Bei Richtungswechsel wird zuerst die Gegenrichtung neutralisiert und deren Rückmeldung geprüft.

Extern geregelte Speicher benötigen tatsächliche Grenzrückmeldungen und einen dokumentierten lokalen Watchdog-Vertrag mit Ablaufwirkung. Das ist eine Geräteschnittstelle, keine Herstellerfreigabeliste. Ein bestätigter Schreibauftrag beweist keine physische Wirkung. Die Anzeige unterscheidet Anforderung, angenommene beziehungsweise rückgemeldete Vorgabe und gemessene Leistung.

## Zuständigkeit, Fehler und Übergabe

Die App reserviert ihre Ausgänge bereits vor dem ersten Regelzyklus. Einzelregler, Farm, manuelle APIs und andere Regeln dürfen dieselben Ziele nicht parallel beschreiben. Alias-Schreibseiten werden ebenfalls berücksichtigt. Vorhandene Strategien liefern Entscheidungen; der finale App-Writer führt die abgestimmten Befehle aus.

Jeder Regelzyklus prüft Messalter, Qualität, zeitlichen Zusammenhang, Gerätegrenzen und den aktuellen Konfigurationsstand. Alte Freigaben und noch nicht physisch bestätigte neue Vorgaben bleiben bei der Budgetberechnung berücksichtigt. Eine Ladefreigabe ist keine zugesicherte PV-Aufnahme; ein möglicher PV-Ausfall wird für den Netzbezug berücksichtigt. Speicher außerhalb M1 können eine lokale M1-Verletzung nicht beheben.

Bei fehlenden oder veralteten Messwerten erfolgt keine neue Leistungsfreigabe. Eine Nullvorgabe ist kein pauschaler sicherer Zustand, wenn bisherige Speicherleistung die Netzgrenze stützt. Deaktivierung und Umzuordnung benötigen deshalb eine kontrollierte Übergabe; bis zu deren Bestätigung bleibt die alte Schreibhoheit erhalten. Den angezeigten Übergabestatus prüfen, bevor eine andere Regelung übernimmt.

## Update und Anlagentest

Version 1.0.28 vereinheitlicht die Darstellung unter EMS Apps und ergänzt die Datenpunkt-Auswahl. Nach dem Update die EMS-Apps-Seite vollständig neu laden, damit App-Center und eingebettetes Formular denselben Stand verwenden. [Bedienungskorrektur und Prüfungen](reports/dynamic-grid-ui-2026-10-23/PRUEFVERMERK_DE.md).

Version 1.0.27 korrigiert den Fehler `DYNAMIC_GRID_VERSION_CONFLICT` beim ersten Speichern der App-Installation. Nach dem Update die EMS-Apps-Seite vollständig neu laden, damit der korrigierte Speicherablauf verwendet wird. Ein echter Konflikt durch zwischenzeitliches Speichern in einer anderen Ansicht erfordert weiterhin das bewusste Laden und Prüfen des aktuellen Standes. Ungespeicherte Eingaben werden nicht automatisch mit fremden Änderungen zusammengeführt. [Korrektur und Prüfungen](reports/dynamic-grid-save-2026-10-23/PRUEFVERMERK_DE.md).

Vor Update Konfiguration und bisherigen vollständigen Quellstand sichern. Eine bestehende Installation aktiviert die neue App nicht automatisch. M0-Vorzeichen zuerst mit bekanntem Bezug prüfen, anschließend M1, SoC und Speicher-Vorzeichen. Mit begrenzten Sollwerten beide Richtungen, Rückmeldungen, Gerätegrenzen, Kommunikationsverlust und Wiederanlauf prüfen. Danach M0/M1 gemeinsam und erst zuletzt Arbitrage-/PV-Verbund testen.

Die dokumentierten Softwaretests ersetzen keine Messung am angeschlossenen Gerät. Der Teststand ermöglicht den beauftragten Eigentest; eine allgemeine Produktiv- oder Konformitätsfreigabe ist daraus nicht abgeleitet. Bei Rückkehr zum vorherigen Paket zunächst eine bestätigte Übergabe herstellen, dann gesicherte Konfiguration wiederherstellen. Ein bloßer Prozessabbruch ist kein Nachweis eines Gerätestopps.

Technischer Vertrag: [Datenmodell und Schnittstellen](dev/DYNAMIC_GRID_CONTRACT.md). Tatsächliche Prüfungen: [Prüfvermerk](reports/dynamic-grid-2026-10-23/PRUEFVERMERK_DE.md).
