/** Same-origin EOS licensing API. Never persists or returns activation codes or private keys. */
export interface EosLicenseStatus {
    valid: boolean;
    code: string;
    uuid: string | null;
    edition: 'home' | 'pro' | null;
    expiresAt: number | null;
    limits: { chargePoints?: number; batteries?: number };
    features: string[];
    tokenVersion: 2 | 3 | null;
    scope: 'system' | 'adapters' | null;
    coreEnabled: boolean;
}
export interface EosTrustKey {
    kid: string;
    fingerprint: string;
    source: 'os' | 'restored' | 'os+restored';
}
export interface EosAllowedKey {
    kid: string;
    fingerprint: string;
    source: 'release' | 'os' | 'release+os';
}
export interface EosTrustStatus {
    ready: boolean;
    code: string;
    canImport: boolean;
    source: 'os' | 'restored' | 'combined' | 'none';
    keys: EosTrustKey[];
    allowedKeys: EosAllowedKey[];
}
export interface EosTrustResult {
    trust: EosTrustStatus;
    license: EosLicenseStatus;
}
export type EosPublicKeys = Record<string, string>;
type LicenseAction = 'status' | 'activate' | 'remove';
type TrustAction = 'status' | 'import' | 'recheck' | 'export';
const MAX_RESPONSE_BYTES = 65536;
export const MAX_PUBLIC_KEY_FILE_BYTES = 32768;
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value);
const isKid = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);

/** Keep diagnostics useful without displaying arbitrary remote response content. */
export function licenseErrorCode(cause: unknown): string {
    if (cause instanceof Error && cause.name === 'AbortError') {
        return 'SERVICE_TIMEOUT';
    }
    return cause instanceof Error && isCode(cause.message) ? cause.message : 'SERVICE_UNAVAILABLE';
}

export function parseLicenseStatus(value: unknown): EosLicenseStatus {
    if (
        !isRecord(value) ||
        value.v !== 1 ||
        typeof value.valid !== 'boolean' ||
        !isCode(value.code) ||
        !(
            value.uuid === null ||
            (typeof value.uuid === 'string' &&
                /^(?:[a-z]{2})?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.uuid))
        ) ||
        !(value.edition === null || value.edition === 'home' || value.edition === 'pro') ||
        !(
            value.expiresAt === null ||
            (typeof value.expiresAt === 'number' &&
                Number.isSafeInteger(value.expiresAt) &&
                value.expiresAt > 0 &&
                value.expiresAt <= 8640000000000000)
        ) ||
        !isRecord(value.limits) ||
        !Array.isArray(value.features) ||
        value.features.length > 64 ||
        !value.features.every(item => typeof item === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(item)) ||
        !(value.tokenVersion === null || value.tokenVersion === 2 || value.tokenVersion === 3) ||
        !(value.scope === null || value.scope === 'system' || value.scope === 'adapters') ||
        typeof value.coreEnabled !== 'boolean'
    ) {
        throw new Error('LICENSE_RESPONSE');
    }
    if (
        value.valid &&
        (value.code !== 'LICENSE_VALID' ||
            !value.uuid ||
            !value.edition ||
            !isCount(value.limits.chargePoints) ||
            !isCount(value.limits.batteries) ||
            (value.tokenVersion === 3
                ? value.scope !== 'system' || !value.coreEnabled
                : value.tokenVersion !== 2 || value.scope !== 'adapters'))
    ) {
        throw new Error('LICENSE_RESPONSE');
    }
    if (!value.valid && (value.coreEnabled || value.tokenVersion !== null || value.scope !== null)) {
        throw new Error('LICENSE_RESPONSE');
    }
    return {
        valid: value.valid,
        code: value.code,
        uuid: value.uuid,
        edition: value.edition,
        expiresAt: value.expiresAt,
        limits: value.valid
            ? { chargePoints: value.limits.chargePoints as number, batteries: value.limits.batteries as number }
            : {},
        features: value.valid ? value.features : [],
        tokenVersion: value.tokenVersion,
        scope: value.scope,
        coreEnabled: value.coreEnabled,
    };
}

function parseKeyList<S extends string>(
    value: unknown,
    sources: readonly S[],
    maximum: number,
): { kid: string; fingerprint: string; source: S }[] {
    if (!Array.isArray(value) || value.length > maximum) {
        throw new Error('TRUST_RESPONSE');
    }
    const seen = new Set<string>();
    return value.map(item => {
        if (
            !isRecord(item) ||
            !isKid(item.kid) ||
            seen.has(item.kid) ||
            typeof item.fingerprint !== 'string' ||
            !/^[a-f0-9]{64}$/.test(item.fingerprint) ||
            typeof item.source !== 'string'
        ) {
            throw new Error('TRUST_RESPONSE');
        }
        const source = sources.find(candidate => candidate === item.source);
        if (!source) {
            throw new Error('TRUST_RESPONSE');
        }
        seen.add(item.kid);
        return { kid: item.kid, fingerprint: item.fingerprint, source };
    });
}
export function parseTrustStatus(value: unknown): EosTrustStatus {
    if (
        !isRecord(value) ||
        value.v !== 1 ||
        typeof value.ready !== 'boolean' ||
        !isCode(value.code) ||
        typeof value.canImport !== 'boolean' ||
        !(
            value.source === 'os' ||
            value.source === 'restored' ||
            value.source === 'combined' ||
            value.source === 'none'
        )
    ) {
        throw new Error('TRUST_RESPONSE');
    }
    const keys = parseKeyList(value.keys, ['os', 'restored', 'os+restored'] as const, 32);
    const allowedKeys = parseKeyList(value.allowedKeys, ['release', 'os', 'release+os'] as const, 64);
    if (
        (value.ready && (value.code !== 'TRUST_READY' || !keys.length || value.source === 'none')) ||
        (!value.ready && (keys.length > 0 || value.code === 'TRUST_READY')) ||
        (value.source === 'none' && keys.length > 0)
    ) {
        throw new Error('TRUST_RESPONSE');
    }
    return {
        ready: value.ready,
        code: value.code,
        canImport: value.canImport,
        source: value.source,
        keys,
        allowedKeys,
    };
}

/** Browser preflight only; the backend independently validates the issuer's authority. */
export function parsePublicKeys(value: unknown): EosPublicKeys {
    if (!isRecord(value)) {
        throw new Error('TRUST_INVALID');
    }
    const entries = Object.entries(value);
    if (
        entries.some(([key, pem]) => /private|vault|cipher|kdf|passphrase/i.test(key) && typeof pem !== 'string') ||
        entries.some(([, pem]) => typeof pem === 'string' && /PRIVATE KEY/.test(pem))
    ) {
        throw new Error('TRUST_PRIVATE_MATERIAL');
    }
    if (!entries.length || entries.length > 32) {
        throw new Error('TRUST_INVALID');
    }
    const result: EosPublicKeys = {};
    for (const [kid, pem] of entries) {
        if (
            !isKid(kid) ||
            typeof pem !== 'string' ||
            pem.length > 1024 ||
            !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\r?\n?$/.test(pem)
        ) {
            throw new Error('TRUST_INVALID');
        }
        // Ed25519 SubjectPublicKeyInfo has a fixed 12-byte ASN.1 prefix and a 32-byte public key.
        const encoded = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
        let decoded: string;
        try {
            decoded = atob(encoded);
        } catch {
            throw new Error('TRUST_INVALID');
        }
        const prefix = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];
        if (
            decoded.length !== 44 ||
            !prefix.every((byte, index) => decoded.charCodeAt(index) === byte) ||
            btoa(decoded) !== encoded
        ) {
            throw new Error('TRUST_INVALID');
        }
        Object.defineProperty(result, kid, { value: pem, enumerable: true, configurable: true, writable: true });
    }
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_PUBLIC_KEY_FILE_BYTES) {
        throw new Error('TRUST_FILE_SIZE');
    }
    return result;
}
export async function parsePublicKeyFile(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<EosPublicKeys> {
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_PUBLIC_KEY_FILE_BYTES) {
        throw new Error('TRUST_FILE_SIZE');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || bytes.byteLength > MAX_PUBLIC_KEY_FILE_BYTES) {
        throw new Error('TRUST_FILE_SIZE');
    }
    let value: unknown;
    try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        throw new Error('TRUST_INVALID');
    }
    return parsePublicKeys(value);
}

async function readJson(response: Response): Promise<unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('LICENSE_RESPONSE');
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }
            length += chunk.value.byteLength;
            if (length > MAX_RESPONSE_BYTES) {
                throw new Error('LICENSE_RESPONSE');
            }
            chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        try {
            return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        } catch {
            throw new Error('LICENSE_RESPONSE');
        }
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
export function licenseEndpoint(action: LicenseAction | `trust/${TrustAction}`, pageUrl?: string): string {
    const path = `/nexowatt/license/${action}`;
    return pageUrl ? new URL(path, pageUrl).href : path;
}
async function requestJson(
    action: LicenseAction | `trust/${TrustAction}`,
    signal: AbortSignal,
    body?: unknown,
): Promise<unknown> {
    if (signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
    }
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
        controller.abort();
    }
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const write = body !== undefined;
        const response = await fetch(licenseEndpoint(action, globalThis.location?.href), {
            method: write ? 'POST' : 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
            headers: write
                ? { Accept: 'application/json', 'Content-Type': 'application/json', 'X-EOS-License': '1' }
                : { Accept: 'application/json' },
            ...(write ? { body: JSON.stringify(body) } : {}),
        });
        const data = await readJson(response);
        if (!response.ok) {
            throw new Error(isRecord(data) && isCode(data.error) ? data.error : 'SERVICE_UNAVAILABLE');
        }
        return data;
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
    }
}
export async function requestLicense(
    action: LicenseAction,
    signal: AbortSignal,
    token?: string,
): Promise<EosLicenseStatus> {
    if (action !== 'status' && action !== 'activate' && action !== 'remove') {
        throw new Error('LICENSE_REQUEST');
    }
    if (action === 'activate' && (typeof token !== 'string' || !token.trim() || token.length > 16384)) {
        throw new Error('LICENSE_FORMAT');
    }
    const status = parseLicenseStatus(
        await requestJson(
            action,
            signal,
            action === 'activate' ? { token: token?.trim() } : action === 'remove' ? {} : undefined,
        ),
    );
    if ((action === 'activate' && !status.valid) || (action === 'remove' && status.valid)) {
        throw new Error('LICENSE_RESPONSE');
    }
    return status;
}
export async function requestTrustStatus(signal: AbortSignal): Promise<EosTrustStatus> {
    return parseTrustStatus(await requestJson('trust/status', signal));
}
export async function requestTrustUpdate(
    action: 'import' | 'recheck',
    signal: AbortSignal,
    keys?: EosPublicKeys,
): Promise<EosTrustResult> {
    if (action !== 'import' && action !== 'recheck') {
        throw new Error('LICENSE_REQUEST');
    }
    const body = action === 'import' ? { keys: parsePublicKeys(keys) } : {};
    const data = await requestJson(`trust/${action}`, signal, body);
    const trust = parseTrustStatus(data);
    if (!isRecord(data)) {
        throw new Error('TRUST_RESPONSE');
    }
    return { trust, license: parseLicenseStatus(data.licenseStatus) };
}
export async function requestTrustExport(signal: AbortSignal): Promise<EosPublicKeys> {
    return parsePublicKeys(await requestJson('trust/export', signal));
}
