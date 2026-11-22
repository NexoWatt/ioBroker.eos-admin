# src-admin-tab/src/lib/adminConnection.ts

Kapselt die Verbindung zur Adapter-Instanz und die geschützten Anmelde-, Konfigurations- und SMTP-API-Aufrufe.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-admin-tab/src/lib/adminConnection.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-admin-tab/src/App.tsx](../../../../../src-admin-tab/src/App.tsx)
- [src-admin-tab/src/components/EmbeddedEmsFrame.tsx](../../../../../src-admin-tab/src/components/EmbeddedEmsFrame.tsx)
- [src-admin-tab/src/lib/dataPointPicker.ts](../../../../../src-admin-tab/src/lib/dataPointPicker.ts)
- [src-admin-tab/src/pages/DynamicGridPage.tsx](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx)
- [src-admin-tab/src/pages/InstallerPage.tsx](../../../../../src-admin-tab/src/pages/InstallerPage.tsx)
- [src-admin-tab/src/pages/MeshAccountingPanel.tsx](../../../../../src-admin-tab/src/pages/MeshAccountingPanel.tsx)
- [src-admin-tab/src/pages/MeshCoordinatorPage.tsx](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx)
- [src-admin-tab/src/pages/NotificationMailPage.tsx](../../../../../src-admin-tab/src/pages/NotificationMailPage.tsx)
- [src-admin-tab/src/pages/PageShell.tsx](../../../../../src-admin-tab/src/pages/PageShell.tsx)
- [src-admin-tab/src/pages/PartnerIntegrationsPage.tsx](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx)
- [src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx)
- [src-admin-tab/src/pages/RedirectPage.tsx](../../../../../src-admin-tab/src/pages/RedirectPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`RuntimeRequestError.constructor`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L131) | message, status, payload | super |
| [`isRecord`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L137) | value | Array.isArray |
| [`isServConn`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L141) | value | isRecord |
| [`isAdminSocket`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L146) | value | isRecord |
| [`isSocketIoClient`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L150) | value | isRecord |
| [`getErrorStatus`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L155) | error | Number.isInteger, isRecord |
| [`getErrorMessage`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L159) | error, fallback | isRecord |
| [`copyJsonValue`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L168) | value, depth, budget | Array.isArray, Number.isFinite, Object.create, Object.entries, copyJsonValue, isRecord, value.map |
| [`parseApiRecord`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L183) | value | copyJsonValue, isRecord |
| [`parseRuntimeAuthStatus`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L190) | value | Array.isArray, String, parseApiRecord, record.capabilities.every |
| [`isIoBrokerObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L211) | value | isRecord |
| [`ApiResponseLimitError.constructor`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L217) | – | super |
| [`readBoundedApiJson`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L231) | response, controller | JSON.parse, Math.max, Math.min, Number, Number.isSafeInteger, body.getReader, bytes.set, bytes.subarray, cancel, controller.abort, expanded.set, reader.read, reader.releaseLock, response.headers.get (weitere in der Quelle) |
| [`cancel`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L239) | – | reader.cancel |
| [`readApiResponse`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L281) | response, controller, adminProxy | Object.create, controller.abort, parseApiRecord, readBoundedApiJson, response.body.cancel, response.headers.get |
| [`withTimeout`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L315) | promise, ms, label | Promise.race |
| [`callbackPromise`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L330) | fn, label, ms | withTimeout |
| [`checkedInstance`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L346) | value | – |
| [`getInstance`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L353) | – | checkedInstance, pathname.indexOf, pathname.slice, rest.indexOf, rest.slice |
| [`getAdapterObjectId`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L373) | instance | getInstance |
| [`checkedPrefix`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L384) | value | segments.some, value.endsWith, value.slice, value.startsWith |
| [`composeRuntimeProxyBase`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L399) | prefix, instance | currentOrigin |
| [`currentOrigin`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L405) | – | Number |
| [`getRuntimeProxyBase`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L427) | instance | checkedInstance, checkedPrefix, composeRuntimeProxyBase, declared.includes, getInstance, pathname.indexOf, pathname.slice, rest.indexOf, rest.slice, safeWindowAccess |
| [`isEmbeddedRuntime`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L467) | – | – |
| [`buildRuntimeBaseUrl`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L473) | target | Number.isInteger, currentOrigin, getRuntimeProxyBase, isEmbeddedRuntime |
| [`readAdapterRuntimeTarget`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L492) | instance, conn | Number, Number.isInteger, checkedInstance, getAdapterObjectId, getInstance, getObject, raw.trim, withTimeout |
| [`resolveRuntimeBaseUrl`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L514) | instance, conn | buildRuntimeBaseUrl, checkedInstance, currentOrigin, getInstance, getRuntimeProxyBase, isEmbeddedRuntime, readAdapterRuntimeTarget |
| [`safeWindowAccess`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L530) | getter | getter |
| [`isErrorLike`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L543) | value | Object.prototype.hasOwnProperty.call, isRecord |
| [`normalizeIoBrokerCallback`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L563) | cb | – |
| [`pickServConn`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L586) | – | safeWindowAccess |
| [`pickSocket`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L600) | – | safeWindowAccess |
| [`ensureSocketIo`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L615) | – | pickSocket, window.__nwSocketLoader |
| [`wrapServConn`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L636) | servConn | – |
| [`getObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L645) | id, cb | cb, normalizeIoBrokerCallback, servConn.getObject |
| [`getState`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L664) | id, cb | cb, normalizeIoBrokerCallback, servConn.getState |
| [`setObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L687) | id, obj, cb | cb, servConn.setObject |
| [`wrapSocket`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L702) | socket | – |
| [`getObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L711) | id, cb | cb, normalizeIoBrokerCallback, socket.emit |
| [`getState`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L730) | id, cb | cb, normalizeIoBrokerCallback, socket.emit |
| [`setObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L749) | id, obj, cb | cb, socket.emit |
| [`getAdminConnection`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L779) | – | ensureSocketIo, isAdminSocket, isServConn, isSocketIoClient, pickServConn, pickSocket, window.io.connect, withTimeout, wrapServConn, wrapSocket |
| [`extractUuid`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L814) | obj | scan |
| [`scan`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L824) | value, key | Array.isArray, Object.entries, Object.getOwnPropertyDescriptor, Object.prototype.hasOwnProperty.call, isRecord, scan, seen.add, seen.has, uuidRe.test, value.trim |
| [`getObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L859) | id, conn | callbackPromise, getAdminConnection, isIoBrokerObject |
| [`getState`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L875) | id, conn | callbackPromise, getAdminConnection, isRecord |
| [`setObject`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L891) | id, obj, conn | callbackPromise, getAdminConnection |
| [`readAdapterPort`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L905) | instance, conn | Number, Number.isInteger, getAdapterObjectId, getInstance, getObject, value.trim |
| [`readSystemUuid`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L924) | conn, instance | String, extractUuid, getInstance, getObject, getState |
| [`fetchJsonWithTimeout`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L969) | url, ms, options | clearTimeout, fetch, readApiResponse, setTimeout |
| [`postJsonWithTimeout`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L998) | url, payload, ms, options | JSON.stringify, clearTimeout, fetch, readApiResponse, setTimeout |
| [`requestRuntimeApi`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1029) | path, payload, timeoutMs, instance, conn | Date.now, base.includes, fetchJsonWithTimeout, getInstance, parseRuntimeAuthStatus, postJsonWithTimeout, resolveRuntimeBaseUrl |
| [`resolveRuntimeLoginUrl`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1055) | instance, conn | getInstance, resolveRuntimeBaseUrl |
| [`readRuntimeAuthStatus`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1066) | instance, conn | Date.now, checkedInstance, encodeURIComponent, getInstance, parseRuntimeAuthStatus, requestRuntimeApi |
| [`loginRuntimeAuth`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1071) | instance, user, password, conn | Date.now, String, checkedInstance, encodeURIComponent, getInstance, parseRuntimeAuthStatus, requestRuntimeApi |
| [`logoutRuntimeAuth`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1077) | instance, conn | Date.now, checkedInstance, encodeURIComponent, getInstance, requestRuntimeApi |
| [`readRuntimeLicenseInfo`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1083) | instance, conn | Date.now, checkedInstance, encodeURIComponent, getInstance, requestRuntimeApi |
| [`saveRuntimeLicenseKey`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1088) | instance, licenseKey, conn | Date.now, String, checkedInstance, encodeURIComponent, getInstance, requestRuntimeApi |
| [`readLicenseStatus`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1099) | instance, conn | Number, Promise.all, String, getAdminConnection, getInstance, getState |
| [`openExternal`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1158) | url | – |
| [`notificationMailRequest`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1170) | payload | requestRuntimeApi |
| [`meshCoordinatorRequest`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1175) | suffix, payload | requestRuntimeApi |
| [`dynamicGridRequest`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1180) | suffix, payload | requestRuntimeApi |
| [`partnerIntegrationsRequest`](../../../../../src-admin-tab/src/lib/adminConnection.ts#L1186) | suffix, payload | requestRuntimeApi |
