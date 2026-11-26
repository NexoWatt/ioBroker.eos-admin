"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = void 0;
exports.remoteName = remoteName;
exports.providerName = providerName;
exports.graphDownloadUrl = graphDownloadUrl;
exports.parseWebdavListing = parseWebdavListing;
exports.ensureWebdavDirectory = ensureWebdavDirectory;
exports.openStorage = openStorage;
exports.pruneRemoteArchives = pruneRemoteArchives;
/** Copyright (c) 2026 NexoWatt. Proprietary. Bounded remote archive inventory. */
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const fast_xml_parser_1 = require("fast-xml-parser");
const http_1 = require("./http");
const storage_1 = require("./storage");
const files_1 = require("./files");
const legacy_1 = require("./legacy");
const storageRetention_1 = require("./storageRetention");
const storageOwnership_1 = require("./storageOwnership");
const types_1 = require("./types");
exports.PROVIDERS = ['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'];
const LIMIT = 10000;
function remoteName(name) {
    return typeof name === 'string' && (files_1.ARCHIVE_NAME.test(name) || legacy_1.LEGACY_NAME.test(name));
}
function providerName(value) {
    if (!exports.PROVIDERS.includes(value))
        throw (0, types_1.fail)('EOS_BACKUP_PROVIDER');
    return value;
}
function remoteEntry(name, id, size, mtime) {
    if (!remoteName(name) || typeof id !== 'string' || !id || id.length > 2048 || /[\x00-\x1f]/.test(id))
        return null;
    const bytes = Number(size), time = typeof mtime === 'number' ? mtime : Date.parse(String(mtime));
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 100 * 1024 ** 3 || !Number.isFinite(time) || time <= 0)
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_METADATA');
    return { name, id, size: bytes, mtime: time };
}
function rows(value) {
    if (!Array.isArray(value) || value.length > LIMIT || value.some(item => !(0, types_1.record)(item)))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_FORMAT');
    return value.filter(types_1.record);
}
function pageCount(result) {
    if (result.length > LIMIT)
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
}
function endpoint(value, host, prefix) {
    const url = new URL(value);
    if (url.protocol !== 'https:' ||
        url.hostname !== host ||
        url.username ||
        url.password ||
        url.port ||
        !url.pathname.startsWith(prefix))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_HOST');
    return url;
}
function graphDownloadUrl(value) {
    if (typeof value !== 'string' || value.length > 16384)
        throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_DOWNLOAD');
    const url = new URL(value);
    if (url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !['.1drv.com', '.files.1drv.com', '.sharepoint.com', '.sharepoint-df.com'].some(suffix => url.hostname.endsWith(suffix)))
        throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_DOWNLOAD_HOST');
    return url;
}
function webdavConfig(ctx) {
    const base = new URL((0, types_1.str)(ctx.config, 'webdavURL'));
    if (base.protocol !== 'https:' || base.username || base.password || base.hash || base.search)
        throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
    base.pathname = node_path_1.posix.join(base.pathname, (0, storage_1.remoteDir)(ctx.config, 'webdav', ctx.kind)) + '/';
    return {
        url: base,
        headers: {
            authorization: 'Basic ' +
                Buffer.from((0, types_1.str)(ctx.config, 'webdavUsername') + ':' + (0, types_1.str)(ctx.config, 'webdavPassword')).toString('base64'),
        },
    };
}
function davTarget(base, name) {
    if (!remoteName(name))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
    const url = new URL(base);
    url.pathname += name;
    return url;
}
function parseWebdavListing(xml, base) {
    if (Buffer.byteLength(xml) > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml))
        throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_XML');
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        processEntities: false,
        parseTagValue: false,
        trimValues: true,
    });
    const parsed = parser.parse(xml);
    if (!(0, types_1.record)(parsed) || !(0, types_1.record)(parsed.multistatus))
        throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_XML');
    const list = parsed.multistatus.response;
    const responses = list === undefined ? [] : Array.isArray(list) ? list : [list];
    if (responses.length > LIMIT)
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
    const result = [];
    const basePath = decodeURIComponent(base.pathname).replace(/\/$/, '');
    for (const response of responses) {
        if (!(0, types_1.record)(response) || typeof response.href !== 'string')
            throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_XML');
        const url = new URL(response.href.replaceAll('&amp;', '&'), base);
        if (url.origin !== base.origin || url.search || url.hash)
            continue;
        const pathname = decodeURIComponent(url.pathname);
        if (node_path_1.posix.dirname(pathname) !== basePath)
            continue;
        const name = node_path_1.posix.basename(pathname);
        const propstats = Array.isArray(response.propstat) ? response.propstat : [response.propstat];
        for (const p of propstats) {
            if (!(0, types_1.record)(p) ||
                typeof p.status !== 'string' ||
                !/^HTTP\/\d(?:\.\d)? 200\b/.test(p.status) ||
                !(0, types_1.record)(p.prop))
                continue;
            if ((0, types_1.record)(p.prop.resourcetype) && 'collection' in p.prop.resourcetype)
                continue;
            const item = remoteEntry(name, name, p.prop.getcontentlength, p.prop.getlastmodified);
            if (item)
                result.push(item);
        }
    }
    return result;
}
/** Create each missing collection; 405 alone is not proof that it is a directory. */
async function ensureWebdavDirectory(ctx) {
    const { url, headers } = webdavConfig(ctx);
    const segments = (0, storage_1.remoteDir)(ctx.config, 'webdav', ctx.kind).split('/').filter(Boolean);
    let pathname = new URL((0, types_1.str)(ctx.config, 'webdavURL')).pathname.replace(/\/$/, '');
    for (const part of segments) {
        pathname += '/' + part;
        const target = new URL(url);
        target.pathname = pathname + '/';
        const made = await (0, http_1.http)(target, 'MKCOL', headers);
        if (made.status === 201)
            continue;
        if (![405, 409].includes(made.status))
            throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_DIRECTORY');
        const check = await (0, http_1.http)(target, 'PROPFIND', { ...headers, depth: '0', 'content-type': 'application/xml' }, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>');
        const xml = check.body.toString('utf8');
        if (check.status !== 207 || /<!DOCTYPE|<!ENTITY/i.test(xml))
            throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_DIRECTORY');
        const parsed = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: true,
            removeNSPrefix: true,
            processEntities: false,
            parseTagValue: false,
        }).parse(xml);
        if (!(0, types_1.record)(parsed) || !(0, types_1.record)(parsed.multistatus))
            throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_DIRECTORY');
        const responses = Array.isArray(parsed.multistatus.response)
            ? parsed.multistatus.response
            : [parsed.multistatus.response];
        const collection = responses.some(response => (0, types_1.record)(response) &&
            (Array.isArray(response.propstat) ? response.propstat : [response.propstat]).some(p => (0, types_1.record)(p) &&
                typeof p.status === 'string' &&
                /^HTTP\/\d(?:\.\d)? 200\b/.test(p.status) &&
                (0, types_1.record)(p.prop) &&
                (0, types_1.record)(p.prop.resourcetype) &&
                'collection' in p.prop.resourcetype));
        if (!collection)
            throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_DIRECTORY');
    }
}
async function ftpClient(ctx) {
    const Ftp = require('ftp');
    const client = new Ftp();
    const dir = (0, storage_1.remoteDir)(ctx.config, 'ftp', ctx.kind) || '/';
    let fatal = null;
    const waiting = new Set();
    client.on('error', error => {
        fatal = error || (0, types_1.fail)('EOS_BACKUP_FTPS');
        for (const reject of waiting)
            reject(fatal);
    });
    client.on('end', () => {
        fatal = (0, types_1.fail)('EOS_BACKUP_FTPS_CLOSED');
        for (const reject of waiting)
            reject(fatal);
    });
    const call = (start) => new Promise((resolve, reject) => {
        if (fatal) {
            reject(fatal);
            return;
        }
        let done = false;
        const finish = (error, value) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            waiting.delete(abort);
            if (error)
                reject((0, types_1.fail)('EOS_BACKUP_FTPS'));
            else
                resolve(value);
        };
        const abort = (error) => finish(error);
        const timer = setTimeout(() => {
            finish((0, types_1.fail)('EOS_BACKUP_FTPS_TIMEOUT'));
            client.destroy();
        }, 5000);
        waiting.add(abort);
        try {
            start(finish);
        }
        catch {
            finish((0, types_1.fail)('EOS_BACKUP_FTPS'));
        }
    });
    await call(callback => {
        client.on('ready', () => callback(null));
        client.connect({
            host: (0, types_1.str)(ctx.config, 'ftpHost'),
            port: (0, types_1.num)(ctx.config, 'ftpPort', 21),
            user: (0, types_1.str)(ctx.config, 'ftpUser'),
            password: (0, types_1.str)(ctx.config, 'ftpPassword'),
            secure: true,
            secureOptions: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
            connTimeout: 5000,
            pasvTimeout: 5000,
            keepalive: 5000,
        });
    }).catch(error => {
        client.destroy();
        throw error;
    });
    return {
        async list() {
            const result = await call(callback => client.list(dir, callback));
            if (!Array.isArray(result) || result.length > LIMIT)
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
            return result
                .filter(v => v.type === '-')
                .map(v => remoteEntry(v.name, v.name, v.size, v.date instanceof Date ? v.date.getTime() : v.date))
                .filter((v) => v !== null);
        },
        async remove(entry) {
            if (!files_1.ARCHIVE_NAME.test(entry.name))
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
            await call(callback => client.delete(node_path_1.posix.join(dir, entry.name), error => callback(error || null)));
        },
        async download(entry) {
            if (!remoteName(entry.name))
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
            const stream = await call(callback => client.get(node_path_1.posix.join(dir, entry.name), callback));
            if (!stream)
                throw (0, types_1.fail)('EOS_BACKUP_FTPS_DOWNLOAD');
            return { stream };
        },
        close() {
            client.end();
            client.destroy();
        },
    };
}
async function openStorage(ctx, value) {
    const provider = providerName(value), c = ctx.config;
    if (!(0, types_1.flag)(c, provider + 'Enabled'))
        throw (0, types_1.fail)('EOS_BACKUP_PROVIDER_DISABLED');
    if (provider === 'ftp')
        return ftpClient(ctx);
    if (provider === 'cifs') {
        const dir = await (0, storage_1.mountedTarget)(c, ctx.kind);
        return {
            async list() {
                const files = await (0, promises_1.readdir)(dir, { withFileTypes: true });
                if (files.length > LIMIT)
                    throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
                const result = [];
                for (const file of files) {
                    if (!file.isFile() || file.isSymbolicLink() || !remoteName(file.name))
                        continue;
                    const s = await (0, promises_1.lstat)((0, node_path_1.join)(dir, file.name));
                    if (!s.isFile() || s.isSymbolicLink())
                        continue;
                    const entry = remoteEntry(file.name, file.name, s.size, s.mtimeMs);
                    if (entry)
                        result.push(entry);
                }
                return result;
            },
            async remove(entry) {
                if (!files_1.ARCHIVE_NAME.test(entry.name))
                    throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
                const file = (0, node_path_1.join)(dir, entry.name), s = await (0, promises_1.lstat)(file);
                if (!s.isFile() || s.isSymbolicLink())
                    throw (0, types_1.fail)('EOS_BACKUP_TARGET_SYMLINK');
                await (0, promises_1.rm)(file);
            },
            download(entry) {
                if (!remoteName(entry.name))
                    throw (0, types_1.fail)('EOS_BACKUP_REMOTE_NAME');
                return { localPath: (0, node_path_1.join)(dir, entry.name) };
            },
            close() { },
        };
    }
    if (provider === 'webdav') {
        const { url, headers } = webdavConfig(ctx);
        return {
            async list() {
                const response = await (0, http_1.http)(url, 'PROPFIND', { ...headers, depth: '1', 'content-type': 'application/xml' }, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>');
                if (response.status !== 207)
                    throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_LIST');
                return parseWebdavListing(response.body.toString('utf8'), url);
            },
            async remove(entry) {
                const response = await (0, http_1.http)(davTarget(url, entry.name), 'DELETE', headers);
                if (![200, 204].includes(response.status))
                    throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_DELETE');
            },
            download(entry) {
                return { url: davTarget(url, entry.name), headers };
            },
            close() { },
        };
    }
    if (provider === 'dropbox') {
        const token = await (0, storage_1.dropboxToken)(c, ctx), headers = { authorization: 'Bearer ' + token }, dir = node_path_1.posix.join('/', (0, storage_1.remoteDir)(c, 'dropbox', ctx.kind)).replace(/\/$/, '');
        return {
            async list() {
                const result = [];
                let page = await (0, http_1.json)('https://api.dropboxapi.com/2/files/list_folder', 'POST', headers, {
                    path: dir === '/' ? '' : dir,
                    recursive: false,
                    limit: 2000,
                });
                const cursors = new Set();
                for (let i = 0; i < 100; i++) {
                    for (const item of rows(page.entries)) {
                        if (item['.tag'] !== 'file')
                            continue;
                        const entry = remoteEntry(item.name, item.id, item.size, item.client_modified);
                        if (entry)
                            result.push(entry);
                    }
                    pageCount(result);
                    if (page.has_more !== true)
                        return result;
                    const cursor = (0, types_1.str)(page, 'cursor');
                    if (!cursor || cursors.has(cursor))
                        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_CURSOR');
                    cursors.add(cursor);
                    page = await (0, http_1.json)('https://api.dropboxapi.com/2/files/list_folder/continue', 'POST', headers, {
                        cursor,
                    });
                }
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
            },
            async remove(entry) {
                await (0, http_1.json)('https://api.dropboxapi.com/2/files/delete_v2', 'POST', headers, { path: entry.id });
            },
            download(entry) {
                return {
                    url: new URL('https://content.dropboxapi.com/2/files/download'),
                    headers: { ...headers, 'Dropbox-API-Arg': JSON.stringify({ path: entry.id }) },
                    method: 'POST',
                };
            },
            close() { },
        };
    }
    if (provider === 'googledrive') {
        const token = await (0, storage_1.googleToken)(c, ctx), headers = { authorization: 'Bearer ' + token };
        let parent = 'root';
        for (const part of (0, storage_1.remoteDir)(c, 'googledrive', ctx.kind).split('/').filter(Boolean)) {
            const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${part.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}' and '${parent}' in parents and trashed = false`;
            const found = await (0, http_1.json)('https://www.googleapis.com/drive/v3/files?fields=files(id),nextPageToken&pageSize=2&q=' +
                encodeURIComponent(q), 'GET', headers);
            const files = rows(found.files);
            if (files.length !== 1 || found.nextPageToken)
                throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_FOLDER_AMBIGUOUS');
            parent = (0, types_1.str)(files[0] || {}, 'id');
            if (!/^[\w-]{1,200}$/.test(parent))
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_ID');
        }
        return {
            async list() {
                const entries = [];
                let cursor = '';
                const seen = new Set();
                for (let i = 0; i < 100; i++) {
                    const params = new URLSearchParams({
                        fields: 'files(id,name,size,modifiedTime,mimeType),nextPageToken',
                        pageSize: '1000',
                        q: `'${parent}' in parents and trashed = false`,
                    });
                    if (cursor)
                        params.set('pageToken', cursor);
                    const page = await (0, http_1.json)('https://www.googleapis.com/drive/v3/files?' + params.toString(), 'GET', headers);
                    for (const item of rows(page.files)) {
                        if (item.mimeType === 'application/vnd.google-apps.folder')
                            continue;
                        const entry = remoteEntry(item.name, item.id, item.size, item.modifiedTime);
                        if (entry)
                            entries.push(entry);
                    }
                    pageCount(entries);
                    cursor = (0, types_1.str)(page, 'nextPageToken');
                    if (!cursor)
                        return entries;
                    if (seen.has(cursor) || cursor.length > 4096)
                        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_CURSOR');
                    seen.add(cursor);
                }
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
            },
            async remove(entry) {
                const response = await (0, http_1.http)(new URL('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(entry.id)), 'DELETE', headers);
                if (response.status !== 204)
                    throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_DELETE');
            },
            download(entry) {
                return {
                    url: new URL('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(entry.id) + '?alt=media'),
                    headers,
                };
            },
            close() { },
        };
    }
    const token = await (0, storage_1.oneDriveToken)(c, ctx), headers = { authorization: 'Bearer ' + token };
    const dir = (0, storage_1.remoteDir)(c, 'onedrive', ctx.kind).split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const listUrl = 'https://graph.microsoft.com/v1.0/me/drive/' +
        (dir ? 'root:/' + dir + ':' : 'root') +
        '/children?$select=id,name,size,lastModifiedDateTime,file&$top=1000';
    return {
        async list() {
            const entries = [];
            let url = listUrl;
            const seen = new Set();
            for (let i = 0; i < 100; i++) {
                const page = await (0, http_1.json)(endpoint(url, 'graph.microsoft.com', '/v1.0/me/drive/').href, 'GET', headers);
                for (const item of rows(page.value)) {
                    if (!(0, types_1.record)(item.file))
                        continue;
                    const entry = remoteEntry(item.name, item.id, item.size, item.lastModifiedDateTime);
                    if (entry)
                        entries.push(entry);
                }
                pageCount(entries);
                url = (0, types_1.str)(page, '@odata.nextLink');
                if (!url)
                    return entries;
                if (seen.has(url) || url.length > 16384)
                    throw (0, types_1.fail)('EOS_BACKUP_REMOTE_CURSOR');
                seen.add(url);
            }
            throw (0, types_1.fail)('EOS_BACKUP_REMOTE_COUNT');
        },
        async remove(entry) {
            const response = await (0, http_1.http)(new URL('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(entry.id)), 'DELETE', headers);
            if (response.status !== 204)
                throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_DELETE');
        },
        async download(entry) {
            const item = await (0, http_1.json)('https://graph.microsoft.com/v1.0/me/drive/items/' +
                encodeURIComponent(entry.id) +
                '?$select=id,name,size,@microsoft.graph.downloadUrl', 'GET', headers);
            if (item.id !== entry.id || item.name !== entry.name || Number(item.size) !== entry.size)
                throw (0, types_1.fail)('EOS_BACKUP_REMOTE_CHANGED');
            return { url: graphDownloadUrl(item['@microsoft.graph.downloadUrl']) };
        },
        close() { },
    };
}
async function pruneRemoteArchives(ctx, currentNames) {
    for (const provider of exports.PROVIDERS) {
        if (!(0, types_1.flag)(ctx.config, provider + 'Enabled'))
            continue;
        const owned = await (0, storageOwnership_1.ownedArchives)(ctx, provider);
        for (const name of currentNames)
            owned.add(name);
        await (0, storageOwnership_1.saveOwnedArchives)(ctx, provider, owned);
        if (ctx.retentionEnabled === false || !(0, types_1.flag)(ctx.config, provider + 'DeleteOldBackup'))
            continue;
        const client = await openStorage(ctx, provider);
        try {
            const entries = await client.list();
            const eligible = entries.filter(entry => owned.has(entry.name));
            for (const entry of (0, storageRetention_1.retentionCandidates)(ctx.config, provider, ctx.kind, eligible, currentNames, true)) {
                await client.remove(entry);
                owned.delete(entry.name);
            }
            await (0, storageOwnership_1.saveOwnedArchives)(ctx, provider, owned);
        }
        finally {
            client.close();
        }
    }
}
