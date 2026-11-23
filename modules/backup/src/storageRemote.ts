/** Copyright (c) 2026 NexoWatt. Proprietary. Bounded remote archive inventory. */
import { lstat, readdir, rm } from 'node:fs/promises';
import { join, posix } from 'node:path';
import type { Readable } from 'node:stream';
import { XMLParser } from 'fast-xml-parser';
import { http, json } from './http';
import { remoteDir, mountedTarget, googleToken, oneDriveToken, dropboxToken } from './storage';
import { ARCHIVE_NAME } from './files';
import { LEGACY_NAME } from './legacy';
import { retentionCandidates, type RemoteEntry } from './storageRetention';
import { ownedArchives, saveOwnedArchives } from './storageOwnership';
import { flag, str, num, record, fail, type JobContext } from './types';
export const PROVIDERS = ['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'] as const;
export type Provider = (typeof PROVIDERS)[number];
export interface RemoteDownload {
    url?: URL;
    headers?: Record<string, string>;
    method?: string;
    localPath?: string;
    stream?: Readable;
}
export interface StorageClient {
    list(): Promise<RemoteEntry[]>;
    remove(entry: RemoteEntry): Promise<void>;
    download(entry: RemoteEntry): Promise<RemoteDownload> | RemoteDownload;
    close(): void;
}
const LIMIT = 10000;
export function remoteName(name: unknown): name is string {
    return typeof name === 'string' && (ARCHIVE_NAME.test(name) || LEGACY_NAME.test(name));
}
export function providerName(value: string): Provider {
    if (!(PROVIDERS as readonly string[]).includes(value)) throw fail('EOS_BACKUP_PROVIDER');
    return value as Provider;
}
function remoteEntry(name: unknown, id: unknown, size: unknown, mtime: unknown): RemoteEntry | null {
    if (!remoteName(name) || typeof id !== 'string' || !id || id.length > 2048 || /[\x00-\x1f]/.test(id)) return null;
    const bytes = Number(size),
        time = typeof mtime === 'number' ? mtime : Date.parse(String(mtime));
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 100 * 1024 ** 3 || !Number.isFinite(time) || time <= 0)
        throw fail('EOS_BACKUP_REMOTE_METADATA');
    return { name, id, size: bytes, mtime: time };
}
function rows(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value) || value.length > LIMIT || value.some(item => !record(item)))
        throw fail('EOS_BACKUP_REMOTE_FORMAT');
    return value.filter(record);
}
function pageCount(result: RemoteEntry[]): void {
    if (result.length > LIMIT) throw fail('EOS_BACKUP_REMOTE_COUNT');
}
function endpoint(value: string, host: string, prefix: string): URL {
    const url = new URL(value);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== host ||
        url.username ||
        url.password ||
        url.port ||
        !url.pathname.startsWith(prefix)
    )
        throw fail('EOS_BACKUP_REMOTE_HOST');
    return url;
}
export function graphDownloadUrl(value: unknown): URL {
    if (typeof value !== 'string' || value.length > 16384) throw fail('EOS_BACKUP_ONEDRIVE_DOWNLOAD');
    const url = new URL(value);
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !['.1drv.com', '.files.1drv.com', '.sharepoint.com', '.sharepoint-df.com'].some(suffix =>
            url.hostname.endsWith(suffix),
        )
    )
        throw fail('EOS_BACKUP_ONEDRIVE_DOWNLOAD_HOST');
    return url;
}
function webdavConfig(ctx: JobContext): { url: URL; headers: Record<string, string> } {
    const base = new URL(str(ctx.config, 'webdavURL'));
    if (base.protocol !== 'https:' || base.username || base.password || base.hash || base.search)
        throw fail('EOS_BACKUP_TLS_REQUIRED');
    base.pathname = posix.join(base.pathname, remoteDir(ctx.config, 'webdav', ctx.kind)) + '/';
    return {
        url: base,
        headers: {
            authorization:
                'Basic ' +
                Buffer.from(str(ctx.config, 'webdavUsername') + ':' + str(ctx.config, 'webdavPassword')).toString(
                    'base64',
                ),
        },
    };
}
function davTarget(base: URL, name: string): URL {
    if (!remoteName(name)) throw fail('EOS_BACKUP_REMOTE_NAME');
    const url = new URL(base);
    url.pathname += name;
    return url;
}
export function parseWebdavListing(xml: string, base: URL): RemoteEntry[] {
    if (Buffer.byteLength(xml) > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw fail('EOS_BACKUP_WEBDAV_XML');
    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        processEntities: false,
        parseTagValue: false,
        trimValues: true,
    });
    const parsed: unknown = parser.parse(xml);
    if (!record(parsed) || !record(parsed.multistatus)) throw fail('EOS_BACKUP_WEBDAV_XML');
    const list = parsed.multistatus.response;
    const responses = list === undefined ? [] : Array.isArray(list) ? list : [list];
    if (responses.length > LIMIT) throw fail('EOS_BACKUP_REMOTE_COUNT');
    const result: RemoteEntry[] = [];
    const basePath = decodeURIComponent(base.pathname).replace(/\/$/, '');
    for (const response of responses) {
        if (!record(response) || typeof response.href !== 'string') throw fail('EOS_BACKUP_WEBDAV_XML');
        const url = new URL(response.href.replaceAll('&amp;', '&'), base);
        if (url.origin !== base.origin || url.search || url.hash) continue;
        const pathname = decodeURIComponent(url.pathname);
        if (posix.dirname(pathname) !== basePath) continue;
        const name = posix.basename(pathname);
        const propstats = Array.isArray(response.propstat) ? response.propstat : [response.propstat];
        for (const p of propstats) {
            if (
                !record(p) ||
                typeof p.status !== 'string' ||
                !/^HTTP\/\d(?:\.\d)? 200\b/.test(p.status) ||
                !record(p.prop)
            )
                continue;
            if (record(p.prop.resourcetype) && 'collection' in p.prop.resourcetype) continue;
            const item = remoteEntry(name, name, p.prop.getcontentlength, p.prop.getlastmodified);
            if (item) result.push(item);
        }
    }
    return result;
}
/** Create each missing collection; 405 alone is not proof that it is a directory. */
export async function ensureWebdavDirectory(ctx: JobContext): Promise<void> {
    const { url, headers } = webdavConfig(ctx);
    const segments = remoteDir(ctx.config, 'webdav', ctx.kind).split('/').filter(Boolean);
    let pathname = new URL(str(ctx.config, 'webdavURL')).pathname.replace(/\/$/, '');
    for (const part of segments) {
        pathname += '/' + part;
        const target = new URL(url);
        target.pathname = pathname + '/';
        const made = await http(target, 'MKCOL', headers);
        if (made.status === 201) continue;
        if (![405, 409].includes(made.status)) throw fail('EOS_BACKUP_WEBDAV_DIRECTORY');
        const check = await http(
            target,
            'PROPFIND',
            { ...headers, depth: '0', 'content-type': 'application/xml' },
            '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
        );
        const xml = check.body.toString('utf8');
        if (check.status !== 207 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw fail('EOS_BACKUP_WEBDAV_DIRECTORY');
        const parsed: unknown = new XMLParser({
            ignoreAttributes: true,
            removeNSPrefix: true,
            processEntities: false,
            parseTagValue: false,
        }).parse(xml);
        if (!record(parsed) || !record(parsed.multistatus)) throw fail('EOS_BACKUP_WEBDAV_DIRECTORY');
        const responses = Array.isArray(parsed.multistatus.response)
            ? parsed.multistatus.response
            : [parsed.multistatus.response];
        const collection = responses.some(
            response =>
                record(response) &&
                (Array.isArray(response.propstat) ? response.propstat : [response.propstat]).some(
                    p =>
                        record(p) &&
                        typeof p.status === 'string' &&
                        /^HTTP\/\d(?:\.\d)? 200\b/.test(p.status) &&
                        record(p.prop) &&
                        record(p.prop.resourcetype) &&
                        'collection' in p.prop.resourcetype,
                ),
        );
        if (!collection) throw fail('EOS_BACKUP_WEBDAV_DIRECTORY');
    }
}
interface FtpListing {
    name?: unknown;
    size?: unknown;
    date?: unknown;
    type?: unknown;
}
interface FtpClient {
    on(event: string, callback: (error?: Error) => void): void;
    connect(options: Record<string, unknown>): void;
    end(): void;
    destroy(): void;
    list(path: string, callback: (error: Error | null, list?: FtpListing[]) => void): void;
    delete(path: string, callback: (error?: Error) => void): void;
    get(path: string, callback: (error: Error | null, stream?: Readable) => void): void;
}
async function ftpClient(ctx: JobContext): Promise<StorageClient> {
    const Ftp = require('ftp') as new () => FtpClient;
    const client = new Ftp();
    const dir = remoteDir(ctx.config, 'ftp', ctx.kind) || '/';
    let fatal: Error | null = null;
    const waiting = new Set<(error: Error) => void>();
    client.on('error', error => {
        fatal = error || fail('EOS_BACKUP_FTPS');
        for (const reject of waiting) reject(fatal);
    });
    client.on('end', () => {
        fatal = fail('EOS_BACKUP_FTPS_CLOSED');
        for (const reject of waiting) reject(fatal);
    });
    const call = <T>(start: (callback: (error: Error | null, value?: T) => void) => void): Promise<T> =>
        new Promise((resolve, reject) => {
            if (fatal) {
                reject(fatal);
                return;
            }
            let done = false;
            const finish = (error: Error | null, value?: T): void => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                waiting.delete(abort);
                if (error) reject(fail('EOS_BACKUP_FTPS'));
                else resolve(value as T);
            };
            const abort = (error: Error): void => finish(error);
            const timer = setTimeout(() => {
                finish(fail('EOS_BACKUP_FTPS_TIMEOUT'));
                client.destroy();
            }, 5000);
            waiting.add(abort);
            try {
                start(finish);
            } catch {
                finish(fail('EOS_BACKUP_FTPS'));
            }
        });
    await call<void>(callback => {
        client.on('ready', () => callback(null));
        client.connect({
            host: str(ctx.config, 'ftpHost'),
            port: num(ctx.config, 'ftpPort', 21),
            user: str(ctx.config, 'ftpUser'),
            password: str(ctx.config, 'ftpPassword'),
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
            const result = await call<FtpListing[]>(callback => client.list(dir, callback));
            if (!Array.isArray(result) || result.length > LIMIT) throw fail('EOS_BACKUP_REMOTE_COUNT');
            return result
                .filter(v => v.type === '-')
                .map(v => remoteEntry(v.name, v.name, v.size, v.date instanceof Date ? v.date.getTime() : v.date))
                .filter((v): v is RemoteEntry => v !== null);
        },
        async remove(entry) {
            if (!ARCHIVE_NAME.test(entry.name)) throw fail('EOS_BACKUP_REMOTE_NAME');
            await call<void>(callback => client.delete(posix.join(dir, entry.name), error => callback(error || null)));
        },
        async download(entry) {
            if (!remoteName(entry.name)) throw fail('EOS_BACKUP_REMOTE_NAME');
            const stream = await call<Readable>(callback => client.get(posix.join(dir, entry.name), callback));
            if (!stream) throw fail('EOS_BACKUP_FTPS_DOWNLOAD');
            return { stream };
        },
        close() {
            client.end();
            client.destroy();
        },
    };
}
export async function openStorage(ctx: JobContext, value: string): Promise<StorageClient> {
    const provider = providerName(value),
        c = ctx.config;
    if (!flag(c, provider + 'Enabled')) throw fail('EOS_BACKUP_PROVIDER_DISABLED');
    if (provider === 'ftp') return ftpClient(ctx);
    if (provider === 'cifs') {
        const dir = await mountedTarget(c, ctx.kind);
        return {
            async list() {
                const files = await readdir(dir, { withFileTypes: true });
                if (files.length > LIMIT) throw fail('EOS_BACKUP_REMOTE_COUNT');
                const result: RemoteEntry[] = [];
                for (const file of files) {
                    if (!file.isFile() || file.isSymbolicLink() || !remoteName(file.name)) continue;
                    const s = await lstat(join(dir, file.name));
                    if (!s.isFile() || s.isSymbolicLink()) continue;
                    const entry = remoteEntry(file.name, file.name, s.size, s.mtimeMs);
                    if (entry) result.push(entry);
                }
                return result;
            },
            async remove(entry) {
                if (!ARCHIVE_NAME.test(entry.name)) throw fail('EOS_BACKUP_REMOTE_NAME');
                const file = join(dir, entry.name),
                    s = await lstat(file);
                if (!s.isFile() || s.isSymbolicLink()) throw fail('EOS_BACKUP_TARGET_SYMLINK');
                await rm(file);
            },
            download(entry) {
                if (!remoteName(entry.name)) throw fail('EOS_BACKUP_REMOTE_NAME');
                return { localPath: join(dir, entry.name) };
            },
            close() {},
        };
    }
    if (provider === 'webdav') {
        const { url, headers } = webdavConfig(ctx);
        return {
            async list() {
                const response = await http(
                    url,
                    'PROPFIND',
                    { ...headers, depth: '1', 'content-type': 'application/xml' },
                    '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>',
                );
                if (response.status !== 207) throw fail('EOS_BACKUP_WEBDAV_LIST');
                return parseWebdavListing(response.body.toString('utf8'), url);
            },
            async remove(entry) {
                const response = await http(davTarget(url, entry.name), 'DELETE', headers);
                if (![200, 204].includes(response.status)) throw fail('EOS_BACKUP_WEBDAV_DELETE');
            },
            download(entry) {
                return { url: davTarget(url, entry.name), headers };
            },
            close() {},
        };
    }
    if (provider === 'dropbox') {
        const token = await dropboxToken(c, ctx),
            headers = { authorization: 'Bearer ' + token },
            dir = posix.join('/', remoteDir(c, 'dropbox', ctx.kind)).replace(/\/$/, '');
        return {
            async list() {
                const result: RemoteEntry[] = [];
                let page = await json('https://api.dropboxapi.com/2/files/list_folder', 'POST', headers, {
                    path: dir === '/' ? '' : dir,
                    recursive: false,
                    limit: 2000,
                });
                const cursors = new Set<string>();
                for (let i = 0; i < 100; i++) {
                    for (const item of rows(page.entries)) {
                        if (item['.tag'] !== 'file') continue;
                        const entry = remoteEntry(item.name, item.id, item.size, item.client_modified);
                        if (entry) result.push(entry);
                    }
                    pageCount(result);
                    if (page.has_more !== true) return result;
                    const cursor = str(page, 'cursor');
                    if (!cursor || cursors.has(cursor)) throw fail('EOS_BACKUP_REMOTE_CURSOR');
                    cursors.add(cursor);
                    page = await json('https://api.dropboxapi.com/2/files/list_folder/continue', 'POST', headers, {
                        cursor,
                    });
                }
                throw fail('EOS_BACKUP_REMOTE_COUNT');
            },
            async remove(entry) {
                await json('https://api.dropboxapi.com/2/files/delete_v2', 'POST', headers, { path: entry.id });
            },
            download(entry) {
                return {
                    url: new URL('https://content.dropboxapi.com/2/files/download'),
                    headers: { ...headers, 'Dropbox-API-Arg': JSON.stringify({ path: entry.id }) },
                    method: 'POST',
                };
            },
            close() {},
        };
    }
    if (provider === 'googledrive') {
        const token = await googleToken(c, ctx),
            headers = { authorization: 'Bearer ' + token };
        let parent = 'root';
        for (const part of remoteDir(c, 'googledrive', ctx.kind).split('/').filter(Boolean)) {
            const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${part.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}' and '${parent}' in parents and trashed = false`;
            const found = await json(
                'https://www.googleapis.com/drive/v3/files?fields=files(id),nextPageToken&pageSize=2&q=' +
                    encodeURIComponent(q),
                'GET',
                headers,
            );
            const files = rows(found.files);
            if (files.length !== 1 || found.nextPageToken) throw fail('EOS_BACKUP_GOOGLE_FOLDER_AMBIGUOUS');
            parent = str(files[0] || {}, 'id');
            if (!/^[\w-]{1,200}$/.test(parent)) throw fail('EOS_BACKUP_REMOTE_ID');
        }
        return {
            async list() {
                const entries: RemoteEntry[] = [];
                let cursor = '';
                const seen = new Set<string>();
                for (let i = 0; i < 100; i++) {
                    const params = new URLSearchParams({
                        fields: 'files(id,name,size,modifiedTime,mimeType),nextPageToken',
                        pageSize: '1000',
                        q: `'${parent}' in parents and trashed = false`,
                    });
                    if (cursor) params.set('pageToken', cursor);
                    const page = await json(
                        'https://www.googleapis.com/drive/v3/files?' + params.toString(),
                        'GET',
                        headers,
                    );
                    for (const item of rows(page.files)) {
                        if (item.mimeType === 'application/vnd.google-apps.folder') continue;
                        const entry = remoteEntry(item.name, item.id, item.size, item.modifiedTime);
                        if (entry) entries.push(entry);
                    }
                    pageCount(entries);
                    cursor = str(page, 'nextPageToken');
                    if (!cursor) return entries;
                    if (seen.has(cursor) || cursor.length > 4096) throw fail('EOS_BACKUP_REMOTE_CURSOR');
                    seen.add(cursor);
                }
                throw fail('EOS_BACKUP_REMOTE_COUNT');
            },
            async remove(entry) {
                const response = await http(
                    new URL('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(entry.id)),
                    'DELETE',
                    headers,
                );
                if (response.status !== 204) throw fail('EOS_BACKUP_GOOGLE_DELETE');
            },
            download(entry) {
                return {
                    url: new URL(
                        'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(entry.id) + '?alt=media',
                    ),
                    headers,
                };
            },
            close() {},
        };
    }
    const token = await oneDriveToken(c, ctx),
        headers = { authorization: 'Bearer ' + token };
    const dir = remoteDir(c, 'onedrive', ctx.kind).split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const listUrl =
        'https://graph.microsoft.com/v1.0/me/drive/' +
        (dir ? 'root:/' + dir + ':' : 'root') +
        '/children?$select=id,name,size,lastModifiedDateTime,file&$top=1000';
    return {
        async list() {
            const entries: RemoteEntry[] = [];
            let url = listUrl;
            const seen = new Set<string>();
            for (let i = 0; i < 100; i++) {
                const page = await json(endpoint(url, 'graph.microsoft.com', '/v1.0/me/drive/').href, 'GET', headers);
                for (const item of rows(page.value)) {
                    if (!record(item.file)) continue;
                    const entry = remoteEntry(item.name, item.id, item.size, item.lastModifiedDateTime);
                    if (entry) entries.push(entry);
                }
                pageCount(entries);
                url = str(page, '@odata.nextLink');
                if (!url) return entries;
                if (seen.has(url) || url.length > 16384) throw fail('EOS_BACKUP_REMOTE_CURSOR');
                seen.add(url);
            }
            throw fail('EOS_BACKUP_REMOTE_COUNT');
        },
        async remove(entry) {
            const response = await http(
                new URL('https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(entry.id)),
                'DELETE',
                headers,
            );
            if (response.status !== 204) throw fail('EOS_BACKUP_ONEDRIVE_DELETE');
        },
        async download(entry) {
            const item = await json(
                'https://graph.microsoft.com/v1.0/me/drive/items/' +
                    encodeURIComponent(entry.id) +
                    '?$select=id,name,size,@microsoft.graph.downloadUrl',
                'GET',
                headers,
            );
            if (item.id !== entry.id || item.name !== entry.name || Number(item.size) !== entry.size)
                throw fail('EOS_BACKUP_REMOTE_CHANGED');
            return { url: graphDownloadUrl(item['@microsoft.graph.downloadUrl']) };
        },
        close() {},
    };
}
export async function pruneRemoteArchives(ctx: JobContext, currentNames: string[]): Promise<void> {
    for (const provider of PROVIDERS) {
        if (!flag(ctx.config, provider + 'Enabled')) continue;
        const owned = await ownedArchives(ctx, provider);
        for (const name of currentNames) owned.add(name);
        await saveOwnedArchives(ctx, provider, owned);
        if (ctx.retentionEnabled === false || !flag(ctx.config, provider + 'DeleteOldBackup')) continue;
        const client = await openStorage(ctx, provider);
        try {
            const entries = await client.list();
            const eligible = entries.filter(entry => owned.has(entry.name));
            for (const entry of retentionCandidates(ctx.config, provider, ctx.kind, eligible, currentNames, true)) {
                await client.remove(entry);
                owned.delete(entry.name);
            }
            await saveOwnedArchives(ctx, provider, owned);
        } finally {
            client.close();
        }
    }
}
