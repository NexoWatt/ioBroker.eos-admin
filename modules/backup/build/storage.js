"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteDir = remoteDir;
exports.mountedTarget = mountedTarget;
exports.ftpUpload = ftpUpload;
exports.googleToken = googleToken;
exports.oneDriveToken = oneDriveToken;
exports.uploadArchives = uploadArchives;
exports.dropboxToken = dropboxToken;
exports.ensureDropboxDirectory = ensureDropboxDirectory;
exports.ensureOneDriveDirectory = ensureOneDriveDirectory;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const files_1 = require("./files");
const http_1 = require("./http");
const tokenCache_1 = require("./tokenCache");
const types_1 = require("./types");
const config_1 = require("./config");
function remoteDir(c, name, kind) {
    const value = (0, types_1.flag)(c, name + 'OwnDir')
        ? (0, types_1.str)(c, name + (kind === 'ccu' ? 'CcuDir' : 'MinimalDir'))
        : (0, types_1.str)(c, name + 'Dir');
    if (value.includes('%') || /[\x00-\x1f\x7f\\]/.test(value) || value.split('/').includes('..'))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_PATH');
    return value.replace(/\/$/, '');
}
function tokenJson(value) {
    let data;
    try {
        data = JSON.parse(value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8'));
    }
    catch {
        throw (0, types_1.fail)('EOS_BACKUP_OAUTH_CONFIG');
    }
    if (!(0, types_1.record)(data))
        throw (0, types_1.fail)('EOS_BACKUP_OAUTH_CONFIG');
    return data;
}
async function mountedTarget(c, kind = 'iobroker') {
    let path;
    if ((0, types_1.str)(c, 'connectType') === 'SDCard') {
        const sd = require('../upstream/build/lib/sdCard.js');
        const target = await sd.validateSdCardTarget((0, types_1.str)(c, 'sdCardMountPath'), (0, types_1.str)(c, 'sdCardBackupSubDir', 'nexowatt-eos-backups'));
        path = target.backupDir;
    }
    else
        path =
            (0, types_1.str)(c, 'connectType') === 'Copy' && (0, types_1.flag)(c, 'cifsOwnDir')
                ? remoteDir(c, 'cifs', kind)
                : (0, types_1.str)(c, 'mountedBackupPath', (0, types_1.str)(c, 'cifsDir'));
    const full = (0, config_1.safeSourcePath)(path), actual = await (0, promises_1.realpath)(full);
    if (actual !== full)
        throw (0, types_1.fail)('EOS_BACKUP_TARGET_SYMLINK');
    const s = await (0, promises_1.lstat)(full);
    if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o002) !== 0)
        throw (0, types_1.fail)('EOS_BACKUP_TARGET_PERMISSIONS');
    return full;
}
async function webdavUpload(c, file, dir) {
    const base = new URL((0, types_1.str)(c, 'webdavURL'));
    const target = new URL(base);
    target.pathname = node_path_1.posix.join(base.pathname, dir, (0, node_path_1.basename)(file));
    const auth = 'Basic ' + Buffer.from((0, types_1.str)(c, 'webdavUsername') + ':' + (0, types_1.str)(c, 'webdavPassword')).toString('base64');
    const result = await (0, http_1.http)(target, 'PUT', {
        authorization: auth,
        'content-type': 'application/octet-stream',
        'content-length': String((await (0, promises_1.stat)(file)).size),
    }, (0, node_fs_1.createReadStream)(file), 30 * 60 * 1000);
    if (result.status < 200 || result.status >= 300)
        throw (0, types_1.fail)('EOS_BACKUP_WEBDAV_UPLOAD');
}
async function ftpUpload(c, files, dir) {
    const Ftp = require('ftp');
    const client = new Ftp();
    let failed;
    let pending;
    client.on('error', () => {
        failed = (0, types_1.fail)('EOS_BACKUP_FTPS_UPLOAD');
        pending?.(failed);
    });
    client.on('end', () => {
        failed = (0, types_1.fail)('EOS_BACKUP_FTPS_CLOSED');
        pending?.(failed);
    });
    const operation = (start, timeout = 5000) => new Promise((resolve, reject) => {
        if (failed) {
            reject(failed);
            return;
        }
        let settled = false;
        const done = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            pending = undefined;
            if (error)
                reject((0, types_1.fail)('EOS_BACKUP_FTPS_UPLOAD'));
            else
                resolve();
        };
        pending = done;
        const timer = setTimeout(() => {
            done((0, types_1.fail)('EOS_BACKUP_FTPS_TIMEOUT'));
            client.destroy();
        }, timeout);
        try {
            start(done);
        }
        catch {
            done((0, types_1.fail)('EOS_BACKUP_FTPS_UPLOAD'));
        }
    });
    try {
        await operation(done => {
            client.on('ready', () => done());
            client.connect({
                host: (0, types_1.str)(c, 'ftpHost'),
                port: (0, types_1.num)(c, 'ftpPort', 21),
                user: (0, types_1.str)(c, 'ftpUser'),
                password: (0, types_1.str)(c, 'ftpPassword'),
                secure: true,
                secureOptions: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
                connTimeout: 5000,
                pasvTimeout: 5000,
                keepalive: 5000,
            });
        });
        if (dir && dir !== '/')
            await operation(done => client.mkdir(dir, true, done));
        for (const file of files)
            await operation(done => client.put(file, node_path_1.posix.join(dir, (0, node_path_1.basename)(file)), done), 30 * 60 * 1000);
    }
    finally {
        pending = undefined;
        client.end();
        client.destroy();
    }
}
async function googleToken(c, ctx) {
    const original = (0, types_1.str)(c, 'googledriveAccessTokens') || (0, types_1.str)(c, 'googledriveAccessJson');
    const credentials = tokenJson(await (0, tokenCache_1.cachedToken)(ctx, 'google', original));
    if (typeof credentials.access_token === 'string' &&
        (0, types_1.num)(credentials, 'expiry_date', Date.parse((0, types_1.str)(credentials, 'access_token_expires_on'))) > Date.now() + 60000)
        return credentials.access_token;
    // Existing 1.0.10 installations use this configured provider's OAuth relay. No new registration is performed.
    const fresh = await (0, http_1.json)((0, types_1.str)(c, 'googledriveAccessTokens')
        ? 'https://googleauth.iobroker.in/googleDriveOAuth'
        : 'https://googleauth.iobroker.in/', 'POST', {}, credentials);
    if (typeof fresh.access_token !== 'string')
        throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_TOKEN');
    await (0, tokenCache_1.saveToken)(ctx, 'google', original, {
        ...credentials,
        ...fresh,
        refresh_token: (0, types_1.str)(fresh, 'refresh_token') || (0, types_1.str)(credentials, 'refresh_token'),
        expiry_date: (0, types_1.num)(fresh, 'expiry_date', Date.now() + (0, types_1.num)(fresh, 'expires_in', 3600) * 1000),
    });
    return fresh.access_token;
}
async function googleUpload(c, files, dir, ctx) {
    const token = await googleToken(c, ctx), headers = { authorization: 'Bearer ' + token };
    let parent = 'root';
    for (const part of dir.split('/').filter(Boolean)) {
        const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${part.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}' and '${parent}' in parents and trashed = false`;
        const found = await (0, http_1.json)('https://www.googleapis.com/drive/v3/files?fields=files(id)&pageSize=2&q=' + encodeURIComponent(q), 'GET', headers);
        const rows = Array.isArray(found.files) ? found.files : [];
        if (rows.length > 1)
            throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_FOLDER_AMBIGUOUS');
        if (rows.length === 1 && (0, types_1.record)(rows[0]) && typeof rows[0].id === 'string')
            parent = rows[0].id;
        else {
            const made = await (0, http_1.json)('https://www.googleapis.com/drive/v3/files', 'POST', headers, {
                name: part,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parent],
            });
            if (typeof made.id !== 'string')
                throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_FOLDER');
            parent = made.id;
        }
    }
    for (const file of files) {
        const size = (await (0, promises_1.stat)(file)).size;
        const init = await (0, http_1.http)(new URL('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'), 'POST', {
            ...headers,
            'content-type': 'application/json',
            'x-upload-content-type': 'application/octet-stream',
            'x-upload-content-length': String(size),
        }, JSON.stringify({ name: (0, node_path_1.basename)(file), parents: [parent] }));
        if (init.status < 200 || init.status >= 300 || typeof init.headers.location !== 'string')
            throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_UPLOAD');
        const target = new URL(init.headers.location);
        if (target.protocol !== 'https:' ||
            target.hostname !== 'www.googleapis.com' ||
            !!target.username ||
            !!target.password ||
            !!target.port)
            throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_UPLOAD_HOST');
        const result = await (0, http_1.http)(target, 'PUT', { 'content-length': String(size), 'content-type': 'application/octet-stream' }, (0, node_fs_1.createReadStream)(file), 30 * 60 * 1000);
        if (result.status < 200 || result.status >= 300)
            throw (0, types_1.fail)('EOS_BACKUP_GOOGLE_UPLOAD');
    }
}
async function oneDriveToken(c, ctx) {
    const original = (0, types_1.str)(c, 'onedriveAccessJson');
    const raw = await (0, tokenCache_1.cachedToken)(ctx, 'onedrive', original);
    let credentials;
    try {
        credentials = tokenJson(raw);
    }
    catch {
        credentials = { refresh_token: raw };
    }
    if (typeof credentials.access_token === 'string' && (0, types_1.num)(credentials, 'expires_at', 0) > Date.now() + 60000)
        return credentials.access_token;
    const metadata = await (0, http_1.json)('https://onedriveauth.simateccloud.de/v2.0');
    const client = (0, types_1.str)(metadata, 'client_id');
    if (!client)
        throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_CLIENT');
    const body = new URLSearchParams({
        refresh_token: (0, types_1.str)(credentials, 'refresh_token', raw),
        grant_type: 'refresh_token',
        client_id: client,
    }).toString();
    const response = await (0, http_1.http)(new URL('https://login.microsoftonline.com/common/oauth2/v2.0/token'), 'POST', { 'content-type': 'application/x-www-form-urlencoded' }, body);
    if (response.status !== 200)
        throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_TOKEN');
    const data = JSON.parse(response.body.toString());
    if (!(0, types_1.record)(data) || typeof data.access_token !== 'string')
        throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_TOKEN');
    await (0, tokenCache_1.saveToken)(ctx, 'onedrive', original, {
        ...credentials,
        ...data,
        refresh_token: (0, types_1.str)(data, 'refresh_token') || (0, types_1.str)(credentials, 'refresh_token'),
        expires_at: Date.now() + (0, types_1.num)(data, 'expires_in', 3600) * 1000,
    });
    return data.access_token;
}
async function oneDriveUpload(c, files, dir, ctx) {
    const token = await oneDriveToken(c, ctx);
    await ensureOneDriveDirectory(token, dir);
    for (const file of files) {
        const path = (dir + '/' + (0, node_path_1.basename)(file)).split('/').filter(Boolean).map(encodeURIComponent).join('/');
        const session = await (0, http_1.json)('https://graph.microsoft.com/v1.0/me/drive/root:/' + path + ':/createUploadSession', 'POST', { authorization: 'Bearer ' + token }, { item: { '@microsoft.graph.conflictBehavior': 'fail', name: (0, node_path_1.basename)(file) } });
        if (typeof session.uploadUrl !== 'string')
            throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_UPLOAD');
        const target = new URL(session.uploadUrl);
        if (target.protocol !== 'https:' ||
            !!target.username ||
            !!target.password ||
            !!target.port ||
            !(target.hostname.endsWith('.1drv.com') ||
                target.hostname.endsWith('.up.1drv.com') ||
                target.hostname.endsWith('.sharepoint.com')))
            throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_UPLOAD_HOST');
        const size = (await (0, promises_1.stat)(file)).size, chunk = 10 * 320 * 1024;
        for (let start = 0; start < size; start += chunk) {
            const end = Math.min(start + chunk, size) - 1;
            const response = await (0, http_1.http)(target, 'PUT', { 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}` }, (0, node_fs_1.createReadStream)(file, { start, end }), 5 * 60 * 1000);
            if (![200, 201, 202].includes(response.status))
                throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_UPLOAD');
        }
    }
}
async function uploadArchives(c, files, kind, ctx) {
    if (files.some(p => !files_1.ARCHIVE_NAME.test((0, node_path_1.basename)(p))))
        throw (0, types_1.fail)('EOS_BACKUP_UPLOAD_NAME');
    if ((0, types_1.flag)(c, 'cifsEnabled')) {
        const target = await mountedTarget(c, kind);
        for (const file of files) {
            await (0, files_1.copyPrivate)(file, (0, node_path_1.join)(target, (0, node_path_1.basename)(file)));
        }
    }
    if ((0, types_1.flag)(c, 'ftpEnabled'))
        await ftpUpload(c, files, remoteDir(c, 'ftp', kind));
    if ((0, types_1.flag)(c, 'webdavEnabled')) {
        const { ensureWebdavDirectory } = await import('./storageRemote.js');
        await ensureWebdavDirectory(ctx);
        for (const file of files)
            await webdavUpload(c, file, remoteDir(c, 'webdav', kind));
    }
    if ((0, types_1.flag)(c, 'dropboxEnabled')) {
        const { Dropbox, DropboxFileUploader, fileUpload } = await import('dropbox');
        const token = await dropboxToken(c, ctx);
        await ensureDropboxDirectory(token, remoteDir(c, 'dropbox', kind));
        const client = new Dropbox({
            accessToken: token,
            fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5 * 60 * 1000) }),
        });
        const uploader = new DropboxFileUploader(client, { parallelUploads: 1 });
        for (const file of files)
            await uploader.upload(await fileUpload(file), {
                path: node_path_1.posix.join('/', remoteDir(c, 'dropbox', kind), (0, node_path_1.basename)(file)),
                mode: { '.tag': 'add' },
                autorename: false,
                mute: true,
            });
    }
    if ((0, types_1.flag)(c, 'googledriveEnabled'))
        await googleUpload(c, files, remoteDir(c, 'googledrive', kind), ctx);
    if ((0, types_1.flag)(c, 'onedriveEnabled'))
        await oneDriveUpload(c, files, remoteDir(c, 'onedrive', kind), ctx);
    const { pruneRemoteArchives } = await import('./storageRemote.js');
    await pruneRemoteArchives(ctx, files.map(file => (0, node_path_1.basename)(file)));
}
async function dropboxToken(c, ctx) {
    if ((0, types_1.str)(c, 'dropboxTokenType', 'custom') === 'custom') {
        const token = (0, types_1.str)(c, 'dropboxAccessToken');
        if (!token)
            throw (0, types_1.fail)('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
        return token;
    }
    const original = (0, types_1.str)(c, 'dropboxAccessTokens') || (0, types_1.str)(c, 'dropboxAccessJson');
    const raw = await (0, tokenCache_1.cachedToken)(ctx, 'dropbox', original);
    let credentials;
    try {
        credentials = tokenJson(raw);
    }
    catch {
        credentials = { refresh_token: raw };
    }
    const expiry = (0, types_1.num)(credentials, 'expires_at', Date.parse((0, types_1.str)(credentials, 'access_token_expires_on')));
    if (typeof credentials.access_token === 'string' && expiry > Date.now() + 60000)
        return credentials.access_token;
    if (!(0, types_1.str)(credentials, 'refresh_token'))
        throw (0, types_1.fail)('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
    const fresh = await (0, http_1.json)('https://oauth2.iobroker.in/dropbox', 'POST', {}, credentials);
    if (typeof fresh.access_token !== 'string' || !fresh.access_token)
        throw (0, types_1.fail)('EOS_BACKUP_DROPBOX_TOKEN_REQUIRED');
    await (0, tokenCache_1.saveToken)(ctx, 'dropbox', original, {
        ...credentials,
        ...fresh,
        refresh_token: (0, types_1.str)(fresh, 'refresh_token') || (0, types_1.str)(credentials, 'refresh_token'),
        expires_at: Date.now() + (0, types_1.num)(fresh, 'expires_in', 14400) * 1000,
    });
    return fresh.access_token;
}
async function ensureDropboxDirectory(token, dir) {
    const headers = { authorization: 'Bearer ' + token };
    let current = '';
    for (const part of dir.split('/').filter(Boolean)) {
        current += '/' + part;
        try {
            await (0, http_1.json)('https://api.dropboxapi.com/2/files/create_folder_v2', 'POST', headers, {
                path: current,
                autorename: false,
            });
        }
        catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'EOS_BACKUP_REMOTE_HTTP_409')
                throw error;
            const existing = await (0, http_1.json)('https://api.dropboxapi.com/2/files/get_metadata', 'POST', headers, {
                path: current,
            });
            if (existing['.tag'] !== 'folder')
                throw (0, types_1.fail)('EOS_BACKUP_DROPBOX_DIRECTORY');
        }
    }
}
async function ensureOneDriveDirectory(token, dir) {
    const headers = { authorization: 'Bearer ' + token };
    let current = '', parent = 'root';
    for (const part of dir.split('/').filter(Boolean)) {
        current += (current ? '/' : '') + encodeURIComponent(part);
        let item;
        try {
            item = await (0, http_1.json)('https://graph.microsoft.com/v1.0/me/drive/root:/' + current + '?$select=id,folder', 'GET', headers);
        }
        catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'EOS_BACKUP_REMOTE_HTTP_404')
                throw error;
            item = await (0, http_1.json)('https://graph.microsoft.com/v1.0/me/drive/' +
                (parent === 'root' ? 'root' : 'items/' + encodeURIComponent(parent)) +
                '/children', 'POST', headers, { name: part, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' });
        }
        if (!(0, types_1.record)(item.folder) || typeof item.id !== 'string' || item.id.length > 200)
            throw (0, types_1.fail)('EOS_BACKUP_ONEDRIVE_DIRECTORY');
        parent = item.id;
    }
}
