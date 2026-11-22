# Bestandskompatibilität: 1.0.36 → 1.0.37

Stand: 19.11.2026. Read-only-Übergabevergleich nach Abschluss der Produktänderungen.

## Ergebnis und Aussagegrenze

**108 kanonische EMS-Quelldateien sind gegenüber 1.0.36 byteidentisch.** Die
vorhandenen SmartHome-Geräte-, Szenen-, Timer- und Favoritenbezüge wurden nicht
durch ein neues Datenmodell ersetzt. Erweiterungen betreffen die Darstellung,
ausdrücklich übernommene Erkennungsvorschläge und den geschützten Webzugang.

Das belegt einen eng begrenzten Eingriff in die bestehenden Regelungsquellen.
Es ist **keine Garantie für unterbrechungsfreien Anlagenbetrieb** und kein
Hardware-, Browser-, ioBroker- oder TLS-/Proxy-Abnahmenachweis. Der Adapterkern
`main.ts` und die Zugangsprüfung wurden geändert; deshalb ist die Aussage
„gesamter Adapter unverändert“ ausdrücklich nicht zutreffend.

Verglichene lokale Stände:

- Baseline: `/workspace/scratch/016e1c77b6f1/smarthome_review_1_0_36/NexoWatt_UI_1.0.36`
- Übergabestand: `/workspace/scratch/016e1c77b6f1/implementation/NexoWatt_UI_1.0.37`

Für diesen Nachweis wurden ausschließlich Dateien gelesen, SHA-256 berechnet
und Quellstrukturen mit dem vorhandenen TypeScript-Parser verglichen. Es wurde
keine zusätzliche Testsuite gestartet und kein Produkt-/Testcode geändert.

## 1. EMS- und Steuerungsquellen

| Quellbereich | Dateien 1.0.36 / 1.0.37 | Byteidentisch | Geändert / neu / entfernt |
| --- | ---: | ---: | ---: |
| `src-ts/runtime-executables/ems/` | 91 / 91 | 91 | 0 / 0 / 0 |
| `src-ts/ems/` | 17 / 17 | 17 | 0 / 0 / 0 |
| `src-ts/contracts/` | 15 / 15 | 15 | 0 / 0 / 0 |
| `src-ts/runtime-executables/lib/` | 29 / 31 | 25 | 4 / 2 / 0 |

Die beiden vollständig identischen EMS-Bäume enthalten unter anderem Engine,
Modulmanager, NexoLogic, Ladeplanung und -verteilung, Heizstabentscheidungen,
NVP-/Netzanschlusskoordination, dynamischen Netzanschluss, PV-/Nulleinspeisungs-
Koordination, Speicher-/Arbitragepolitik sowie Schutz- und Budgetdienste.
Die Zahl 108 zählt ausschließlich die beiden EMS-Quellbäume; generierte
JavaScript-Dateien und Runtime-Mirrors werden nicht nochmals mitgezählt.

Die vier geänderten bestehenden `lib`-Dateien sind:

- `smarthome-contract.ts`: optionale Import-/Anzeige-/Statusfelder.
- `iobroker-user-auth.ts`: Kontoprüfung und Sitzungswiderruf.
- `sse-runtime-guard.ts`: Autorisierung und Ablauf des Browser-Livekanals.
- `license-bootstrap-access.ts`: geschützter Zugang zum Aktivierungspfad.

Neu sind `smarthome-import.ts` und `ui-access-policy.ts`. Die vorhandenen
Mesh-Regler/-Writer/-Protokolle, elektrische EVCS-Grenzen, NVP- und dynamische
Netzanschluss-APIs sowie Partner-Steuerungshelfer in diesem Ordner sind unter
den 25 identischen Dateien.

Zusätzlich wurden die 345 direkten Klassenmethoden in `main.ts` anhand ihrer
vollständigen Quellkörper verglichen: **341 sind identisch**. Geändert sind
`buildSmartHomeDevicesFromConfig`, `getSmartHomeDevicesWithState`, `startServer`
und `_nwCloseServer`. Dieser Teilvergleich zählt keine Konstruktoren, freien
Funktionen oder eingebetteten Arrow-Funktionen als eigene Klassenmethoden.

### Reproduzierbare Hashanker

Je Verzeichnis wurden alle regulären Dateien unter relativem Pfad sortiert.
Der Manifesthash ist SHA-256 über die UTF-8-Verkettung
`relativerPfad + NUL + DateiSHA256 + LF`. Beide Stände haben in den folgenden
Bereichen denselben Manifesthash:

| Bereich | Gemeinsamer Manifest-SHA-256 |
| --- | --- |
| Runtime-EMS, 91 Dateien | `03e58edbf81ffff7f7bde2be51826590e84bf749b16d926ff7cbd088e578f059` |
| Typisierte EMS-Quellen, 17 Dateien | `456693acb243c3ae24f603465ed1506ae6543dbd3365d9e009aff60f269c6bdb` |
| Contracts, 15 Dateien | `3bc1411f4fb66718f90a0f5d3e513207c5cb170ff03710b5a56adefd7a5f5e59` |

## 2. Erhaltene SmartHome-Verträge

| Vertrag | Feststellung aus dem Quellvergleich |
| --- | --- |
| Grundkonfiguration | `smartHomeConfig` mit `version`, `floors`, `rooms`, `functions`, `devices`, `scenes`, `pages`, `meta` bleibt erhalten. `getSmartHomeConfig` und der äußere Konfigurationsnormalisierer sind unverändert. Das vorhandene v2-/v3-Verhalten bleibt bestehen. |
| Gerätetypen und IDs | Die zehn unterstützten Gerätetypen und die bisherige ID-/Raum-/Funktionszuordnung bleiben erhalten. Die neue Importaktualisierung erlaubt keine Änderung von Geräte-ID, Räumen, Funktionen, Favoriten oder Berechtigungen als Importfeld. |
| Bedien-APIs | Alle 22 erfassten `app`-Registrierungen mit wörtlichem `/api/smarthome/…`-Pfad existieren weiter. 21 Handler-/Middleware-Argumentfolgen sind identisch; geändert wurde ausschließlich `GET /api/smarthome/type-detect`. Die vorgelagerte Authentifizierung ist davon getrennt geändert. |
| Szenen | `normalizeSmartHomeScene`, Aktionsnormalisierung und Zielprüfung sind unverändert. Ebenso die Backend-Methoden für Vorprüfung, Verschachtelung, Ausführung, Schreibwerte und Pulse. `deviceId`, `sceneId`, Aktionsreihenfolge und Werte werden dadurch nicht neu zugeordnet. |
| Timer | `smarthome.timersJson`, `smarthome.timersUpdatedAt`, `smarthome.timersNextAt` bleiben gleich. Normalisierung, Laden, Speichern, Terminberechnung, Scheduling und Aktorausführung haben identische Methodenkörper. |
| Logik-Uhren | Zustandserzeugung, `smarthome.logicClocksJson`, Terminberechnung und Ausführung sind unverändert; auch die NexoLogic-EMS-Quelle ist byteidentisch. |
| Installer-Speicherung | Der bestehende transaktionale Speichervorgang und die SmartHome-Konfigurationsroute bleiben erhalten. Erkennung oder Vorschau speichert keine Anlage automatisch. |
| Auslieferungsdefaults | In `io-package.json.native` unterscheidet sich als oberster Schlüssel nur `auth`. Die vorhandenen Objekte `smartHome` und `smartHomeConfig` sind identisch. `package.json.dependencies` ist identisch; kein zusätzlicher Geräteadapter wird zur Voraussetzung. |

18 gezielt ausgewählte Frontend-Funktionskörper sind unverändert:

`nwToggleDevice`, `nwSetLevel`, `nwSetColor`, `nwCoverAction`, `nwPlayerAction`,
`nwPlayerActionMulti`, `nwSetRtrSetpoint`, `nwClimateAction`,
`nwSetSmartHomeValue`, `nwSaveDeviceTimer`, `nwDeleteDeviceTimer`,
`nwGetRtrRange`, `nwLoadFavoriteOverrides`, `nwSaveFavoriteOverrides`,
`nwIsFavorite`, `nwToggleFavorite`, `nwApplyPageFilters`,
`nwLoadSmartHomeConfig`.

### Favoriten und Browser-Einstellungen

Alle zwölf vorhandenen Browser-Speicherschlüssel beziehungsweise Präfixe sind
unverändert; keiner wurde entfernt oder neu angelegt:

| Bereich | Erhaltener Schlüssel / Präfix |
| --- | --- |
| Gerätefavoriten | `nw_sh_favorites_overrides_v1`, `nw_sh_favorites_first` |
| Audio | `nw_sh_audio_zones_sel`, `nw_sh_player_favs_`, `nw_sh_player_recent_` |
| Ansicht und Navigation | `nw_sh_view_mode`, `nw_sh_text_size`, `nw_sh_active_page`, `nw_sh_nav_expanded` |
| Regler | `nw_sh_live_preview`, `nw_sh_step_dimmer`, `nw_sh_step_blind` |

Auch die ausgewählten bisherigen Defaults sind gleich: Live-Vorschau `true`,
Drosselung `200 ms`, Regler-Schritt `5`, Favoriten zuerst `false`. Konfigurierte
Gerätegrenzen und Temperatur-Schrittweiten werden weiterhin durch die
bisherigen Bedienfunktionen verarbeitet.

## 3. Additive Änderungen und deren Begrenzung

- **Darstellung:** neue Karten und größere Dialoge; Öffnen allein sendet keinen
  Gerätebefehl. Polling unterscheidet echte Zustandsänderungen von reinem
  `ageMs`-Fortschreiben. Offene Eingabeentwürfe bleiben erhalten.
- **Import:** Name, Symbol, feste Farbe und IO-Vorschläge werden im
  Installerentwurf geprüft. Quellenänderungen sind nicht vorausgewählt.
  `nwApplyTypeDetectedUpdate` kopiert das bestehende Gerät und ändert nur
  ausdrücklich ausgewählte zulässige Felder. Speichern bleibt ein eigener
  Schritt. Ausgewählte IO-Änderungen können anschließend bewusst die reale
  Zuordnung ändern; sie sind kein wirkungsfreies Designmerkmal.
- **Herkunft:** optionales `importProvenance`; manuelle Bestandsgeräte erhalten
  keine erfundene Importhistorie. Ungültige Herkunft wird entfernt.
- **Zusatzstatus:** optionale `io.indicators` für Batterie, UNREACH und Fehler
  werden ausschließlich gelesen. Ohne Zuordnung entstehen keine künstlichen
  Statuswerte und keine neuen Schreibpfade. Eine neu zugeordnete gültige
  Störungsmeldung kann die Geräteanzeige nun bewusst auf offline/Fehler setzen.
- **Kamera:** optionales `io.camera.urlStateId`; Bestandskameras ohne dieses Feld
  behalten ihren statischen Vertrag. Neue dynamische Quellen verlangen gültige
  aktuelle HTTP(S)-URLs ohne eingebettete Zugangsdaten.
- **Farbe:** `ui.color` wird auf unterstützte Hexfarben normalisiert. Ein
  bisheriges freies/ungültiges CSS-Farbformat kann dadurch entfallen; das betrifft
  die Darstellung und ist keine vollständige Bytegleichheit des Gerätedatensatzes.

## 4. Tatsächliche Migrationspunkte und offene Zielprüfung

**Der Webzugang ändert sich absichtlich.** Anonyme Bedien-/Datenzugriffe sowie
frühere offene `all`-/`lan`-Konfigurationen werden nicht als Freigabe übernommen.
Vorhandene Sitzungen werden nicht in die neue Sitzung überführt. Konten,
Gruppenzuordnungen, vorgesehenes Anmeldeprofil und HTTPS-/Proxyzugang müssen
vor Ort funktionieren. Eigene Skripte, die bisher ungeschützt UI-APIs aufgerufen
haben, müssen den aktuellen Sitzungs-/CSRF-Vertrag verwenden. Das ist getrennt
von den unveränderten autonomen EMS-Regelungsquellen zu bewerten.

**Browserlokale Favoriten sind an den Browserursprung gebunden.** Bei gleichem
Schema, Host und Port bleiben die vorhandenen Schlüssel verwendbar. Ein Wechsel
von HTTP zu HTTPS oder auf einen anderen Host/Port macht die bisherige
LocalStorage-Ablage unter der neuen Adresse nicht automatisch sichtbar. Die
Daten sind dadurch nicht aus der alten Ablage gelöscht; diese Version enthält
keine automatische Übertragung zwischen Browserursprüngen. Ein reiner Pfadwechsel
auf demselben Ursprung hat diesen Effekt nicht.

Vor einer produktiven Freigabe bleiben auf einer repräsentativen Bestandsanlage
mindestens zu bestätigen:

1. Gesicherte Bestandskonfiguration und Rückkehrweg; kontrollierter Adapterneustart
   mit bestehenden Geräten, Szenen, Timern und Logik-Uhren.
2. Anmeldung von Kunde, Installateur und Admin über die tatsächliche Adresse;
   anschließend vorhandene Gerätebedienung und erneute Session-/Netzverbindung.
3. Reale Rückmeldung und Grenzwerte repräsentativer Dimmer, Beschattung,
   Raumklima, Sensoren, Player und Kameras; sichere Behandlung von offline/stale.
4. Anstehende Timer, Timer über Tageswechsel und gespeicherte Szenen mit ihren
   vorhandenen Geräte-IDs. Die identischen Quellen ersetzen keinen Zeit-/Gerätetest.
5. Touch-, Fokus- und Layoutverhalten auf dem Zieltablet/-telefon einschließlich
   320/360-Pixel-Ansicht sowie realer Browser-/Proxy-/Kamera-Einschränkungen.
6. EMS-Langzeitbetrieb und Ressourcenbedarf nach dem Update. Geänderte
   Web-/SSE-Sitzungsprüfungen teilen den Adapterprozess mit der Regelung;
   Quellgleichheit allein belegt keine Last- oder Timingreserve.

Bereits durchgeführte isolierte UI-, Import- und HTTP-Prüfungen sind separat
beschrieben in [SmartHome-Modernisierung](../../SMARTHOME_MODERN_1_0_37_DE.md),
[Geräteimport](../../SMARTHOME_IMPORT_DE.md) und den zugehörigen Prüfberichten.
Dieser zusätzliche Vergleich erteilt keine Hardwarefreigabe.

## 5. Quellenbindung des geprüften Übergabestands

| Geänderte Quelle | SHA-256 in 1.0.37 beim Vergleich |
| --- | --- |
| `src-ts/runtime-executables/main.ts` | `307375285bd08b407545132598deda624506c0c1dab35bb5331e2409859658f7` |
| `src-ts/runtime-executables/lib/smarthome-contract.ts` | `4431b17227ce4550291ae02489f1c4884e86e14ec3f1ca0cc82267f2eeb0a087` |
| `src-ts/runtime-executables/www/smarthome.ts` | `06c4e110a22de74c35538dae57dec6a70c6dcdf712c2c8d9b7e6b4b830e5e317` |
| `src-ts/runtime-executables/www/smarthome-config.ts` | `03736603e65152cd007989c0a0bdcffb3d86e82490428f6fff08960914028a41` |

Spätere Änderungen an diesen Quellen oder den verglichenen EMS-Bäumen benötigen
einen erneuten Abgleich; die obigen Zahlen beziehen sich ausschließlich auf
diesen dokumentierten Stand.
