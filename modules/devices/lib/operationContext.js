// @ts-check
'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
/** @type {import("node:async_hooks").AsyncLocalStorage<() => boolean>} */
const operationContext = new AsyncLocalStorage();

function assertOperationAllowed() {
    const gate = operationContext.getStore();
    if (!gate) return; // Unhosted regression fixtures retain their original contract.
    let allowed = false;
    try { allowed = gate() === true; } catch { /* Authorization failure is a denial. */ }
    if (!allowed) {
        const error = Object.assign(new Error('EOS_DEVICES_NOT_AUTHORIZED'), { code: 'EOS_DEVICES_NOT_AUTHORIZED' });
        throw error;
    }
}
/** @template T @param {() => boolean} gate @param {() => T} callback @returns {T} */
function runWithOperationGate(gate, callback) { return operationContext.run(gate, callback); }
module.exports = { assertOperationAllowed, runWithOperationGate };
