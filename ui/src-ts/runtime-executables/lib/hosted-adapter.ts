/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bindet die eingebettete UI an EOS und bewahrt bei bestätigter Migration den alten Datenpunkt-Namespace.
 * Daten und Wirkung: Eine Adapterinstanz, unveränderte History-/Alias-IDs, zentraler Lizenz-/Schreibschutz und verschlüsselte Konfiguration.
 * Bei Änderungen: Namespace-, Credential-, Lizenz- und Schreibschutz sowie die Migrations- und HTTP-Regressionsprüfungen erhalten.
 * Grenze: Namespaces kommen ausschließlich aus der geschützten Migrationsablage; Browserwerte erweitern keine Rechte.
 */
'use strict';
type JsonRecord = Record<string, unknown>;
interface StoredObject extends JsonRecord { native?: JsonRecord }
interface Bridge {
  resolveAccess(request: unknown): Promise<unknown>;
  getLicense(): unknown;
  canWrite(): boolean;
  originAllowed(request: unknown): boolean;
}
interface Owner {
  namespace: string;
  instance: number;
  config: JsonRecord;
  eosMigration?: { saveUi(config: JsonRecord): Promise<void> };
  getForeignObjectAsync(id: string, ...args: unknown[]): Promise<StoredObject | null | undefined>;
  setForeignObjectAsync(id: string, object: StoredObject, ...args: unknown[]): Promise<unknown>;
  setForeignStateAsync(id: string, ...args: unknown[]): Promise<unknown>;
  setForeignStateChangedAsync(id: string, ...args: unknown[]): Promise<unknown>;
  setForeignState(id: string, ...args: unknown[]): unknown;
  setForeignStateChanged(id: string, ...args: unknown[]): unknown;
}
const defaults: unknown = require('../io-package.json').native;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function record(value: unknown): value is JsonRecord { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value: unknown): unknown { return JSON.parse(JSON.stringify(value)); }
function merge(base: unknown, overlay: unknown): JsonRecord {
  const copy = clone(record(base) ? base : {});
  if (!record(copy)) throw new Error('EOS_UI_CONFIG_INVALID');
  if (!record(overlay)) return copy;
  for (const [key, value] of Object.entries(overlay)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error('EOS_UI_CONFIG_INVALID');
    const old: unknown = Reflect.get(copy, key);
    Reflect.set(copy, key, record(value) ? merge(record(old) ? old : {}, value) : clone(value));
  }
  return copy;
}
function retainedNamespace(owner: Owner): string {
  const migration = owner.config.eosUiMigration;
  return record(migration) && migration.preserveNamespace === true && typeof migration.source === 'string'
    && /^nexowatt-ui\.\d+$/.test(migration.source) ? migration.source : owner.namespace;
}
const LOCAL_METHODS = new Map<string, string>([
  ['getObject', 'getForeignObject'], ['getObjectAsync', 'getForeignObjectAsync'],
  ['getState', 'getForeignState'], ['getStateAsync', 'getForeignStateAsync'], ['getStates', 'getForeignStates'], ['getStatesAsync', 'getForeignStatesAsync'],
  ['setObject', 'setForeignObject'], ['setObjectAsync', 'setForeignObjectAsync'],
  ['setObjectNotExists', 'setForeignObjectNotExists'], ['setObjectNotExistsAsync', 'setForeignObjectNotExistsAsync'],
  ['extendObject', 'extendForeignObject'], ['extendObjectAsync', 'extendForeignObjectAsync'],
  ['delObject', 'delForeignObject'], ['delObjectAsync', 'delForeignObjectAsync'],
  ['setState', 'setForeignState'], ['setStateAsync', 'setForeignStateAsync'],
  ['setStateChanged', 'setForeignStateChanged'], ['setStateChangedAsync', 'setForeignStateChangedAsync'],
  ['delState', 'delForeignState'], ['delStateAsync', 'delForeignStateAsync'],
  ['subscribeStates', 'subscribeForeignStates'], ['subscribeStatesAsync', 'subscribeForeignStatesAsync'],
  ['unsubscribeStates', 'unsubscribeForeignStates'], ['unsubscribeStatesAsync', 'unsubscribeForeignStatesAsync'],
  ['subscribeObjects', 'subscribeForeignObjects'], ['subscribeObjectsAsync', 'subscribeForeignObjectsAsync'],
  ['unsubscribeObjects', 'unsubscribeForeignObjects'], ['unsubscribeObjectsAsync', 'unsubscribeForeignObjectsAsync'],
]);
const GUARDED_WRITES = new Set(['setForeignState', 'setForeignStateAsync', 'setForeignStateChanged', 'setForeignStateChangedAsync']);
class HostedAdapter {
  declare readonly _owner: Owner;
  declare readonly _bridge: Bridge;
  declare readonly namespace: string;
  declare readonly hostNamespace: string;
  declare readonly name: string;
  declare readonly instance: number;
  config: JsonRecord;
  constructor({ owner, bridge }: { owner: Owner; bridge: Bridge }) {
    if (!owner || !/^eos-admin\.\d+$/.test(owner.namespace || '') || !bridge
      || typeof bridge.resolveAccess !== 'function' || typeof bridge.getLicense !== 'function'
      || typeof bridge.canWrite !== 'function' || typeof bridge.originAllowed !== 'function') throw new Error('EOS_UI_BRIDGE_INVALID');
    const namespace = retainedNamespace(owner);
    Object.defineProperties(this, {
      _owner: { value: owner }, _bridge: { value: bridge },
      namespace: { value: namespace }, hostNamespace: { value: owner.namespace },
      name: { value: namespace.split('.')[0] }, instance: { value: Number(namespace.split('.').at(-1)) },
    });
    this.config = merge(defaults, owner.config.eosUi || {});
    delete this.config.licenseKey;
    this.config.auth = { mode: 'eos' };
    this.config.port = owner.config.port;
    const bound = new Map<PropertyKey, unknown>();
    return new Proxy(this, {
      get(target, key, receiver) {
        if (Reflect.has(target, key)) return Reflect.get(target, key, receiver);
        const foreign = typeof key === 'string' ? LOCAL_METHODS.get(key) : undefined;
        if (target.namespace !== owner.namespace && foreign) {
          if (!bound.has(key)) {
            const method: unknown = Reflect.get(GUARDED_WRITES.has(foreign) ? target : owner, foreign);
            const context = GUARDED_WRITES.has(foreign) ? target : owner;
            if (typeof method !== 'function') throw new Error('EOS_UI_MIGRATION_API_UNAVAILABLE');
            bound.set(key, (id: string, ...args: unknown[]): unknown => {
              if (typeof id !== 'string' || !id || id.length > 512) throw new Error('EOS_UI_STATE_ID');
              const full = id.startsWith(`${target.namespace}.`) ? id : `${target.namespace}.${id}`;
              return Reflect.apply(method, context, [full, ...args]);
            });
          }
          return bound.get(key);
        }
        const value: unknown = Reflect.get(owner, key);
        if (typeof value !== 'function') return value;
        if (!bound.has(key)) bound.set(key, value.bind(owner));
        return bound.get(key);
      },
    });
  }
  ownsLocalNamespace(): boolean { return this.namespace === retainedNamespace(this._owner); }
  async getForeignObjectAsync(id: string, ...args: unknown[]): Promise<StoredObject | null | undefined> {
    const own = id === `system.adapter.${this.namespace}`;
    const object = await this._owner.getForeignObjectAsync(own ? `system.adapter.${this._owner.namespace}` : id, ...args);
    if (!own || !object) return object;
    return { ...object, _id: id, native: merge(defaults, this._owner.config.eosUi || {}) };
  }
  async setForeignObjectAsync(id: string, object: StoredObject, ...args: unknown[]): Promise<unknown> {
    if (id !== `system.adapter.${this.namespace}`) return this._owner.setForeignObjectAsync(id, object, ...args);
    const actual = await this._owner.getForeignObjectAsync(`system.adapter.${this._owner.namespace}`);
    if (!actual || !record(object?.native)) throw new Error('EOS_UI_CONFIG_INVALID');
    const next = merge({}, object.native);
    delete next.licenseKey; delete next.auth; delete next.port; delete next.secure;
    if (this._owner.eosMigration?.saveUi) await this._owner.eosMigration.saveUi(next);
    else if (this.namespace !== this._owner.namespace) throw new Error('EOS_UI_MIGRATION_STORE_UNAVAILABLE');
    else await this._owner.setForeignObjectAsync(id, { ...actual, native: { ...actual.native, eosUi: next } }, ...args);
    this._owner.config.eosUi = clone(next);
  }
  setForeignStateAsync(id: string, ...args: unknown[]): Promise<unknown> {
    if (this._bridge.canWrite() !== true) return Promise.reject(new Error('EOS_UI_OWNERSHIP_LOST'));
    return this._owner.setForeignStateAsync(id, ...args);
  }
  setForeignStateChangedAsync(id: string, ...args: unknown[]): Promise<unknown> {
    if (this._bridge.canWrite() !== true) return Promise.reject(new Error('EOS_UI_OWNERSHIP_LOST'));
    return this._owner.setForeignStateChangedAsync(id, ...args);
  }
  setForeignStateChanged(id: string, ...args: unknown[]): unknown {
    if (this._bridge.canWrite() !== true) return deniedWrite(args);
    return this._owner.setForeignStateChanged(id, ...args);
  }
  setForeignState(id: string, ...args: unknown[]): unknown {
    if (this._bridge.canWrite() !== true) return deniedWrite(args);
    return this._owner.setForeignState(id, ...args);
  }
}
function deniedWrite(args: unknown[]): void {
  const callback = args.at(-1);
  if (typeof callback === 'function') { callback(new Error('EOS_UI_OWNERSHIP_LOST')); return; }
  throw new Error('EOS_UI_OWNERSHIP_LOST');
}
/** Public snapshot only; editions/limits never originate from UI config/states. */
function centralLicenseSnapshot(bridge: Pick<Bridge, 'getLicense'>) {
  let raw: unknown;
  try { raw = bridge.getLicense(); } catch { raw = null; }
  const state = record(raw) ? raw : {};
  const limits = record(state.limits) ? state.limits : {};
  const chargePoints = typeof limits.chargePoints === 'number' ? limits.chargePoints : 0;
  const batteries = typeof limits.batteries === 'number' ? limits.batteries : -1;
  const valid = state.valid === true && state.coreEnabled === true
    && (state.edition === 'home' || state.edition === 'pro') && Array.isArray(state.features)
    && Number.isInteger(chargePoints) && chargePoints > 0 && Number.isInteger(batteries) && batteries >= 0;
  return {
    ok: valid, edition: valid ? (state.edition === 'home' ? 'hems' : 'eos') : 'none',
    type: valid ? 'full' : 'none', uuid: typeof state.uuid === 'string' ? state.uuid : '',
    msg: valid ? 'Zentrale EOS-Lizenz aktiv' : 'Zentrale EOS-Lizenz erforderlich',
    maxWallboxes: valid ? chargePoints : 0, maxStorages: valid ? batteries : 0,
    grants: valid && Array.isArray(state.features) ? state.features.filter((item: unknown): item is string => typeof item === 'string') : [],
    expiresAt: valid && typeof state.expiresAt === 'number' ? state.expiresAt : 0,
  };
}
const ROLE_CAPABILITIES = new Map<string, string[]>([
  ['admin', ['*']],
  ['installer', ['frontend.open', 'appcenter.open', 'mapping.edit', 'chargepoints.configure', 'mesh.configure',
    'exportGuard.configure', 'smarthome.configure', 'nexologic.configure', 'diagnostics.open', 'energyWallet.customerSettings']],
  ['customer', ['frontend.open', 'energyWallet.customerSettings']],
]);
/** No request headers carry identity. Every HTTP/SSE check calls the host authority. */
async function centralAccess(bridge: Pick<Bridge, 'resolveAccess'>, req: unknown): Promise<JsonRecord> {
  const none = { authenticated: false, user: null, role: 'none', roles: [], groups: [], capabilities: [],
    isAdmin: false, isInstaller: false, isCustomer: false };
  const value = await bridge.resolveAccess(req);
  if (!record(value) || value.authenticated !== true || value.mustChangePassword === true
    || typeof value.user !== 'string' || !/^system\.user\.[A-Za-z0-9_.@-]{1,128}$/.test(value.user)
    || typeof value.role !== 'string' || !ROLE_CAPABILITIES.has(value.role) || typeof value.csrfToken !== 'string'
    || value.csrfToken.length < 16 || typeof value.credentialKey !== 'string' || !value.credentialKey) return none;
  const allowed = ROLE_CAPABILITIES.get(value.role) || [];
  const requested: unknown[] = Array.isArray(value.capabilities) ? value.capabilities : [];
  const capabilities = requested.filter((cap): cap is string => typeof cap === 'string' && (value.role === 'admin' || allowed.includes(cap)));
  return { ...value, capabilities, roles: [value.role], groups: Array.isArray(value.groups) ? value.groups : [],
    isAdmin: value.role === 'admin', isInstaller: ['admin', 'installer'].includes(value.role), isCustomer: value.role === 'customer' };
}
module.exports = { HostedAdapter, centralLicenseSnapshot, centralAccess };
