# Dynamischer Netzanschluss: gemeinsamer Vertrag

Stand 23.10.2026. Eigene App-ID `dynamicGrid`, Konfiguration `config.dynamicGridConnection`.
`installed && enabled` aktiviert die App. Der gespeicherte Vertrag enthält kein weiteres Aktivierungsfeld.

## Öffentliche Daten

```js
{
  schemaVersion: 1, configVersion: 1, maxSkewMs: 1000,
  points: [
    { id:'M0', source:'general', importLimitW:250000, exportLimitW:250000, importReserveW:25000, exportReserveW:25000 },
    { id:'M1', source:'mapped', measurement:{stateId:'meter.power',unit:'W',sign:1,maxAgeMs:5000}, importLimitW:100000, exportLimitW:0, importReserveW:0, exportReserveW:0 }
  ],
  storages: [{
    id:'house', name:'Haus', connectionPointId:'M1', controlPointId:'M1', dispatchGroupId:'house',
    primaryPurpose:'selfConsumption', authority:'eos',
    powerMeasurement:{stateId:'battery.power',unit:'W',sign:1,maxAgeMs:5000},
    socMeasurement:{stateId:'battery.soc',scale:1,maxAgeMs:5000},
    availability:{stateId:'battery.online',availableValue:true,maxAgeMs:5000},
    maxChargeW:50000,maxDischargeW:50000,minSoc:10,maxSoc:90,maxDeltaWPerSec:10000,
    strategy:{targetGridImportW:50,importThresholdW:20,peakLimitW:100000},
    command:{mode:'signedTarget',signedTarget:{stateId:'battery.target',scale:1,sign:1,readbackStateId:'battery.appliedTarget'},
      run:{stateId:'battery.run',onValue:true,offValue:false}},
    configuredToleranceW:100, commandTimeoutMs:5000
  }], pvAssignments:[]
}
```

Leistung: Bezug positiv, Speicherentladung positiv. `scale` ist W pro Rohwert (SoC: Prozentpunkte pro Rohwert); Schreiben teilt W durch `scale` und multipliziert `sign`.
Messleistungen nutzen `unit:'W'|'kW'` und `sign:1|-1`. M0 wird ausschließlich aus Allgemein serverseitig übernommen. Dort signierte Messung oder vollständiges, kohärentes Bezug-/Einspeisepaar; niemals einseitiger Nullersatz.

Leistung und SoC eines Speichers benötigen unterschiedliche physische Messquellen; Aliasnamen umgehen diese Prüfung nicht. Bereichszähler, Speicher- und PV-Istleistungen dürfen ebenfalls nicht dieselbe physische Leistungsquelle mehrfach bilanzieren.

`primaryPurpose`: `selfConsumption|zeroExport|peakShaving|tariff|arbitrage`. Externe Stellhoheit nur bei `arbitrage`; EOS-Arbitrage benötigt `requestPowerMeasurement` im üblichen Leistungsmessformat. Gruppen müssen Bereich, Aufgabe, Stellhoheit und `strategy` teilen.

`command.mode`: `signedTarget` mit `signedTarget`; `splitTarget` mit `chargeTarget` und `dischargeTarget`; `externalLimits` mit `maxCharge` und `maxDischarge`. Leistungs-Ausgänge jeweils `{stateId,scale,sign,readbackStateId?}`. Split-/Maxima-Ausgänge benutzen positive Beträge und `sign:1`. Optional `run`, `chargeEnable`, `dischargeEnable`: `{stateId,onValue,offValue,readbackStateId?}`; Werte Boolean oder endliche Zahl, verschieden und gleichen Typs.

Externe Limits benötigen zusätzlich `command.appliedMaxCharge` und `appliedMaxDischarge` als Messleistungen sowie `command.watchdog:{stateId,ttlMs,writeValue,readbackStateId,expiryBehavior:'zeroLimits'}`. `writeValue` ist Boolean oder endliche Zahl. Watchdog ist ein explizit konfigurierter, geräteseitig auslaufender Vertrag; Empfang ersetzt weder Grenzanwendung noch Istwirkung. EOS-Sollwerte sind keine externen Maximalfreigaben. `availability` ist optional; ohne Mapping wird Verfügbarkeit ausschließlich aus frischer Leistung und SoC abgeleitet.

PV-Zeilen und deren `evuControl` werden durch `dynamic-grid-pv.validateDynamicPvAssignments` verwaltet.

## Reine Services

`dynamic-grid-config.js` exportiert:

- `dynamicGridDefaults()` → leeres Schema1.
- `validateDynamicGridConfig(raw, {rootConfig, active, resolveSourceId?, generalMeasurement?})` → `{valid,config,topology,errors,warnings,activeEligible}`. `config` ist der gespeicherte, normalisierte Appvertrag; `topology` trägt intern `origin:'dynamicGridConnection',mode:'dynamic',operation:'active',points,storages,pvAssignments`. `active:false` erlaubt unvollständige Entwürfe, meldet Aktivierungsfehler getrennt unter `activationErrors`.
- `resolveGeneralMeasurement(rootConfig, {unitByStateId?})` → allgemeine signierte Messung oder `{kind:'split',importMeasurement,exportMeasurement,maxAgeMs,sign}`. Objekt-Einheiten werden serverseitig durch `generalMeasurement` übergeben.
- `dynamicGridReadIds(topology)` → begrenzte eindeutige Liste aller Lese-DPs.
- `dynamicGridWriteIds(topology)` → eindeutige Ausgänge einschließlich Watchdog/Enable.
- `collectDynamicSnapshot(topology,states,now)` → bestehende `{valid,points,storages,errors,skewMs,ts,configVersion}` plus `storageTelemetry[id]:{valid,socPct,available,ts,maxDeltaWPerSec}`, `requests[id]`, `readbacks[id]`, `pv[id]`.

`nvp-budget.js` exportiert zusätzlich `solveDynamicDispatch({points,residuals,participants})`.
Punkte enthalten bereits um Reserven verminderte Grenzen. Restlastintervalle in W enthalten mögliche PV-Ausfälle und andere unbestätigte Änderungen.
Teilnehmer: `{id,connectionPointId,authority,actualW,minPowerW,maxPowerW,requestedW?,desiredMinW?,desiredMaxW?,reservedMinW,reservedMaxW,priority?}`.
Ausgang: `{valid,safe,status,reason,commands,participants,points,transitionPoints,recoveryAllowed,requiresConfirmation}`.
EOS-Befehle `{id,targetW,minPowerW:targetW,maxPowerW:targetW,recovery}`; externe Befehle `{id,minPowerW,maxPowerW,maxChargeW,maxDischargeW}`.
Alle alten, aktuellen und unbestätigten neuen Freigaben bleiben in der Übergangshülle. Bei bestehender Überschreitung sind explizit markierte, an jedem Punkt nicht verschlechternde EOS-Stützschritte und echte Verkleinerungen alter externer Verträge erlaubt; `safe` bleibt dabei falsch. Eine bestätigungsbedürftige Einschränkung beim Neustart darf auch bei Ist gleich Soll gesendet werden. Null ist kein pauschaler Rückfall; externe Maxima enthalten ohnehin keine garantierte Mindeststützung.

## Laufzeit- und API-Verantwortung

Backend prüft Objekte, Einheiten, Lese-/Schreib-Aliasse, eindeutige Schreibhoheit und CAS atomar. Aktive Konfiguration braucht vollständige Zuordnungen, keine künstliche Herstellerliste und keine Livefrische bei Speicherung. Runtime prüft aktuelle Qualität direkt vor Befehlen. Split gegenläufige Richtung erst nach bestätigter Neutralisierung. ACK bestätigt nicht die physische Leistung.
API: GET `/api/dynamic-grid`, GET `/status`, POST `/config` `{config,expectedConfigVersion,app?:{installed,enabled}}`, POST `/preview` `{config}`. Alle Pfade unter `/api/dynamic-grid` und Installerrolle.
