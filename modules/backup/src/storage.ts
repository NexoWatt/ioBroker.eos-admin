/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { createReadStream } from 'node:fs';
import { lstat, stat, realpath } from 'node:fs/promises';
import { basename, join, posix } from 'node:path';
import { copyPrivate, ARCHIVE_NAME } from './files';
import { http, json } from './http';
import { cachedToken, saveToken } from './tokenCache';
import { flag, str, num, record, fail, type JobContext, type Config } from './types';
import { safeSourcePath } from './config';
interface FtpClient {
    on(name: string, callback: (error?: Error) => void): void;
    connect(config: Record<string, unknown>): void;
    put(source: string, path: string, callback: (error?: Error) => void): void;
    mkdir(path: string, recursive: boolean, callback: (error?: Error) => void): void;
    end(): void;
    destroy(): void;
}
export function remoteDir(c: Config, name: string, kind: string): string {
    const value = flag(c, name + 'OwnDir')
        ? str(c, name + (kind === 'ccu' ? 'CcuDir' : 'MinimalDir'))
        : str(c, name + 'Dir');
    if (value.includes('%') || /[\x00-\x1f\x7f\\]/.test(value) || value.split('/').includes('..'))
        throw fail('EOS_BACKUP_REMOTE_PATH');
    return value.replace(/\/$/, '');
}
function tokenJson(value: string): Record<string, unknown> {
    let data: unknown;
    try {
        data = JSON.parse(value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8'));
    } catch {
        throw fail('EOS_BACKUP_OAUTH_CONFIG');
    }
    if (!record(data)) throw fail('EOS_BACKUP_OAUTH_CONFIG');
    return data;
}
export async function mountedTarget(c: Config, kind = 'iobroker'): Promise<string> {
    let path: string;
    if (str(c, 'connectType') === 'SDCard') {
        const sd = require('../upstream/build/lib/sdCard.js') as {
            validateSdCardTarget: (
                mount: string,
                sub: string,
                options?: Record<string, unknown>,
            ) => Promise<{ backupDir: string }>;
        };
        const target = await sd.validateSdCardTarget(
            str(c, 'sdCardMountPath'),
            str(c, 'sdCardBackupSubDir', 'nexowatt-eos-backups'),
        );
        path = target.backupDir;
    } else
        path =
            str(c, 'connectType') === 'Copy' && flag(c, 'cifsOwnDir')
                ? remoteDir(c, 'cifs', kind)
                : str(c, 'mountedBackupPath', str(c, 'cifsDir'));
    const full = safeSourcePath(path),
        actual = await realpath(full);
    if (actual !== full) throw fail('EOS_BACKUP_TARGET_SYMLINK');
    const s = await lstat(full);
    if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o002) !== 0) throw fail('EOS_BACKUP_TARGET_PERMISSIONS');
    return full;
}
async function webdavUpload(c: Config, file: string, dir: string): Promise<void> {
    const base = new URL(str(c, 'webdavURL'));
    const target = new URL(base);
    target.pathname = posix.join(base.pathname, dir, basename(file));
    const auth = 'Basic ' + Buffer.from(str(c, 'webdavUsername') + ':' + str(c, 'webdavPassword')).toString('base64');
    const result = await http(
        target,
        'PUT',
        {
            authorization: auth,
            'content-type': 'application/octet-stream',
            'content-length': String((await stat(file)).size),
        },
        createReadStream(file),
        30 * 60 * 1000,
    );
    if (result.status < 200 || result.status >= 300) throw fail('EOS_BACKUP_WEBDAV_UPLOAD');
}
export async function ftpUpload(c: Config, files: string[], dir: string): Promise<void> {
    const Ftp = require('ftp') as new () => FtpClient;
    const client = new Ftp();
    let failed: Error | undefined;
    let pending: ((error: Error) => void) | undefined;
    client.on('error', () => {
        failed = fail('EOS_BACKUP_FTPS_UPLOAD');
        pending?.(failed);
    });
    client.on('end', () => {
        failed = fail('EOS_BACKUP_FTPS_CLOSED');
        pending?.(failed);
    });
    const operation = (start: (done: (error?: Error) => void) => void, timeout = 5000): Promise<void> =>
        new Promise((resolve, reject) => {
            if (failed) {
                reject(failed);
                return;
            }
            let settled = false;
            const done = (error?: Error): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                pending = undefined;
                if (error) reject(fail('EOS_BACKUP_FTPS_UPLOAD'));
                else resolve();
            };
            pending = done;
            const timer = setTimeout(() => {
                done(fail('EOS_BACKUP_FTPS_TIMEOUT'));
                client.destroy();
            }, timeout);
            try {
                start(done);
            } catch {
                done(fail('EOS_BACKUP_FTPS_UPLOAD'));
            }
        });
    try {
        await operation(done => {
            client.on('ready', () => done());
            client.connect({
                host: str(c, 'ftpHost'),
                port: num(c, 'ftpPort', 21),
                user: str(c, 'ftpUser'),
                password: str(c, 'ftpPassword'),
                secure: true,
                secureOptions: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
                connTimeout: 5000,
                pasvTimeout: 5000,
                keepalive: 5000,
            });
        });
        if (dir && dir !== '/') await operation(done => client.mkdir(dir, true, done));
        for (const file of files)
            await operation(done => client.put(file, posix.join(dir, basename(file)), done), 30 * 60 * 1000);
    } finally {
        pending = undefined;
        client.end();
        client.destroy();
    }
}
export async function googleToken(c: Config, ctx: JobContext): Promise<string> {
    const original = str(c, 'googledriveAccessTokens') || str(c, 'googledriveAccessJson');
    const credentials = tokenJson(await cachedToken(ctx, 'google', original));
    if (
        typeof credentials.access_token === 'string' &&
        num(credentials, 'expiry_date', Date.parse(str(credentials, 'access_token_expires_on'))) > Date.now() + 60000
    )
        return credentials.access_token;
    // Existing 1.0.10 installations use this configured provider's OAuth relay. No new registration is performed.
    const fresh = await json(
        str(c, 'googledriveAccessTokens')
            ? 'https://googleauth.iobroker.in/googleDriveOAuth'
            : 'https://googleauth.iobroker.in/',
        'POST',
        {},
        credentials,
    );
    if (typeof fresh.access_token !== 'string') throw fail('EOS_BACKUP_GOOGLE_TOKEN');
    await saveToken(ctx, 'google', original, {
        ...credentials,
        ...fresh,
        refresh_token: str(fresh, 'refresh_token') || str(credentials, 'refresh_token'),
        expiry_date: num(fresh, 'expiry_date', Date.now() + num(fresh, 'expires_in', 3600) * 1000),
    });
    return fresh.access_token;
}
async function googleUpload(c: Config, files: string[], dir: string, ctx: JobContext): Promise<void> {
    const token = await googleToken(c, ctx),
        headers = { authorization: 'Bearer ' + token };
    let parent = 'root';
    for (const part of dir.split('/').filter(Boolean)) {
        const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${part.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}' and '${parent}' in parents and trashed = false`;
        const found = await json(
            'https://www.googleapis.com/drive/v3/files?fields=files(id)&pageSize=2&q=' + encodeURIComponent(q),
            'GET',
            headers,
        );
        const rows = Array.isArray(found.files) ? found.files : [];
        if (rows.length > 1) throw fail('EOS_BACKUP_GOOGLE_FOLDER_AMBIGUOUS');
        if (rows.length === 1 && record(rows[0]) && typeof rows[0].id === 'string') parent = rows[0].id;
        else {
            const made = await json('https://www.googleapis.com/drive/v3/files', 'POST', headers, {
                name: part,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parent],
            });
            if (typeof made.id !== 'string') throw fail('EOS_BACKUP_GOOGLE_FOLDER');
            parent = made.id;
        }
    }
    for (const file of files) {
        const size = (await stat(file)).size;
        const init = await http(
            new URL('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'),
            'POST',
            {
                ...headers,
                'content-type': 'application/json',
                'x-upload-content-type': 'application/octet-stream',
                'x-upload-content-length': String(size),
            },
            JSON.stringify({ name: basename(file), parents: [parent] }),
        );
        if (init.status < 200 || init.status >= 300 || typeof init.headers.location !== 'string')
            throw fail('EOS_BACKUP_GOOGLE_UPLOAD');
        const target = new URL(init.headers.location);
        if (
            target.protocol !== 'https:' ||
            target.hostname !== 'www.googleapis.com' ||
            !!target.username ||
            !!target.password ||
            !!target.port
        )
            throw fail('EOS_BACKUP_GOOGLE_UPLOAD_HOST');
        const result = await http(
            target,
            'PUT',
            { 'content-length': String(size), 'content-type': 'application/octet-stream' },
            createReadStream(file),
            30 * 60 * 1000,
        );
        if (result.status < 200 || result.status >= 300) throw fail('EOS_BACKUP_GOOGLE_UPLOAD');
    }
}
export async function oneDriveToken(c: Config, ctx: JobContext): Promise<string> {
    const original = str(c, 'onedriveAccessJson');
    const raw = await cachedToken(ctx, 'onedrive', original);
    let credentials: Record<string, unknown>;
    try {
        credentials = tokenJson(raw);
    } catch {
        credentials = { refresh_token: raw };
    }
    if (typeof credentials.access_token === 'string' && num(credentials, 'expires_at', 0) > Date.now() + 60000)
        return credentials.access_token;
    const metadata = await json('https://onedriveauth.simateccloud.de/v2.0');
    const client = str(metadata, 'client_id');
    if (!client) throw fail('EOS_BACKUP_ONEDRIVE_CLIENT');
    const body = new URLSearchParams({
        refresh_token: str(credentials, 'refresh_token', raw),
        grant_type: 'refresh_token',
        client_id: client,
    }).toString();
    const response = await http(
        new URL('https://login.microsoftonline.com/common/oauth2/v2.0/token'),
        'POST',
        { 'content-type': 'application/x-www-form-urlencoded' },
        body,
    );
    if (response.status !== 200) throw fail('EOS_BACKUP_ONEDRIVE_TOKEN');
    const data: unknown = JSON.parse(response.body.toString());
    if (!record(data) || typeof data.access_token !== 'string') throw fail('EOS_BACKUP_ONEDRIVE_TOKEN');
    await saveToken(ctx, 'onedrive', original, {
        ...credentials,
        ...data,
        refresh_token: str(data, 'refresh_token') || str(credentials, 'refresh_token'),
        expires_at: Date.now() + num(data, 'expires_in', 3600) * 1000,
    });
    return data.access_token;
}
async function oneDriveUpload(c: Config, files: string[], dir: string, ctx: JobContext): Promise<void> {
    const token = await oneDriveToken(c, ctx);
    await ensureOneDriveDirectory(token, dir);
    for (const file of files) {
        const path = (dir + '/' + basename(file)).split('/').filter(Boolean).map(encodeURIComponent).join('/');
        const session = await json(
            'https://graph.microsoft.com/v1.0/me/drive/root:/' + path + ':/createUploadSession',
            'POST',
            { authorization: 'Bearer ' + token },
            { item: { '@microsoft.graph.conflictBehavior': 'fail', name: basename(file) } },
        );
        if (typeof session.uploadUrl !== 'string') throw fail('EOS_BACKUP_ONEDRIVE_UPLOAD');
        const target = new URL(session.uploadUrl);
        if (
            target.protocol !== 'https:' ||
            !!target.username ||
            !!target.password ||
            !!target.port ||
            !(
                target.hostname.endsWith('.1drv.com') ||
                target.hostname.endsWith('.up.1drv.com') ||
                target.hostname.endsWith('.sharepoint.com')
            )
        )
            throw fail('EOS_BACKUP_ONEDRIVE_UPLOAD_HOST');
        const size = (await stat(file)).size,
            chunk = 10 * 320 * 1024;
        for (let start = 0; start < size; start += chunk) {
            const end = Math.min(start + chunk, size) - 1;
            const response = await http(
                target,
                'PUT',
                { 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}` },
                createReadStream(file, { start, end }),
                5 * 60 * 1000,
            );
            if (![200, 201, 202].includes(response.status)) throw fail('EOS_BACKUP_ONEDRIVE_UPLOAD');
        }
    }
}
export async function uploadArchives(c: Config, files: string[], kind: string, ctx: JobContext): Promise<void> {
    if (files.some(p => !ARCHIVE_NAME.test(basename(p)))) throw fail('EOS_BACKUP_UPLOAD_NAME');
    if (flag(c, 'cifsEnabled')) {
        const target = await mountedTarget(c, kind);
        for (const file of files) {
            await copyPrivate(file, join(target, basename(file)));
        }
    }
    if (flag(c, 'ftpEnabled')) await ftpUpload(c, files, remoteDir(c, 'ftp', kind));
    if (flag(c, 'webdavEnabled')) {
        const { ensureWebdavDirectory } = await import('./storageRemote.js');
        await ensureWebdavDirectory(ctx);
        for (const file of files) await webdavUpload(c, file, remoteDir(c, 'webdav', kind));
    }
    if (flag(c, 'dropboxEnabled')) {
        const { Dropbox, DropboxFileUploader, fileUpload } = await import('dropbox');
        const token = await dropboxToken(c, ctx);
        await ensureDropboxDirectory(token, remoteDir(c, 'dropbox', kind));
        const client = new Dropbox({
            accessToken: token,
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
                fetch(input, { ...init, signal: AbortSignal.timeout(5 * 60 * 1000) }),
        });
        const uploader = new DropboxFileUploader(client, { parallelUploads: 1 });
        for (const file of files)
            await uploader.upload(await fileUpload(file), {
                path: posix.join('/', remoteDir(c, 'dropbox', kind), basename(file)),
                mode: { '.tag': 'add' },
                autorename: false,
                mute: true,
            });
    }
    if (flag(c, 'googledriveEnabled')) await googleUpload(c, files, remoteDir(c, 'googledrive', kind), ctx);
    if (flag(c, 'onedriveEnabled')) await oneDriveUpload(c, files, remoteDir(c, 'onedrive', kind), ctx);
    const { pruneRemoteArchives } = await import('./storageRemote.js');
    await pruneRemoteArchives(
        ctx,
        files.map(file => basename(file)),
    );
}

export async function dropboxToken(c: Config, ctx: JobContext): Promise<string> {
    if (str(c, 'dropboxTokenType', 'custom') === 'custom') {
        const token = str(c, 'dropboxAccessToken');
        if (!token) throw fail('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
        return token;
    }
    const original = str(c, 'dropboxAccessTokens') || str(c, 'dropboxAccessJson');
    const raw = await cachedToken(ctx, 'dropbox', original);
    let credentials: Record<string, unknown>;
    try {
        credentials = tokenJson(raw);
    } catch {
        credentials = { refresh_token: raw };
    }
    const expiry = num(credentials, 'expires_at', Date.parse(str(credentials, 'access_token_expires_on')));
    if (typeof credentials.access_token === 'string' && expiry > Date.now() + 60000) return credentials.access_token;
    if (!str(credentials, 'refresh_token')) throw fail('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
    const fresh = await json('https://oauth2.iobroker.in/dropbox', 'POST', {}, credentials);
    if (typeof fresh.access_token !== 'string' || !fresh.access_token) throw fail('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
    await saveToken(ctx, 'dropbox', original, {
        ...credentials,
        ...fresh,
        refresh_token: str(fresh, 'refresh_token') || str(credentials, 'refresh_token'),
        expires_at: Date.now() + num(fresh, 'expires_in', 14400) * 1000,
    });
    return fresh.access_token;
}

export async function ensureDropboxDirectory(token: string, dir: string): Promise<void> {
    const headers = { authorization: 'Bearer ' + token };
    let current = '';
    for (const part of dir.split('/').filter(Boolean)) {
        current += '/' + part;
        try {
            await json('https://api.dropboxapi.com/2/files/create_folder_v2', 'POST', headers, {
                path: current,
                autorename: false,
            });
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'EOS_BACKUP_REMOTE_HTTP_409')
                throw error;
            const existing = await json('https://api.dropboxapi.com/2/files/get_metadata', 'POST', headers, {
                path: current,
            });
            if (existing['.tag'] !== 'folder') throw fail('EOS_BACKUP_DROPBOX_DIRECTORY');
        }
    }
}
export async function ensureOneDriveDirectory(token: string, dir: string): Promise<void> {
    const headers = { authorization: 'Bearer ' + token };
    let current = '',
        parent = 'root';
    for (const part of dir.split('/').filter(Boolean)) {
        current += (current ? '/' : '') + encodeURIComponent(part);
        let item: Record<string, unknown>;
        try {
            item = await json(
                'https://graph.microsoft.com/v1.0/me/drive/root:/' + current + '?$select=id,folder',
                'GET',
                headers,
            );
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'EOS_BACKUP_REMOTE_HTTP_404')
                throw error;
            item = await json(
                'https://graph.microsoft.com/v1.0/me/drive/' +
                    (parent === 'root' ? 'root' : 'items/' + encodeURIComponent(parent)) +
                    '/children',
                'POST',
                headers,
                { name: part, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' },
            );
        }
        if (!record(item.folder) || typeof item.id !== 'string' || item.id.length > 200)
            throw fail('EOS_BACKUP_ONEDRIVE_DIRECTORY');
        parent = item.id;
    }
}
