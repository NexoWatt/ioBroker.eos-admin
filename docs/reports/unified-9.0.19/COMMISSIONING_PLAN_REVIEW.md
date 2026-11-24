# Geräte → EMS: Zuordnung und Inbetriebnahme 9.0.19

Stand: 2026-11-24. Vertraulich, NexoWatt. Dieser Vermerk beschreibt den reinen Konfigurationsplaner; Hardwaretests und der komplette HTTP-/Runtime-Pfad sind gesonderte Nachweise.

## Verhalten

Ein explizites Speichern aus der Geräteverwaltung kann Zuordnung, Aktivierung der passenden Gerätezeile und Aktivierung der zugehörigen Basis-App in einem versionsgeprüften Konfigurationsvorgang übernehmen. Dazu enthält die gespeicherte Geräteabsicht `ems.activation` mit `requested`, einer eindeutigen `requestId` und gegebenenfalls technischen `limits`. Der Planer selbst schreibt weder Datenpunkte noch Hardware.

Der geschützte Eintrag `eosDeviceEms.bindings[baseId]` speichert die verbrauchte Anfrage und einen Fingerabdruck ihrer Rolle, Anlagenzuordnung, Grenzen und Geräteprofilidentität. Ein Neustart, Update, wiederholter Aufruf oder eine andere Gerätekonfiguration aktiviert eine nachträglich im App-Center deaktivierte App nicht wieder. Eine veränderte Absicht mit bereits verbrauchter Kennung wird abgewiesen. Eine neue ausdrückliche Geräte-Inbetriebnahme darf erneut aktivieren. Ein ausgetauschtes Profil oder eine geänderte Geräteklasse übernimmt die bisherige Freigabe nicht; die eigene Zeile bleibt mit `ACTIVATION_PROFILE_CHANGED` inaktiv. Eine reine Adresskorrektur innerhalb desselben Profils ändert die Freigabeidentität nicht.

| Geräteverwendung | Ergebnis bei gültiger ausdrücklicher Inbetriebnahme |
| --- | --- |
| Wallbox | Eigene Ladepunktzeile aktiv; nur Basis-App `charging` installiert/aktiviert |
| Einzelspeicher | Eigene Einzelzuordnung aktiv; nur Basis-App `storage` installiert/aktiviert |
| Speicherfarm | Bestehendes eindeutig identifiziertes Mitglied übernommen oder eigenes Mitglied ergänzt; nur Basis-App `storagefarm` installiert/aktiviert |
| NVP M0 | `datapoints.gridPointPower` als gemeinsame Messquelle; dieses Feld wird bereits von NVP, Safety, Budget und Regelung konsumiert |
| NVP M1 | Vorhandenes dynamisches Messstellenmodell befüllt; keine erfundene Freigabe einer M1-Speicherregelung |
| PV/Erzeuger/Verbraucher | Explizit ausgewähltes vorhandenes Energieflussfeld; keine stillschweigende PV-Abregelung oder weitere Regel-App |

Arbitrage, Peak-Shaving und andere zusätzliche Regelstrategien werden nicht ungefragt eingeschaltet. Vorhandene weitere App-Einstellungen bleiben erhalten.

## Voraussetzungen und Erhaltung

Aktivierung verlangt verifizierte Alias-/Objektmetadaten, lesbare Messquellen, die passende beschreibbare Sollwertfamilie, eine numerische NVP-Quelle mit passender Einheit, freigegebene App-Lizenz und begrenzte technische Konfiguration. Bereits gültige Kundenlimits bleiben vorrangig; Gerätewerte ergänzen fehlende oder ungültige/unbegrenzte Werte.

- Speicher: endliche Leistungsgrenzen für Laden/Entladen und bestätigte AC-/DC-Kopplung. Bestehende Farmgrenze 0 bleibt eine Richtungssperre; zwei gesperrte Richtungen werden nicht als nutzbare neue Regelung freigegeben. Kapazität ist optional.
- AC-Wallbox: bestätigter Typ, Phasen 1 oder 3 sowie Mindest-/Höchststrom.
- DC-Wallbox: bestätigter Typ sowie Mindest-/Höchstleistung.
- Nicht auflösbare, falsch typisierte oder nicht beschreibbare Quellen führen zu einem nachvollziehbaren offenen Status. Die Anfrage bleibt unverbraucht. Bereits laufende alte Zeilen werden bei nicht vollständig validierter Inbetriebnahme wiederhergestellt.
- Gültige manuelle Zuordnungen, Namen und Leistungs-/Kapazitätswerte werden nicht pauschal ersetzt. Eindeutige alte Alias-Verknüpfungen können bei ausdrücklicher Inbetriebnahme über ihre wirklichen Quellen einer vorhandenen Zeile zugeordnet werden. Namens- oder Reihenfolgenvergleich reicht nicht.
- Überschneidende Schreibziele werden auch gegenüber Lade-, Speicher-, PV-, Wärme-, Heizstab-, Schwellwert-, Generator-/BHKW- und konfigurierten Verbraucher-Steuerungen geprüft. Reine gemeinsame Messungen erteilen keine zusätzliche Schreibzuständigkeit.
- Das Installieren oder Einschalten einer gemeinsam genutzten App darf keine bisher ruhende manuelle oder unvollständig geprüfte Controllerzeile mitstarten. Die neue Freigabe bleibt dann offen (`otherUncommissionedController`). Eine zuvor wirksame App verlangt sowohl `installed` als auch `enabled`.
- Ein fehlendes aktuelles Alias-Inventar bleibt als offener Zustand sichtbar; eine früher verbrauchte Freigabe überschreibt diesen Status nicht. Eine fehlgeschlagene Inbetriebnahme nach Profilwechsel stellt die aktive alte Profilzeile nicht wieder her. FENECON-spezifische Regelparameter werden nicht automatisch auf ein fremdes Ersatzprofil übertragen.

`ACTIVATION_APPLIED` bestätigt die übernommene Konfiguration, nicht einen bereits laufenden physischen Leistungsaustausch. Veraltete Messwerte oder Transportfehler müssen weiterhin durch die bestehende Laufzeit-Safety blockiert werden. Neue NVP-Zuordnungen bevorzugen `comm.connected`; die langsamere eigene `r.online`-Zuordnung wird nur beim ausdrücklichen erneuten Speichern des betroffenen Gerätes ersetzt.

## Bekannte FENECON-Korrekturen

Nur bei ausdrücklicher neuer Geräte-Inbetriebnahme und exakt bekanntem Home-Profil werden semantisch falsche eigene Quellen korrigiert: direkter ESS-Sollwert 706 gehört nicht in das native FEMS-NVP-Feld; echte ESS-Aktorleistung 604 wird von der physischen Batterie-/Anzeigeleistung 415 getrennt. Ein gemeinsam mit weiteren Speichern betriebenes Home-Mitglied erhält mit nachgewiesenen 604/706-Quellen die direkte ESS-Kommandofamilie. Gültige echte native Quellen bleiben als Referenzen verfügbar.

`batteryFlowPowerId` ist das neue rein lesende Farmfeld für die physische Batterieanzeige. `signedPowerId` und `feneconEssActualPowerId` bleiben die Regelungsrückmeldung. Bei Einzelbetrieb wird ein leeres globales Batterie-Anzeigefeld mit der physischen Quelle belegt. Keine Quelle wird aus einem fehlenden Readback erfunden.

Eine Watt-Zahl im eigenen Datenpunktfeld, etwa `pvPowerId: "10000"`, kann beim ausdrücklichen Geräteauftrag durch die tatsächlich geprüfte DC-PV-Quelle ersetzt werden. Eine boolesche OCPP-Transaktionsanzeige als globale EV-Leistung wird nur bei ausdrücklicher erfolgreicher Wallbox-Inbetriebnahme entfernt; eine numerische manuelle Summenquelle bleibt erhalten. Jede solche Korrektur wird als eigener Statuscode zurückgegeben.

## Abschalten

Gerätedeaktivierung, Entfernung oder Beobachtungsmodus halten eigene Zeilen inaktiv und behalten Zuordnungen und Grenzen. Bei der einzelnen Speicherzeile wird auch die allein dazugehörige Speicher-App deaktiviert. Gemeinsam von anderen Geräten genutzte Farm-/Lade-Apps werden dabei nicht global abgeschaltet. Die Runtime berücksichtigt zusätzlich den deaktivierten Zustand einer eigenen Einzel-Speicherzeile.

## Ausgeführte Prüfungen

- 52 fokussierte Planer-/Aktivierungs- und unabhängige Reviewtests unter Node.js 22 und 24 bestanden.
- Strikte JavaScript-Typprüfung des Planers bestanden.
- Verbindliches gezieltes ESLint des Planers bestanden.
- Abgedeckt: vorhandener FENECON plus neuer SolaX plus SMA-M0 in einem Auftrag; Quellenkorrektur und getrennte Anzeige/Regelung; Erhaltung gültiger Kundenlimits; Alias-Adoption ohne Duplikat; Sperre gemischter/überlappender Regler; unverbrauchte unvollständige Anfragen; Replay-/Update-Schutz; individuelles Abschalten; Transportstatus; unveränderte alte Aufrufe ohne Aktivierungsauftrag.

Die Tests arbeiten mit verifizierbaren Modellinventaren und Konfigurationsobjekten. Sie ersetzen keine Prüfung realer Kommunikationswege, Registerfreigaben, Schutzgeräte oder physischer Schreibvorgänge auf einer Kundenanlage. Die komplette HTTP-/Engine-Neubindung und Generator-/Treiberprüfungen gehören in den übergeordneten Prüfbericht.
