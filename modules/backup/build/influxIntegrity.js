"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryInflux = inventoryInflux;
exports.validateInfluxExport = validateInfluxExport;
exports.exportInflux2 = exportInflux2;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const command_1 = require("./command");
const files_1 = require("./files");
const types_1 = require("./types");
const MAX_METADATA = 8 * 1024 ** 2;
async function jsonFile(file) {
    const fd = await (0, promises_1.open)(file, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const st = await fd.stat();
        if (!st.isFile() || st.size === 0 || st.size > MAX_METADATA)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_METADATA_SIZE');
        const bytes = Buffer.alloc(MAX_METADATA + 1);
        let length = 0;
        while (length < bytes.length) {
            const read = await fd.read(bytes, length, bytes.length - length, null);
            if (!read.bytesRead)
                break;
            length += read.bytesRead;
        }
        if (length > MAX_METADATA)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_METADATA_SIZE');
        return JSON.parse(bytes.subarray(0, length).toString('utf8'));
    }
    finally {
        await fd.close();
    }
}
/** Read-only inventory before snapshotting prevents a mistyped/missing bucket yielding false success. */
async function inventoryInflux(target, workDir, index) {
    const file = (0, node_path_1.join)(workDir, `influx-inventory-${index}.json`);
    const environment = { INFLUX_TOKEN: target.token };
    const readInventory = async (args) => {
        try {
            await (0, command_1.run)(await (0, command_1.executable)('influx'), args, { cwd: workDir, output: file, environment, timeout: 15000, maxBytes: MAX_METADATA });
            return await jsonFile(file);
        }
        finally {
            await (0, promises_1.rm)(file, { force: true });
        }
    };
    let scopes;
    if (target.orgId)
        scopes = [['--org-id', target.orgId]];
    else if (target.org)
        scopes = [['--org', target.org]];
    else {
        // `influx bucket list` requires an organization even for an operator token.
        const organizations = await readInventory(['org', 'list', '--json', '--host', target.url]);
        if (!Array.isArray(organizations) || organizations.length > 64 || organizations.some(row => !(0, types_1.record)(row) || typeof row.id !== 'string' || !/^[0-9a-fA-F]{16}$/.test(row.id)))
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_INVENTORY');
        scopes = organizations.filter(types_1.record).map(row => ['--org-id', String(row.id)]);
    }
    const buckets = [], ids = new Set();
    for (const scope of scopes) {
        const parsed = await readInventory(['bucket', 'list', '--json', '--host', target.url, '--limit', '10001', ...scope]);
        // CLI returns null for an existing organization with no buckets.
        if (parsed === null)
            continue;
        if (!Array.isArray(parsed) || parsed.length > 10000)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_INVENTORY');
        for (const row of parsed) {
            if (!(0, types_1.record)(row) || typeof row.id !== 'string' || !/^[0-9a-fA-F]{16}$/.test(row.id) ||
                typeof row.orgID !== 'string' || !/^[0-9a-fA-F]{16}$/.test(row.orgID) ||
                typeof row.name !== 'string' || !row.name.length || row.name.length > 256 || ids.has(row.id))
                throw (0, types_1.fail)('EOS_BACKUP_INFLUX_INVENTORY');
            ids.add(row.id);
            if (ids.size > 10000)
                throw (0, types_1.fail)('EOS_BACKUP_INFLUX_INVENTORY');
            if ((!target.bucketId || row.id === target.bucketId) && (!target.bucket || row.name === target.bucket))
                buckets.push({ id: row.id, orgId: row.orgID, name: row.name });
        }
    }
    if ((target.bucket || target.bucketId) && buckets.length !== 1)
        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_BUCKET_MISSING_OR_AMBIGUOUS');
    return buckets;
}
/** Structural and file validation, not a mere archive-size check. Empty *existing* buckets are valid. */
async function validateInfluxExport(folder, expected, required) {
    const entries = await (0, promises_1.readdir)(folder, { withFileTypes: true });
    if (entries.length > 100000 || entries.some(entry => !entry.isFile() || entry.isSymbolicLink()))
        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_FILES');
    const manifests = entries.filter(entry => entry.name.endsWith('.manifest'));
    if (manifests.length !== 1 || !manifests[0])
        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_MANIFEST_MISSING');
    const manifest = await jsonFile((0, node_path_1.join)(folder, manifests[0].name));
    if (!(0, types_1.record)(manifest) || manifest.manifestVersion !== 2 || !Array.isArray(manifest.buckets) || manifest.buckets.length > 10000)
        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_MANIFEST');
    const files = [];
    const fileNames = new Set();
    const verifyFile = async (entry) => {
        if (!(0, types_1.record)(entry) || typeof entry.fileName !== 'string' || !/^[A-Za-z0-9_.-]{1,160}$/.test(entry.fileName) ||
            entry.fileName !== (0, node_path_1.basename)(entry.fileName) || ['.', '..'].includes(entry.fileName) ||
            !Number.isSafeInteger(entry.size) || Number(entry.size) <= 0 || (entry.compression !== 0 && entry.compression !== 1) ||
            fileNames.has(entry.fileName))
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_FILE_ENTRY');
        const size = await (0, files_1.assertRegular)((0, node_path_1.join)(folder, entry.fileName));
        if (size !== entry.size)
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_FILE_SIZE');
        fileNames.add(entry.fileName);
        files.push({ name: entry.fileName, size, sha256: await (0, files_1.hashFile)((0, node_path_1.join)(folder, entry.fileName)) });
    };
    await verifyFile(manifest.kv);
    if (manifest.sql !== undefined)
        await verifyFile(manifest.sql);
    const actual = new Map();
    let activeHistoryPresent = required === undefined;
    for (const bucket of manifest.buckets) {
        if (!(0, types_1.record)(bucket) || typeof bucket.bucketID !== 'string' || !/^[0-9a-fA-F]{16}$/.test(bucket.bucketID) ||
            typeof bucket.organizationID !== 'string' || !/^[0-9a-fA-F]{16}$/.test(bucket.organizationID) ||
            typeof bucket.bucketName !== 'string' || actual.has(bucket.bucketID) || !Array.isArray(bucket.retentionPolicies))
            throw (0, types_1.fail)('EOS_BACKUP_INFLUX_BUCKET_MANIFEST');
        actual.set(bucket.bucketID, { id: bucket.bucketID, orgId: bucket.organizationID, name: bucket.bucketName });
        if (required && bucket.bucketName === required.bucket && bucket.organizationName === required.org)
            activeHistoryPresent = true;
        for (const policy of bucket.retentionPolicies) {
            if (!(0, types_1.record)(policy) || !Array.isArray(policy.shardGroups))
                throw (0, types_1.fail)('EOS_BACKUP_INFLUX_SHARDS');
            for (const group of policy.shardGroups) {
                if (!(0, types_1.record)(group) || !Array.isArray(group.shards))
                    throw (0, types_1.fail)('EOS_BACKUP_INFLUX_SHARDS');
                for (const shard of group.shards)
                    await verifyFile(shard);
            }
        }
    }
    if (actual.size !== expected.length || expected.some(item => {
        const found = actual.get(item.id);
        return !found || found.orgId !== item.orgId || found.name !== item.name;
    }))
        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_BUCKET_CONTENT_MISSING');
    if (!activeHistoryPresent)
        throw (0, types_1.fail)('EOS_BACKUP_ACTIVE_INFLUX_CONTENT_MISSING');
    if (entries.some(entry => entry.name !== manifests[0]?.name && !fileNames.has(entry.name)))
        throw (0, types_1.fail)('EOS_BACKUP_INFLUX_UNREFERENCED_FILE');
    const proof = { schema: 'nexowatt-influx-export-proof/v1', manifest: manifests[0].name, buckets: expected, files };
    await (0, promises_1.writeFile)((0, node_path_1.join)(folder, 'eos-export-proof.json'), JSON.stringify(proof, null, 2), { flag: 'wx', mode: 0o600 });
    return proof;
}
async function exportInflux2(target, folder, workDir, index, required) {
    const expected = await inventoryInflux(target, workDir, index);
    const args = ['backup', '--host', target.url];
    if (target.orgId)
        args.push('--org-id', target.orgId);
    else if (target.org)
        args.push('--org', target.org);
    if (expected.length === 1 && (target.bucketId || target.bucket))
        args.push('--bucket-id', expected[0]?.id ?? '');
    args.push(folder);
    await (0, command_1.run)(await (0, command_1.executable)('influx'), args, { cwd: workDir, environment: { INFLUX_TOKEN: target.token } });
    await validateInfluxExport(folder, expected, required);
}
