/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Reserviert die generischen Ausgänge der App Dynamischer Netzanschluss
 * bereits vor dem ersten Schreibauftrag und während einer laufenden Übergabe.
 * Bei Änderungen: Alte und neue Ausgangsverträge, Alias-Schreibketten, finale Generation und bestätigte Übergabe gemeinsam prüfen.
 * Daten und Wirkung: Liest ausschließlich Konfiguration und vorab aufgelöste
 * Alias-Schreibketten; keine Geräteabfrage und kein Hardware-Write.
 * Sicherheitsgrenze: Eine abgelaufene normale Arbiter-Lease, Shadow-Betrieb oder
 * gleicher Zahlenwert dürfen die konfigurierte Schreibhoheit nicht umgehen.
 */
type RecordLike = Record<string, any>;
const STORAGE_OUTPUTS = ['signedTarget', 'chargeTarget', 'dischargeTarget', 'maxCharge', 'maxDischarge', 'run', 'chargeEnable', 'dischargeEnable', 'watchdog'];

/** Gibt aktive und bis zur bestätigten Übergabe zurückgehaltene Verträge zurück. */
function ownershipConfigs(adapter: RecordLike | null | undefined): RecordLike[] {
  if (!adapter) return [];
  const config = adapter.config || {};
  const app = config.emsApps?.apps?.dynamicGrid;
  const runtime = adapter._nwDynamicGridConnectionRuntime || {};
  const configs: RecordLike[] = [];
  if (app?.installed === true && app?.enabled === true && config.dynamicGridConnection) configs.push(config.dynamicGridConnection);
  for (const retained of Array.isArray(runtime.retainedConfigs) ? runtime.retainedConfigs : []) {
    if (retained && typeof retained === 'object') configs.push(retained.config || retained);
  }
  if (runtime.lifecycleOwnershipConfig) configs.push(runtime.lifecycleOwnershipConfig);
  if (adapter._nwDynamicGridOwnershipPending) configs.push(adapter._nwDynamicGridOwnershipPending);
  return configs;
}

/** App übernimmt auch vor dem ersten Messzyklus; Altregler erzeugen keinen Nullstopp. */
export function dynamicGridHasControl(adapter: RecordLike | null | undefined): boolean {
  const app = adapter?.config?.emsApps?.apps?.dynamicGrid;
  return (app?.installed === true && app?.enabled === true) || ownershipConfigs(adapter).length > 0;
}

/** Liefert ausschließlich Ausgänge einschließlich kompletter Alias-Schreibketten. */
export function getDynamicGridOwnedTargets(adapter: RecordLike | null | undefined): Set<string> {
  const targets = new Set<string>();
  const add = (raw: unknown): void => {
    if (typeof raw !== 'string' || !raw.trim()) return;
    const id = raw.trim();
    if (targets.has(id)) return;
    targets.add(id);
    const canonical = adapter?._nwDynamicGridCanonicalTargets?.[id];
    for (const next of Array.isArray(canonical) ? canonical : [canonical]) {
      if (typeof next === 'string' && next.trim()) targets.add(next.trim());
    }
  };
  for (const config of ownershipConfigs(adapter)) {
    for (const storage of Array.isArray(config.storages) ? config.storages : []) {
      for (const key of STORAGE_OUTPUTS) add(storage?.command?.[key]?.stateId);
    }
    for (const pv of Array.isArray(config.pvAssignments) ? config.pvAssignments : []) add(pv?.command?.stateId);
  }
  return targets;
}

/** Unbekannte eigene Alias-Schreibseiten dürfen keine Lücke für Fremdschreiber öffnen. */
export function hasCompleteDynamicGridOwnership(adapter: RecordLike | null | undefined): boolean {
  const cache = adapter?._nwDynamicGridCanonicalTargets || {};
  const complete = (id: unknown): boolean => {
    if (typeof id !== 'string' || !id.trim()) return false;
    const chain = cache[id.trim()];
    return typeof chain === 'string' ? !!chain.trim()
      : Array.isArray(chain) && chain.length > 0 && chain.every((part) => typeof part === 'string' && part.trim());
  };
  for (const config of ownershipConfigs(adapter)) {
    for (const storage of Array.isArray(config.storages) ? config.storages : []) {
      for (const key of STORAGE_OUTPUTS) if (storage?.command?.[key] && !complete(storage.command[key].stateId)) return false;
    }
    for (const pv of Array.isArray(config.pvAssignments) ? config.pvAssignments : []) if (!complete(pv?.command?.stateId)) return false;
  }
  return true;
}

/** Prüft auch eine konkurrierende Aliasadresse, die dieselbe Schreibquelle trifft. */
export function isDynamicGridOwned(adapter: RecordLike | null | undefined, targetId: unknown): boolean {
  if (typeof targetId !== 'string') return false;
  const targets = getDynamicGridOwnedTargets(adapter);
  if (targets.has(targetId.trim())) return true;
  const canonical = adapter?._nwDynamicGridCanonicalTargets?.[targetId.trim()];
  return (Array.isArray(canonical) ? canonical : [canonical]).some((id) => typeof id === 'string' && targets.has(id));
}

/** Nur der zentrale Writer und ausdrücklich ausgewiesene Notstopps dürfen schreiben. */
export function isDynamicGridWriter(owner: unknown): boolean {
  return typeof owner === 'string' && /^dynamicGridConnection(?:\.|$)/.test(owner.trim());
}

export function isDynamicGridEmergencyWriter(owner: unknown): boolean {
  return typeof owner === 'string' && /^(?:emergency|hardware-stop|notstop)(?:[.:-]|$)/i.test(owner.trim());
}

const aliasJobs = new WeakMap<object, Map<string, Promise<string[] | null>>>();

/**
 * Prüft freie API-Aliasse vor einem echten Write. Auflösung maximal acht Kanten,
 * 1 s Gesamtbudget und 16 noch laufende Jobs je Adapter; Timeout startet keinen
 * unbegrenzten Ersatzjob. Ein unaufgelöster Schreibweg wird nicht freigegeben.
 */
export async function checkDynamicGridWriteTarget(adapter: RecordLike, targetId: string): Promise<{ owned: boolean; unresolved: boolean }> {
  if (!dynamicGridHasControl(adapter)) return { owned: false, unresolved: false };
  if (isDynamicGridOwned(adapter, targetId)) return { owned: true, unresolved: false };
  if (!hasCompleteDynamicGridOwnership(adapter)) return { owned: false, unresolved: true };
  if (typeof adapter.getForeignObjectAsync !== 'function') return { owned: false, unresolved: true };
  let jobs = aliasJobs.get(adapter);
  if (!jobs) { jobs = new Map(); aliasJobs.set(adapter, jobs); }
  let job = jobs.get(targetId);
  if (!job) {
    if (jobs.size >= 16) return { owned: false, unresolved: true };
    job = (async () => {
      const chain: string[] = [];
      let id = targetId;
      for (let depth = 0; depth <= 8; depth += 1) {
        if (chain.includes(id)) return null;
        chain.push(id);
        const object = await adapter.getForeignObjectAsync(id);
        if (!object || object.type !== 'state') return null;
        const alias = object.common?.alias?.id;
        const next = typeof alias === 'string' ? alias : alias?.write;
        if (!alias) return chain;
        if (typeof next !== 'string' || !next.trim()) return null;
        id = next.trim();
      }
      return null;
    })().catch(() => null);
    jobs.set(targetId, job);
    void job.finally(() => { if (jobs!.get(targetId) === job) jobs!.delete(targetId); });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const chain = await Promise.race([job, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 1000); })]);
  if (timer !== undefined) clearTimeout(timer);
  if (!chain) return { owned: false, unresolved: true };
  const cache = adapter._nwDynamicGridCanonicalTargets || (adapter._nwDynamicGridCanonicalTargets = Object.create(null));
  cache[targetId] = chain;
  return { owned: isDynamicGridOwned(adapter, targetId), unresolved: false };
}
