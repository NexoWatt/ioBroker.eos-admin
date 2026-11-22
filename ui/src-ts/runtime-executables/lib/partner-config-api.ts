/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Geschützte Installateur-API für Partnerfreigaben, Entwurfsvorschau und globalen Widerruf.
 * Daten und Wirkung: Validierte Konfiguration wird über den zentralen CAS-Commit gespeichert; keine Geheimnisse.
 * Sicherheitsgrenze: Installer-Middleware UND tatsächliche Sitzungsrolle sind Pflicht; Fehler bleiben redigiert.
 * Bei Änderungen: Generische Import-/Speicherwege, Versionskonflikte und App-Rollen-Negativtests prüfen.
 * Verknüpfungen: partner-contracts.ts, partner-service.ts, main.ts.
 */
import { safeConfigurationFailure } from './http-error-boundary';
import { currentPartnerConfig, defaultPartnerConfig, partnerAppState, partnerRecord, partnerKeys, partnerInteger, validatePartnerConfig } from './partner-contracts';
import type { PartnerAppState, PartnerConfig, PartnerRecord } from './partner-contracts';
import type { PartnerStatus } from './partner-service';
export type PartnerHttpRequest = { body?: unknown; nwSession?: unknown };
export type PartnerHttpResponse = { setHeader(name: string, value: string): unknown; status(code: number): PartnerHttpResponse; json(value: unknown): unknown };
export type PartnerHttpHandler = (req: PartnerHttpRequest, res: PartnerHttpResponse, next?: (error?: unknown) => void) => unknown;
export type PartnerHttpApp = { get(path: string, ...handlers: PartnerHttpHandler[]): unknown; post(path: string, ...handlers: PartnerHttpHandler[]): unknown };
export type PartnerApiHooks = {
  getRoot(): unknown;
  getStatus(): PartnerStatus;
  beginSave(): unknown;
  endSave(token: unknown): void;
  commit(config: PartnerConfig, app: PartnerAppState | null, expectedConfigVersion: number): Promise<void>;
  invalidate(): void | Promise<void>;
};
/** Öffentliche, statische Fehlermeldung; fremde Fehlerdetails gelangen niemals an API/Logs. */
class PartnerApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
function apiError(status: number, code: string, message: string): never { throw new PartnerApiError(status, code, message); }
function fail(res: PartnerHttpResponse, error: unknown): unknown {
  if (error instanceof PartnerApiError) return res.status(error.status).json({ ok: false, error: error.code, message: error.message });
  const failure = safeConfigurationFailure(error);
  return res.status(failure.status).json(failure.body);
}
/** Apprechte können nur explizit als echte Boolesche Werte gesetzt werden. */
function parseApp(value: unknown): PartnerAppState | null {
  if (value === undefined) return null;
  if (!partnerRecord(value) || !partnerKeys(value, ['installed', 'enabled']) || typeof value.installed !== 'boolean' || typeof value.enabled !== 'boolean' || (!value.installed && value.enabled)) return apiError(400, 'INVALID_APP', 'Ungültiger Appzustand.');
  return { installed: value.installed, enabled: value.enabled, active: value.installed && value.enabled };
}
/** Snapshot enthält nur die strikt validierte Positivliste, niemals Credentials oder ungeprüftes native. */
export function partnerIntegrationSnapshot(root: unknown, status: PartnerStatus): PartnerRecord {
  const stored = partnerRecord(root) && root.partnerIntegrations !== undefined ? root.partnerIntegrations : defaultPartnerConfig();
  const validation = validatePartnerConfig(stored);
  return { ok: true, config: validation.config ?? defaultPartnerConfig(), app: partnerAppState(root), status: validation.valid ? status : { ...status, connection: 'blocked', reason: 'INVALID_CONFIG' }, validation: { valid: validation.valid, errors: validation.errors } };
}
/** Zentrale Persistenzgrenze für AppCenter, Import und andere Schreibwege: nie CAS oder Validierung umgehen. */
export function assertPartnerPersistence(currentRoot: unknown, nextRoot: unknown): void {
  const before = currentPartnerConfig(currentRoot);
  const after = currentPartnerConfig(nextRoot);
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (after.configVersion !== before.configVersion + 1) apiError(409, 'CONFIG_VERSION_CONFLICT', 'Partnerkonfiguration wurde zwischenzeitlich geändert.');
}
/** HTTP-Registrierung benötigt bestehende Auth-Middleware und überprüft deren konkrete Rolle erneut. */
export function registerPartnerIntegrationApi(app: PartnerHttpApp, requireInstaller: PartnerHttpHandler, hooks: PartnerApiHooks): void {
  const base = '/api/installer/partner-integrations';
  const roleGuard: PartnerHttpHandler = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!partnerRecord(req.nwSession) || (req.nwSession.role !== 'installer' && req.nwSession.role !== 'admin')) return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: 'Installateur- oder Administratorrolle erforderlich.' });
    if (next) next();
    return undefined;
  };
  app.get(base, requireInstaller, roleGuard, (_req, res) => {
    try { return res.json(partnerIntegrationSnapshot(hooks.getRoot(), hooks.getStatus())); } catch (error) { return fail(res, error); }
  });
  app.post(`${base}/preview`, requireInstaller, roleGuard, (req, res) => {
    try {
      if (!partnerRecord(req.body) || !partnerKeys(req.body, ['config'])) apiError(400, 'INVALID_REQUEST', 'Konfigurationsentwurf erforderlich.');
      const validation = validatePartnerConfig(req.body.config);
      return res.json({ ...partnerIntegrationSnapshot(hooks.getRoot(), hooks.getStatus()), config: validation.config, validation: { valid: validation.valid, errors: validation.errors }, preview: true });
    } catch (error) { return fail(res, error); }
  });
  const change = (revoke: boolean): PartnerHttpHandler => async (req, res) => {
    let token: unknown;
    try {
      if (!partnerRecord(req.body) || !partnerKeys(req.body, revoke ? ['expectedConfigVersion'] : ['config', 'expectedConfigVersion', 'app']) || !partnerInteger(req.body.expectedConfigVersion, 1, Number.MAX_SAFE_INTEGER - 1)) apiError(400, 'INVALID_REQUEST', 'Konfiguration und erwartete Revision erforderlich.');
      token = hooks.beginSave();
      if (!token) apiError(409, 'SAVE_BUSY', 'Ein anderer Speichervorgang läuft.');
      const current = currentPartnerConfig(hooks.getRoot());
      if (current.configVersion !== req.body.expectedConfigVersion) apiError(409, 'CONFIG_VERSION_CONFLICT', 'Partnerkonfiguration wurde zwischenzeitlich geändert.');
      let config: PartnerConfig;
      let appState: PartnerAppState | null = null;
      if (revoke) config = { ...current, enabled: false, grants: [], configVersion: current.configVersion + 1 };
      else {
        const validation = validatePartnerConfig(req.body.config);
        if (!validation.config) return res.status(400).json({ ok: false, error: 'INVALID_CONFIG', validation: { valid: false, errors: validation.errors } });
        if (validation.config.configVersion !== current.configVersion) apiError(409, 'CONFIG_VERSION_CONFLICT', 'Entwurf basiert auf einer veralteten Revision.');
        config = { ...validation.config, configVersion: current.configVersion + 1 }; appState = parseApp(req.body.app);
      }
      // Auch ein fehlgeschlagener Commit darf keinen bereits widerrufenen Auftrag erneut aktivieren.
      await hooks.invalidate();
      await hooks.commit(config, appState, current.configVersion);
      return res.json(partnerIntegrationSnapshot(hooks.getRoot(), hooks.getStatus()));
    } catch (error) { return fail(res, error); }
    finally { if (token) hooks.endSave(token); }
  };
  app.post(`${base}/config`, requireInstaller, roleGuard, change(false));
  app.post(`${base}/revoke`, requireInstaller, roleGuard, change(true));
}
