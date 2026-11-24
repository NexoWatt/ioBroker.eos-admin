'use strict';
const { assertOperationAllowed } = require('../operationContext');
const { claimSerialPort, boundedSerialClose, serialError } = require('./modbusSerialLease');

const ModbusRTU = require('modbus-serial');

/**
 * Shared Modbus RTU bus manager.
 *
 * Why?
 * - RS485 is a shared medium: multiple slaves on one /dev/tty... port.
 * - Opening the same serial port multiple times (one client per device) typically fails.
 * - This manager keeps ONE physical serial connection per port/settings and multiplexes requests.
 */

const buses = new Map(); // key -> { bus, refs }

function makeKey(opts) {
  const o = opts || {};
  const path = (o.path || '').toString().trim();
  const baudRate = Number(o.baudRate || 9600);
  const parity = (o.parity || 'none').toString();
  const dataBits = Number(o.dataBits || 8);
  const stopBits = Number(o.stopBits || 1);
  return `${path}|${baudRate}|${parity}|${dataBits}|${stopBits}`;
}

class ModbusRtuBus {
  constructor(adapter, opts) {
    this.adapter = adapter;
    this.opts = {
      path: (opts.path || '').toString().trim(),
      baudRate: Number(opts.baudRate || 9600),
      parity: (opts.parity || 'none').toString(),
      dataBits: Number(opts.dataBits || 8),
      stopBits: Number(opts.stopBits || 1),
    };

    this.client = new ModbusRTU();
    this.connected = false;
    this.connecting = false;
    this.closing = false;

    // Serialize all operations on this bus
    this._queue = Promise.resolve();
  }

  async _enqueue(fn) {
    const run = async () => fn();
    const p = this._queue.then(run, run);
    // keep queue alive even if p rejects
    this._queue = p.catch(() => {});
    return p;
  }

  async ensureConnected() {
    if (this.closing) throw serialError('E_MODBUS_SERIAL_CLOSING');
    if (this.connected) return true;
    if (this.connecting) {
      // Wait for current connect attempt
      await this._queue;
      return this.connected;
    }

    this.connecting = true;

    return await this._enqueue(async () => {
      try {
        if (this.closing) throw serialError('E_MODBUS_SERIAL_CLOSING');
        if (this.connected) return true;
        await new Promise((resolve, reject) => {
          assertOperationAllowed();
          this.client.connectRTUBuffered(
            this.opts.path,
            {
              baudRate: this.opts.baudRate,
              parity: this.opts.parity,
              dataBits: this.opts.dataBits,
              stopBits: this.opts.stopBits,
            },
            (err) => (err ? reject(err) : resolve())
          );
        });
        if (this.closing) throw serialError('E_MODBUS_SERIAL_CLOSING');
        this.connected = true;
        this.adapter.log.info(`[modbusRtuBus] connected ${this.opts.path} @${this.opts.baudRate} ${this.opts.parity} ${this.opts.dataBits}${this.opts.stopBits}`);
        return true;
      } catch (e) {
        this.connected = false;
        throw e;
      } finally {
        this.connecting = false;
      }
    });
  }

  async close() {
    this.closing = true;
    return await this._enqueue(async () => {
      try {
        if (this.client && this.client.isOpen !== false) {
          await new Promise((resolve, reject) => {
            try { this.client.close(error => error ? reject(error) : resolve()); }
            catch (error) { reject(error); }
          });
        }
      } finally {
        this.connected = false;
      }
    });
  }

  async _exec(unitId, timeoutMs, fn) {
    // Connect outside the request queue: enqueueing a connection from inside a
    // running queue entry would wait for itself after a transport failure.
    assertOperationAllowed();
    await this.ensureConnected();
    return await this._enqueue(async () => {
      assertOperationAllowed();
      if (this.closing) throw serialError('E_MODBUS_SERIAL_CLOSING');
      if (!this.connected) throw new Error('Serial transport disconnected before dispatch');
      this.client.setID(Number(unitId || 1));
      this.client.setTimeout(Number(timeoutMs || 2000));
      try {
        return await fn(this.client);
      } catch (e) {
        // Mark as disconnected so next operation tries to reconnect
        this.connected = false;
        throw e;
      }
    });
  }

  // Read helpers
  readCoils(unitId, timeoutMs, addr, len) {
    return this._exec(unitId, timeoutMs, (c) => c.readCoils(addr, len));
  }
  readDiscreteInputs(unitId, timeoutMs, addr, len) {
    return this._exec(unitId, timeoutMs, (c) => c.readDiscreteInputs(addr, len));
  }
  readHoldingRegisters(unitId, timeoutMs, addr, len) {
    return this._exec(unitId, timeoutMs, (c) => c.readHoldingRegisters(addr, len));
  }
  readInputRegisters(unitId, timeoutMs, addr, len) {
    return this._exec(unitId, timeoutMs, (c) => c.readInputRegisters(addr, len));
  }

  // Write helpers
  writeCoil(unitId, timeoutMs, addr, value) {
    return this._exec(unitId, timeoutMs, (c) => c.writeCoil(addr, value));
  }
  writeRegister(unitId, timeoutMs, addr, value) {
    return this._exec(unitId, timeoutMs, (c) => c.writeRegister(addr, value));
  }
  writeRegisters(unitId, timeoutMs, addr, values) {
    return this._exec(unitId, timeoutMs, (c) => c.writeRegisters(addr, values));
  }
  writeCoils(unitId, timeoutMs, addr, values) {
    return this._exec(unitId, timeoutMs, (c) => c.writeCoils(addr, values));
  }
}

function acquireBus(adapter, opts) {
  const key = makeKey(opts);
  if (!key || key.startsWith('|')) {
    throw new Error('Invalid Modbus RTU path');
  }

  const existing = buses.get(key);
  if (existing) {
    if (existing.closing) throw serialError('E_MODBUS_SERIAL_CLOSING');
    existing.refs++;
    return { key, bus: existing.bus };
  }

  const releasePort = claimSerialPort((opts.path || '').toString().trim());
  let bus;
  try { bus = new ModbusRtuBus(adapter, opts); }
  catch (error) { releasePort(); throw error; }
  buses.set(key, { bus, refs: 1, closing: false, closePromise: null, releasePort });
  return { key, bus };
}

async function releaseBus(key) {
  const entry = buses.get(key);
  if (!entry) return;
  if (entry.closePromise) return await boundedSerialClose(entry.closePromise);
  entry.refs--;
  if (entry.refs > 0) return;
  entry.closing = true;
  entry.closePromise = entry.bus.close().then(() => {
    // Late completion may release only this exact entry, never a replacement.
    if (buses.get(key) === entry) {
      buses.delete(key);
      entry.releasePort();
    }
  });
  try { await boundedSerialClose(entry.closePromise); }
  catch (error) {
    try { entry.bus.adapter.log.warn('EOS_MODBUS_SERIAL_STOP_UNCONFIRMED'); } catch (_) { /* Diagnostic failure does not restore transport authority. */ }
    throw error;
  }
}

module.exports = {
  acquireBus,
  releaseBus,
};
