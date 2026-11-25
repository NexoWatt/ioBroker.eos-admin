/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/ems-control-values.ts
 * Quell-Hash: sha256:d2dab9ebf6e490b628821f7608f53869842784486c714cbdec5ed7ee090f2a6b
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/ems-control-values.js.
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
exports.EMS_CONTROL_FIELDS = void 0;
exports.emsControlField = emsControlField;
exports.validEmsControlValue = validEmsControlValue;
exports.checkedEmsControlState = checkedEmsControlState;
/** Ordinary ioBroker EMS wishes: value validation only, no additional access rights. */
exports.EMS_CONTROL_FIELDS = ['userStationEnabled', 'userEnabled', 'userMode', 'userAutoSource', 'userPhaseMode', 'userStorageAssistEnabled', 'goalEnabled', 'goalTargetSocPct', 'goalFinishTs', 'goalBatteryKwh'];
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function emsControlField(relativeId) {
    if (/^evcs\.\d+\.mode$/.test(relativeId))
        return 'legacyMode';
    const match = /^chargingManagement\.wallboxes\.[a-zA-Z0-9_]+\.([a-zA-Z0-9]+)$/.exec(relativeId);
    return match && exports.EMS_CONTROL_FIELDS.some(field => field === match[1]) ? match[1] : null;
}
function validEmsControlValue(field, value, now = Date.now()) {
    if (['userStationEnabled', 'userEnabled', 'userStorageAssistEnabled', 'goalEnabled'].includes(field))
        return typeof value === 'boolean';
    if (field === 'legacyMode')
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
    const values = { userMode: ['auto', 'pv', 'minpv', 'boost'], userAutoSource: ['standard', 'strategy'], userPhaseMode: ['fixed-1p', 'fixed-3p', 'auto-pv'] };
    if (field === 'userMode' || field === 'userAutoSource' || field === 'userPhaseMode')
        return typeof value === 'string' && (value === '' || values[field].includes(value));
    if (typeof value !== 'number' || !Number.isFinite(value))
        return false;
    if (field === 'goalTargetSocPct')
        return value >= 0 && value <= 100;
    if (field === 'goalBatteryKwh')
        return value >= 0 && value <= 5000;
    // Existing daily target times may legitimately be in the past and roll to
    // tomorrow. Keep that behavior; reject negatives and unbounded future dates.
    return field === 'goalFinishTs' && Number.isSafeInteger(value) && value >= 0 && value <= now + 366 * 86400000;
}
const fallback = {
    userStationEnabled: false, userEnabled: true, userMode: 'auto', userAutoSource: 'standard', userPhaseMode: 'auto-pv', userStorageAssistEnabled: false,
    goalEnabled: false, goalTargetSocPct: 0, goalFinishTs: 0, goalBatteryKwh: 0, legacyMode: 0,
};
/** A bad persisted/cache value must not turn into a missing/default-enabled state.
 * Caller fences this station using eosInvalidControl while leaving raw DB intact. */
function checkedEmsControlState(relativeId, state, now = Date.now()) {
    const field = emsControlField(relativeId);
    if (!field || !record(state))
        return state;
    if (state.eosControlReadFailed !== true && (state.val === null || state.val === undefined || validEmsControlValue(field, state.val, now)))
        return state;
    return { ...state, val: fallback[field], eosInvalidControl: true };
}
