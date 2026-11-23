/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { request } from 'node:https';
import type { Readable } from 'node:stream';
import { fail, record } from './types';
export async function http(
    url: URL,
    method: string,
    headers: Record<string, string>,
    body?: string | Readable,
    timeout = 5000,
): Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer }> {
    if (url.protocol !== 'https:' || url.username || url.password) throw fail('EOS_BACKUP_TLS_REQUIRED');
    return new Promise((resolve, reject) => {
        let settled = false;
        let req: import('node:http').ClientRequest | undefined;
        let response: import('node:http').IncomingMessage | undefined;
        const upload = typeof body === 'string' ? undefined : body;
        const done = (
            error: unknown,
            result?: { status: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer },
        ): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            // A failed connection or an early response does not consume a piped file.
            // Always close its descriptor; a completed request may keep its socket alive.
            if (upload) {
                if (req) upload.unpipe(req);
                upload.destroy();
            }
            if (error || !req?.writableFinished) {
                response?.destroy();
                req?.destroy();
            }
            if (error) reject(fail('EOS_BACKUP_REMOTE_REQUEST'));
            else if (result) resolve(result);
        };
        const timer = setTimeout(() => done(fail('EOS_BACKUP_TRANSFER_TIMEOUT')), timeout);
        timer.unref();
        try {
            req = request(url, { method, headers, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, res => {
                if (settled) {
                    res.destroy();
                    return;
                }
                response = res;
                const chunks: Buffer[] = [];
                let length = 0;
                res.on('data', (chunk: Buffer) => {
                    if (settled) return;
                    length += chunk.length;
                    if (length > 1024 * 1024) done(fail('EOS_BACKUP_RESPONSE_LIMIT'));
                    else chunks.push(chunk);
                });
                res.on('error', done);
                res.once('aborted', () => done(fail('EOS_BACKUP_RESPONSE_ABORTED')));
                res.once('end', () =>
                    done(null, { status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
                );
                res.once('close', () => {
                    if (!res.complete) done(fail('EOS_BACKUP_RESPONSE_ABORTED'));
                });
            });
            req.on('error', done);
            if (typeof body === 'string') req.end(body);
            else if (upload) {
                upload.once('error', done);
                upload.pipe(req);
            } else req.end();
        } catch (error) {
            done(error);
        }
    });
}
export async function json(
    url: string,
    method = 'GET',
    headers: Record<string, string> = {},
    body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const text = body ? JSON.stringify(body) : undefined;
    const result = await http(new URL(url), method, { 'content-type': 'application/json', ...headers }, text);
    if (result.status < 200 || result.status >= 300) throw fail('EOS_BACKUP_REMOTE_HTTP_' + result.status);
    let data: unknown;
    try {
        data = JSON.parse(result.body.toString());
    } catch {
        throw fail('EOS_BACKUP_REMOTE_JSON');
    }
    if (!record(data)) throw fail('EOS_BACKUP_REMOTE_JSON');
    return data;
}
