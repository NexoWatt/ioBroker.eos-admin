"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wakeTarget = wakeTarget;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const node_dgram_1 = require("node:dgram");
const promises_1 = require("node:timers/promises");
const types_1 = require("./types");
/** One explicitly configured magic packet; no shell, scanning or automatic target discovery. */
async function wakeTarget(c) {
    if (!(0, types_1.flag)(c, 'wakeOnLAN') || (0, types_1.str)(c, 'connectType') === 'SDCard')
        return;
    const value = (0, types_1.str)(c, 'macAd');
    if (!/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value))
        throw (0, types_1.fail)('EOS_BACKUP_WOL_MAC');
    const port = (0, types_1.num)(c, 'wolPort', 9), seconds = (0, types_1.num)(c, 'wolWait', 25);
    if (!Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > 120)
        throw (0, types_1.fail)('EOS_BACKUP_WOL_CONFIG');
    const mac = Buffer.from(value.replace(/[:-]/g, ''), 'hex');
    const packet = Buffer.concat([Buffer.alloc(6, 255), ...Array.from({ length: 16 }, () => mac)]);
    await new Promise((resolve, reject) => {
        const socket = (0, node_dgram_1.createSocket)('udp4');
        let done = false;
        const finish = (error) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            socket.close();
            if (error)
                reject(error);
            else
                resolve();
        };
        const timer = setTimeout(() => finish((0, types_1.fail)('EOS_BACKUP_WOL_TIMEOUT')), 5000);
        socket.once('error', finish);
        socket.bind(() => {
            try {
                socket.setBroadcast(true);
                socket.send(packet, port, '255.255.255.255', error => finish(error ?? undefined));
            }
            catch {
                finish((0, types_1.fail)('EOS_BACKUP_WOL_FAILED'));
            }
        });
    });
    await (0, promises_1.setTimeout)(seconds * 1000);
}
