# Arbitrage-Steuergrenze – NexoWatt UI 1.0.32

Stand: 28.10.2026. Änderungsbasis ist das bereitgestellte vollständige UI-Repository 1.0.31; kein installiertes System wurde geprüft oder verändert. Dieser Teilnachweis ergänzt die Partner-/WSS-Unterlagen und stellt keine CRA-Konformitätserklärung oder Gerätefreigabe dar.

## Funktionsänderung und Grenze

Ein Partnerauftrag ist ausschließlich eine befristete wirtschaftliche Anforderung an den vorhandenen Speicherregler. Der neue reine TypeScript-Evaluator `src-ts/runtime-executables/ems/services/arbitrage-control.ts` schreibt keine Zustände, Dateien oder Geräte. Seine Eingaben enthalten nur Ressourcenkennung, Richtung, Leistung, Befehlszeitpunkte und den lokal erzeugten Sicherheitskontext; beliebige Datenpunktnamen und zusätzliche Befehlsfelder werden abgewiesen. Der Partnerdienst prüft Authentisierung, Lease und Widerruf. Die Auswahl bindet zusätzlich die aktuell installierte und eingeschaltete Arbitrage-App, explizit in Betrieb genommene Ressource, Partnerkennung und Konfigurationsrevision.

Der Evaluator benötigt echte endliche Zahlen, frischen SoC, tatsächliche Batterie- und Anschlussleistung sowie einen gültigen zentralen Grant. Die Zeitstempel jeder Messquelle werden getrennt geprüft. SoC, Import, Export, Lade-/Entladeleistung und Netzlade-/Einspeiseerlaubnis sind lokale Obergrenzen. Ein mitgeliefertes dynamisches Limit wird immer geprüft und kann diese Grenzen ausschließlich einschränken. Ungültige oder fehlende Daten ergeben eine Ablehnung mit `targetW:null`; daraus entsteht kein unkontrollierter Nullbefehl.

Die Vorzeichen sind einheitlich: Batterie positiv = Entladen, negativ = Laden; Netz positiv = Bezug, negativ = Einspeisung. Die Anschlussrechnung entfernt den Batterie-Istwert genau einmal. Die Entscheidung verfällt spätestens mit Auftrag, Grant oder ältester Messwertfreigabe. Der interne Grant ist höchstens eine Sekunde gültig. Wird die Geräteausgabe danach erreicht, erfolgt kein alter Partnerwrite; der nächste reguläre Zyklus plant neu. Damit ist keine harte Echtzeitgarantie verbunden.

## Integrationspfade und Rückfall

| Ressource | Implementierter Pfad | Rückfall und Einschränkung |
| --- | --- | --- |
| `single`, generisches signedTarget-/Split-Profil | Policy im vorhandenen `storage-control.ts`, bestehendes `_applyTargetW`, bestehende zentrale Budgets und Sicherheitskette | Haushalt übernimmt im nächsten Reglerzyklus mit seiner lokalen Regelung. `tradingOnly` plant ohne gültigen Auftrag lokal 0 W; erforderliche Schutz-/Anschlussregelungen behalten Vorrang. |
| Konkrete normalisierte Dynamic-Dispatchgruppe mit Zweck `arbitrage` und Stellhoheit `eos` | `dynamic-grid-connection.ts` → vorhandener Gruppenplaner → gemeinsamer Intervallsolver → vorhandener Dynamic-Writer | Ohne gültigen Auftrag plant die gemappte Partnergruppe einen lokalen Nullwunsch. Der gemeinsame Solver entscheidet weiterhin über notwendige Netzstützung und reservierte, noch unbestätigte Übergänge. Ein alter Rampenanker darf die Partnerleistung nicht verlängern. |
| Legacy `farm` | Nicht freigegeben | Aggregierter SoC und aggregierte Leistung ersetzen keine getrennte Mitgliederprüfung. Eine gesonderte, geprüfte Bridge fehlt. |
| Standalone FENECON-, Sungrow- oder E3/DC-Sonderpfad | Nicht freigegeben | Herstellerspezifische Modi und Übergänge sind in dieser Erweiterung nicht gerätegeprüft. Bestehender lokaler Betrieb bleibt bestehen. |

Standalone benötigt weder DynamicGrid noch PV-, Bilanz- oder Tarif-App. Der vorhandene Speicherwriter, der konfigurierte Anschluss und die zentrale Sicherheitsbasis bleiben erforderlich. Ein statisches Partnerlimit ersetzt weder die lokale Inbetriebnahme noch ein gegebenes §14a-, Mesh-, Lizenz-, SoC-, Geräte- oder Anschlusslimit. Es gibt keine zusätzliche Schreibschleife und keine automatische Geräteaktivierung.

In Dynamic-Gruppen muss jedes Mitglied frische eigene Leistungs-/SoC-Daten liefern. Für die Ladungsentscheidung gilt der höchste, für die Entladung der niedrigste Mitglieder-SoC. Die ausgehende kompakte Telemetrie zeigt den niedrigsten Mitglieder-SoC; dies ist keine kapazitätsgewichtete Energieanzeige. Die lokale Auswahl setzt die fachlichen Grenzen strenger um als diese vereinfachte Anzeige.

## Widerruf unmittelbar vor Wirkung

`actuator-shadow-arbiter.ts` prüft den Partnerkontext unmittelbar vor dem tatsächlichen ioBroker-Schreibaufruf, auch nach asynchroner Metadaten-/Aliasprüfung, im Shadow-Modus, bei Wertgleichheit und bei übersprungenen Keepalives. Jede Blockentscheidung verhindert die Ausgabe, auch wenn keine konkurrierende Autoritätslease existiert. Ein fehlender oder abgemeldeter Arbiter führt keinen geschützten Callback aus. Nach Stop/Uninstall bleibt ein dünner Interceptor für bereits laufende Fortsetzungen erhalten. Generationen verhindern, dass alte Fortsetzungen nach Reinstall gültig werden.

Der Single-Guard prüft erneut aktuelle Partnerauswahl, Fingerprint, Ablauf, Steuerhoheit und lebende Safety-/Leistungsgrenzen. In Dynamic-Gruppen gilt die Leaseprüfung für sämtliche aus der Partnerplanung entstandenen Commands, auch wenn der Solver einen Startup-Übergang als `recovery` markiert. Eine lokale Rückfallplanung im nächsten Zyklus kann notwendige Schutzregelung unabhängig von einer Partnerlease ausführen.

Ein `accepted` oder Transport-ACK bestätigt keine physische Gerätewirkung. Tatsächliche Batterie-Istleistung und gerätespezifische Rückmeldungen bleiben maßgeblich. Bereits an die Hardware übergebene Befehle können durch softwareseitigen Widerruf nicht rückwirkend zurückgenommen werden; Watchdog, Geräteverhalten und sicherer Übergang müssen am jeweiligen Gerät geprüft sein.

## Telemetrie und Ressourcenfähigkeit

Die internen Maps `_nwPartnerStorageTelemetry` und `_nwPartnerResourceAvailability` entstehen vor und ohne einen bestehenden Partnerauftrag. Dies vermeidet eine zirkuläre Abhängigkeit bei der Aufnahme eines Auftrags. Die Runtime verwendet nur diese begrenzten fachlichen Projektionen, keine frei wählbaren ioBroker-Datenpunkte.

Single-Zeitpunkte stammen aus den tatsächlichen DP-Messzeitpunkten; für den kanonischen NVP aus Snapshot-Zeitpunkt minus ursprünglichem Messalter. Ein erneuter Abruf setzt keinen alten Messwert auf jetzt. In Dynamic-Gruppen wird der jeweils älteste zugehörige Mitgliederzeitpunkt ausgegeben. Die Runtime begrenzt die Fähigkeitsmeldung auf 15 Sekunden und prüft Telemetriealter und Kohärenz nochmals. Die Fähigkeit ist keine Bestätigung eines aktuell zulässigen Leistungskommandos.

## Prüfungen und Belege

Ausgeführt in der lokalen Software-Testumgebung mit simuliertem ioBroker-Transport, ohne physische Speicher, WSS-Gegenstelle oder produktive Anlage:

```sh
NW_DYNAMIC_SOURCE_TEST=1 node --test test/arbitrage-control.test.cjs test/arbitrage-writer-integration.test.cjs test/dynamic-grid-ownership.test.cjs test/dynamic-grid-runtime.test.cjs
```

Ergebnis: **71 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen**. Der Test lädt die kanonischen TypeScript-Quellen; er benötigt keinen parallelen Runtime-Neubau. Details, Laufzeitversionen und konkrete Quelldateihashes liegen unter `evidence/arbitrage-control-1.0.32-test.log`, `evidence/arbitrage-control-1.0.32-environment.json` und `evidence/arbitrage-control-1.0.32-sources.sha256`.

| Prüfgruppe | Nachgewiesener Umfang |
| --- | --- |
| 20 Evaluatorprüfungen | Vollständiges neues Modul mit TypeScript strict, keine `any`-/Suppressions-Ausnahme; Grenzwerte, Standalone, Handel ohne Hauslast, Frische, Kohärenz, Grant/TTL, dynamische Einschränkung, Getter/Prototyp-/Typfehler, keine mutierten Eingaben. |
| 5 neue Single-Tick-Integrationsprüfungen | Produktiver Regler und `_applyTargetW`: genau ein begrenzter Lade-Write; TTL-Rückfall auf Haushaltsregelung; Disconnect-Rückfall bei `tradingOnly`; Widerruf im Write-await ohne Geräteausgabe; nachträglich verschärfte Leistungssperre ohne Geräteausgabe. |
| 17 Ownership-/Arbiterprüfungen | Bestehende alleinige Steuerhoheit plus neue Widerruf-, Null-Autoritäts-, Keepalive-, Alias-await-, Stop-, Reinstall- und fehlender-Arbiter-Fälle mit gezählten realen Transport-Callbacks. |
| 29 Dynamic-Runtimeprüfungen | Bestehende Intervall-/ACK-/Safety-/Timeout-Regressionen plus Partnerauftrag über gemeinsamen Writer, TTL ohne alten Rampenauftrag, Widerruf während Writer-Metadatenawait und Telemetrie/Fähigkeit ohne vorhandene Lease. |

Während der Entwicklung reproduzierte Fehler wurden vor dem finalen Lauf korrigiert: Blockentscheidung ohne Autoritätsobjekt führte zunächst den Originalwriter aus; ein Startup-`recovery`-Marker umging zunächst die Partnerprüfung. Beide Fehler besitzen ausgeführte negative Writer-Regressionen. Das endgültige Rohprotokoll bezieht sich auf die beigefügten Quellenhashes.

## Offene Prüfungen und nächster Schritt

Nicht ausgeführt sind Hersteller-/Hardwareabnahmen, reale WSS-Partnerintegration, Feldtests auf der Hausanlage, Langzeitverhalten bei Gerätetimeouts und physische Watchdog-/Notstoppprüfung. Die fachliche Abnahme je Speicherprofil und Firmware verbleibt beim Integrator/Betreiber. Vor Inbetriebnahme sind Backup/Rückfall auf den vorherigen Adapterstand, kleine begrenzte Sollleistungen, Vorzeichen, tatsächlicher SoC/Leistungswert, Leaseablauf, Verbindungsverlust, Neustart und wirksame lokale Schutzgrenzen an genau dieser Anlage zu prüfen. `commissioned` darf erst nach dieser Prüfung ausdrücklich gesetzt werden.

Der vollständige Release-Build, übrige Regressionen, SBOM-/Geheimnisprüfung und Dokumentationsversiegelung gehören zum übergeordneten Liefernachweis. Dieser Teilbericht ersetzt diese Prüfungen nicht. Bestandsdateien enthalten weiterhin vorhandene Legacy-Typausnahmen; nur das neue Evaluatormodul ist hier als vollständig strict geprüft ausgewiesen.
