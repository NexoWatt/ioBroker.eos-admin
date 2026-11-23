/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { createSocket } from 'node:dgram';
import { setTimeout as delay } from 'node:timers/promises';
import { fail, flag, num, str, type Config } from './types';
/** One explicitly configured magic packet; no shell, scanning or automatic target discovery. */
export async function wakeTarget(c: Config): Promise<void> {
    if (!flag(c, 'wakeOnLAN') || str(c, 'connectType') === 'SDCard') return;
    const value = str(c, 'macAd');
    if (!/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value)) throw fail('EOS_BACKUP_WOL_MAC');
    const port = num(c, 'wolPort', 9),
        seconds = num(c, 'wolWait', 25);
    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > 120
    )
        throw fail('EOS_BACKUP_WOL_CONFIG');
    const mac = Buffer.from(value.replace(/[:-]/g, ''), 'hex');
    const packet = Buffer.concat([Buffer.alloc(6, 255), ...Array.from({ length: 16 }, () => mac)]);
    await new Promise<void>((resolve, reject) => {
        const socket = createSocket('udp4');
        let done = false;
        const finish = (error?: Error): void => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            socket.close();
            if (error) reject(error);
            else resolve();
        };
        const timer = setTimeout(() => finish(fail('EOS_BACKUP_WOL_TIMEOUT')), 5000);
        socket.once('error', finish);
        socket.bind(() => {
            try {
                socket.setBroadcast(true);
                socket.send(packet, port, '255.255.255.255', error => finish(error ?? undefined));
            } catch {
                finish(fail('EOS_BACKUP_WOL_FAILED'));
            }
        });
    });
    await delay(seconds * 1000);
}
