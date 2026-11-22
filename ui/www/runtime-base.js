/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/runtime-base.ts
 * Quell-Hash: sha256:f7f321856fce4f5da11f8cc1784e349058199151cd3777b97cfcfd1c519da1f8
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/runtime-base.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
(function () {
    'use strict';
    if (window.NW_RUNTIME)
        return;
    const initialPath = window.location.pathname;
    // Keine Dekodierung oder Normalisierung fremder Präfixe: Prozentzeichen,
    // Punktsegmente, doppelte Slashes und Schemas sind keine Admin-Public-Paths.
    const proxyContext = () => {
        if (initialPath.length > 4096 || !initialPath.startsWith('/'))
            return null;
        // Ein weiterer Instanzmarker wäre zwischen Public-Pfad und Runtimepfad
        // mehrdeutig; weder erste noch letzte Instanz stillschweigend auswählen.
        if ((initialPath.match(/\/proxy\/nexowatt-ui\.(?:0|[1-9][0-9]{0,5})(?=\/|$)/gu) || []).length > 1)
            return null;
        const segments = initialPath.split('/');
        for (let index = 1; index <= 17 && index < segments.length; index += 1) {
            const segment = segments.at(index);
            if (!segment || segment.length > 128 || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/u.test(segment))
                return null;
            const instanceMatch = segment === 'proxy' ? /^nexowatt-ui\.(0|[1-9][0-9]{0,5})$/u.exec(segments.at(index + 1) || '') : null;
            if (instanceMatch?.[1] !== undefined) {
                const candidate = segments.slice(0, index + 2).join('/');
                return candidate.length <= 256 ? { prefix: candidate, instance: instanceMatch[1] } : null;
            }
        }
        return null;
    };
    const context = proxyContext();
    const prefix = context?.prefix || '';
    const isProxy = prefix !== '';
    const origin = window.location.origin;
    const publicPath = isProxy ? prefix.slice(0, prefix.lastIndexOf('/proxy/')) + '/' : '/';
    /** Nur eigene bekannte HTTP-Routen; Admin-, OAuth- und externe URLs bleiben unverändert. */
    const runtimePath = (path) => path === '/' || /^\/(?:api(?:\/|$)|static(?:\/|$)|assets(?:\/|$)|ems(?:\/|$)|mail-setup(?:\/|$)|mesh-setup(?:\/|$)|ledger(?:\/|$)|mesh\/microgrid(?:\/|$)|events$|config$|netoperator(?:\/|$)|history(?:\/|$)|settings(?:\/|$)|evcs(?:\/|$)|storagefarm(?:\/|$)|speicherfarm(?:\/|$)|smarthome(?:\/|$)|para14a-report(?:\/|$)|evcs-report(?:\/|$)|rfid-report(?:\/|$)|tariff-report(?:\/|$)|year-report(?:\/|$)|manifest\.webmanifest$|favicon\.ico$|apple-touch-icon\.png$|(?:index|ems-apps|simulation|license|smarthome|smarthome-config|logic|settings|history|evcs|storagefarm|mesh-microgrid|energy-ledger|netoperator|dc-station-display|para14a-report|evcs-report|rfid-report|tariff-report|year-report)\.html$)/u.test(path);
    /** URL-Typ und Ursprung prüfen, niemals Zugangsdaten an einen fremden Host umleiten. */
    const url = (value) => {
        if (!isProxy || typeof value !== 'string' || !value || value.length > 16384)
            return value;
        if (value.startsWith('#') || value.startsWith('//') || value.includes('\\'))
            return value;
        let parsed;
        try {
            parsed = new URL(value, document.baseURI || window.location.href);
        }
        catch {
            return value;
        }
        if (parsed.origin !== origin || parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol))
            return value;
        if (parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/'))
            return value;
        if (parsed.pathname === '/' && parsed.hash.startsWith('#tab-'))
            return origin + publicPath + parsed.search + parsed.hash;
        if (!runtimePath(parsed.pathname))
            return value;
        const mapped = prefix + parsed.pathname + parsed.search + parsed.hash;
        return /^[a-z][a-z0-9+.-]*:/iu.test(value) ? origin + mapped : mapped;
    };
    const api = Object.freeze({
        isProxy,
        instance: context?.instance ?? null,
        url,
        pathname: () => {
            const current = window.location.pathname;
            return isProxy && (current === prefix || current.startsWith(prefix + '/')) ? current.slice(prefix.length) || '/' : current;
        },
        adminBase: () => origin + publicPath,
    });
    Object.defineProperty(window, 'NW_RUNTIME', { value: api, writable: false, configurable: false });
    if (!isProxy || typeof window.fetch !== 'function')
        return;
    const originalFetch = window.fetch.bind(window);
    // Der Wrapper wird vor Auth/App-Skripten geladen. Request-Körper, Header,
    // Signal und explizite Init-Optionen bleiben erhalten; externe Aufrufe ebenso.
    window.fetch = (input, init) => {
        if (input instanceof Request) {
            const mapped = url(input.url);
            return originalFetch(mapped === input.url ? input : new Request(new URL(mapped, origin).href, input), init);
        }
        const value = input instanceof URL ? input.href : input;
        const mapped = url(value);
        return originalFetch(mapped === value ? input : mapped, init);
    };
})();
