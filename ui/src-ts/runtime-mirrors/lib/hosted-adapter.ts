/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/hosted-adapter.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/hosted-adapter.js
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
 * Original-Hash: edea5cbf27c2f07fc6d4ab89f80ae35eb29bcbe22036d302594364d92b2032f7
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
 * Quelle: src-ts/runtime-executables/lib/hosted-adapter.ts
 * Quell-Hash: sha256:0ce5027d9850cc43e4f9c628cfa592f770de3d44dc438a309c4605c14cf0c97f
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/hosted-adapter.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
'use strict';

/**
 * In-process capability bridge to the single EOS adapter. This is deliberately
 * not adapter-core: no second instance, socket, database connection or lifecycle.
 * UI-owned configuration is nested under native.eosUi; host security settings
 * cannot be overwritten by the historical UI configuration persistence path.
 */
const defaults = require('../io-package.json').native;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/**
 * Code-Teil: clone
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function clone(value) { return JSON.parse(JSON.stringify(value)); }
/**
 * Code-Teil: merge
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function merge(base, overlay) {
  const result = clone(base || {});
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return result;
  for (const [key, value] of Object.entries(overlay)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error('EOS_UI_CONFIG_INVALID');
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(result[key] && typeof result[key] === 'object' ? result[key] : {}, value) : clone(value);
  }
  return result;
}
/**
 * Code-Teil: HostedAdapter
 *
 * Zweck:
 * Automatisch markierter Klasse-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
class HostedAdapter {
  constructor({ owner, bridge }) {
    if (!owner || !/^eos-admin\.\d+$/.test(owner.namespace || '') || !bridge
      || ['resolveAccess', 'getLicense', 'canWrite', 'originAllowed'].some(name => typeof bridge[name] !== 'function')) {
      throw new Error('EOS_UI_BRIDGE_INVALID');
    }
    Object.defineProperties(this, {
      _owner: { value: owner },
      _bridge: { value: bridge },
      namespace: { value: owner.namespace },
      instance: { value: owner.instance },
    });
    this.config = merge(defaults, owner.config.eosUi || {});
    delete this.config.licenseKey;
    // Security and transport are solely host-owned; legacy fields cannot opt out.
    this.config.auth = { mode: 'eos' };
    this.config.port = owner.config.port;
    const bound = new Map();
    return new Proxy(this, {
      get(target, key, receiver) {
        if (Reflect.has(target, key)) return Reflect.get(target, key, receiver);
        const value = owner[key];
        if (typeof value !== 'function') return value;
        if (!bound.has(key)) bound.set(key, value.bind(owner));
        return bound.get(key);
      },
    });
  }
  async getForeignObjectAsync(id, ...args) {
    const object = await this._owner.getForeignObjectAsync(id, ...args);
    if (id !== `system.adapter.${this.namespace}` || !object) return object;
    return { ...object, native: merge(defaults, object.native?.eosUi || {}) };
  }
  async setForeignObjectAsync(id, object, ...args) {
    if (id !== `system.adapter.${this.namespace}`) return this._owner.setForeignObjectAsync(id, object, ...args);
    const actual = await this._owner.getForeignObjectAsync(id);
    if (!actual || !object?.native || typeof object.native !== 'object' || Array.isArray(object.native)) {
      throw new Error('EOS_UI_CONFIG_INVALID');
    }
    const next = clone(object.native);
    delete next.licenseKey;
    delete next.auth;
    delete next.port;
    delete next.secure;
    await this._owner.setForeignObjectAsync(id, { ...actual, native: { ...actual.native, eosUi: next } }, ...args);
    this._owner.config.eosUi = clone(next);
  }
  /** Never accept a stale owner generation for a foreign/device write. */
  setForeignStateAsync(id, ...args) {
    if (this._bridge.canWrite() !== true) return Promise.reject(new Error('EOS_UI_OWNERSHIP_LOST'));
    return this._owner.setForeignStateAsync(id, ...args);
  }
  setForeignStateChangedAsync(id, ...args) {
    if (this._bridge.canWrite() !== true) return Promise.reject(new Error('EOS_UI_OWNERSHIP_LOST'));
    return this._owner.setForeignStateChangedAsync(id, ...args);
  }
  setForeignStateChanged(id, ...args) {
    if (this._bridge.canWrite() !== true) {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      if (callback) { callback(new Error('EOS_UI_OWNERSHIP_LOST')); return; }
      throw new Error('EOS_UI_OWNERSHIP_LOST');
    }
    return this._owner.setForeignStateChanged(id, ...args);
  }

  setForeignState(id, ...args) {
    if (this._bridge.canWrite() !== true) {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      if (callback) { callback(new Error('EOS_UI_OWNERSHIP_LOST')); return; }
      throw new Error('EOS_UI_OWNERSHIP_LOST');
    }
    return this._owner.setForeignState(id, ...args);
  }
}

/** Public snapshot only; editions/limits never originate from UI config/states. */
function centralLicenseSnapshot(bridge) {
  let state;
  try { state = bridge.getLicense(); } catch { state = null; }
  const valid = state?.valid === true && state?.coreEnabled === true
    && ['home', 'pro'].includes(state.edition) && Array.isArray(state.features)
    && Number.isInteger(state.limits?.chargePoints) && state.limits.chargePoints > 0
    && Number.isInteger(state.limits?.batteries) && state.limits.batteries >= 0;
  return {
    ok: valid, edition: valid ? (state.edition === 'home' ? 'hems' : 'eos') : 'none',
    type: valid ? 'full' : 'none', uuid: typeof state?.uuid === 'string' ? state.uuid : '',
    msg: valid ? 'Zentrale EOS-Lizenz aktiv' : 'Zentrale EOS-Lizenz erforderlich',
    maxWallboxes: valid ? state.limits.chargePoints : 0,
    maxStorages: valid ? state.limits.batteries : 0,
    grants: valid ? state.features.filter(item => typeof item === 'string') : [],
    expiresAt: valid && typeof state.expiresAt === 'number' ? state.expiresAt : 0,
  };
}
const ROLE_CAPABILITIES = Object.freeze({
  admin: ['*'],
  installer: ['frontend.open', 'appcenter.open', 'mapping.edit',
    'chargepoints.configure', 'mesh.configure', 'exportGuard.configure', 'smarthome.configure',
    'nexologic.configure', 'diagnostics.open', 'energyWallet.customerSettings'],
  customer: ['frontend.open', 'energyWallet.customerSettings'],
});
/** No request headers carry identity. Every HTTP/SSE check calls the host authority. */
async function centralAccess(bridge, req) {
  const none = { authenticated: false, user: null, role: 'none', roles: [], groups: [], capabilities: [],
    isAdmin: false, isInstaller: false, isCustomer: false };
  const value = await bridge.resolveAccess(req);
  if (!value || value.authenticated !== true || value.mustChangePassword === true
    || typeof value.user !== 'string' || !/^system\.user\.[A-Za-z0-9_.@-]{1,128}$/.test(value.user)
    || !Object.hasOwn(ROLE_CAPABILITIES, value.role) || typeof value.csrfToken !== 'string'
    || value.csrfToken.length < 16 || typeof value.credentialKey !== 'string' || !value.credentialKey) return none;
  const requested = Array.isArray(value.capabilities) ? value.capabilities : [];
  const allowed = ROLE_CAPABILITIES[value.role];
  const capabilities = value.role === 'admin'
    ? requested.filter(cap => typeof cap === 'string')
    : requested.filter(cap => typeof cap === 'string' && allowed.includes(cap));
  return { ...value, capabilities, roles: [value.role],
    groups: Array.isArray(value.groups) ? value.groups : [], isAdmin: value.role === 'admin',
    isInstaller: ['admin', 'installer'].includes(value.role), isCustomer: value.role === 'customer' };
}
module.exports = { HostedAdapter, centralLicenseSnapshot, centralAccess };
