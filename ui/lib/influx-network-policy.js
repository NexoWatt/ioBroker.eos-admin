/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/influx-network-policy.ts
 * Quell-Hash: sha256:a367d4c267f8fe76642292e32f6383531e914c5f10222ff50b375bfe4aa43474
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/influx-network-policy.js.
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
exports.assertInfluxAddressAllowed = assertInfluxAddressAllowed;
exports.validateInfluxUrl = validateInfluxUrl;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt erlaubte InfluxDB-Ziele und prüft jede tatsächlich für die Verbindung aufgelöste Adresse.
 * Daten und Wirkung: Erlaubt ausdrücklich lokale Datenbanken, begrenzt unverschlüsseltes HTTP auf lokale Netze und sperrt Metadaten-, Link-Local-, Multicast- und unbestimmte Ziele.
 * Bei Änderungen: IPv4-/IPv6-Sonderfälle, DNS-Wechsel, URL-Anteile und TLS-Serverprüfung prüfen; lokale Gerätekommunikation nicht pauschal sperren.
 */
/** Local databases are supported deliberately. This policy must also run on every
 * resolved connection address: validating a hostname once does not prevent rebinding. */
const node_net_1 = require("node:net");
function failure(code) { return Object.assign(new Error(code), { code }); }
function ipv6Words(address) {
    const halves = address.toLowerCase().split('::');
    const words = (half) => half ? half.split(':').flatMap(part => part.includes('.')
        ? [Number(part.split('.')[0]) * 256 + Number(part.split('.')[1]), Number(part.split('.')[2]) * 256 + Number(part.split('.')[3])]
        : [parseInt(part, 16)]) : [];
    const left = words(halves[0] || '');
    const right = words(halves[1] || '');
    return halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill(0), ...right] : left;
}
/** HTTPS may reach public Influx services; plain HTTP is confined to loopback/LAN.
 * Link-local, unspecified, multicast and known metadata endpoints are never allowed. */
function assertInfluxAddressAllowed(input, protocol) {
    let address = input.replace(/^\[|\]$/g, '');
    const family = (0, node_net_1.isIP)(address);
    if (!family || address.includes('%'))
        throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
    let local = false;
    if (family === 6) {
        const words = ipv6Words(address);
        const first = words[0] ?? 0;
        // IMDS uses ULA on AWS and Google Cloud; ULA alone is not enough
        // to classify these two well-known endpoints as an allowed LAN database.
        const metadata = ((first === 0xfd00 && words[1] === 0x0ec2) ||
            (first === 0xfd20 && words[1] === 0x00ce)) &&
            words.slice(2, 7).every(word => word === 0) && words[7] === 0x0254;
        if (metadata)
            throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
        if (words.slice(0, 5).every(word => word === 0) && words[5] === 65535) {
            const high = words[6] ?? 0;
            const low = words[7] ?? 0;
            address = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
        }
        else {
            const loopback = words.slice(0, 7).every(word => word === 0) && words[7] === 1;
            if ((!loopback && words.slice(0, 6).every(word => word === 0)) || (first & 0xffc0) === 0xfe80 ||
                (first & 0xff00) === 0xff00)
                throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
            local = loopback || (first & 0xfe00) === 0xfc00;
            if (protocol === 'http:' && !local)
                throw failure('EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS');
            return;
        }
    }
    const octets = address.split('.').map(Number);
    const first = octets[0] ?? 0;
    const second = octets[1] ?? 0;
    if (first === 0 || first >= 224 || (first === 169 && second === 254) || address === '100.100.100.200') {
        throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
    }
    local = first === 127 || first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
    if (protocol === 'http:' && !local)
        throw failure('EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS');
}
function validateInfluxUrl(input) {
    if (typeof input !== 'string' || !input.trim() || input.length > 2048 || /[\u0000-\u0020\u007f]/u.test(input)) {
        throw failure('EOS_INFLUX_URL_INVALID');
    }
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw failure('EOS_INFLUX_URL_INVALID');
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || url.username || url.password ||
        url.hash || url.search || url.pathname.includes('/api/'))
        throw failure('EOS_INFLUX_URL_INVALID');
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if ((0, node_net_1.isIP)(hostname))
        assertInfluxAddressAllowed(hostname, url.protocol);
    if (['metadata.google.internal', 'metadata.goog', 'instance-data.ec2.internal'].includes(hostname.toLowerCase().replace(/\.$/, ''))) {
        throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
    }
    url.pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url;
}
