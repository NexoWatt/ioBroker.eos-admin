/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Begrenzt kurzlebige UI-Lesecaches und gibt abgelaufene Inhalte auch ohne nächsten HTTP-Aufruf frei.
 * Daten und Wirkung: Hält ausschließlich lesende Antworten und Objekt-Snapshots; Messwerte, Regelzyklen und persistierte Einstellungen bleiben unberührt.
 * Bei Änderungen: Monotone Fristen, begrenzte Einträge, parallele Abrufe und Bereinigung nach Stop mit den Cache-Lebenszyklustests prüfen.
 */
import { performance } from 'node:perf_hooks';

type Timer = ReturnType<typeof setTimeout>;
export interface CacheClock {
  now(): number;
  schedule(callback: () => void, delayMs: number): Timer;
  cancel(timer: Timer): void;
}
const clock: CacheClock = {
  now: () => performance.now(),
  schedule: (callback, delayMs) => { const timer = setTimeout(callback, delayMs); timer.unref(); return timer; },
  cancel: timer => clearTimeout(timer),
};

/** A bounded Map with real idle expiry; reads never prolong the freshness window. */
export class EphemeralMap<K, V> extends Map<K, V> {
  private readonly expiry = new Map<K, { at: number; timer: Timer }>();
  constructor(private readonly ttlMs: number, private readonly maxEntries: number, private readonly time: CacheClock = clock) {
    super();
    if (!Number.isFinite(ttlMs) || ttlMs < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new Error('EOS_CACHE_CONFIGURATION');
    }
  }
  override set(key: K, value: V): this {
    this.delete(key);
    while (this.size >= this.maxEntries) {
      const oldest = super.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
    super.set(key, value);
    const timer = this.time.schedule(() => this.delete(key), this.ttlMs);
    this.expiry.set(key, { at: this.time.now() + this.ttlMs, timer });
    return this;
  }
  override has(key: K): boolean {
    const item = this.expiry.get(key);
    if (item && this.time.now() >= item.at) this.delete(key);
    return super.has(key);
  }
  override get(key: K): V | undefined {
    return this.has(key) ? super.get(key) : undefined;
  }
  override delete(key: K): boolean {
    const item = this.expiry.get(key);
    if (item) this.time.cancel(item.timer);
    this.expiry.delete(key);
    return super.delete(key);
  }
  override clear(): void {
    for (const item of this.expiry.values()) this.time.cancel(item.timer);
    this.expiry.clear();
    super.clear();
  }
}

/** One full discovery snapshot at a time, including simultaneous forced refreshes. */
export class ExpiringSnapshot<T> {
  private readonly cache: EphemeralMap<string, { value: T }>;
  private pending: Promise<T> | null = null;
  private closed = false;
  constructor(private readonly load: () => Promise<T>, ttlMs: number, time: CacheClock = clock) {
    this.cache = new EphemeralMap(ttlMs, 1, time);
  }
  get retained(): boolean { return this.cache.has('snapshot'); }
  get loading(): boolean { return this.pending !== null; }
  get(force = false): Promise<T> {
    if (this.closed) return Promise.reject(new Error('EOS_UI_STOPPING'));
    // A refresh already in progress is newer than the previously cached snapshot.
    if (this.pending) return this.pending;
    const cached = !force ? this.cache.get('snapshot') : undefined;
    if (cached) return Promise.resolve(cached.value);
    this.cache.clear();
    const request = Promise.resolve().then(this.load).then(value => {
      if (this.closed) throw new Error('EOS_UI_STOPPING');
      this.cache.set('snapshot', { value });
      return value;
    });
    this.pending = request;
    const settled = () => { if (this.pending === request) this.pending = null; };
    void request.then(settled, settled);
    return request;
  }
  close(): void {
    this.closed = true;
    this.cache.clear();
    // An IO operation already running may finish, but cannot repopulate the cache.
    this.pending = null;
  }
}
