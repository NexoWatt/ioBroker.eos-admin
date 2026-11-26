/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/eos-presentation-routes.ts
 * Quell-Hash: sha256:c7964864ce73d5ad00cae72592e580f871db3c886db149b9809ff18efd8f2b66
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/eos-presentation-routes.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESENTATION_FILES = void 0;
exports.presentationRoute = presentationRoute;
exports.isPresentationRequest = isPresentationRequest;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const ui_access_policy_1 = require("./ui-access-policy");
const DATAPOINT_PICKER_ROUTES = new Set([
    '/api/smarthome/dpsearch', '/api/smarthome/object/tree', '/api/object/tree',
]);
exports.PRESENTATION_FILES = new Map([
    ['/manifest.webmanifest', ['www/manifest.webmanifest', 'application/manifest+json']],
    ['/sw.js', ['www/sw.js', 'application/javascript']],
    ...ui_access_policy_1.APPLE_TOUCH_ICON_PATHS.map(path => [path, ['www/assets/icons/nexowatt-180.png', 'image/png']]),
    ['/favicon.ico', ['www/assets/icons/nexowatt-32.png', 'image/x-icon']],
]);
/** A raw HTTP path must match this allowlist before crossing into the read-only process. */
function presentationRoute(method, url) {
    if ((method !== 'GET' && method !== 'HEAD') || typeof url !== 'string')
        return null;
    const pathname = url.split(/[?#]/, 1)[0];
    if (!pathname)
        return null;
    const canonical = (0, ui_access_policy_1.uiRequestPath)({ path: pathname });
    // The three existing Express 4 picker routes also accept case variants and
    // one trailing slash. Never pass percent/decode or traversal aliases here.
    if ((canonical === pathname || canonical + '/' === pathname) && DATAPOINT_PICKER_ROUTES.has(canonical.toLowerCase()))
        return 'picker';
    if (canonical !== pathname)
        return null;
    if (pathname === '/')
        return 'dashboard';
    if (exports.PRESENTATION_FILES.has(pathname))
        return 'file';
    if (/^\/(?:assets|static)\//.test(pathname) && (0, ui_access_policy_1.isPublicUiRequest)({ method, path: pathname }))
        return 'asset';
    return null;
}
function isPresentationRequest(method, url) {
    return presentationRoute(method, url) !== null;
}
