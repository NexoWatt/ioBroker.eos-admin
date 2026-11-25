/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/** Live measurements retain their observation time. Missing or stale data is not zero. */
export interface FlowMeasurement { value: number; ts: number }
function ownData(record: unknown, key: string): unknown {
    if (!record || typeof record !== 'object') return undefined;
    const property = Object.getOwnPropertyDescriptor(record, key);
    return property && 'value' in property ? property.value as unknown : undefined;
}
function finite(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string') {
        const text = value.trim();
        if (text.length > 64 || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
        value = text.replace(',', '.');
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
export function readFlowMeasurement(cache: unknown, key: string, now: number, maxAgeMs: number): FlowMeasurement | null {
    const record = ownData(cache, key);
    const value = finite(ownData(record, 'value'));
    const timestamp = finite(ownData(record, 'ts'));
    const quality = ownData(record, 'q');
    // A quality getter is invalid, even when it would return zero.
    const qualityDescriptor = record && typeof record === 'object' ? Object.getOwnPropertyDescriptor(record, 'q') : undefined;
    if (value === null || timestamp === null || timestamp <= 0 || timestamp > now
        || !Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || now - timestamp > maxAgeMs
        || (qualityDescriptor && !('value' in qualityDescriptor)) || (quality !== undefined && quality !== 0)) return null;
    return { value, ts: timestamp };
}
/** All configured members must be observed. A newer member cannot refresh an older one. */
export function sumFlowMeasurements(cache: unknown, keys: readonly string[], now: number, maxAgeMs: number): FlowMeasurement | null {
    if (keys.length === 0 || keys.length > 1024) return null;
    let total = 0;
    let oldest = now;
    for (const key of keys) {
        const measurement = readFlowMeasurement(cache, key, now, maxAgeMs);
        if (!measurement) return null;
        total += measurement.value;
        oldest = Math.min(oldest, measurement.ts);
    }
    return Number.isFinite(total) ? { value: total, ts: oldest } : null;
}
