"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.http = http;
exports.json = json;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
const node_https_1 = require("node:https");
const types_1 = require("./types");
async function http(url, method, headers, body, timeout = 5000) {
    if (url.protocol !== 'https:' || url.username || url.password)
        throw (0, types_1.fail)('EOS_BACKUP_TLS_REQUIRED');
    return new Promise((resolve, reject) => {
        let settled = false;
        let req;
        let response;
        const upload = typeof body === 'string' ? undefined : body;
        const done = (error, result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            // A failed connection or an early response does not consume a piped file.
            // Always close its descriptor; a completed request may keep its socket alive.
            if (upload) {
                if (req)
                    upload.unpipe(req);
                upload.destroy();
            }
            if (error || !req?.writableFinished) {
                response?.destroy();
                req?.destroy();
            }
            if (error)
                reject((0, types_1.fail)('EOS_BACKUP_REMOTE_REQUEST'));
            else if (result)
                resolve(result);
        };
        const timer = setTimeout(() => done((0, types_1.fail)('EOS_BACKUP_TRANSFER_TIMEOUT')), timeout);
        timer.unref();
        try {
            req = (0, node_https_1.request)(url, { method, headers, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, res => {
                if (settled) {
                    res.destroy();
                    return;
                }
                response = res;
                const chunks = [];
                let length = 0;
                res.on('data', (chunk) => {
                    if (settled)
                        return;
                    length += chunk.length;
                    if (length > 1024 * 1024)
                        done((0, types_1.fail)('EOS_BACKUP_RESPONSE_LIMIT'));
                    else
                        chunks.push(chunk);
                });
                res.on('error', done);
                res.once('aborted', () => done((0, types_1.fail)('EOS_BACKUP_RESPONSE_ABORTED')));
                res.once('end', () => done(null, { status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
                res.once('close', () => {
                    if (!res.complete)
                        done((0, types_1.fail)('EOS_BACKUP_RESPONSE_ABORTED'));
                });
            });
            req.on('error', done);
            if (typeof body === 'string')
                req.end(body);
            else if (upload) {
                upload.once('error', done);
                upload.pipe(req);
            }
            else
                req.end();
        }
        catch (error) {
            done(error);
        }
    });
}
async function json(url, method = 'GET', headers = {}, body) {
    const text = body ? JSON.stringify(body) : undefined;
    const result = await http(new URL(url), method, { 'content-type': 'application/json', ...headers }, text);
    if (result.status < 200 || result.status >= 300)
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_HTTP_' + result.status);
    let data;
    try {
        data = JSON.parse(result.body.toString());
    }
    catch {
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_JSON');
    }
    if (!(0, types_1.record)(data))
        throw (0, types_1.fail)('EOS_BACKUP_REMOTE_JSON');
    return data;
}
