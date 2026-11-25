// @ts-check
'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: MQTT-Aufträge an eine konkrete Sitzung und eine Gesamtfrist binden.
 * Daten und Wirkung: Bindet offene Callbacks und asynchrone Messwerte an die Sitzung; Abbruch entfernt Timer und Auftrag.
 * Bei Änderungen: Nach Fristablauf muss der Besitzer den tatsächlichen Transport beenden.
 */

/** @typedef {{ owner: object, kind: 'publish' | 'subscribe', cancel: (error: Error) => void }} PendingOperation */
class MqttPendingOperations {
  constructor() {
    /** @type {Set<PendingOperation>} */
    this.pending = new Set();
  }

  get size() { return this.pending.size; }

  /** @param {'publish' | 'subscribe'} kind */
  count(kind) {
    let count = 0;
    for (const operation of this.pending) if (operation.kind === kind) count += 1;
    return count;
  }

  /** @param {object | null} owner @param {string} reason */
  cancel(owner, reason) {
    for (const operation of [...this.pending]) {
      if (operation.owner === owner) operation.cancel(new Error(reason));
    }
  }

  /**
   * @template T
   * @param {object} owner
   * @param {'publish' | 'subscribe'} kind
   * @param {number} deadlineMs
   * @param {(done: (error?: unknown, value?: T) => void) => void} dispatch
   * @param {() => void} abortTransport
   * @returns {Promise<T | undefined>}
   */
  run(owner, kind, deadlineMs, dispatch, abortTransport) {
    return new Promise((resolve, reject) => {
      let settled = false;
      /** @param {unknown} [error] @param {T} [value] */
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.pending.delete(operation);
        if (error !== undefined && error !== null) reject(error); else resolve(value);
      };
      const operation = { owner, kind, cancel: finish };
      const timeout = setTimeout(() => {
        finish(new Error(kind === 'publish' ? 'E_MQTT_PUBLISH_TIMEOUT' : 'E_MQTT_SUBSCRIBE_TIMEOUT'));
        messageSession.exit(abortTransport);
      }, deadlineMs);
      this.pending.add(operation);
      try { dispatch(finish); } catch (error) { finish(error); }
    });
  }
}
/** @type {AsyncLocalStorage<() => boolean>} */
const messageSession = new AsyncLocalStorage();
/** @template T @param {() => boolean} current @param {() => T} action @returns {T} */
function runMqttMessageSession(current, action) { return messageSession.run(current, action); }
function assertMqttMessageSession() {
  const current = messageSession.getStore();
  if (current && !current()) throw new Error('E_MQTT_MESSAGE_SESSION_ENDED');
}
/** @type {AsyncLocalStorage<{ queue: object, active: boolean }>} */
const callbackQueueContext = new AsyncLocalStorage();
class MqttCallbackQueue {
  constructor() {
    /** @type {Promise<void>} */
    this.tail = Promise.resolve();
    this.pendingCount = 0;
  }
  /**
   * @template T
   * @param {() => Promise<T>} action
   * @param {'telemetry' | 'barrier'} [kind]
   * @returns {Promise<T>}
   */
  run(action, kind = 'telemetry') {
    const enclosing = callbackQueueContext.getStore();
    if (enclosing?.queue === this && enclosing.active) return Promise.resolve().then(action);
    if (kind === 'telemetry' && this.pendingCount >= 32) return Promise.reject(new Error('E_MQTT_CALLBACK_BACKLOG'));
    this.pendingCount += 1;
    const result = this.tail.then(async () => {
      const token = { queue: this, active: true };
      try { return await callbackQueueContext.run(token, action); }
      finally { token.active = false; }
    });
    this.tail = result.then(() => undefined, () => undefined).finally(() => { this.pendingCount -= 1; });
    return result;
  }
  drain() { return this.tail; }
}
class MqttMessageBacklog {
  constructor() { this.count = 0; this.bytes = 0; }
  /** @param {number} bytes @returns {() => void} */
  reserve(bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 1024 * 1024) throw new Error('E_MQTT_PAYLOAD_LIMIT');
    if (this.count >= 256 || this.bytes + bytes > 4 * 1024 * 1024) throw new Error('E_MQTT_BACKLOG_LIMIT');
    this.count += 1;
    this.bytes += bytes;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.count -= 1;
      this.bytes -= bytes;
    };
  }
}
module.exports = { MqttPendingOperations, MqttCallbackQueue, MqttMessageBacklog, runMqttMessageSession, assertMqttMessageSession };
