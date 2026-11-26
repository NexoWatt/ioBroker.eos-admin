"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttPacketLimit = void 0;
exports.validateExtraConfig = validateExtraConfig;
exports.parseZigbeeBackup = parseZigbeeBackup;
exports.createExtraArchives = createExtraArchives;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_https_1 = require("node:https");
const node_net_1 = require("node:net");
const node_tls_1 = require("node:tls");
const node_stream_1 = require("node:stream");
const files_1 = require("./files");
const types_1 = require("./types");
const JSON_LIMIT = 8 * 1024 * 1024, TOTAL_JSON_LIMIT = 64 * 1024 * 1024, ZIP_LIMIT = 16 * 1024 * 1024;
const MQTT_LIMIT = Math.ceil(ZIP_LIMIT / 3) * 4 + 65536;
function endpoint(host, protocol, port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535 || host.length > 253 || !host || /[\s/@?#\\]/.test(host))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ENDPOINT');
    const bracketed = (0, node_net_1.isIP)(host) === 6 ? '[' + host + ']' : host;
    let url;
    try {
        url = new URL(protocol + '://' + bracketed + ':' + port);
    }
    catch {
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ENDPOINT');
    }
    if (url.pathname !== '/' && url.pathname !== '')
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ENDPOINT');
    if (url.username || url.password || url.hash || url.search)
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ENDPOINT');
    return url;
}
function grafanaUrl(c) {
    const protocol = (0, types_1.str)(c, 'grafanaProtocol', 'http');
    if (!['http', 'https'].includes(protocol))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ENDPOINT');
    if (protocol === 'https' && c.grafanaSignedCertificates === false)
        throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
    const token = (0, types_1.str)(c, 'grafanaApiKey');
    if (!token || token.length > 4096 || /[\r\n\0]/.test(token))
        throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_TOKEN');
    return endpoint((0, types_1.str)(c, 'grafanaHost'), protocol, (0, types_1.num)(c, 'grafanaPort', 3000));
}
function mqttSettings(c) {
    const protocol = (0, types_1.str)(c, 'zigbee2mqttProtocol', 'mqtt');
    if (!['mqtt', 'mqtts'].includes(protocol))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ENDPOINT');
    const url = endpoint((0, types_1.str)(c, 'zigbee2mqttHost'), protocol, (0, types_1.num)(c, 'zigbee2mqttPort', 1883));
    const topic = (0, types_1.str)(c, 'zigbee2mqttBaseTopic', 'zigbee2mqtt');
    if (!topic || topic.length > 256 || /[+#\0\r\n]/.test(topic) || topic.startsWith('$'))
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_TOPIC');
    const options = {
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 0,
        resubscribe: false,
        connectTimeout: 5000,
        clientId: 'nweos-backup-' + (0, node_crypto_1.randomUUID)(),
        keepalive: 10,
        queueQoSZero: false,
    };
    const user = (0, types_1.str)(c, 'zigbee2mqttUser'), password = (0, types_1.str)(c, 'zigbee2mqttPassword');
    if (user.length > 4096 || password.length > 4096)
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_AUTH');
    if (user)
        options.username = user;
    if (password)
        options.password = password;
    if ((0, types_1.flag)(c, 'zigbee2mqttAuth') && !user)
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_AUTH');
    return { url, topic, options };
}
/** Pure preflight; the parent does not need axios or MQTT at startup. */
function validateExtraConfig(c) {
    if ((0, types_1.flag)(c, 'grafanaEnabled'))
        grafanaUrl(c);
    if ((0, types_1.flag)(c, 'zigbee2mqttEnabled')) {
        const type = (0, types_1.str)(c, 'zigbee2mqttType');
        if (!['local', 'remote'].includes(type))
            throw (0, types_1.fail)('EOS_BACKUP_MQTT_TYPE');
        if (type === 'remote')
            mqttSettings(c);
    }
}
function filename(label, identity) {
    return ((label.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'item') +
        '_' +
        (0, node_crypto_1.createHash)('sha256').update(identity).digest('hex').slice(0, 16));
}
function identifier(item, key = 'uid') {
    const value = item[key];
    if (typeof value !== 'string' || !value || value.length > 256 || /[\0\r\n]/.test(value))
        throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_DATA');
    return value;
}
function list(value) {
    if (!Array.isArray(value) || value.length > 10000 || !value.every(types_1.record))
        throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_DATA');
    return value;
}
async function grafana(ctx, deps) {
    const base = grafanaUrl(ctx.config), directory = (0, node_path_1.join)(ctx.workDir, 'grafana'), file = (0, node_path_1.join)(ctx.workDir, 'grafana.tar.gz');
    await (0, files_1.privateDir)(directory);
    for (const name of ['datasource', 'dashboards', 'dashboards_manually_restore', 'folder'])
        await (0, files_1.privateDir)((0, node_path_1.join)(directory, name));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    timer.unref();
    let total = 0;
    const agent = new node_https_1.Agent({ rejectUnauthorized: true, minVersion: 'TLSv1.2', keepAlive: false });
    const headers = { Authorization: 'Bearer ' + (0, types_1.str)(ctx.config, 'grafanaApiKey'), Accept: 'application/json' };
    const fetch = deps.getJson ??
        (async (url, auth, signal) => {
            const axios = (await import('axios')).default;
            const response = await axios.get(url.href, {
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
    const get = async (path) => {
        if (controller.signal.aborted)
            throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_TIMEOUT');
        const requestDeadline = new AbortController();
        const requestTimer = setTimeout(() => requestDeadline.abort(), 5000);
        requestTimer.unref();
        try {
            const value = await fetch(new URL(path, base), headers, AbortSignal.any([controller.signal, requestDeadline.signal]));
            const text = JSON.stringify(value);
            if (typeof text !== 'string' || Buffer.byteLength(text) > JSON_LIMIT)
                throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_LIMIT');
            total += Buffer.byteLength(text);
            if (total > TOTAL_JSON_LIMIT)
                throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_LIMIT');
            return value;
        }
        finally {
            clearTimeout(requestTimer);
        }
    };
    const save = async (path, value) => {
        await (0, promises_1.writeFile)((0, node_path_1.join)(directory, path), JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
    };
    const search = async (type) => {
        const result = [], seen = new Set();
        for (let page = 1; page <= 21; page++) {
            const entries = list(await get('/api/search?type=' + type + '&limit=500&page=' + page));
            for (const item of entries) {
                if (item.type !== type)
                    continue;
                const uid = identifier(item);
                if (seen.has(uid))
                    throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_PAGINATION');
                seen.add(uid);
                result.push(item);
                if (result.length > 10000)
                    throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_LIMIT');
            }
            if (entries.length < 500)
                return result;
        }
        throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_LIMIT');
    };
    try {
        const datasources = list(await get('/api/datasources'));
        for (let i = 0; i < datasources.length; i++) {
            const source = datasources[i];
            if (source) {
                const id = source.uid ?? source.id ?? i;
                if (typeof id !== 'string' && typeof id !== 'number')
                    throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_DATA');
                await save('datasource/' + filename((0, types_1.str)(source, 'name', 'datasource'), String(id)) + '.json', source);
            }
        }
        const folders = await search('dash-folder');
        for (const folder of folders) {
            const uid = identifier(folder);
            const value = await get('/api/folders/' + encodeURIComponent(uid));
            if (!(0, types_1.record)(value) || value.uid !== uid)
                throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_DATA');
            await save('folder/' + filename((0, types_1.str)(value, 'title', 'folder'), uid) + '.json', value);
        }
        const dashboards = await search('dash-db');
        const folderMap = Object.create(null);
        // Sequential bounded requests avoid a burst of full dashboard JSON in the worker heap.
        for (const item of dashboards) {
            const uid = identifier(item), value = await get('/api/dashboards/uid/' + encodeURIComponent(uid));
            if (!(0, types_1.record)(value) || !(0, types_1.record)(value.dashboard) || !(0, types_1.record)(value.meta) || value.dashboard.uid !== uid)
                throw (0, types_1.fail)('EOS_BACKUP_GRAFANA_DATA');
            const name = filename((0, types_1.str)(value.dashboard, 'title', 'dashboard'), uid);
            folderMap[name] = (0, types_1.str)(value.meta, 'folderUid', 'general') || 'general';
            const dashboard = { ...value.dashboard, id: null };
            await save('dashboards/' + name + '.json', { dashboard, overwrite: true });
            await save('dashboards_manually_restore/' + name + '.json', dashboard);
        }
        await save('folder/dashboard_folder_map.json', folderMap);
        await (0, files_1.archiveDirectory)(directory, file, [], TOTAL_JSON_LIMIT * 3);
        return { file, kind: 'grafana' };
    }
    catch (error) {
        await (0, promises_1.rm)(file, { force: true });
        if (error instanceof Error &&
            'code' in error &&
            typeof error.code === 'string' &&
            error.code.startsWith('EOS_BACKUP_'))
            throw error;
        throw (0, types_1.fail)(controller.signal.aborted ? 'EOS_BACKUP_GRAFANA_TIMEOUT' : 'EOS_BACKUP_GRAFANA_REQUEST');
    }
    finally {
        clearTimeout(timer);
        agent.destroy();
        await (0, promises_1.rm)(directory, { recursive: true, force: true });
    }
}
/** Reject an oversized MQTT frame from its five-byte header, before mqtt-packet buffers its body. */
class MqttPacketLimit extends node_stream_1.Transform {
    maximum;
    header = [];
    remaining = 0;
    multiplier = 1;
    payload = 0;
    total = 0;
    constructor(maximum = MQTT_LIMIT) {
        super();
        this.maximum = maximum;
    }
    _transform(chunk, _encoding, callback) {
        try {
            this.total += chunk.length;
            if (this.total > this.maximum * 2)
                throw (0, types_1.fail)('EOS_BACKUP_MQTT_LIMIT');
            let offset = 0;
            while (offset < chunk.length) {
                if (this.payload > 0) {
                    const size = Math.min(this.payload, chunk.length - offset);
                    this.push(chunk.subarray(offset, offset + size));
                    this.payload -= size;
                    offset += size;
                    continue;
                }
                const byte = chunk[offset++];
                this.header.push(byte);
                if (this.header.length === 1)
                    continue;
                this.remaining += (byte & 127) * this.multiplier;
                if (this.remaining > this.maximum || this.header.length > 5)
                    throw (0, types_1.fail)('EOS_BACKUP_MQTT_LIMIT');
                if (byte & 128) {
                    if (this.header.length === 5)
                        throw (0, types_1.fail)('EOS_BACKUP_MQTT_LIMIT');
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
        }
        catch (error) {
            callback(error instanceof Error ? error : (0, types_1.fail)('EOS_BACKUP_MQTT_LIMIT'));
        }
    }
}
exports.MqttPacketLimit = MqttPacketLimit;
function connectMqtt(url, options) {
    // Dynamic require occurs only in the short-lived backup worker.
    const mqtt = require('mqtt');
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    return new mqtt.MqttClient(() => {
        const socket = url.protocol === 'mqtts:'
            ? (0, node_tls_1.connect)({
                host: hostname,
                port: Number(url.port) || 8883,
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2',
                ...(!(0, node_net_1.isIP)(hostname) ? { servername: hostname } : {}),
            })
            : (0, node_net_1.connect)({ host: hostname, port: Number(url.port) || 1883 });
        const limiter = new MqttPacketLimit();
        const stream = node_stream_1.Duplex.from({ readable: socket.pipe(limiter), writable: socket });
        socket.on('error', error => limiter.destroy(error));
        limiter.on('error', () => socket.destroy());
        stream.on('close', () => {
            limiter.destroy();
            socket.destroy();
        });
        return stream;
    }, options);
}
function parseZigbeeBackup(payload, transaction) {
    if (payload.length > MQTT_LIMIT)
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_LIMIT');
    let data;
    try {
        data = JSON.parse(payload.toString('utf8'));
    }
    catch {
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_DATA');
    }
    if (!(0, types_1.record)(data))
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_DATA');
    if (data.transaction !== transaction)
        return null;
    if (data.status !== 'ok' || !(0, types_1.record)(data.data) || typeof data.data.zip !== 'string')
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_BACKUP_FAILED');
    const encoded = data.data.zip;
    if (encoded.length > Math.ceil(ZIP_LIMIT / 3) * 4 ||
        encoded.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_DATA');
    const zip = Buffer.from(encoded, 'base64');
    if (zip.length < 4 ||
        zip.length > ZIP_LIMIT ||
        zip[0] !== 0x50 ||
        zip[1] !== 0x4b ||
        !((zip[2] === 3 && zip[3] === 4) || (zip[2] === 5 && zip[3] === 6)))
        throw (0, types_1.fail)('EOS_BACKUP_MQTT_ZIP');
    return zip;
}
async function zigbee(ctx, deps) {
    const settings = mqttSettings(ctx.config), transaction = (0, node_crypto_1.randomUUID)(), file = (0, node_path_1.join)(ctx.workDir, 'zigbee2mqtt.zip');
    const client = (deps.mqttConnect ?? connectMqtt)(settings.url, settings.options);
    let timer;
    try {
        const zip = await new Promise((resolve, reject) => {
            let settled = false, requested = false;
            const done = (error, value) => {
                if (settled)
                    return;
                settled = true;
                if (timer)
                    clearTimeout(timer);
                if (error)
                    reject(error);
                else if (value)
                    resolve(value);
            };
            timer = setTimeout(() => done((0, types_1.fail)('EOS_BACKUP_MQTT_TIMEOUT')), 60000);
            timer.unref();
            client.on('error', () => done((0, types_1.fail)('EOS_BACKUP_MQTT_CONNECTION')));
            client.on('close', () => done((0, types_1.fail)('EOS_BACKUP_MQTT_CONNECTION')));
            client.once('connect', () => {
                client.subscribe(settings.topic + '/bridge/response/backup', { qos: 0 }, (error, grants) => {
                    if (error || !grants?.length || grants.some(grant => grant.qos === 128)) {
                        done((0, types_1.fail)('EOS_BACKUP_MQTT_SUBSCRIBE'));
                        return;
                    }
                    requested = true;
                    client.publish(settings.topic + '/bridge/request/backup', JSON.stringify({ transaction }), { qos: 0, retain: false }, error => {
                        if (error)
                            done((0, types_1.fail)('EOS_BACKUP_MQTT_PUBLISH'));
                    });
                });
            });
            client.on('message', (topic, payload, packet) => {
                if (settled || !requested || packet.retain || topic !== settings.topic + '/bridge/response/backup')
                    return;
                try {
                    const value = parseZigbeeBackup(payload, transaction);
                    if (value)
                        done(null, value);
                }
                catch {
                    done((0, types_1.fail)('EOS_BACKUP_MQTT_DATA'));
                }
            });
        });
        await (0, promises_1.writeFile)(file, zip, { flag: 'wx', mode: 0o600 });
        return { file, kind: 'zigbee2mqtt' };
    }
    finally {
        if (timer)
            clearTimeout(timer);
        client.end(true);
        client.stream?.destroy();
    }
}
async function createExtraArchives(ctx, deps = {}) {
    validateExtraConfig(ctx.config);
    const result = [];
    if ((0, types_1.flag)(ctx.config, 'grafanaEnabled'))
        result.push(await grafana(ctx, deps));
    if ((0, types_1.flag)(ctx.config, 'zigbee2mqttEnabled') && (0, types_1.str)(ctx.config, 'zigbee2mqttType') === 'remote')
        result.push(await zigbee(ctx, deps));
    return result;
}
