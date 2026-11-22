/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ordnet kanonische ioBroker-Konten ausschließlich anhand ihrer Gruppen
 * den EOS-Rollen zu; Benutzer- und Anzeigenamen verleihen keine Berechtigung.
 * Daten und Wirkung: Validierte Gruppenlisten aus lokaler Adapterkonfiguration;
 * ausschließlich lesender Zugriff auf aktuelle system.group-Objekte. Keine
 * Änderung von Konten, Passwörtern, Gruppen oder Geräte-/Regelungsdaten.
 * Sicherheitsgrenze: Exakte Objekt-ID, Typ group und direkte Mitgliedschaft der
 * authentifizierten system.user-ID sind erforderlich. Fehlerhafte Konfiguration,
 * fehlerhafte bestehende Objekte und Lesefehler verweigern sämtliche Rollen.
 * Fehlende oder deaktivierte Gruppen verleihen keine Rolle. Bei mehreren gültigen
 * Zuordnungen gilt Admin vor Installer vor Customer. Implizite Namenregeln und
 * frühere Benutzerlisten werden nicht übernommen.
 * Zeitbudget: Maximal 5.000 ms insgesamt; ioBroker-Leseaufrufe sind nicht abbrechbar,
 * späte Ergebnisse werden verworfen und starten keine weiteren Leseaufrufe.
 * Bei Änderungen: Gruppenzuordnung, Widerruf und Rollenpriorität gemeinsam prüfen.
 * Nachweise: docs/reports/groups-auth-2026-11-03/GRUPPENMODUL_PRUEFVERMERK_DE.md
 */
import { performance } from 'node:perf_hooks';

export type IoBrokerRole = 'admin' | 'installer' | 'customer' | 'none';

export interface IoBrokerRolePolicy {
  readonly valid: boolean;
  readonly adminGroups: readonly string[];
  readonly installerGroups: readonly string[];
  readonly customerGroups: readonly string[];
}

export interface IoBrokerRoleAdapter {
  getForeignObjectAsync: (id: string) => Promise<unknown>;
}

export interface IoBrokerRoleInfo {
  user: string | null;
  role: IoBrokerRole;
  roles: IoBrokerRole[];
  groups: string[];
  capabilities: string[];
  isAdmin: boolean;
  isInstaller: boolean;
  isCustomer: boolean;
}

const MAX_SUFFIX_LENGTH = 128;
const MAX_CONFIG_CHARS = 8192;
const MAX_GROUPS_PER_FIELD = 32;
const MAX_GROUPS_TOTAL = 128;
const MAX_MEMBERS_PER_GROUP = 10000;
const ROLE_TIMEOUT_MS = 5000;
const FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;
const DEFAULT_ADMIN = ['system.group.administrator', 'system.group.eosAdmin', 'system.group.nexowattAdmin'];
const DEFAULT_INSTALLER = ['system.group.installer', 'system.group.eosInstaller', 'system.group.nexowattInstaller'];
const DEFAULT_CUSTOMER = ['system.group.user', 'system.group.eosUser', 'system.group.nexowattUser'];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Kanonische ID-Suffixe unverändert prüfen; keine erneute Namensnormalisierung. */
function canonicalSuffix(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SUFFIX_LENGTH
    && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
    && value.replace(FORBIDDEN_CHARS, '') === value;
}

function groupId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('system.group.') && canonicalSuffix(value.slice(13));
}

function memberId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('system.user.') && canonicalSuffix(value.slice(12));
}

/** Leer/fehlend ergänzt keine Gruppen; fremde Typen und zu große Listen sperren. */
function configuredGroups(value: unknown): string[] | null {
  if (value === undefined) return [];
  let items: unknown[];
  if (typeof value === 'string') {
    if (value.length > MAX_CONFIG_CHARS) return null;
    items = value.split(/[\n,;]+/u);
  } else if (Array.isArray(value)) {
    items = value;
  } else return null;
  if (items.length > MAX_GROUPS_PER_FIELD) return null;
  const groups: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string' || item.length > MAX_CONFIG_CHARS) return null;
    const id = item.trim();
    if (!id) continue;
    if (!groupId(id)) return null;
    groups.push(id);
  }
  return Array.from(new Set(groups));
}

function policy(admin: string[], installer: string[], customer: string[], valid: boolean): IoBrokerRolePolicy {
  return Object.freeze({
    valid,
    adminGroups: Object.freeze(admin),
    installerGroups: Object.freeze(installer),
    customerGroups: Object.freeze(customer),
  });
}

/**
 * Lokale Gruppenzuordnung einmalig validieren. Standardgruppen bleiben verfügbar;
 * individuelle vollständige Gruppen-IDs ergänzen sie. auth.installerGroups bleibt
 * als alter Gruppenvertrag erhalten. Benutzerlisten werden bewusst nicht gelesen.
 */
export function createIoBrokerRolePolicy(accessControl: unknown = {}, auth: unknown = {}): IoBrokerRolePolicy {
  const invalid = (): IoBrokerRolePolicy => policy([], [], [], false);
  try {
    if (!record(accessControl) || !record(auth)) return invalid();
    const admin = configuredGroups(accessControl.adminGroups);
    const installer = configuredGroups(accessControl.installerGroups);
    const customer = configuredGroups(accessControl.customerGroups);
    const legacyInstaller = configuredGroups(auth.installerGroups);
    if (!admin || !installer || !customer || !legacyInstaller) return invalid();
    const admins = Array.from(new Set([...DEFAULT_ADMIN, ...admin]));
    const installers = Array.from(new Set([...DEFAULT_INSTALLER, ...installer, ...legacyInstaller]));
    const customers = Array.from(new Set([...DEFAULT_CUSTOMER, ...customer]));
    if (new Set([...admins, ...installers, ...customers]).size > MAX_GROUPS_TOTAL) return invalid();
    return policy(admins, installers, customers, true);
  } catch (_error: unknown) { return invalid(); }
}

/** Abgeschlossene Rollenabbildung; keine dynamischen Capability-/Objektindizes. */
function roleInfo(user: string | null, role: IoBrokerRole, groups: string[]): IoBrokerRoleInfo {
  const capabilities = role === 'admin' ? ['*'] : role === 'installer' ? [
    'frontend.open', 'appcenter.open', 'simulation.open', 'mapping.edit',
    'chargepoints.configure', 'mesh.configure', 'exportGuard.configure',
    'smarthome.configure', 'nexologic.configure', 'diagnostics.open',
    'energyWallet.customerSettings',
  ] : role === 'customer' ? ['frontend.open', 'energyWallet.customerSettings'] : [];
  return {
    user, role, roles: role === 'none' ? [] : [role], groups, capabilities,
    isAdmin: role === 'admin', isInstaller: role === 'admin' || role === 'installer',
    isCustomer: role === 'customer',
  };
}

/**
 * Aktuelle Gruppen pro Zugriff prüfen. Ein unbekanntes oder gruppenloses Konto
 * erhält none. Die Kontoprüfung/Authentifizierung muss der Aufrufer vorher leisten.
 * Keine gecachten Gruppen: Entfernung, Löschung und Sperre wirken beim nächsten
 * Zugriff. timeoutMs darf das gemeinsame Budget für Tests nur verkürzen.
 */
export function resolveIoBrokerRoleInfo(
  adapter: IoBrokerRoleAdapter,
  user: unknown,
  rolePolicy: IoBrokerRolePolicy,
  timeoutMs = ROLE_TIMEOUT_MS,
): Promise<IoBrokerRoleInfo> {
  const canonicalUser = canonicalSuffix(user) ? user : null;
  const denied = (): IoBrokerRoleInfo => roleInfo(canonicalUser, 'none', []);
  if (!canonicalUser || rolePolicy.valid !== true) return Promise.resolve(denied());
  const allGroups = Array.from(new Set([...rolePolicy.adminGroups, ...rolePolicy.installerGroups, ...rolePolicy.customerGroups]));
  if (allGroups.length > MAX_GROUPS_TOTAL || !allGroups.every(groupId)) return Promise.resolve(denied());
  const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, ROLE_TIMEOUT_MS) : ROLE_TIMEOUT_MS;
  const deadline = performance.now() + budget;
  return new Promise(resolve => {
    let active = true;
    const inTime = (): boolean => active && performance.now() < deadline;
    const finish = (value: IoBrokerRoleInfo): void => {
      if (!active) return;
      const accepted = inTime();
      active = false;
      clearTimeout(timer);
      resolve(accepted ? value : denied());
    };
    const timer = setTimeout(() => finish(denied()), budget);
    const run = async (): Promise<void> => {
      try {
        const groups: string[] = [];
        const canonicalId = 'system.user.' + canonicalUser;
        for (const id of allGroups) {
          if (!inTime()) { finish(denied()); return; }
          const object = await adapter.getForeignObjectAsync(id);
          if (!inTime()) { finish(denied()); return; }
          if (object === null || object === undefined) continue;
          if (!record(object) || object._id !== id || object.type !== 'group' || !record(object.common)) { finish(denied()); return; }
          const common = object.common;
          if (common.enabled !== undefined && typeof common.enabled !== 'boolean') { finish(denied()); return; }
          if (common.enabled === false) continue;
          if (!Array.isArray(common.members) || common.members.length > MAX_MEMBERS_PER_GROUP || !common.members.every(memberId)) { finish(denied()); return; }
          if (common.members.includes(canonicalId)) groups.push(id);
        }
        let role: IoBrokerRole = 'none';
        if (groups.some(id => rolePolicy.adminGroups.includes(id))) role = 'admin';
        else if (groups.some(id => rolePolicy.installerGroups.includes(id))) role = 'installer';
        else if (groups.some(id => rolePolicy.customerGroups.includes(id))) role = 'customer';
        finish(roleInfo(canonicalUser, role, groups));
      } catch (_error: unknown) { finish(denied()); }
    };
    void run();
  });
}
