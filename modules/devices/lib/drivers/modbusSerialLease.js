// @ts-check
/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { resolve } = require('node:path');
/** In-process ownership only; OS permissions/locks still govern other processes. */
/** @type {Map<string, symbol>} */
const leases = new Map();
/** @param {string} code */
function serialError(code) { return Object.assign(new Error(code), { code }); }
/** @param {string} path */
function claimSerialPort(path) {
    const key = process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
    if (leases.has(key)) throw serialError('E_MODBUS_SERIAL_PORT_BUSY');
    const token = Symbol('modbus-serial-lease');
    leases.set(key, token);
    return () => { if (leases.get(key) === token) leases.delete(key); };
}
/** The original close may finish late; only its successful completion releases ownership. */
/** @param {Promise<void>} operation */
async function boundedSerialClose(operation) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    try {
        await Promise.race([operation, new Promise((_, reject) => {
            timer = setTimeout(() => reject(serialError('E_MODBUS_SERIAL_STOP_TIMEOUT')), 2500);
        })]);
    } finally { clearTimeout(timer); }
}
module.exports = { claimSerialPort, boundedSerialClose, serialError };
