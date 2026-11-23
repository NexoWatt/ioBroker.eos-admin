# SmartHome-Bedienoberflächen: Referenz und Abgrenzung 9.0.9

Stand: 23.11.2026. Diese Datei dokumentiert die geprüfte Entwurfsreferenz und den vorgesehenen Übernahmeumfang. Ausgeführte Produktprüfungen werden im allgemeinen 9.0.9-Prüfbericht ausgewiesen.

## Herkunft

- Vom Nutzer bereitgestellte Datei: `ioBroker.devices-master.zip`.
- SHA-256 des unveränderten Eingangsarchivs: `a0166efec63ae7e5dc5ce3d25d41e60a321f7f58444c127c2cc4c9535a46ba2f`.
- Paketangabe im Archiv: `iobroker.devices` **4.4.0**, Repository `https://github.com/ioBroker/ioBroker.devices`.
- Der Name `master.zip` bezeichnet keinen nachgewiesenen Git-Commit. Die Zuordnung erfolgt hier ausdrücklich über Archivhash und enthaltene Paketmetadaten.
- Lizenz laut mitgelieferter Datei: **MIT**, Copyright (c) 2019–2026 bluefox. Der unveränderte vollständige Lizenztext wird vorsorglich unter [ui/www/licenses/iobroker-devices-MIT.txt](../../../ui/www/licenses/iobroker-devices-MIT.txt) mitgeführt.

Die untersuchten Oberflächen liegen im Archiv unter `src-admin/src/WidgetsManager/Widgets/`. Relevant sind insbesondere `Generic.tsx`, `Switch.tsx`, `Dimmer.tsx`, `ColorLight.tsx`, `Thermostat.tsx`, `Blind.tsx`, `BlindButtons.tsx`, `Button.tsx`, `MediaPlayer.tsx`, `Camera.tsx`, `TouchSafeSlider.tsx` und `touchGesture.ts`.

## Übernahmeumfang

Übernommen werden Bedien- und Darstellungsmuster für die vorhandenen EOS-SmartHome-Gerätetypen. Die Implementierung erfolgt innerhalb der bestehenden EOS-Oberfläche mit NexoWatt-Gestaltung; die neuen Interaktionshelfer sind eigener Projektcode. Es wird weder der vollständige ioBroker.devices-Adapter noch sein React-/MUI-Frontend eingebaut.

Insbesondere werden keine zusätzliche Geräteerkennung, Alias-Erzeugung, Backend-Kommunikation, Plugin-Dienste, Module-Federation-Lader oder fremden Widget-Laufzeiten hinzugefügt. Die vorhandenen EOS-APIs, Gerätezuordnungen, zentralen Rechte und die gemeinsame Systemlizenz bleiben die maßgebliche Grenze. Die Referenz stellt keine zusätzliche unterstützte Geräte- oder Protokollliste für EOS dar.

| Vorhandene EOS-Kachel | Referenzmuster | Grenze |
| --- | --- | --- |
| Schalter/Licht | Aktives Icon, eindeutiger Status, sichtbarer Ein/Aus-Schalter | Nur vorhandene Schreibfreigabe und gültige Rückmeldung verwenden. |
| Dimmer | Prozent-/Füllstand, kontrolliertes Ziehen und Detailansicht | Wertebereich und Schrittweite stammen weiterhin aus EOS. |
| Farblicht | Farbfläche, Helligkeit und separater Schalter | Nur tatsächlich vorhandene Farb-/Power-Funktionen anbieten. |
| Beschattung | Position und klar getrennte Auf/Stopp/Ab-Bedienung | EOS-Sperr-, Wind-, Regen- und Frostprüfungen erhalten; Stopp unabhängig behandeln. |
| Thermostat/RTR | Große Temperatur, getrennte Ist-/Sollwerte, Einstellbogen und Schritttasten | Keine zusätzliche Heiz-/Kühlfunktion aus dem Referenzumfang ableiten. |
| Taster/Szene | Deutlicher Auslöser und kurzzeitiges Druck-/Sendefeedback | Kein Dauerzustand und keine physische Bestätigung aus einem Tastendruck ableiten. |
| Sensor/Kontakt | Messwert, Einheit, Zustand und Qualitätsanzeige | Keine scheinbare Bedienfunktion für reine Lesewerte. |
| Audio | Cover, Titel, Wiedergabestatus und Detailbedienung | Vorhandene Player-Aktionen und Zonen erhalten. |
| Kamera | Vorschau und deutlicher Zugang zur Ansicht | Keine neue PTZ-Funktion, Berechtigung oder externe Quelle allein aus der Vorlage. |
| Eingebettetes Widget | Einheitlicher Rahmen und zugängliche Bedienung | Bestehendes EOS-Sandboxing und URL-Prüfung beibehalten. |

Ein Schloss-Icon begründet keinen neuen Schloss-Gerätevertrag. Die reine Frontend-PIN-Abfrage der Referenz wird nicht als Sicherheitsmechanismus übernommen.

## Druck- und Touch-Rückmeldung

Die Referenz trennt bei Schiebereglern bewusstes Ziehen vom vertikalen Scrollen. Ihr `TouchGestureGuard` verwendet unter anderem `pan-y`, eine Bewegungstoleranz, eine Richtungsprüfung und eine Erkennung vorangegangenen Scrollens. Diese Prinzipien dienen der eigenen EOS-Implementierung als Referenz; die konkrete Ausführung und Prüfung sind separat nachzuweisen.

Ein sichtbarer Druckzustand bestätigt zunächst nur die Eingabe. Während der API-Anfrage wird ein laufender Vorgang angezeigt. Eine angenommene Anfrage darf als gesendet bezeichnet werden; der tatsächliche Gerätezustand muss weiterhin aus seiner Rückmeldung stammen. Die Referenz zeigt beim Taster bereits unmittelbar für 1.200 ms einen optimistischen Sendezustand. Das ist ausdrücklich kein Nachweis einer physischen Ausführung.

Scrollen, ein abgebrochener Zeigerkontakt und das Öffnen eines Detaildialogs dürfen keine zusätzliche, unbeabsichtigte Geräteaktion auslösen. Tastaturbedienung, reduzierte Bewegung, schreibgeschützte Kacheln und die getrennte Verfügbarkeit eines zulässigen Stoppbefehls gehören zur EOS-Abnahme.

## Lokale Browser-Prüfgrenze

Ein einzelner Startversuch mit dem vorhandenen `/usr/bin/chromium` und `playwright-core` wurde ausgeführt: Headless-Betrieb, Chromium-Sandbox eingeschaltet, ausschließlich eine lokale `about:blank`-Seite mit synthetischem Inhalt vorgesehen. Produkt- oder Kundenseiten wurden nicht aufgerufen.

Der Browser brach vor der Seitenerzeugung mit `SIGABRT` ab. Maßgebliche Meldung: `FATAL:chrome/browser/process_singleton_posix.cc:297` – `socket() failed: Operation not permitted (1)`; zusätzlich meldete Crashpad `ptrace: Operation not permitted`. Der Prüfprozess endete mit Exitcode 1. Es wurde kein weiterer Start mit abgeschalteter Sandbox versucht. Daher ist dieser Versuch kein visueller Browsernachweis; DOM-/Vertragstests sind davon getrennt auszuweisen.
