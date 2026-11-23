// @ts-check
'use strict';
const { runWithOperationGate } = require('./lib/operationContext');

/**
 * Guard each hosted driver instance, never shared prototypes. Dispatch-time checks
 * also cover delayed Modbus queue entries and MQTT periodic write groups.
 * A transport request already on the wire cannot be recalled by this software gate.
 */
/** @param {import('./contracts').Driver} driver @param {() => boolean} canOperate */
function guardDriver(driver, canOperate) {
    if (!driver || typeof driver !== 'object') throw new Error('EOS_DEVICES_DRIVER_INVALID');
    Object.defineProperty(driver, 'canOperate', { value: canOperate, configurable: false, writable: false });
    const assertAllowed = () => {
        if (canOperate() !== true) {
            const error = Object.assign(new Error('EOS_DEVICES_NOT_AUTHORIZED'), { code: 'EOS_DEVICES_NOT_AUTHORIZED' });
            throw error;
        }
    };
    for (const name of ['connect', 'ensureConnected', 'readDatapoints', 'writeDatapoint', '_publish', '_sendAndReceiveNow']) {
        const original = driver[name];
        if (typeof original !== 'function') continue;
        /** @param {unknown[]} args */
        driver[name] = async function guardedOperation(...args) {
            assertAllowed();
            return runWithOperationGate(canOperate, () => original.apply(this, args));
        };
    }
    if (typeof driver._withIoLock === 'function') {
        const original = driver._withIoLock;
        /** @param {(...args: unknown[]) => unknown} callback @param {unknown[]} args */
        driver._withIoLock = function guardedQueue(callback, ...args) {
            assertAllowed();
            /** @param {unknown[]} callbackArgs */
            const dispatch = (...callbackArgs) => { assertAllowed(); return runWithOperationGate(canOperate, () => callback(...callbackArgs)); };
            return original.call(this, dispatch, ...args);
        };
    }
    const disconnect = driver.disconnect;
    driver.hostedDisconnectFailed = false;
    driver.disconnect = async function guardedDisconnect() {
        try {
            const result = await disconnect.call(this);
            driver.hostedDisconnectFailed = false;
            return result;
        } catch (error) {
            driver.hostedDisconnectFailed = true;
            throw error;
        }
    };
    return driver;
}
module.exports = { guardDriver };
