/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/flow-measurement.ts
 * Quell-Hash: sha256:db2712142e024764743ab3a0f856605691fb4e53cb6b612023e135a1e60e0035
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/flow-measurement.js.
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
exports.readFlowMeasurement = readFlowMeasurement;
exports.sumFlowMeasurements = sumFlowMeasurements;
function ownData(record, key) {
    if (!record || typeof record !== 'object')
        return undefined;
    const property = Object.getOwnPropertyDescriptor(record, key);
    return property && 'value' in property ? property.value : undefined;
}
function finite(value) {
    if (typeof value !== 'number' && typeof value !== 'string')
        return null;
    if (typeof value === 'string') {
        const text = value.trim();
        if (text.length > 64 || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text))
            return null;
        value = text.replace(',', '.');
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
function readFlowMeasurement(cache, key, now, maxAgeMs) {
    const record = ownData(cache, key);
    const value = finite(ownData(record, 'value'));
    const timestamp = finite(ownData(record, 'ts'));
    const quality = ownData(record, 'q');
    // A quality getter is invalid, even when it would return zero.
    const qualityDescriptor = record && typeof record === 'object' ? Object.getOwnPropertyDescriptor(record, 'q') : undefined;
    if (value === null || timestamp === null || timestamp <= 0 || timestamp > now
        || !Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || now - timestamp > maxAgeMs
        || (qualityDescriptor && !('value' in qualityDescriptor)) || (quality !== undefined && quality !== 0))
        return null;
    return { value, ts: timestamp };
}
/** All configured members must be observed. A newer member cannot refresh an older one. */
function sumFlowMeasurements(cache, keys, now, maxAgeMs) {
    if (keys.length === 0 || keys.length > 1024)
        return null;
    let total = 0;
    let oldest = now;
    for (const key of keys) {
        const measurement = readFlowMeasurement(cache, key, now, maxAgeMs);
        if (!measurement)
            return null;
        total += measurement.value;
        oldest = Math.min(oldest, measurement.ts);
    }
    return Number.isFinite(total) ? { value: total, ts: oldest } : null;
}
