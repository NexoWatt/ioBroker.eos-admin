/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Führt den expliziten SmartHome-Schalter im gemeinsamen Installer.
 * Daten und Wirkung: Speichert nur die Freigabe im bestehenden geschützten
 * Installer-State. Gebäudestruktur, Zuordnungen, Szenen und Uhren bleiben erhalten.
 * Bei Änderungen: Altbestand, Schreibfehler, Parallelzugriffe und Rechte prüfen.
 */
type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
}
function record(value: unknown): RecordValue {
    return isRecord(value) ? value : {};
}

/** Erst eine bewusste neue Auswahl ersetzt den bisherigen nativen/AppCenter-Stand. */
export function smartHomeEnabled(config: unknown, nativeConfig?: unknown): boolean {
    const runtime = record(config);
    const smartHome = record(runtime.smartHome);
    if (Object.hasOwn(smartHome, 'customerViewEnabled') && typeof smartHome.customerViewEnabled === 'boolean') {
        return smartHome.customerViewEnabled;
    }
    const nativeSmartHome = record(record(nativeConfig).smartHome);
    const legacyEnabled = typeof nativeSmartHome.enabled === 'boolean'
        ? nativeSmartHome.enabled === true : smartHome.enabled === true;
    const apps = record(record(runtime.emsApps).apps);
    const app = Object.hasOwn(apps, 'smartHome') ? record(apps.smartHome) : record(apps.smarthome);
    return legacyEnabled || (app.installed === true && app.enabled === true);
}

interface Request { body?: unknown }
interface Response {
    status(code: number): Response;
    json(value: unknown): unknown;
    setHeader(name: string, value: string): unknown;
}
type Handler = (req: Request, res: Response) => unknown;
interface Router {
    get(path: string, guard: Handler, handler: Handler): unknown;
    post(path: string, guard: Handler, handler: Handler): unknown;
}
export interface SmartHomeActivationHost {
    config: unknown;
    _nwNativeConfigBase?: unknown;
    _nwInstallerConfigPatch?: unknown;
    _nwInstallerConfigRawPatch?: unknown;
    _nwMeshAppSaveInProgress?: unknown;
    _meshCoordinator?: { saving?: boolean };
    smartHomeDevices?: unknown;
    _nwProtectCredentialState(id: string): Promise<unknown>;
    setStateAsync(id: string, state: { val: string; ack: true }): Promise<unknown>;
    log: { warn(message: string): unknown };
}

function noStore(res: Response): void {
    res.setHeader('Cache-Control', 'no-store');
}

/** Routes sitzen hinter gemeinsamer Anmeldung, CSRF- und Feature-Lizenzprüfung. */
export function registerSmartHomeActivationApi(app: Router, host: SmartHomeActivationHost, guard: Handler): void {
    app.get('/api/smarthome/activation', guard, (_req, res) => {
        noStore(res);
        return res.json({ ok: true, enabled: smartHomeEnabled(host.config, host._nwNativeConfigBase) });
    });
    app.post('/api/smarthome/activation', guard, async (req, res) => {
        noStore(res);
        const body = record(req.body);
        if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'enabled') || typeof body.enabled !== 'boolean') {
            return res.status(400).json({ ok: false, error: 'SMART_HOME_ACTIVATION_INVALID' });
        }
        if (host._nwMeshAppSaveInProgress || host._meshCoordinator?.saving) {
            return res.status(409).json({ ok: false, error: 'INSTALLER_CONFIG_BUSY' });
        }
        // Dieselbe Sperre wie Layout/AppCenter, ohne Regelungsstop oder EMS-Neustart.
        const token = {};
        host._nwMeshAppSaveInProgress = token;
        try {
            const current = record(host.config);
            const previous = record(host._nwInstallerConfigPatch);
            const patch = { ...previous, smartHome: {
                ...record(previous.smartHome), customerViewEnabled: body.enabled,
            } };
            const nextConfig = { ...current, smartHome: {
                ...record(current.smartHome), customerViewEnabled: body.enabled,
            } };
            const json = JSON.stringify(patch);
            await host._nwProtectCredentialState('installer.configJson');
            await host.setStateAsync('installer.configJson', { val: json, ack: true });
            // Kein optimistischer Wechsel: erst eine bestätigte DB-Schreiboperation
            // darf den sichtbaren Zustand und den abgeleiteten Gerätecache ändern.
            host._nwInstallerConfigPatch = patch;
            host._nwInstallerConfigRawPatch = patch;
            host.config = nextConfig;
            host.smartHomeDevices = [];
            return res.json({ ok: true, enabled: body.enabled });
        } catch {
            host.log.warn('SmartHome-Aktivierung konnte nicht gespeichert werden; bisherige Einstellung bleibt aktiv.');
            return res.status(500).json({ ok: false, error: 'SMART_HOME_ACTIVATION_SAVE_FAILED' });
        } finally {
            if (host._nwMeshAppSaveInProgress === token) host._nwMeshAppSaveInProgress = false;
        }
    });
}
