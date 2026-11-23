/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';
import { createRequire } from 'node:module';

const loadDependency = createRequire(__filename);

type RecordValue = { name: string; type: string; ttl: number; flush?: boolean; data: unknown };
type Packet = { questions?: unknown; answers?: unknown; authorities?: unknown; additionals?: unknown };
type SendPacket = {
    questions?: { name: string; type: string }[];
    answers?: RecordValue[];
    authorities?: RecordValue[];
};
export interface EosDiscoveryTransport {
    on(event: string, callback: (...args: unknown[]) => void): unknown;
    query(packet: SendPacket, callback?: (error?: Error | null) => void): void;
    respond(packet: SendPacket, callback?: (error?: Error | null) => void): void;
    destroy(): void;
}
export interface EosDiscovery {
    start(): void;
    stop(): void;
}
interface Options {
    adapter: { log: { info(message: string): void; warn(message: string): void } };
    enabled: boolean;
    hostname?: string;
    port: number;
    bind?: string;
}
interface Dependencies {
    createTransport?: (options: { interface?: string; reuseAddr: boolean; ttl: number }) => EosDiscoveryTransport;
    interfaces?: typeof networkInterfaces;
    schedule?: (callback: () => void, milliseconds: number) => () => void;
    now?: () => number;
    random?: () => number;
}

const SERVICE = '_https._tcp.local';
const SERVICE_ENUM = '_services._dns-sd._udp.local';
const MAX_RECORDS = 64;
const TTL = 120;
function object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
function canonical(value: unknown): string {
    return typeof value === 'string' && value.length <= 255 ? value.toLowerCase().replace(/\.$/, '') : '';
}
function list(value: unknown): unknown[] {
    return Array.isArray(value) ? value.slice(0, MAX_RECORDS) : [];
}
function addressKey(value: string): string {
    return isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname : value;
}

/**
 * Announces only our own HTTPS endpoint through link-local mDNS. Three targeted
 * hostname/service probes precede publication. A different owner causes a
 * conservative stop: no silent rename that would invalidate the TLS SAN.
 * Discovery failure must never terminate the adapter or relax authentication.
 * The caller starts this only after its authenticated TLS listener is ready.
 */
export function createEosDiscovery(options: Options, dependencies: Dependencies = {}): EosDiscovery {
    const schedule =
        dependencies.schedule ||
        ((callback, milliseconds) => {
            const timer = setTimeout(callback, milliseconds);
            timer.unref();
            return () => clearTimeout(timer);
        });
    const now = dependencies.now || Date.now;
    const random = dependencies.random || Math.random;
    const interfaces = dependencies.interfaces || networkInterfaces;
    const hostname = options.hostname === undefined ? 'nexowatt' : options.hostname;
    const host = `${hostname}.local`;
    const instance = `${hostname}.${SERVICE}`;
    const bind = options.bind || '0.0.0.0';
    const timers = new Set<() => void>();
    let transport: EosDiscoveryTransport | undefined;
    let started = false;
    let stopped = false;
    let published = false;
    let ready = false;
    let confirmed = false;
    let generation = 0;
    let records: RecordValue[] = [];
    let allLocal = new Set<string>();
    let advertised: string[] = [];
    let lastReply = -Infinity;

    function later(callback: () => void, milliseconds: number): void {
        if (stopped) {
            return;
        }
        const cancel: () => void = schedule(() => {
            timers.delete(cancel);
            if (!stopped) {
                try {
                    callback();
                } catch {
                    fail('EOS_MDNS_OPERATION_FAILED');
                }
            }
        }, milliseconds);
        timers.add(cancel);
    }
    function clearTimers(): void {
        for (const cancel of timers) {
            cancel();
        }
        timers.clear();
    }
    function destroy(): void {
        const current = transport;
        transport = undefined;
        try {
            current?.destroy();
        } catch {
            /* Socket cleanup must not affect EOS. */
        }
    }
    function stop(): void {
        if (stopped) {
            return;
        }
        stopped = true;
        clearTimers();
        // Goodbye is best effort and bounded, even when the UDP send callback
        // never arrives. No callback can restart discovery after this point.
        if (published && transport) {
            const cancel = schedule(destroy, 100);
            try {
                transport.respond({ answers: records.map(record => ({ ...record, ttl: 0 })) }, () => {
                    cancel();
                    destroy();
                });
            } catch {
                cancel();
                destroy();
            }
        } else {
            destroy();
        }
        published = false;
    }
    function fail(code: string): void {
        if (stopped) {
            return;
        }
        options.adapter.log.warn(`${code}: Lokale Namensankündigung beendet; EOS bleibt über seine IP erreichbar.`);
        stop();
    }
    function addresses(): { own: Set<string>; visible: string[] } {
        const own = new Set<string>();
        const visible = new Set<string>();
        for (const entries of Object.values(interfaces())) {
            for (const entry of entries || []) {
                const address = entry.address.split('%')[0] || '';
                const family = isIP(address);
                if (!family || entry.internal) {
                    continue;
                }
                own.add(addressKey(address));
                if ((bind === '0.0.0.0' && family === 4) || (bind === '::' && family === 6) || bind === address) {
                    visible.add(address);
                }
            }
        }
        return { own, visible: [...visible].sort().slice(0, 8) };
    }
    function makeRecords(): RecordValue[] {
        return [
            { name: SERVICE, type: 'PTR', ttl: TTL, data: instance },
            { name: SERVICE_ENUM, type: 'PTR', ttl: TTL, data: SERVICE },
            {
                name: instance,
                type: 'SRV',
                ttl: TTL,
                flush: true,
                data: { port: options.port, target: host, priority: 0, weight: 0 },
            },
            { name: instance, type: 'TXT', ttl: TTL, flush: true, data: [Buffer.from('path=/')] },
            ...advertised.map(address => ({
                name: host,
                type: isIP(address) === 6 ? 'AAAA' : 'A',
                ttl: TTL,
                flush: true,
                data: address,
            })),
        ];
    }
    function send(answers: RecordValue[], done?: () => void): void {
        if (stopped || !transport) {
            return;
        }
        transport.respond({ answers }, error => {
            if (error) {
                fail('EOS_MDNS_SEND_FAILED');
            } else if (!stopped) {
                done?.();
            }
        });
    }
    function conflict(packet: Packet): boolean {
        for (const value of [...list(packet.answers), ...list(packet.authorities), ...list(packet.additionals)]) {
            const record = object(value);
            if (!record || record.ttl === 0) {
                continue;
            }
            const name = canonical(record.name);
            if (name === host && (record.type === 'A' || record.type === 'AAAA')) {
                if (typeof record.data === 'string' && isIP(record.data) && !allLocal.has(addressKey(record.data))) {
                    return true;
                }
            }
            if (name === instance && record.type === 'SRV') {
                const data = object(record.data);
                if (data && (canonical(data.target) !== host || data.port !== options.port)) {
                    return true;
                }
            }
        }
        return false;
    }
    function receive(value: unknown, query: boolean): void {
        if (stopped) {
            return;
        }
        const packet = object(value) as Packet | null;
        if (!packet) {
            return;
        }
        if (conflict(packet)) {
            fail('EOS_MDNS_NAME_CONFLICT');
            return;
        }
        if (!query || !published || now() - lastReply < 1000) {
            return;
        }
        const requested = list(packet.questions)
            .map(object)
            .filter(item => item !== null);
        const selected = records.filter(record =>
            requested.some(
                question =>
                    canonical(question.name) === canonical(record.name) &&
                    (question.type === 'ANY' || question.type === record.type),
            ),
        );
        if (!selected.length) {
            return;
        }
        // One bounded response per second. Supplement SRV/PTR answers with our
        // own endpoint records only; never reflect arbitrary peer data.
        lastReply = now();
        send(selected.some(record => record.type === 'PTR' || record.type === 'SRV') ? records : selected);
    }
    function refresh(): void {
        const current = addresses();
        allLocal = current.own;
        if (JSON.stringify(current.visible) !== JSON.stringify(advertised)) {
            if (published) {
                send(records.map(record => ({ ...record, ttl: 0 })));
            }
            published = false;
            beginProbe(current.visible);
            return;
        }
        send(records);
        later(refresh, 60000);
    }
    function beginProbe(visible: string[]): void {
        if (stopped) {
            return;
        }
        if (!visible.length) {
            fail('EOS_MDNS_NO_LOCAL_ADDRESS');
            return;
        }
        advertised = visible;
        records = makeRecords();
        const claim = ++generation;
        let probes = 0;
        const probe = (): void => {
            if (stopped || claim !== generation || !transport) {
                return;
            }
            if (probes++ < 3) {
                transport.query(
                    {
                        questions: [
                            { name: host, type: 'ANY' },
                            { name: instance, type: 'ANY' },
                        ],
                        authorities: records.filter(record => record.type !== 'PTR'),
                    },
                    error => {
                        if (error) {
                            fail('EOS_MDNS_PROBE_FAILED');
                        }
                    },
                );
                later(probe, 250);
                return;
            }
            published = true;
            lastReply = now();
            send(records, () => {
                if (claim !== generation) {
                    return;
                }
                confirmed = true;
                options.adapter.log.info(
                    `EOS_MDNS_READY: https://${host}:${options.port}/ lokal angekündigt; Zertifikatsvertrauen separat prüfen.`,
                );
                later(() => send(records), 1000);
                later(refresh, 60000);
            });
        };
        later(probe, Math.floor(Math.max(0, Math.min(1, random())) * 250));
    }
    function start(): void {
        if (started || stopped || options.enabled !== true) {
            return;
        }
        started = true;
        if (
            typeof hostname !== 'string' ||
            !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname) ||
            !Number.isInteger(options.port) ||
            options.port < 1 ||
            options.port > 65535 ||
            typeof bind !== 'string' ||
            (!['0.0.0.0', '::'].includes(bind) && !isIP(bind))
        ) {
            fail('EOS_MDNS_CONFIGURATION_INVALID');
            return;
        }
        try {
            const current = addresses();
            allLocal = current.own;
            if (!current.visible.length) {
                fail('EOS_MDNS_NO_LOCAL_ADDRESS');
                return;
            }
            // The package is explicitly declared; lazy loading keeps disabled
            // discovery from creating sockets or loading a second network stack.
            const create =
                dependencies.createTransport ||
                (loadDependency('multicast-dns') as NonNullable<Dependencies['createTransport']>);
            transport = create({
                reuseAddr: true,
                ttl: 255,
                ...(isIP(bind) === 4 && bind !== '0.0.0.0' ? { interface: bind } : {}),
            });
            transport.on('error', () => fail('EOS_MDNS_SOCKET_FAILED'));
            transport.on('ready', () => {
                if (ready || stopped) {
                    return;
                }
                ready = true;
                try {
                    beginProbe(current.visible);
                } catch {
                    fail('EOS_MDNS_PROBE_FAILED');
                }
            });
            transport.on('query', packet => {
                try {
                    receive(packet, true);
                } catch {
                    fail('EOS_MDNS_PACKET_FAILED');
                }
            });
            transport.on('response', packet => {
                try {
                    receive(packet, false);
                } catch {
                    fail('EOS_MDNS_PACKET_FAILED');
                }
            });
            later(() => {
                if (!confirmed) {
                    fail('EOS_MDNS_START_TIMEOUT');
                }
            }, 4000);
        } catch {
            fail('EOS_MDNS_START_FAILED');
        }
    }
    return { start, stop };
}
