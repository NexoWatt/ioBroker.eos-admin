'use strict';

const { ModbusDriver, isTransportError } = require('./modbus');
const { assertOperationAllowed } = require('../operationContext');

// OVUM MIRA 1.1.3 START, physical 0-based holding-register addresses.
// Only volatile EMS inputs are writable. P_ configuration words persist to flash.
const { miraConnection, rejectLogin, S32_MIN, S32_MAX } = require('../ovumMiraConnection');
const INPUTS = Object.freeze({
  'control.pvStatus':       [55070, 1, 0, 2],
  'control.batterySocPct':  [55071, 1, 0, 100],
  'control.gridPowerW':     [55072, 2, S32_MIN, S32_MAX],
  'control.inverterPowerW': [55074, 2, S32_MIN, S32_MAX],
  'control.pvPowerTargetW': [55076, 2, 0, S32_MAX],
});

function exactWords(response, length) {
  const words = response?.data;
  if (!Array.isArray(words) || words.length !== length ||
      !words.every(w => Number.isInteger(w) && w >= 0 && w <= 0xffff)) {
    throw new Error('MIRA: Unvollständige Modbus-Rückmeldung.');
  }
  return words;
}

class OvumMiraDriver extends ModbusDriver {
  constructor(adapter, cfg, template, global) {
    super(adapter, cfg, template, global);
    const role = template.driverHints.ovumMira.module;
    const { unitId, code } = miraConnection(role, cfg.protocol, cfg.connection);
    this.unitId = this.manualUnitId = unitId;
    this.manualAddressOffset = this.autoAddressOffset = 0;
    this._disableAddressFallbackOffsets = true;
    this.wordOrder = this.byteOrder = 'be';
    this.strictContiguousReads = true;
    this.abortPollOnTransportLoss = true;
    this.loginCode = code;
    this.needStatus = true;
    this.sessionClient = null;
    this.loginRetryAt = 0;
    this.epoch = 0;
  }

  _markDisconnected(error) {
    this.epoch++;
    this.sessionClient = null;
    super._markDisconnected(error);
  }

  async disconnect() {
    this.epoch++;
    this.sessionClient = null;
    return super.disconnect();
  }

  async readDatapoints(points) {
    if (!this._busy) this.needStatus = true;
    const values = await super.readDatapoints(points);
    for (const key of Object.keys(values)) {
      if (typeof values[key] === 'number' && !Number.isFinite(values[key])) values[key] = null;
    }
    return values;
  }

  async _checkLogin(client, current, firstAccess) {
    const status = async () => {
      current();
      const words = (await client.readHoldingRegisters(100, 1))?.data;
      if (!Array.isArray(words) || words.length !== 1 || ![0, 1].includes(words[0])) {
        throw rejectLogin('MIRA: Ungültige Login-Status-Antwort.');
      }
      return words[0];
    };
    if (!(firstAccess && this.loginCode) && await status() === 1) return;
    if (!this.loginCode) throw rejectLogin('MIRA: Anmeldung erforderlich. Modbus-Login-Code in der Geräteverbindung prüfen.');
    if (Date.now() < this.loginRetryAt) throw rejectLogin('MIRA: Letzte Anmeldung abgewiesen. Modbus-Login-Code prüfen.');
    current();
    try {
      await client.writeRegisters(101, this.loginCode.slice());
    } catch (error) {
      // Never propagate a library exception that may contain a request dump.
      const safe = rejectLogin('MIRA: Übertragung der Anmeldung fehlgeschlagen.');
      if (isTransportError(error)) {
        safe.code = ['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ERR_SOCKET_CLOSED'].includes(error?.code)
          ? error.code : 'ERR_SOCKET_CLOSED';
      }
      throw safe;
    }
    if (await status() !== 1) {
      this.loginRetryAt = Date.now() + 60000;
      throw rejectLogin('MIRA: Anmeldung nicht bestätigt. Modbus-Login-Code in der Geräteverbindung prüfen.');
    }
    this.loginRetryAt = 0;
  }

  async _transaction(verify, action) {
    const epoch = this.epoch;
    const current = () => {
      assertOperationAllowed();
      if (this.epoch !== epoch || !this.connected) {
        throw Object.assign(new Error('MIRA: Verbindung wurde beendet.'), { code: 'E_MODBUS_CONNECT_CANCELLED' });
      }
    };
    return this._withIoLock(async () => {
      current();
      const run = async client => {
        current();
        const firstAccess = this.sessionClient !== client;
        if (firstAccess || verify || this.needStatus) {
          await this._checkLogin(client, current, firstAccess);
          current();
          this.sessionClient = client;
          this.needStatus = false;
        }
        return action(client, current);
      };
      if (this.protocol === 'modbusRtu') return this.rtuBus.withUnitClient(this.unitId, this.timeoutMs, run);
      this._setTcpRequestUnitId(this.unitId);
      return run(this.client);
    }, 'MIRA Modbus');
  }

  _mbReadHoldingRegisters(address, length, unitId) {
    if (this._operationUnitId(unitId) !== this.unitId) throw new Error('MIRA: Fremde Unit-ID.');
    // Addresses 101/102 hold the login code and are never measurement words.
    if (address < 103 && address + length > 101) throw new Error('MIRA: Anmelderegister ist kein Messpunkt.');
    return this._transaction(false, client => client.readHoldingRegisters(address, length));
  }

  async writeDatapoint(dp, value) {
    const spec = Object.hasOwn(INPUTS, dp?.id) ? INPUTS[dp.id] : null;
    if (this.unitId !== 110 || !spec || dp.rw !== 'rw') throw new Error('MIRA: Schreibzugriff für diesen Datenpunkt gesperrt.');
    const [address, length, min, max] = spec;
    const n = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
    if (!Number.isInteger(n) || n < min || n > max) throw new Error('MIRA: Ungültiger EMS-Stellwert.');
    const words = length === 1 ? [n] : [n >>> 16, n & 0xffff];
    await this.ensureConnected();
    await this._transaction(true, async (client, current) => {
      current();
      if (length === 1) await client.writeRegister(address, words[0]);
      else await client.writeRegisters(address, words);
      current();
      const actual = exactWords(await client.readHoldingRegisters(address, length), length);
      current();
      if (!actual.every((word, i) => word === words[i])) {
        throw Object.assign(new Error('MIRA: Sollwert vom Gerät nicht bestätigt.'), { code: 'EOS_MIRA_READBACK' });
      }
    });
    return { effectiveValue: n };
  }
}
module.exports = { OvumMiraDriver };
