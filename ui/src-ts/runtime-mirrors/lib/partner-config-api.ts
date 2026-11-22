/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/partner-config-api.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/partner-config-api.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: ff0fc5b935cc2e404df9384278f4aee9a4af8e61ef7d6e52d5de5586d109b6e0
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/partner-config-api.ts
 * Quell-Hash: sha256:db7d02ac67193522d9887a8d7dee431296599e39149654f910da30a439dfca9d
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/partner-config-api.js.
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
exports.partnerIntegrationSnapshot = partnerIntegrationSnapshot;
exports.assertPartnerPersistence = assertPartnerPersistence;
exports.registerPartnerIntegrationApi = registerPartnerIntegrationApi;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Geschützte Installateur-API für Partnerfreigaben, Entwurfsvorschau und globalen Widerruf.
 * Daten und Wirkung: Validierte Konfiguration wird über den zentralen CAS-Commit gespeichert; keine Geheimnisse.
 * Sicherheitsgrenze: Installer-Middleware UND tatsächliche Sitzungsrolle sind Pflicht; Fehler bleiben redigiert.
 * Bei Änderungen: Generische Import-/Speicherwege, Versionskonflikte und App-Rollen-Negativtests prüfen.
 * Verknüpfungen: partner-contracts.ts, partner-service.ts, main.ts.
 */
const http_error_boundary_1 = require("./http-error-boundary");
const partner_contracts_1 = require("./partner-contracts");
/** Öffentliche, statische Fehlermeldung; fremde Fehlerdetails gelangen niemals an API/Logs. */
class PartnerApiError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
/**
 * Code-Teil: apiError
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function apiError(status, code, message) { throw new PartnerApiError(status, code, message); }
/**
 * Code-Teil: fail
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function fail(res, error) {
    if (error instanceof PartnerApiError)
        return res.status(error.status).json({ ok: false, error: error.code, message: error.message });
    const failure = (0, http_error_boundary_1.safeConfigurationFailure)(error);
    return res.status(failure.status).json(failure.body);
}
/** Apprechte können nur explizit als echte Boolesche Werte gesetzt werden. */
function parseApp(value) {
    if (value === undefined)
        return null;
    if (!(0, partner_contracts_1.partnerRecord)(value) || !(0, partner_contracts_1.partnerKeys)(value, ['installed', 'enabled']) || typeof value.installed !== 'boolean' || typeof value.enabled !== 'boolean' || (!value.installed && value.enabled))
        return apiError(400, 'INVALID_APP', 'Ungültiger Appzustand.');
    return { installed: value.installed, enabled: value.enabled, active: value.installed && value.enabled };
}
/** Snapshot enthält nur die strikt validierte Positivliste, niemals Credentials oder ungeprüftes native. */
function partnerIntegrationSnapshot(root, status) {
    const stored = (0, partner_contracts_1.partnerRecord)(root) && root.partnerIntegrations !== undefined ? root.partnerIntegrations : (0, partner_contracts_1.defaultPartnerConfig)();
    const validation = (0, partner_contracts_1.validatePartnerConfig)(stored);
    return { ok: true, config: validation.config ?? (0, partner_contracts_1.defaultPartnerConfig)(), app: (0, partner_contracts_1.partnerAppState)(root), status: validation.valid ? status : { ...status, connection: 'blocked', reason: 'INVALID_CONFIG' }, validation: { valid: validation.valid, errors: validation.errors } };
}
/** Zentrale Persistenzgrenze für AppCenter, Import und andere Schreibwege: nie CAS oder Validierung umgehen. */
function assertPartnerPersistence(currentRoot, nextRoot) {
    const before = (0, partner_contracts_1.currentPartnerConfig)(currentRoot);
    const after = (0, partner_contracts_1.currentPartnerConfig)(nextRoot);
    if (JSON.stringify(before) === JSON.stringify(after))
        return;
    if (after.configVersion !== before.configVersion + 1)
        apiError(409, 'CONFIG_VERSION_CONFLICT', 'Partnerkonfiguration wurde zwischenzeitlich geändert.');
}
/** HTTP-Registrierung benötigt bestehende Auth-Middleware und überprüft deren konkrete Rolle erneut. */
function registerPartnerIntegrationApi(app, requireInstaller, hooks) {
    const base = '/api/installer/partner-integrations';
/**
 * Code-Teil: roleGuard
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const roleGuard = (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!(0, partner_contracts_1.partnerRecord)(req.nwSession) || (req.nwSession.role !== 'installer' && req.nwSession.role !== 'admin'))
            return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'Installateur- oder Administratorrolle erforderlich.' });
        if (next)
            next();
        return undefined;
    };
    app.get(base, requireInstaller, roleGuard, (_req, res) => {
        try {
            return res.json(partnerIntegrationSnapshot(hooks.getRoot(), hooks.getStatus()));
        }
        catch (error) {
            return fail(res, error);
        }
    });
    app.post(`${base}/preview`, requireInstaller, roleGuard, (req, res) => {
        try {
            if (!(0, partner_contracts_1.partnerRecord)(req.body) || !(0, partner_contracts_1.partnerKeys)(req.body, ['config']))
                apiError(400, 'INVALID_REQUEST', 'Konfigurationsentwurf erforderlich.');
            const validation = (0, partner_contracts_1.validatePartnerConfig)(req.body.config);
            return res.json({ ...partnerIntegrationSnapshot(hooks.getRoot(), hooks.getStatus()), config: validation.config, validation: { valid: validation.valid, errors: validation.errors }, preview: true });
        }
        catch (error) {
            return fail(res, error);
        }
    });
/**
 * Code-Teil: change
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const change = (revoke) => async (req, res) => {
        let token;
        try {
            if (!(0, partner_contracts_1.partnerRecord)(req.body) || !(0, partner_contracts_1.partnerKeys)(req.body, revoke ? ['expectedConfigVersion'] : ['config', 'expectedConfigVersion', 'app']) || !(0, partner_contracts_1.partnerInteger)(req.body.expectedConfigVersion, 1, Number.MAX_SAFE_INTEGER - 1))
                apiError(400, 'INVALID_REQUEST', 'Konfiguration und erwartete Revision erforderlich.');
            token = hooks.beginSave();
            if (!token)
                apiError(409, 'SAVE_BUSY', 'Ein anderer Speichervorgang läuft.');
            const current = (0, partner_contracts_1.currentPartnerConfig)(hooks.getRoot());
            if (current.configVersion !== req.body.expectedConfigVersion)
                apiError(409, 'CONFIG_VERSION_CONFLICT', 'Partnerkonfiguration wurde zwischenzeitlich geändert.');
            let config;
            let appState = null;
            if (revoke)
                config = { ...current, enabled: false, grants: [], configVersion: current.configVersion + 1 };
            else {
                const validation = (0, partner_contracts_1.validatePartnerConfig)(req.body.config);
                if (!validation.config)
                    return res.status(400).json({ ok: false, error: 'INVALID_CONFIG', validation: { valid: false, errors: validation.errors } });
                if (validation.config.configVersion !== current.configVersion)
                    apiError(409, 'CONFIG_VERSION_CONFLICT', 'Entwurf basiert auf einer veralteten Revision.');
                config = { ...validation.config, configVersion: current.configVersion + 1 };
                appState = parseApp(req.body.app);
            }
            // Auch ein fehlgeschlagener Commit darf keinen bereits widerrufenen Auftrag erneut aktivieren.
            await hooks.invalidate();
            await hooks.commit(config, appState, current.configVersion);
            return res.json(partnerIntegrationSnapshot(hooks.getRoot(), hooks.getStatus()));
        }
        catch (error) {
            return fail(res, error);
        }
        finally {
            if (token)
                hooks.endSave(token);
        }
    };
    app.post(`${base}/config`, requireInstaller, roleGuard, change(false));
    app.post(`${base}/revoke`, requireInstaller, roleGuard, change(true));
}
