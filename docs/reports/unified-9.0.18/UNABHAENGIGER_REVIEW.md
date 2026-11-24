# Unabhängige Prüfung: Geräte → EMS und Kundentarif, Version 9.0.18

Stand: 24. November 2026. Geprüft wurden die automatische Übernahme gespeicherter Geräte mit nachgewiesenen Alias-V1-Objekten in die bestehende EMS-Konfiguration und die begrenzte Kundeneinstellung des anlagenweiten Tarifproviders. Die Prüfung erfolgte getrennt von der Implementierung der Zuordnungslogik, der API und ihrer Laufzeitanbindung.

## Nachgewiesenes Verhalten

Der zusätzliche Test `test/eos-device-ems-end-to-end.test.cjs` verwendet den echten Modulhost, das integrierte Gerätemodul, den Aliasgenerator der Profile `evcs.abl.emh1.evcc2_3.modbusAscii`, `ess.fenecon.FeneconHomeEssImpl` und `ess.solax.SolaXHybridX1X3Ess`, den Inventardienst, den Planer und die echte gehostete Laufzeitmethode `reconcileDeviceEms`. Die echte geschützte Persistenz nach `installer.configJson`, die Anlage fehlender EMS-Objekte und die Ladepunkt-Synchronisierung werden ausgeführt.

- Ein gespeichertes unterstütztes Wallboxgerät erscheint als zusätzlicher, dauerhaft gespeicherter Ladepunkt mit tatsächlich vorhandenen Alias-V1-Datenpunkten.
- Der neue Ladepunkt bleibt `enabled: false`. Zuordnung und Betriebsfreigabe sind getrennt. Die Zuordnung erzeugt keinen Gerätebefehl mit `ack: false`.
- Bestehende manuelle Zuordnungen, Kundennamen und Strombegrenzungen bleiben beim erneuten Speichern erhalten. Deaktivieren und erneutes Aktivieren erzeugen keine doppelten Ladepunkte.
- Nach Verwerfen der Laufzeitkonfiguration lädt die echte Methode `loadInstallerConfigFromState` denselben gespeicherten Stand wieder. Ein anschließender neuer Modulhost übernimmt dieselben Geräte- und Zuordnungskennungen.
- Ein bestätigter alter Namespace `nexowatt-devices.0` bleibt erhalten; Gerätekennungen mit Punkten werden korrekt verarbeitet.
- Ein konkurrierender Geräte-Speichervorgang während der EMS-Übernahme wird mit `EOS_MODULE_BUSY` abgewiesen und überschreibt den vorherigen Stand nicht.
- Eine vorhandene manuelle ioBroker-Aliaskette zum gleichen Wallbox-Schreibziel wird über die echte asynchrone Zielauflösung erkannt. Der zusätzliche Regler wird als Konflikt abgewiesen; der gespeicherte Kundenstand bleibt unverändert.
- In diesem Ablauf wurden keine Schreibzugriffe auf ioBroker-Admin, Administratorgruppen oder andere Adapter beobachtet. Zulässige Schreibziele sind der EOS-Namespace beziehungsweise bestätigte Alt-Namespaces und die bestehende zusätzliche Sicherung unter `0_userdata.0.nexowattVis`.
- FENECON Home erhält als inaktive Farmzeile getrennte tatsächliche Quellen: ESS-Rückmeldung Register 604, direktes ESS-Schreibziel 706 und nativen Netzzielpfad 992 mit `ctrlBalancing0`-Prüfung. Die Lesezuordnungen 315/343/702/704/339/331/327 und ihre Umrechnung von kW nach W werden am echten Profil geprüft. Ein Rücklesewert für das nur beschreibbare Register 706 wird nicht erfunden. Wiederholung erhält die eingestellte Ladeleistungsgrenze.
- SolaX Hybrid erhält allgemeine Speicherzuordnungen und echte optionale Lesealiase für Leistungsgrenzen 162/164 und Sollwertrücklesen 417, getrennt vom Schreibziel 161. Ein ungeklärtes Netzleistungs-Vorzeichen wird nicht als standardisierter NVP-Alias angeboten. Es werden keine FENECON-Reglerfelder, nativen Netzziele oder nicht belegten AC-/DC-PV-Aufteilungen ergänzt.
- Die gemeinsam wiederholte Aliasprüfung umfasst alle 195 Profile: 2463 bisherige kanonische Aliase bleiben erhalten, 89 zusätzliche ausschließlich lesende Aliase sind auf 25 Profile begrenzt. Fehlende, umadressierte, anders skalierte oder nur beschreibbare Quellen bleiben unverfügbar. Ein bestätigter Schreibauftrag wird nicht als tatsächlich zurückgelesener Sollwert ausgegeben.

## Kundentarif und laufende Regelung

`test/eos-customer-tariff-api.test.cjs` prüft acht Abläufe gegen die echte gehostete HTTP-Anwendung mit tatsächlicher geschützter Konfigurationspersistenz und echtem Tarifprovider samt `DatapointRegistry`. `test/eos-customer-tariff-consumer.test.cjs` prüft zwei Abläufe zusätzlich mit dem echten Verbraucher `TarifVisModule`.

- Anmeldung, gültige Rolle, Energiefreigabe, Origin und CSRF bleiben erforderlich. Der Kundenzugang öffnet die allgemeine Installer-Konfiguration nicht. Fremde Endpunkte, freie Datenpunktpfade, App-Aktivierungen und zusätzliche Felder werden abgewiesen.
- Teiländerungen erhalten manuelle Zuordnungen, Geräte, Grenzwerte und EMS-App-Konfiguration. Leere Zugangsfelder erhalten nur zulässige bestehende Zugangsdaten. Ein Anbieterwechsel, einschließlich ENTSO-E zu einem Marktprofil mit gleicher Quelle, benötigt einen erneut eingegebenen passenden Token.
- Zugangsdaten erscheinen nicht in der Kundenantwort. Zur Wiederherstellung aufbewahrte frühere Zugangsdaten bleiben in geschützten Zuständen; sie werden aus Installer-Ansicht, JSON-Export und dem HTTP-Abruf der Zusatzsicherung entfernt. Eine Aussage über zusätzliche Verschlüsselung dieser Tarifdaten wird daraus nicht abgeleitet.
- Eine ausdrückliche Zustimmung ordnet genau vier Preis-Eingänge zu. Die sechs tatsächlichen Laufzeitschlüssel der Verbraucher wechseln mit; beim Abwählen werden die vorherigen Preiszuordnungen wiederhergestellt. Neue Anschlüsse erhalten keine automatische Tarif-/Betriebsfreigabe. Bestehende explizite Aktivierungsoptionen bleiben auch bei einem zuvor deaktivierten Provider erhalten.
- Veraltete Editorstände und fehlgeschlagene Persistenz überschreiben den bestätigten Stand nicht.
- Bei Anbieterwechsel werden direkte Preise und Kurven sofort unbrauchbar. Der echte Tarifverbraucher kann während verzögerter Datenbankantworten keine günstige Preisfreigabe aus der alten Quelle bilden. Auch ein bereits laufender alter positiver State-Schreibvorgang kann den Preis während der ausstehenden Löschung nicht erneut für die Regelung nutzbar machen.

## Befunde und Behandlung

| Prüffeld | Ergebnis |
| --- | --- |
| Implizite Ladepunktaktivierung | Neue Einträge setzen ausdrücklich `enabled: false`; die vorhandene Laufzeit behandelt ein fehlendes Flag sonst als aktiv. |
| Eigene Aliasvarianten / Schreibrechte | Tatsächliche Objekte, Templatekennung, Aliasversion, Manifest-Fähigkeiten, Typ, Einheit und Schreibrecht werden geprüft. Fehlende Metadaten bleiben ausstehend. |
| Unbeabsichtigtes Überschreiben | Nichtleere manuelle Zuordnungen bleiben maßgeblich. Rollen-/Slotwechsel entfernen bestehende Zuordnungen nicht automatisch. |
| Persistenz / Neustart | Geschützter Konfigurations-Commit und echte Wiederherstellung aus dem State erfolgreich getestet. |
| Geräte-/App-Deaktivierung | Zuordnungen und Datenpunktobjekte bleiben erhalten; automatisch zugeordnete Regelzeilen werden bei deaktiviertem/entferntem Quellgerät nicht selbsttätig wieder aktiviert. |
| Veraltete App-Center-Ansicht | Versionsprüfung für Installer-Konfiguration ergänzt; gesonderte Laufzeittests des Lifecycle-Teils prüfen Konflikte. |
| M0/M1 und Erzeugerzuordnung | Explizite Messpunkt-/Slotwahl erforderlich. Belegte Slots und doppelte Messquellen werden abgewiesen. Hybrid-`powerBalance` wird nicht als Speicherregel- oder PV-Erzeugungsmessung geraten. |
| Speicheroptionen | Vorhandene Optionen eines noch nicht zugeordneten Einzelspeichers bleiben erhalten. Einzel- und Farmregelung verwenden unterschiedliche, bestehende Konfigurationsfelder. |
| Fremde ioBroker-Aliasketten | Der zunächst fehlende Anschluss der Zielauflösung wurde ergänzt: begrenzte Einzelabfragen, getrennte Lese-/Schreibzeiger, Zyklus-/Tiefengrenze, keine systemweite Objektsuche. Produktionsanbindung im Code und tatsächlicher Konfliktablauf im fünften Integrationstest geprüft. |
| Generierte Heartbeat-/Rechenaliase | Der Integrationstest deckte anschließend einen Fehler auf: gültige ABL-Aliase ohne einzelne `dpId` blockierten Folgeübernahmen mit `EOS_EMS_TARGET_RESOLUTION_PENDING`. Verifizierte lesende Aliase werden jetzt als eigenständige Quellen behandelt; fehlende Schreibziele werden weiterhin nicht erfunden. Wiederholung und Wiederherstellung bestehen. |
| Tarifzuordnung ohne Neustart | Die erste API-Version aktualisierte nur UI-Abonnements; die tatsächlichen EMS-Leser behielten die bisherigen Quellen. Der unabhängige HTTP-Test reproduzierte das. Der Tarifprovider bindet jetzt ausschließlich die sechs zugehörigen Leseschlüssel neu; Zustimmung und Rücknahme sind geprüft. |
| Verspäteter alter Tarif-State | Die Prüfung reproduzierte eine zwischenzeitliche Reaktivierung eines alten günstigen Preises durch eine schon laufende State-Schreiboperation. Die neue Lesesperre für exakt die eigenen Preisquellen bleibt bis zum erfolgreichen Abschluss der aktuellen Löschveröffentlichung bestehen. Der echte Tarifverbraucher bleibt auch in diesem Zwischenzustand ohne alte Preisfreigabe. |

## Ausgeführte Prüfungen und Grenzen

Laufzeit dieser unabhängigen Prüfungen: Node.js `v24.22.3`.

```text
node --test test/eos-device-ems-end-to-end.test.cjs test/eos-device-ems-plan.test.cjs test/eos-device-ems-runtime.test.cjs test/eos-customer-tariff-api.test.cjs test/eos-customer-tariff-consumer.test.cjs test/eos-customer-tariff-runtime.test.cjs modules/devices/test/aliasContractV1.test.js modules/devices/test/deviceAliasSemantics.test.js
85 bestanden, 0 fehlgeschlagen, 0 übersprungen.
Davon 17 unabhängig ergänzte Integrationstests: 7 Geräte, 8 HTTP, 2 Tarifverbraucher.
```

Diese Wiederholung erfolgte nach dem aktuellen UI-Laufzeitbuild, der Korrektur der generierten Heartbeat-/Rechenaliase, der gezielten Tarif-Laufzeitzuordnung, der Sperre verspäteter Preisereignisse und der Erhaltung expliziter Tarifoptionen. Die vollständigen Releaseprüfungen unter Node.js 22 und 24 werden im übergeordneten Releasebericht dokumentiert.

Die Zielauflösung beweist Datenpunktidentität, keine vollständige elektrische Topologie. Dass zwei separat angelegte Geräteprofile unter verschiedenen Gerätebasen dieselbe physische IP-/Bus-Hardware ansprechen, wird daraus nicht automatisch erkannt. Die Anlagenzugehörigkeit und getrennte Messung von PV-Gruppen muss der Installateur bestätigen. Neue Regler bleiben deshalb zunächst inaktiv.

**Testgrenze:** Controller-Objekt-/State-Datenbank, Sitzungen und Hardwaretransport sind lokale Testimplementierungen. Der echte Gerätemodulstart erzeugt echte profilabhängige Aliasobjekte, öffnet jedoch keine physische Verbindung. Die Hintergrund-EMS-Ausführung wird im Geräteintegrationstest durch die echte Ladepunkt-Konfigurationssynchronisierung ersetzt; die Tarifverbrauchertests führen gezielt echte Modulticks aus. Externe Tarifserver werden nicht kontaktiert. Kein Nachweis für reale Hardware, reale Reglerausgabe, Anbieter-Vertragsgültigkeit, eine Kundenmigration, die Erreichbarkeit eines produktiven ioBroker-Admin-Prozesses oder einen Langzeit-/Lastbetrieb. UI-DOM-Tests sind kein Smartphone-/Browsernachweis. Die Prüfung bestätigt insbesondere keine allgemeine CRA-Konformität.
