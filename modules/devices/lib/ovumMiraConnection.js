'use strict';

const S32_MIN = -0x80000000;
const S32_MAX = 0x7fffffff;
function rejectLogin(reason) {
  return Object.assign(new Error(reason), { code: 'EOS_MIRA_LOGIN' });
}

function loginWords(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw rejectLogin('MIRA: Ungültiger Login-Code.');
  const text = String(value).trim();
  const hex = /^0x[0-9a-f]{1,8}$/i.test(text);
  if (!hex && !/^-?\d+$/.test(text)) throw rejectLogin('MIRA: Login-Code ist keine 32-Bit-Ganzzahl.');
  const n = Number(text);
  if (!Number.isInteger(n) || n < S32_MIN || n > (hex ? 0xffffffff : S32_MAX)) {
    throw rejectLogin('MIRA: Login-Code ist außerhalb des 32-Bit-Bereichs.');
  }
  return [n >>> 16, n & 0xffff];
}

function miraConnection(role, protocol, connection) {
  const raw = connection?.unitId;
  const unitId = raw === undefined || raw === null || raw === '' ? (role === 'hsm' ? 110 : 111) :
    typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw)) ? Number(raw) : NaN;
  if (!['modbusTcp', 'modbusRtu'].includes(protocol) ||
      !(role === 'hsm' && unitId === 110 || role === 'wpm' && Number.isInteger(unitId) && unitId >= 111 && unitId <= 118)) {
    throw Object.assign(new Error('MIRA: Protokoll oder Unit-ID passt nicht zum Modul (HSM 110, WPM 111–118).'), { code: 'EOS_MIRA_CONNECTION' });
  }
  return { unitId, code: loginWords(connection?.writePassword) };
}
module.exports = { miraConnection, rejectLogin, S32_MIN, S32_MAX };
