/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Erhält vorhandene EOS-Zusatzbedienung hinter derselben Prüfung wie die neuen Geräteprofile.
 * Daten und Wirkung: Akzeptiert nur ausdrücklich konfigurierte Schreibziele und prüft Profil, Metadaten und Schutzkontakte vor der Übergabe.
 * Bei Änderungen: reine Lesedatenpunkte, Klimagrenzen, Beschattungsschutz, Szenen und gleichzeitig geänderte Zuordnungen testen.
 */
import { DeviceControlError, executeDeviceControl, normalizeDeviceControls, type DeviceControlsWriteHost } from './smarthome-device-controls';
type Row = Record<string, unknown>;
function row(value: unknown): Row { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
function fail(code: string): never { throw new DeviceControlError(code); }
const WRITE_PATHS: Readonly<Record<string, readonly string[]>> = {
    switch: ['writeId'], level: ['writeId'], color: ['writeId'], white: ['writeId'], colorTemperature: ['writeId'],
    cover: ['positionWriteId', 'tiltWriteId', 'upId', 'downId', 'stopId', 'actionId'],
    climate: ['setpointId', 'powerId', 'modeId', 'fanId', 'fanSpeedId', 'swingId'], sensor: ['writeId'],
    player: ['playId', 'pauseId', 'stopId', 'nextId', 'prevId', 'stateId', 'volumeId', 'volumeWriteId',
        'toggleId', 'muteId', 'muteWriteId', 'powerId', 'powerWriteId', 'urlId', 'urlWriteId', 'stationId', 'playlistId', 'seekId', 'seekWriteId', 'shuffleId', 'repeatId', 'ttsWriteId'],
};
export interface LegacyDeviceHost extends DeviceControlsWriteHost {
    device(id: string): unknown;
    authorize(): Promise<boolean>;
}
function signature(value: unknown): string {
    const device = row(value); return JSON.stringify({ id: device.id, io: device.io, behavior: device.behavior });
}
/** Nur für Geräte mit vollständigem Profil: Altgeräte ohne Profil behalten ihren bestehenden Ablauf. */
export async function executeLegacyDeviceWrite(deviceInput: unknown, stateId: unknown, value: unknown, host: LegacyDeviceHost): Promise<{ ok: true }> {
    const device = row(deviceInput); const io = row(device.io); const behavior = row(device.behavior);
    if (typeof device.id !== 'string' || typeof stateId !== 'string') return fail('EOS_CONTROL_REQUEST_INVALID');
    const controls = normalizeDeviceControls(io.deviceControls);
    if (!controls) return fail('EOS_CONTROL_CONFIG_MISSING');
    if (!await host.authorize()) return fail('EOS_CONTROL_FORBIDDEN');
    const initial = signature(device); const deviceId = device.id; const expires = Date.now() + 5000;
    if (signature(host.device(deviceId)) !== initial) return fail('EOS_CONTROL_CONFIG_CHANGED');
    const explicit = Object.entries(WRITE_PATHS).some(([group, fields]) => fields.some(field => row(io[group])[field] === stateId));
    if (!explicit) return fail('EOS_CONTROL_NOT_WRITABLE');
    const candidates = controls.fields.filter(field => field.writeId === stateId);
    if (candidates.length > 1) return fail('EOS_CONTROL_MAPPING_AMBIGUOUS');
    const mapped = candidates[0];
    if (!mapped && ['blind', 'blindButtons', 'gate', 'lock', 'thermostat', 'airCondition'].includes(controls.profile)) return fail('EOS_CONTROL_NOT_WRITABLE');
    // Echte EOS-Ergänzungen wie TTS/Senderspeicher bleiben möglich. Die universelle
    // Prüfung verwendet dennoch echte Objektmetadaten, keine freie Client-DP-ID.
    const effective = mapped ? controls : { profile: 'universal', fields: [{ key: 'EOS_EXTRA', writeId: stateId }] };
    const key = mapped?.key ?? 'EOS_EXTRA';
    const writeHost: DeviceControlsWriteHost = {
        readObject: id => host.readObject(id), readState: id => host.readState(id),
        writeState: async (id, target) => {
            if (!await host.authorize()) return fail('EOS_CONTROL_FORBIDDEN');
            if (Date.now() >= expires) return fail('EOS_CONTROL_TIMEOUT');
            if (signature(host.device(deviceId)) !== initial) return fail('EOS_CONTROL_CONFIG_CHANGED');
            return host.writeState(id, target);
        },
    };
    const staleAfterMs = typeof behavior.staleAfterSec === 'number' && Number.isFinite(behavior.staleAfterSec) ? Math.max(0, behavior.staleAfterSec) * 1000 : 0;
    return executeDeviceControl(effective, { key, value }, writeHost, behavior.readOnly === true, { staleAfterMs });
}
