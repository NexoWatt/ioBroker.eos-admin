/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/smarthome-activation.ts
 * Quell-Hash: sha256:41621ef404cb4e99f090e5888feab95253b2aeff299b939451ce635b946e0a71
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/smarthome-activation.js.
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
exports.smartHomeEnabled = smartHomeEnabled;
exports.registerSmartHomeActivationApi = registerSmartHomeActivationApi;
function isRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
}
function record(value) {
    return isRecord(value) ? value : {};
}
/** Erst eine bewusste neue Auswahl ersetzt den bisherigen nativen/AppCenter-Stand. */
function smartHomeEnabled(config, nativeConfig) {
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
function noStore(res) {
    res.setHeader('Cache-Control', 'no-store');
}
/** Routes sitzen hinter gemeinsamer Anmeldung, CSRF- und Feature-Lizenzprüfung. */
function registerSmartHomeActivationApi(app, host, guard) {
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
        }
        catch {
            host.log.warn('SmartHome-Aktivierung konnte nicht gespeichert werden; bisherige Einstellung bleibt aktiv.');
            return res.status(500).json({ ok: false, error: 'SMART_HOME_ACTIVATION_SAVE_FAILED' });
        }
        finally {
            if (host._nwMeshAppSaveInProgress === token)
                host._nwMeshAppSaveInProgress = false;
        }
    });
}
