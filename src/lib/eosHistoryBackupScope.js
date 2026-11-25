// @ts-check
'use strict';

/** @typedef {{provider:'influxdb2',url:string,bucket:string,org:string}|{provider:'postgresql',namespace:string}|{provider:'adapter',instance:string}|{provider:'none'|'unknown'}} HistoryBackupRequirement */
/** @typedef {{namespace:string,eosHostedRuntime?:{getHistoryBackupRequirement?:()=>unknown|Promise<unknown>},getForeignObjectAsync:(id:string)=>Promise<unknown>}} Owner */
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} value @returns {value is string} */
function label(value) { return typeof value === 'string' && value.length > 0 && value.length <= 256 && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127); }
/** @param {unknown} value @returns {string|null} */
function endpoint(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
        return url.href.replace(/\/$/, '');
    } catch { return null; }
}

/** Only identity is copied; historian credentials never become backup credentials.
 * @param {unknown} candidate @param {string} namespace @returns {HistoryBackupRequirement}
 */
function validateRequirement(candidate, namespace) {
    if (!record(candidate)) return { provider: 'unknown' };
    if (candidate.provider === 'none') return { provider: 'none' };
    if (candidate.provider === 'postgresql') {
        return candidate.namespace === namespace && /^eos-admin\.\d+$/.test(namespace)
            ? { provider: 'postgresql', namespace } : { provider: 'unknown' };
    }
    if (candidate.provider === 'influxdb2') {
        const url = endpoint(candidate.url);
        return url && label(candidate.bucket) && label(candidate.org)
            ? { provider: 'influxdb2', url, bucket: candidate.bucket, org: candidate.org } : { provider: 'unknown' };
    }
    if (candidate.provider === 'adapter' && typeof candidate.instance === 'string' && /^influxdb\.\d+$/.test(candidate.instance)) {
        return { provider: 'adapter', instance: candidate.instance };
    }
    return { provider: 'unknown' };
}

/** Resolve the active, saved history provider instead of trusting backup UI settings.
 * The owner bounds the read-only controller call; missing/ambiguous providers remain unknown.
 * @param {Owner} owner @returns {Promise<HistoryBackupRequirement>}
 */
async function resolveHistoryBackupRequirement(owner) {
    if (!owner.eosHostedRuntime?.getHistoryBackupRequirement) return { provider: 'unknown' };
    const requirement = validateRequirement(await owner.eosHostedRuntime.getHistoryBackupRequirement(), owner.namespace);
    if (requirement.provider !== 'adapter') return requirement;
    const instance = await owner.getForeignObjectAsync(`system.adapter.${requirement.instance}`);
    if (!record(instance) || !record(instance.native) || !record(instance.common) || instance.common.name !== 'influxdb') return { provider: 'unknown' };
    const native = instance.native;
    // ioBroker.influxdb uses lowercase dbname and the version-specific organization field.
    if (native.dbversion !== '2.x' || !label(native.host) || !label(native.dbname) || !label(native.organization) ||
        !['http', 'https'].includes(String(native.protocol))) return { provider: 'unknown' };
    const port = typeof native.port === 'number' ? native.port : typeof native.port === 'string' && /^\d{1,5}$/.test(native.port) ? Number(native.port) : NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535 || /[\s/@?#\\]/.test(native.host)) return { provider: 'unknown' };
    const prefix = native.path === undefined ? '' : native.path;
    if (typeof prefix !== 'string' || (prefix !== '' && (!prefix.startsWith('/') || /[?#\\]/.test(prefix)))) return { provider: 'unknown' };
    const url = endpoint(`${native.protocol}://${native.host}:${port}${prefix}`);
    return url ? { provider: 'influxdb2', url, bucket: native.dbname, org: native.organization } : { provider: 'unknown' };
}

module.exports = { resolveHistoryBackupRequirement, validateRequirement };
