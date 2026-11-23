'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { secureFile } = require('../tools/eos-tls-issuer.cjs');

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-issuer-file-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, 'request.pem');
    await fs.writeFile(file, 'abcd', { mode: 0o600 });
    return { directory, file };
}

test('offline issuer limits the same file descriptor and rejects symlinks and insecure secrets', async t => {
    const { directory, file } = await fixture(t);
    assert.equal(await secureFile(file, 4), 'abcd');
    await assert.rejects(secureFile(file, 3), /Unzulässige Datei/);
    const link = path.join(directory, 'request-link.pem');
    await fs.symlink(file, link);
    await assert.rejects(secureFile(link, 4), /Unzulässige Datei/);
    await fs.chmod(file, 0o644);
    if (process.platform !== 'win32') await assert.rejects(secureFile(file, 4, true), /0600/);
});

test('offline issuer refuses public CSR growth after metadata validation without an unbounded read', async t => {
    const { file } = await fixture(t);
    const actualOpen = fs.open;
    t.mock.method(fs, 'open', async (...args) => {
        const handle = await actualOpen(...args);
        const read = handle.read.bind(handle);
        let changed = false;
        handle.read = async (...readArgs) => {
            if (!changed) { changed = true; await fs.appendFile(file, 'e'.repeat(8192)); }
            return read(...readArgs);
        };
        return handle;
    });
    await assert.rejects(secureFile(file, 4), /Datei zu groß oder während des Lesens verändert/);
});

test('offline issuer detects a truncated CSR instead of signing partial input', async t => {
    const { file } = await fixture(t);
    const actualOpen = fs.open;
    t.mock.method(fs, 'open', async (...args) => {
        const handle = await actualOpen(...args);
        const read = handle.read.bind(handle);
        let changed = false;
        handle.read = async (...readArgs) => {
            if (!changed) { changed = true; await fs.truncate(file, 2); }
            return read(...readArgs);
        };
        return handle;
    });
    await assert.rejects(secureFile(file, 4), /Datei zu groß oder während des Lesens verändert/);
});
