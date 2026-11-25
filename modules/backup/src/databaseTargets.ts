/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { fail, flag, record, str, type Config } from './types';
import { isIP } from 'node:net';
export interface InfluxTarget {
    version: '1.x' | '2.x';
    host: string;
    port: string;
    protocol: 'http' | 'https';
    url: string;
    bucket: string;
    bucketId: string;
    org: string;
    orgId: string;
    token: string;
}
/** The same normalized target drives validation, preflight and the actual exporter. */
export function influxTargets(c: Config): InfluxTarget[] {
    if (!flag(c, 'influxDBEnabled')) return [];
    const multi = flag(c, 'influxDBMulti');
    const rows = multi ? c.influxDBEvents : [c];
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 64 || rows.some(row => !record(row)))
        throw fail('EOS_BACKUP_EVENTS');
    return rows.filter(record).map(row => {
        const value = (suffix: string, field: string, fallback = ''): string =>
            multi ? str(row, field, str(c, 'influxDB' + suffix, fallback)) : str(c, 'influxDB' + suffix, fallback);
        const version = value('Version', 'dbversion', '1.x');
        const protocol = value('Protocol', 'protocol', 'http');
        const rawHost = value('Host', 'host', 'localhost');
        const host = isIP(rawHost) === 6 ? `[${rawHost}]` : rawHost;
        const port = value('Port', 'port', version === '2.x' ? '8086' : '8088');
        if (version !== '1.x' && version !== '2.x') throw fail('EOS_BACKUP_INFLUX_VERSION');
        if (protocol !== 'http' && protocol !== 'https') throw fail('EOS_BACKUP_INFLUX_PROTOCOL');
        if (!/^(?:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*|\[[0-9a-fA-F:]+\])$/.test(host) || host.length > 253)
            throw fail('EOS_BACKUP_INFLUX_HOST');
        if (host.startsWith('[') && isIP(host.slice(1, -1)) !== 6) throw fail('EOS_BACKUP_INFLUX_HOST');
        if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw fail('EOS_BACKUP_INFLUX_PORT');
        const bucket = value('Name', 'dbName'), bucketId = value('BucketId', 'bucketId');
        const org = value('Organization', 'org'), orgId = value('OrganizationId', 'orgId');
        for (const name of [bucket, org])
            if (name.length > 256 || /[\0\r\n]/.test(name)) throw fail('EOS_BACKUP_INFLUX_IDENTITY');
        for (const id of [bucketId, orgId])
            if (id && !/^[0-9a-fA-F]{16}$/.test(id)) throw fail('EOS_BACKUP_INFLUX_IDENTITY');
        return { version, protocol, host, port, url: `${protocol}://${host}:${Number(port)}`, bucket, bucketId, org, orgId, token: value('Token', 'token') };
    });
}
