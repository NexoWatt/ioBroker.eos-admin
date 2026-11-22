# EMS Apps: Navigation, Lizenz und Bestandskompatibilität

Stand: 23.10.2026. Diese Beschreibung gehört zur Korrektur der Navigation nach Einführung des dynamischen Netzanschlusses. Sie ersetzt keine Inbetriebnahmeprüfung an realen Geräten.

## Navigation

Die technische Einrichtung und Aktivierung von EMS-Regelungsapps liegt ausschließlich unter **EMS Apps**. Die Installer-Startseite öffnet diesen übergeordneten Bereich; sie enthält keine zusätzliche Startkachel für den dynamischen Netzanschluss. VIS, Simulation, SmartHome sowie die rollenabhängige Mail- und Lizenzverwaltung bleiben erhalten.

Der dynamische Netzanschluss erscheint im vorhandenen App-Katalog. Nach der Installation und dem erfolgreichen Speichern öffnet **Dynamischen Netzanschluss einrichten** den zugehörigen Reiter innerhalb von EMS Apps. Dort ist die bestehende geschützte React-Detailansicht eingebettet. Eine noch ungespeicherte Installation zeigt lediglich den Hinweis, zuerst zu speichern. Andere App-Schalter laden ein bereits geöffnetes Formular nicht neu; dadurch bleibt dessen ungespeicherter Entwurf erhalten. Eine Abwahl der Installation entfernt die eingebettete Ansicht wie bei den übrigen installabhängigen Modulreitern.

M0 bleibt mit der Zuordnung unter **Allgemein** verknüpft und schreibgeschützt in der App sichtbar. Der Verweis auf Allgemein und **Zu EMS Apps** wechseln bei Einbettung die übergeordnete Seite; sie erzeugen kein verschachteltes AppCenter. Die bestehende Direktroute `/ems/dynamic-grid/#/dynamic-grid` bleibt für vorhandene Links nutzbar. Routen- und API-Berechtigung bleiben auf Installer/Admin begrenzt; die Navigation ersetzt diese Prüfung nicht.

Die Speicherfarm enthält keinen eigenen Konfigurationseinstieg zum dynamischen Netzanschluss mehr. Die lesenden Kundenansichten für Speicherfarm und Ladepunkte sowie vorhandene Tarif-/PV-Bedienfelder bleiben erhalten. Diese Korrektur verschiebt technische App-Einrichtung und verändert keine bereits vorhandenen Kunden-Bedienberechtigungen oder Regelparameter.

### Betroffene Quellen

Ab 1.0.27 übermittelt auch der globale Speicherknopf die zuletzt geladene Dynamic-Grid-Version. Das behebt den fälschlichen Versionskonflikt bei der Erstinstallation. Änderungen aus anderen Ansichten bleiben durch die serverseitige Versionsprüfung geschützt. Nach dem Update die Seite vollständig neu laden; bei einem späteren echten Konflikt den angezeigten aktuellen Stand prüfen, bevor erneut gespeichert wird. [Prüfvermerk 1.0.27](../reports/dynamic-grid-save-2026-10-23/PRUEFVERMERK_DE.md).

- `src-admin-tab/src/pages/InstallerPage.tsx`: übergeordnete Bereichseinstiege statt app-spezifischem Regelungsbutton.
- `src-admin-tab/src/pages/DynamicGridPage.tsx`: bestehende Detailansicht mit passendem eingebettetem Rückweg.
- `src-ts/runtime-executables/www/ems-apps.ts` und der manuell typisierte Spiegel: vorhandener Katalog-/Reitermechanismus, Installation vor Einbettung, Erhalt des Formularentwurfs.
- `www/ems-apps.html`: Modulreiter und Einbettungsziel.
- `www/storagefarm.html`: Entfernung des zusätzlichen Konfigurationseinstiegs; Kundenanzeige unverändert.

### Gezielte Prüfungen

- `node test/frontend-ems-navigation.cjs`: tatsächlicher React-Renderer und Click-Handler für Installer/Admin sowie M0-Verweis im eigenständigen und eingebetteten Modus.
- `node test/frontend-nvp-topology.cjs`: bestehender Formular-/Rollen-/API-Vertrag.
- `NW_PLAYWRIGHT_MODULE=<Playwright-Modul> CHROMIUM_BIN=<Chromium> node test/browser-ems-navigation.cjs`: tatsächlicher App-Katalog mit aktueller isoliert übersetzter Runtime-Quelle und gebauter React-App, Installieren/Speichern, interner Reiter, Entwurfserhalt, Rückwege, Rollen und mobile Breite. Verwendet lokale API-Fixtures, keine Hardware.
- `NW_PLAYWRIGHT_MODULE=<Playwright-Modul> CHROMIUM_BIN=<Chromium> node test/browser-nvp-topology.cjs`: bestehender Browsercheck des vollständigen dynamischen Einrichtungsformulars.

Interne Browseraufnahmen werden außerhalb des Repositorys abgelegt. Der releasebezogene Prüfbericht enthält die tatsächlichen Ergebnisse; die Aufzählung der Prüfkommandos allein stellt keinen bestandenen Prüfnachweis dar.

## Bestandslizenzen ab 1.0.26

Die bisherige Lizenzstrategie aus 1.0.21 bleibt für die laufenden ioBroker-Feldtestanlagen erhalten. Unterstützt sind NW1, NW1E, NW1H, NW1T, NW1TE und NW1TH. Vorhandene gültige Schlüssel werden wieder ohne zusätzliche Dienstvariable geprüft. Die zwischenzeitliche Anweisung zur Installation einer privaten Lizenz-Umgebung ist für diese Bestandskeys keine Updatevoraussetzung mehr. Es ist kein neuer Schlüssel erforderlich.

Die Prüfung erfolgt weiterhin gegen die System-UUID und die jeweilige Signatur. Home-/Pro-Zuordnung und Funktionsgrenzen bleiben erhalten. Für denselben Testschlüssel werden der gespeicherte Beginn, Ablauf und letzte Prüfzeitpunkt weiterverwendet; das Update gewährt keine neue Testlaufzeit. Falsche UUIDs, veränderte Signaturen, fehlende Schlüssel und abgelaufene Testlizenzen schalten keine Funktionen frei. Eine bereits gültig konfigurierte private Signaturbasis bleibt zusätzlich unterstützt, ohne die alten Schlüssel auszuschließen.

Nach dem normalen Adapterupdate und Neustart wird die gespeicherte Lizenz automatisch erneut ausgewertet. Den gültigen Status und die passende Home-/Pro-Anzeige in der Lizenzverwaltung kontrollieren. Anschließend EMS Apps und die bisherigen Feldtestfunktionen prüfen. Weder System-UUID noch vorhandenen Lizenzschlüssel oder Trial-Start zum Beheben dieses Fehlers löschen. Anmeldung und Rollenprüfung gelten weiterhin.

Die spätere zentrale beziehungsweise asymmetrische Lizenzarchitektur wird in der eigenen EOS-Software umgesetzt. Dieser Stand führt sie nicht vorzeitig in den vorhandenen UI-Adapter ein. Der historische symmetrische Prüfwert war bereits ausgeliefert und ist kein vertrauliches Sicherheitsmerkmal; NW-SECRET-01 bleibt im Befundregister dokumentiert. Die konkrete Bestandsausnahme erlaubt keine anderen eingebauten Geheimnisse und verändert keine API-, Rollen- oder Geräteberechtigungen.

Tatsächliche Prüfung, Grenzen und Rohbelege: [Prüfvermerk 1.0.26](../reports/license-ems-2026-10-23/PRUEFVERMERK_DE.md).
