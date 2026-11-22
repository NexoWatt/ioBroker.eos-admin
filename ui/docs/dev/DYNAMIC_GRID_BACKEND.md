# Dynamischer Netzanschluss: Backend und App-Lifecycle

Stand: 23.10.2026. Diese Ergänzung gehört zum [gemeinsamen Vertrag](DYNAMIC_GRID_CONTRACT.md). Maßgebliche Implementierungen sind `main.ts` und `lib/dynamic-grid-config-api.ts` unter `src-ts/runtime-executables/`.

## Konfiguration und Rechte

Die App-ID lautet `dynamicGrid`, der Gesamtvertrag liegt in `config.dynamicGridConnection`. Ausschließlich explizites `installed: true` zusammen mit `enabled: true` aktiviert die App. Installation ohne Aktivschalter, ein alter `enableDynamicGrid`-Schalter oder eine vollständige inaktive Zuordnung aktivieren keine Regelung. Die vorhandenen Home-/Pro-Netzlimitrechte gelten weiter; die Anzahl eigener Speicherzuordnungen verwendet dieselben Grenzen wie die Speicherfarm, Home zwei und Pro zehn. Eine vorherige Installation von Speicherregelung oder Speicherfarm ist nicht erforderlich.

Alle vier API-Routen und die Einrichtung unter `/ems/dynamic-grid/#/dynamic-grid` benötigen serverseitig Installer-/Adminrechte. API-Antworten verwenden `Cache-Control: no-store`. Detailzustände und freie Datenpunktzuordnungen erscheinen nicht im öffentlichen State-/Config-Payload.

| Route | Zweck und Vertrag |
| --- | --- |
| `GET /api/dynamic-grid` | Aktueller Vertrag, Appzustand, schreibgeschützte Allgemein-M0-Quelle, Validierung, Status und Speicheranzahlgrenze |
| `GET /api/dynamic-grid/status` | Versionsgebundener Laufzeitstatus; gegebenenfalls dazu passende PV-Diagnose |
| `POST /api/dynamic-grid/config` | `{config, expectedConfigVersion, app?: {installed, enabled}}`; vollständigen Vertrag und Appzustand atomar speichern |
| `POST /api/dynamic-grid/preview` | `{config}`; vollständige Aktivierungsprüfung und vorhandenen lesenden Vorschau-Hook ausführen, ohne Konfiguration zu speichern |

Inaktive Entwürfe dürfen erforderliche Zuordnungen noch offenlassen. Widersprüchliche Datentypen, doppelte Ausgänge, ungültige Gruppen oder unbekannte Schemas sind auch im Entwurf Fehler. Für die Aktivierung werden alle nötigen Objektverträge geprüft: Typ, Lesbarkeit beziehungsweise Schreibbarkeit, bekannte Leistungseinheiten und getrennte Alias-Lese-/Schreibketten. Eine Herstellerliste, vorhandene Inventarzeile oder gerade frische Leistungsmessung ist keine Speichervoraussetzung. Die Prüfung aktueller Messqualität unmittelbar vor einem Befehl gehört zur Runtime.

## M0, Aliasidentität und PV-Übernahme

M0 übernimmt die signierte Allgemein-Zuordnung `datapoints.gridPointPower`, andernfalls das vollständige Paar `gridBuyPower`/`gridSellPower`. Einheit W/kW stammt aus dem zugeordneten ioBroker-Objekt; die Allgemein-Vorzeichenumkehr wird berücksichtigt. Ein separates M0-Mapping innerhalb der App wird abgewiesen. M0-Limits und Reserven werden in der App konfiguriert. M1 bleibt ein eigener lokaler Messpunkt.

Die Metadatenprüfung verfolgt Lese- und Schreib-Aliasse getrennt, höchstens acht Ebenen mit Zyklenerkennung. Pro Adapter läuft nur ein Prüfauftrag mit maximal vier parallelen DB-Abfragen und einer Antwortfrist von drei Sekunden. Bei einer hängenden DB bleibt dessen Auftragsslot bis zum tatsächlichen Abschluss belegt. Identische Metadatenprüfungen werden höchstens fünf Sekunden genutzt; Messwerte werden dabei nicht zwischengespeichert.

Physische Schreibketten werden vor Aktivierung und beim Start an die zentrale Stellhoheit übergeben. Alte, während einer Übergabe noch reservierte Ausgänge bleiben berücksichtigt. Aktive bestehende Zero-Export-PV-Ausgänge müssen in der neuen App enthalten sein, bevor diese den finalen PV-Regelschritt übernimmt. Eine Netzexportgrenze ist dabei kein PV-Erzeugungslimit und darf nicht allein durch Umbenennung übernommen werden. Zugeordnete, aktivierte EVU-Stufen benötigen lesbare numerische oder boolesche Eingänge.

## Atomare Änderungen und Übergabe

Die gemeinsame Installer-Mutationssperre umfasst Lesen, Validieren, Persistieren und Übernehmen. Sie gilt auch für AppCenter-Save, Import, SmartHome, NexoLogic, Simulation und die Startup-Migration. Die neue Runtime erhält zusätzlich eine Save-Sperre; Hardwareübergaben laufen ausschließlich über ihren dafür vorgesehenen Übergabe-Hook.

Ein erfolgreicher App-Save erhöht `configVersion` genau einmal. AppCenter und Import verwenden `expectedDynamicGridConfigVersion` oder die Versionsnummer des ausdrücklich übertragenen Appvertrags. Änderungen der Allgemein-M0-Quelle, der Appaktivierung und relevanter zugeordneter EVU-Eingänge gehören zu diesem Vertrag. Veraltete oder fehlende erforderliche Versionen liefern HTTP 409. Ein Import, der die neue App noch nicht kennt, deaktiviert sie nicht stillschweigend und entfernt ihren Vertrag nicht.

Der globale AppCenter-Save überträgt den zuletzt geladenen `expectedDynamicGridConfigVersion` ausdrücklich, auch wenn nur der Installationsschalter geändert wird. Er sendet dabei keine veraltete Kopie der separat bearbeiteten App-Zuordnungen. Bei einer noch fehlenden Konfiguration und älteren Entwürfen ohne gültige Versionsnummer liefern beide lesenden Installer-APIs denselben CAS-Ausgangswert `1`; sie verändern dadurch weder die Runtime noch die gespeicherte Konfiguration. Die erste erfolgreiche Installation eines inaktiven Entwurfs speichert Version `2`. Eine unveränderte dynamische Konfiguration erhält beim Speichern einer anderen App keine neue Version. Ein zwischenzeitlicher Save im eigenen App-Editor macht den vorherigen Parent-Token für nachfolgende Lifecycle-Änderungen ungültig. Beim Backup-Import hat der ausdrücklich mitgesendete, aktuell geladene Token Vorrang vor der alten Versionsnummer im Backup-Inhalt. Fehlende Tokens werden serverseitig niemals durch die aktuelle Version ersetzt.

Vor Änderung einer aktiven Stellstrecke bestätigt die Runtime die Übergabe. Solange dies nicht möglich ist, liefert die API `DYNAMIC_GRID_HANDOVER_PENDING`; gespeicherte Konfiguration und Appaktivierung bleiben bestehen. Die Runtime darf ihre laufende Übergabe weiterführen. Erst ein Datenbankfehler nach positiv bestätigter Vorbereitung ruft den Abbruch-Hook auf. Die bisherige Konfiguration wird dann nicht durch den erfolglosen Kandidaten ersetzt.

Aktive beziehungsweise für eine Übergabe reservierte dynamische Stellhoheit verdrängt alte Einzel-/Farmwriter. Ein direkter Aufruf des alten Farmdispatchers liefert `dynamic-grid-owns-storage`; er sendet dabei keinen pauschalen Nullbefehl.

## Status und Nachweisgrenze

Ein Status mit anderer Konfigurationsversion oder anderem Appaktivzustand wird als ausstehend ausgegeben. Alte Messungen und Budgets werden nicht in die neue Version kopiert. Aktive Statuswerte mit fehlendem, zukünftigem oder mehr als 15 Sekunden altem Zeitstempel werden als `stale` markiert und nicht als aktuelle erfolgreiche Regelung ausgegeben. Gleiches gilt für die Aufnahme des separaten PV-Diagnoseblocks.

Die Backend-Tests verwenden die tatsächlichen Express-Routen beziehungsweise maßgeblichen TypeScript-Helfer mit simuliertem ioBroker. Sie prüfen Rollen, Entwürfe, freie Aktivierung, Einheiten, Aliasidentität, CAS, Import, konkurrierende Writer, Übergaben und Persistenzfehler. Sie sind keine Prüfung einer realen Batterie, eines Wechselrichters, eines Watchdogs oder einer Hardware-Ausfallreaktion. Gerätebezogene Inbetriebnahme und Wirkungsmessung bleiben gesondert erforderlich. Rohprotokoll: `docs/reports/dynamic-grid-2026-10-23/backend-api.log`.

Die Regression zur ersten Installation über den globalen AppCenter-Save prüft zusätzlich fehlende Konfigurationen, leere beziehungsweise ältere Entwürfe, getrennte Appänderungen und echte veraltete Tokens über HTTP. Der Backupfall verwendet eine aktuelle Version `5` und Backup-Inhalt mit Version `1`. Rohprotokoll: `docs/reports/dynamic-grid-save-2026-10-23/backend-http.log`.

## Eingebettete Einrichtung und Datenpunkt-Browser ab 1.0.28

`DynamicGridPage.tsx` verwendet im ausdrücklich mit `embedded=1` geöffneten EMS-App-Center den rahmenlosen `PageShell` und `EmbeddedEmsFrame`. Die bestehende Rollenprüfung in `ProtectedRuntimeRoute` bleibt vorgeschaltet. Die gemeinsame Datei `/static/styles.css` liefert die EMS-Formularbausteine; die zusätzlichen Regeln sind auf die eingebettete Oberfläche beschränkt. `ResizeObserver` meldet die tatsächliche Inhaltshöhe. Der Host übernimmt ausschließlich ganzzahlige, begrenzte Höhen vom aktuellen iframe und demselben Ursprung. Dadurch übernimmt die äußere EMS-Seite das Scrollen.

`DpField.tsx` bindet alle freien M1-, Speicher- und PV-Datenpunktfelder an `dataPointPicker.ts`. Dieser Client öffnet den vorhandenen App-Center-Dialog über eine einmalige Request-ID; in der eigenständigen Adapteransicht öffnet er denselben geschützten Dialog als Popup. Der Host bleibt `src-ts/runtime-executables/www/ems-apps.ts`. Es gibt keine zweite Such- oder Baumimplementierung. Objektbaum und Suche verwenden weiterhin die berechtigungsgeprüften Routen `/api/object/tree` und `/api/smarthome/dpsearch`.

Anfrage und Antwort sind an Ursprung, konkretes Fenster und Request-ID gebunden. Abbruch, geschlossener Dialog, verschwundene Formularzeilen, geänderter Entwurf, laufendes Speichern oder ein veralteter Konfigurationsstand dürfen keine verspätete Auswahl übernehmen. Asynchrone Such- und Baumantworten gehören zur jeweiligen Dialoggeneration. Ordner sind Navigationsziele; auswählbar sind die gelieferten Datenpunktkennungen. Lese- und Schreibkontext ändern die Dialogbeschriftung, führen aber keine neue Hersteller- oder Datenpunkt-Whitelist ein. Die fachliche Vertragsprüfung bleibt bei den vorhandenen APIs.

Die Auswahl ruft ausschließlich denselben lokalen Änderungsweg wie die manuelle ID-Eingabe auf. Sie schreibt keine Konfiguration und keinen Gerätewert. M0 bietet keinen eigenen Picker, da seine Zuordnung aus Allgemein stammt. Die vorhandenen geladenen und beobachteten Versionszähler aus 1.0.27 bleiben für spätere Saves maßgeblich.
