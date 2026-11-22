# src-ts/runtime-executables/www/operating-strategies-appcenter.ts

Verbindet die App-Center-Einrichtung von Betriebsstrategien mit den Backend-Daten.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L34) | – | – |
| [`getEdition`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L35) | – | – |
| [`byId`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L41) | id | document.getElementById |
| [`esc`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L42) | value | String |
| [`clone`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L48) | value | JSON.parse, JSON.stringify |
| [`record`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L51) | value | Array.isArray |
| [`list`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L52) | value | Array.isArray, value.filter |
| [`text`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L53) | value, fallback | String |
| [`bool`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L57) | value, fallback | – |
| [`number`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L58) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`integer`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L63) | value, fallback, min, max | Math.round, number |
| [`safeId`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L64) | value, fallback | text |
| [`withUniqueIds`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L69) | items, prefix | items.map |
| [`edition`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L83) | – | String, getEdition |
| [`ruleBuilder`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L90) | – | record |
| [`defaultNightReserve`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L92) | targetSocPct | – |
| [`defaultProfiles`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L105) | – | defaultNightReserve |
| [`defaultControlContract`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L124) | – | – |
| [`defaultConfig`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L134) | – | builder.defaultSimulation, defaultControlContract, defaultProfiles, ruleBuilder |
| [`normalizeMappings`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L174) | input | keys.forEach, record |
| [`normalizeSystemMappings`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L197) | input | record, text |
| [`normalizeCustomResource`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L209) | input, index | bool, controlTypes.includes, failSafePolicies.includes, integer, normalizeMappings, number, powerUnits.includes, record, resourceTypes.includes, safeId, text |
| [`normalizeProfile`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L244) | input, index | Math.min, modes.includes, number, record, safeId, seasons.includes, text |
| [`normalizeLink`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L271) | input | bool, integer, normalizeMappings, record, roles.includes, sourceId.startsWith, text |
| [`normalizeConfig`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L294) | input | Array.from, builder.normalizeRules, builder.normalizeSimulation, clone, defaultConfig, defaultControlContract, defaultProfiles, integer, list, normalizeSystemMappings, normalizedProfiles.map, normalizedRules.map, profileIds.has, record (weitere in der Quelle) |
| [`truthyDp`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L369) | value | text |
| [`mappedCount`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L373) | values | values.forEach |
| [`eosAppActive`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L382) | config, appId, enableFlag | record |
| [`flowSlotFor`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L389) | config, slot | Math.max, list, record |
| [`flowControlMappings`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L393) | ctrlInput, includeStages | reads.push, record, writes.push |
| [`deriveStorageFarmResources`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L420) | config | eosAppActive, list, record |
| [`deriveStorageResource`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L450) | config | eosAppActive, mappedCount, normalizeMappings, number, record, text |
| [`deriveEvcsResources`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L505) | config | eosAppActive, list, record |
| [`deriveFlowConsumerResources`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L535) | config | eosAppActive, list, record |
| [`deriveModuleDevices`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L565) | config, key, label, tab, resourceType | eosAppActive, list, record |
| [`deriveExistingResources`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L614) | config | combined.filter, deriveEvcsResources, deriveFlowConsumerResources, deriveModuleDevices, deriveStorageFarmResources, deriveStorageResource |
| [`applyRoleOverride`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L632) | resourceInput, roleOverride | clone |
| [`strategyResourceCatalog`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L643) | – | builder.normalizeCatalog, deriveExistingResources, list, ruleBuilder |
| [`linkBySourceId`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L675) | sourceId | list, normalizeLink, sourceId.startsWith |
| [`resourceTypeLabel`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L694) | type | – |
| [`controlTypeLabel`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L707) | type | – |
| [`badge`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L719) | label, tone | esc |
| [`gotoTabButton`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L723) | tab | esc |
| [`existingReadMappingInput`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L727) | resource, link, key, label | esc, record, safeId, text |
| [`existingReadMappingsHtml`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L741) | resource, link | fields.map, fields.push |
| [`existingResourcesHtml`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L757) | resources | edition, record, resources.map, text |
| [`dpInput`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L808) | resource, index, key, label, write | esc, record, text |
| [`customResourcesHtml`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L821) | resources | resources.map |
| [`profilesHtml`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L853) | profiles, resources | profiles.map, resources.filter |
| [`styleHtml`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L884) | – | – |
| [`renderHtml`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L936) | – | badge, customResourcesHtml, deriveExistingResources, edition, esc, existingResourcesHtml, list, profilesHtml, record, ruleBuilder, strategyResourceCatalog, styleHtml, systemMapField, text |
| [`systemMapField`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L948) | key, label | esc |
| [`syncLinksFromDom`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L985) | – | deriveExistingResources, document.querySelectorAll, list, out.filter, rendered.map |
| [`find`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L993) | selector, attr | Array.from, document.querySelectorAll |
| [`syncCustomFromDom`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1034) | – | document.querySelectorAll, list, resources.map |
| [`syncProfilesFromDom`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1053) | – | byId, document.querySelectorAll, list, profiles.map, text |
| [`syncGlobalFromDom`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1075) | – | byId, integer, record |
| [`syncFromDom`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1093) | – | builder.syncFromDom, byId, document.querySelectorAll, getCheck, getValue, integer, normalizeConfig, normalizeSystemMappings, record, ruleBuilder, strategyResourceCatalog, syncCustomFromDom, syncLinksFromDom, syncProfilesFromDom |
| [`getCheck`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1095) | id, fallback | byId |
| [`getValue`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1096) | id, fallback | byId, text |
| [`rerender`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1124) | – | bindEvents, renderHtml |
| [`bindEvents`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1130) | – | activeProfile.addEventListener, addProfile.addEventListener, addResource.addEventListener, autoImport.addEventListener, builder.bindEvents, byId, document.querySelectorAll, ruleBuilder |
| [`getConfig`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1212) | – | – |
| [`updateConfig`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1213) | next | normalizeConfig |
| [`getResources`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1214) | – | strategyResourceCatalog |
| [`syncAll`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1215) | – | syncFromDom |
| [`render`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1221) | mount, config, enabled | builder.resetSimulationResult, normalizeConfig, record, rerender, ruleBuilder |
| [`apply`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1232) | config, selectedEdition | document.getElementById, record, render |
| [`collect`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1242) | existing, enabled, selectedEdition | builder.normalizeRules, builder.normalizeSimulation, byId, clone, defaultControlContract, deriveExistingResources, edition, list, normalizeConfig, record, ruleBuilder, syncFromDom, text |
| [`setup`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1295) | options | – |
| [`simulate`](../../../../../src-ts/runtime-executables/www/operating-strategies-appcenter.ts#L1308) | config, resources | builder.simulate, ruleBuilder, strategyResourceCatalog |
