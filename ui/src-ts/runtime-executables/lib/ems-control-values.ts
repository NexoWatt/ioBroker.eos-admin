// @runtime-transpile
/** Ordinary ioBroker EMS wishes: value validation only, no additional access rights. */
export const EMS_CONTROL_FIELDS = ['userStationEnabled', 'userEnabled', 'userMode', 'userAutoSource', 'userPhaseMode', 'userStorageAssistEnabled', 'goalEnabled', 'goalTargetSocPct', 'goalFinishTs', 'goalBatteryKwh'] as const;
export type EmsControlField = (typeof EMS_CONTROL_FIELDS)[number];
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
export function emsControlField(relativeId: string): EmsControlField | 'legacyMode' | null {
    if (/^evcs\.\d+\.mode$/.test(relativeId)) return 'legacyMode';
    const match = /^chargingManagement\.wallboxes\.[a-zA-Z0-9_]+\.([a-zA-Z0-9]+)$/.exec(relativeId);
    return match && EMS_CONTROL_FIELDS.some(field => field === match[1]) ? match[1] as EmsControlField : null;
}
export function validEmsControlValue(field: EmsControlField | 'legacyMode', value: unknown, now = Date.now()): boolean {
    if (['userStationEnabled', 'userEnabled', 'userStorageAssistEnabled', 'goalEnabled'].includes(field)) return typeof value === 'boolean';
    if (field === 'legacyMode') return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
    const values = { userMode: ['auto', 'pv', 'minpv', 'boost'], userAutoSource: ['standard', 'strategy'], userPhaseMode: ['fixed-1p', 'fixed-3p', 'auto-pv'] };
    if (field === 'userMode' || field === 'userAutoSource' || field === 'userPhaseMode') return typeof value === 'string' && (value === '' || values[field].includes(value));
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (field === 'goalTargetSocPct') return value >= 0 && value <= 100;
    if (field === 'goalBatteryKwh') return value >= 0 && value <= 5000;
    // Existing daily target times may legitimately be in the past and roll to
    // tomorrow. Keep that behavior; reject negatives and unbounded future dates.
    return field === 'goalFinishTs' && Number.isSafeInteger(value) && value >= 0 && value <= now + 366 * 86400000;
}
const fallback: Record<EmsControlField | 'legacyMode', string | number | boolean> = {
    userStationEnabled: false, userEnabled: true, userMode: 'auto', userAutoSource: 'standard', userPhaseMode: 'auto-pv', userStorageAssistEnabled: false,
    goalEnabled: false, goalTargetSocPct: 0, goalFinishTs: 0, goalBatteryKwh: 0, legacyMode: 0,
};
/** A bad persisted/cache value must not turn into a missing/default-enabled state.
 * Caller fences this station using eosInvalidControl while leaving raw DB intact. */
export function checkedEmsControlState(relativeId: string, state: unknown, now = Date.now()): unknown {
    const field = emsControlField(relativeId);
    if (!field || !record(state)) return state;
    if (state.eosControlReadFailed !== true && (state.val === null || state.val === undefined || validEmsControlValue(field, state.val, now))) return state;
    return { ...state, val: fallback[field], eosInvalidControl: true };
}
