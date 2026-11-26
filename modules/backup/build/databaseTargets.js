"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.influxTargets = influxTargets;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const types_1 = require("./types");
const node_net_1 = require("node:net");
/** The same normalized target drives validation, preflight and the actual exporter. */
function influxTargets(c) {
    if (!(0, types_1.flag)(c, 'influxDBEnabled'))
        return [];
    const multi = (0, types_1.flag)(c, 'influxDBMulti');
    const rows = multi ? c.influxDBEvents : [c];
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 64 || rows.some(row => !(0, types_1.record)(row)))
        throw (0, types_1.fail)('EOS_BACKUP_EVENTS');
    return rows.filter(types_1.record).map(row => {
        const value = (suffix, field, fallback = '') => multi ? (0, types_1.str)(row, field, (0, types_1.str)(c, 'influxDB' + suffix, fallback)) : (0, types_1.str)(c, 'influxDB' + suffix, fallback);
        const version = value('Version', 'dbversion', '1.x');
        const protocol = value('Protocol', 'protocol', 'http');
        const rawHost = value('Host', 'host', 'localhost');
        const host = (0, node_net_1.isIP)(rawHost) === 6 ? `[${rawHost}]` : rawHost;
        const port = value('Port', 'port', version === '2.x' ? '8086' : '8088');
        if (version !== '1.x' && version !== '2.x')
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_VERSION');
        if (protocol !== 'http' && protocol !== 'https')
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_PROTOCOL');
        if (!/^(?:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*|\[[0-9a-fA-F:]+\])$/.test(host) || host.length > 253)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_HOST');
        if (host.startsWith('[') && (0, node_net_1.isIP)(host.slice(1, -1)) !== 6)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_HOST');
        if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_PORT');
        const bucket = value('Name', 'dbName'), bucketId = value('BucketId', 'bucketId');
        const org = value('Organization', 'org'), orgId = value('OrganizationId', 'orgId');
        for (const name of [bucket, org])
            if (name.length > 256 || /[\0\r\n]/.test(name))
                throw (0, types_1.fail)('EOS_BACKUP_INFLUX_IDENTITY');
        for (const id of [bucketId, orgId])
            if (id && !/^[0-9a-fA-F]{16}$/.test(id))
                throw (0, types_1.fail)('EOS_BACKUP_INFLUX_IDENTITY');
        return { version, protocol, host, port, url: `${protocol}://${host}:${Number(port)}`, bucket, bucketId, org, orgId, token: value('Token', 'token') };
    });
}
