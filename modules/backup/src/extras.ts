/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { createHash, randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Agent } from 'node:https';
import { connect as tcpConnect, isIP, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { Duplex, Transform, type TransformCallback } from 'node:stream';
import type { MqttClient, IClientOptions } from 'mqtt';
import { archiveDirectory, privateDir } from './files';
import { fail, flag, num, record, str, type JobContext, type Config } from './types';
const JSON_LIMIT = 8 * 1024 * 1024,
    TOTAL_JSON_LIMIT = 64 * 1024 * 1024,
    ZIP_LIMIT = 16 * 1024 * 1024;
const MQTT_LIMIT = Math.ceil(ZIP_LIMIT / 3) * 4 + 65536;
export interface ExtraDependencies {
    getJson?: (url: URL, headers: Record<string, string>, signal: AbortSignal) => Promise<unknown>;
    mqttConnect?: (url: URL, options: IClientOptions) => MqttClient;
}
function endpoint(host: string, protocol: string, port: number): URL {
    if (!Number.isInteger(port) || port < 1 || port > 65535 || host.length > 253 || !host || /[\s/@?#\\]/.test(host))
        throw fail('EOS_BACKUP_REMOTE_ENDPOINT');
    const bracketed = isIP(host) === 6 ? '[' + host + ']' : host;
    let url: URL;
    try {
        url = new URL(protocol + '://' + bracketed + ':' + port);
    } catch {
        throw fail('EOS_BACKUP_REMOTE_ENDPOINT');
    }
    if (url.pathname !== '/' && url.pathname !== '') throw fail('EOS_BACKUP_REMOTE_ENDPOINT');
    if (url.username || url.password || url.hash || url.search) throw fail('EOS_BACKUP_REMOTE_ENDPOINT');
    return url;
}
function grafanaUrl(c: Config): URL {
    const protocol = str(c, 'grafanaProtocol', 'http');
    if (!['http', 'https'].includes(protocol)) throw fail('EOS_BACKUP_REMOTE_ENDPOINT');
    if (protocol === 'https' && c.grafanaSignedCertificates === false) throw fail('EOS_BACKUP_TLS_REQUIRED');
    const token = str(c, 'grafanaApiKey');
    if (!token || token.length > 4096 || /[\r\n\0]/.test(token)) throw fail('EOS_BACKUP_GRAFANA_TOKEN');
    return endpoint(str(c, 'grafanaHost'), protocol, num(c, 'grafanaPort', 3000));
}
function mqttSettings(c: Config): { url: URL; topic: string; options: IClientOptions } {
    const protocol = str(c, 'zigbee2mqttProtocol', 'mqtt');
    if (!['mqtt', 'mqtts'].includes(protocol)) throw fail('EOS_BACKUP_REMOTE_ENDPOINT');
    const url = endpoint(str(c, 'zigbee2mqttHost'), protocol, num(c, 'zigbee2mqttPort', 1883));
    const topic = str(c, 'zigbee2mqttBaseTopic', 'zigbee2mqtt');
    if (!topic || topic.length > 256 || /[+#\0\r\n]/.test(topic) || topic.startsWith('$'))
        throw fail('EOS_BACKUP_MQTT_TOPIC');
    const options: IClientOptions = {
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 0,
        resubscribe: false,
        connectTimeout: 5000,
        clientId: 'nweos-backup-' + randomUUID(),
        keepalive: 10,
        queueQoSZero: false,
    };
    const user = str(c, 'zigbee2mqttUser'),
        password = str(c, 'zigbee2mqttPassword');
    if (user.length > 4096 || password.length > 4096) throw fail('EOS_BACKUP_MQTT_AUTH');
    if (user) options.username = user;
    if (password) options.password = password;
    if (flag(c, 'zigbee2mqttAuth') && !user) throw fail('EOS_BACKUP_MQTT_AUTH');
    return { url, topic, options };
}
/** Pure preflight; the parent does not need axios or MQTT at startup. */
export function validateExtraConfig(c: Config): void {
    if (flag(c, 'grafanaEnabled')) grafanaUrl(c);
    if (flag(c, 'zigbee2mqttEnabled')) {
        const type = str(c, 'zigbee2mqttType');
        if (!['local', 'remote'].includes(type)) throw fail('EOS_BACKUP_MQTT_TYPE');
        if (type === 'remote') mqttSettings(c);
    }
}
function filename(label: string, identity: string): string {
    return (
        (label.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'item') +
        '_' +
        createHash('sha256').update(identity).digest('hex').slice(0, 16)
    );
}
function identifier(item: Record<string, unknown>, key = 'uid'): string {
    const value = item[key];
    if (typeof value !== 'string' || !value || value.length > 256 || /[\0\r\n]/.test(value))
        throw fail('EOS_BACKUP_GRAFANA_DATA');
    return value;
}
function list(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value) || value.length > 10000 || !value.every(record)) throw fail('EOS_BACKUP_GRAFANA_DATA');
    return value;
}
async function grafana(ctx: JobContext, deps: ExtraDependencies): Promise<{ file: string; kind: string }> {
    const base = grafanaUrl(ctx.config),
        directory = join(ctx.workDir, 'grafana'),
        file = join(ctx.workDir, 'grafana.tar.gz');
    await privateDir(directory);
    for (const name of ['datasource', 'dashboards', 'dashboards_manually_restore', 'folder'])
        await privateDir(join(directory, name));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    timer.unref();
    let total = 0;
    const agent = new Agent({ rejectUnauthorized: true, minVersion: 'TLSv1.2', keepAlive: false });
    const headers = { Authorization: 'Bearer ' + str(ctx.config, 'grafanaApiKey'), Accept: 'application/json' };
    const fetch =
        deps.getJson ??
        (async (url: URL, auth: Record<string, string>, signal: AbortSignal): Promise<unknown> => {
            const axios = (await import('axios')).default;
            const response = await axios.get<unknown>(url.href, {
                headers: auth,
                timeout: 5000,
                signal,
                httpsAgent: agent,
                maxRedirects: 0,
                maxContentLength: JSON_LIMIT,
                maxBodyLength: JSON_LIMIT,
                proxy: false,
                responseType: 'json',
                transitional: { silentJSONParsing: false },
            });
            return response.data;
        });
    const get = async (path: string): Promise<unknown> => {
        if (controller.signal.aborted) throw fail('EOS_BACKUP_GRAFANA_TIMEOUT');
        const requestDeadline = new AbortController();
        const requestTimer = setTimeout(() => requestDeadline.abort(), 5000);
        requestTimer.unref();
        try {
            const value = await fetch(
                new URL(path, base),
                headers,
                AbortSignal.any([controller.signal, requestDeadline.signal]),
            );
            const text = JSON.stringify(value);
            if (typeof text !== 'string' || Buffer.byteLength(text) > JSON_LIMIT)
                throw fail('EOS_BACKUP_GRAFANA_LIMIT');
            total += Buffer.byteLength(text);
            if (total > TOTAL_JSON_LIMIT) throw fail('EOS_BACKUP_GRAFANA_LIMIT');
            return value;
        } finally {
            clearTimeout(requestTimer);
        }
    };
    const save = async (path: string, value: unknown): Promise<void> => {
        await writeFile(join(directory, path), JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
    };
    const search = async (type: string): Promise<Record<string, unknown>[]> => {
        const result: Record<string, unknown>[] = [],
            seen = new Set<string>();
        for (let page = 1; page <= 21; page++) {
            const entries = list(await get('/api/search?type=' + type + '&limit=500&page=' + page));
            for (const item of entries) {
                if (item.type !== type) continue;
                const uid = identifier(item);
                if (seen.has(uid)) throw fail('EOS_BACKUP_GRAFANA_PAGINATION');
                seen.add(uid);
                result.push(item);
                if (result.length > 10000) throw fail('EOS_BACKUP_GRAFANA_LIMIT');
            }
            if (entries.length < 500) return result;
        }
        throw fail('EOS_BACKUP_GRAFANA_LIMIT');
    };
    try {
        const datasources = list(await get('/api/datasources'));
        for (let i = 0; i < datasources.length; i++) {
            const source = datasources[i];
            if (source) {
                const id = source.uid ?? source.id ?? i;
                if (typeof id !== 'string' && typeof id !== 'number') throw fail('EOS_BACKUP_GRAFANA_DATA');
                await save('datasource/' + filename(str(source, 'name', 'datasource'), String(id)) + '.json', source);
            }
        }
        const folders = await search('dash-folder');
        for (const folder of folders) {
            const uid = identifier(folder);
            const value = await get('/api/folders/' + encodeURIComponent(uid));
            if (!record(value) || value.uid !== uid) throw fail('EOS_BACKUP_GRAFANA_DATA');
            await save('folder/' + filename(str(value, 'title', 'folder'), uid) + '.json', value);
        }
        const dashboards = await search('dash-db');
        const folderMap = Object.create(null) as Record<string, string>;
        // Sequential bounded requests avoid a burst of full dashboard JSON in the worker heap.
        for (const item of dashboards) {
            const uid = identifier(item),
                value = await get('/api/dashboards/uid/' + encodeURIComponent(uid));
            if (!record(value) || !record(value.dashboard) || !record(value.meta) || value.dashboard.uid !== uid)
                throw fail('EOS_BACKUP_GRAFANA_DATA');
            const name = filename(str(value.dashboard, 'title', 'dashboard'), uid);
            folderMap[name] = str(value.meta, 'folderUid', 'general') || 'general';
            const dashboard = { ...value.dashboard, id: null };
            await save('dashboards/' + name + '.json', { dashboard, overwrite: true });
            await save('dashboards_manually_restore/' + name + '.json', dashboard);
        }
        await save('folder/dashboard_folder_map.json', folderMap);
        await archiveDirectory(directory, file, [], TOTAL_JSON_LIMIT * 3);
        return { file, kind: 'grafana' };
    } catch (error) {
        await rm(file, { force: true });
        if (
            error instanceof Error &&
            'code' in error &&
            typeof error.code === 'string' &&
            error.code.startsWith('EOS_BACKUP_')
        )
            throw error;
        throw fail(controller.signal.aborted ? 'EOS_BACKUP_GRAFANA_TIMEOUT' : 'EOS_BACKUP_GRAFANA_REQUEST');
    } finally {
        clearTimeout(timer);
        agent.destroy();
        await rm(directory, { recursive: true, force: true });
    }
}
/** Reject an oversized MQTT frame from its five-byte header, before mqtt-packet buffers its body. */
export class MqttPacketLimit extends Transform {
    private header: number[] = [];
    private remaining = 0;
    private multiplier = 1;
    private payload = 0;
    private total = 0;
    constructor(private readonly maximum = MQTT_LIMIT) {
        super();
    }
    override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        try {
            this.total += chunk.length;
            if (this.total > this.maximum * 2) throw fail('EOS_BACKUP_MQTT_LIMIT');
            let offset = 0;
            while (offset < chunk.length) {
                if (this.payload > 0) {
                    const size = Math.min(this.payload, chunk.length - offset);
                    this.push(chunk.subarray(offset, offset + size));
                    this.payload -= size;
                    offset += size;
                    continue;
                }
                const byte = chunk[offset++]!;
                this.header.push(byte);
                if (this.header.length === 1) continue;
                this.remaining += (byte & 127) * this.multiplier;
                if (this.remaining > this.maximum || this.header.length > 5) throw fail('EOS_BACKUP_MQTT_LIMIT');
                if (byte & 128) {
                    if (this.header.length === 5) throw fail('EOS_BACKUP_MQTT_LIMIT');
                    this.multiplier *= 128;
                    continue;
                }
                this.push(Buffer.from(this.header));
                this.payload = this.remaining;
                this.header = [];
                this.remaining = 0;
                this.multiplier = 1;
            }
            callback();
        } catch (error) {
            callback(error instanceof Error ? error : fail('EOS_BACKUP_MQTT_LIMIT'));
        }
    }
}
function connectMqtt(url: URL, options: IClientOptions): MqttClient {
    // Dynamic require occurs only in the short-lived backup worker.
    const mqtt = require('mqtt') as typeof import('mqtt');
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    return new mqtt.MqttClient(() => {
        const socket: Socket =
            url.protocol === 'mqtts:'
                ? tlsConnect({
                      host: hostname,
                      port: Number(url.port) || 8883,
                      rejectUnauthorized: true,
                      minVersion: 'TLSv1.2',
                      ...(!isIP(hostname) ? { servername: hostname } : {}),
                  })
                : tcpConnect({ host: hostname, port: Number(url.port) || 1883 });
        const limiter = new MqttPacketLimit();
        const stream = Duplex.from({ readable: socket.pipe(limiter), writable: socket });
        socket.on('error', error => limiter.destroy(error));
        limiter.on('error', () => socket.destroy());
        stream.on('close', () => {
            limiter.destroy();
            socket.destroy();
        });
        return stream;
    }, options);
}
export function parseZigbeeBackup(payload: Buffer, transaction: string): Buffer | null {
    if (payload.length > MQTT_LIMIT) throw fail('EOS_BACKUP_MQTT_LIMIT');
    let data: unknown;
    try {
        data = JSON.parse(payload.toString('utf8'));
    } catch {
        throw fail('EOS_BACKUP_MQTT_DATA');
    }
    if (!record(data)) throw fail('EOS_BACKUP_MQTT_DATA');
    if (data.transaction !== transaction) return null;
    if (data.status !== 'ok' || !record(data.data) || typeof data.data.zip !== 'string')
        throw fail('EOS_BACKUP_MQTT_BACKUP_FAILED');
    const encoded = data.data.zip;
    if (
        encoded.length > Math.ceil(ZIP_LIMIT / 3) * 4 ||
        encoded.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
    )
        throw fail('EOS_BACKUP_MQTT_DATA');
    const zip = Buffer.from(encoded, 'base64');
    if (
        zip.length < 4 ||
        zip.length > ZIP_LIMIT ||
        zip[0] !== 0x50 ||
        zip[1] !== 0x4b ||
        !((zip[2] === 3 && zip[3] === 4) || (zip[2] === 5 && zip[3] === 6))
    )
        throw fail('EOS_BACKUP_MQTT_ZIP');
    return zip;
}
async function zigbee(ctx: JobContext, deps: ExtraDependencies): Promise<{ file: string; kind: string }> {
    const settings = mqttSettings(ctx.config),
        transaction = randomUUID(),
        file = join(ctx.workDir, 'zigbee2mqtt.zip');
    const client = (deps.mqttConnect ?? connectMqtt)(settings.url, settings.options);
    let timer: NodeJS.Timeout | undefined;
    try {
        const zip = await new Promise<Buffer>((resolve, reject) => {
            let settled = false,
                requested = false;
            const done = (error: Error | null, value?: Buffer): void => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                if (error) reject(error);
                else if (value) resolve(value);
            };
            timer = setTimeout(() => done(fail('EOS_BACKUP_MQTT_TIMEOUT')), 60000);
            timer.unref();
            client.on('error', () => done(fail('EOS_BACKUP_MQTT_CONNECTION')));
            client.on('close', () => done(fail('EOS_BACKUP_MQTT_CONNECTION')));
            client.once('connect', () => {
                client.subscribe(settings.topic + '/bridge/response/backup', { qos: 0 }, (error, grants) => {
                    if (error || !grants?.length || grants.some(grant => grant.qos === 128)) {
                        done(fail('EOS_BACKUP_MQTT_SUBSCRIBE'));
                        return;
                    }
                    requested = true;
                    client.publish(
                        settings.topic + '/bridge/request/backup',
                        JSON.stringify({ transaction }),
                        { qos: 0, retain: false },
                        error => {
                            if (error) done(fail('EOS_BACKUP_MQTT_PUBLISH'));
                        },
                    );
                });
            });
            client.on('message', (topic, payload, packet) => {
                if (settled || !requested || packet.retain || topic !== settings.topic + '/bridge/response/backup')
                    return;
                try {
                    const value = parseZigbeeBackup(payload, transaction);
                    if (value) done(null, value);
                } catch {
                    done(fail('EOS_BACKUP_MQTT_DATA'));
                }
            });
        });
        await writeFile(file, zip, { flag: 'wx', mode: 0o600 });
        return { file, kind: 'zigbee2mqtt' };
    } finally {
        if (timer) clearTimeout(timer);
        client.end(true);
        client.stream?.destroy();
    }
}
export async function createExtraArchives(
    ctx: JobContext,
    deps: ExtraDependencies = {},
): Promise<{ file: string; kind: string }[]> {
    validateExtraConfig(ctx.config);
    const result: { file: string; kind: string }[] = [];
    if (flag(ctx.config, 'grafanaEnabled')) result.push(await grafana(ctx, deps));
    if (flag(ctx.config, 'zigbee2mqttEnabled') && str(ctx.config, 'zigbee2mqttType') === 'remote')
        result.push(await zigbee(ctx, deps));
    return result;
}
