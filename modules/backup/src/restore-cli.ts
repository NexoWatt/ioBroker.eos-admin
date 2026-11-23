/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Retained upstream MIT rights and notices remain applicable; see ../upstream/LICENSE.
 */
import { constants } from 'node:fs';
import { mkdir, rm, open, rename } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { decryptFile, ARCHIVE_NAME, privateDir } from './files';
import { record, fail } from './types';
async function recoveryKey(path: string): Promise<Buffer> {
    const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let value: unknown;
    try {
        const info = await fd.stat();
        if (!info.isFile() || info.size > 4096) throw fail('EOS_BACKUP_KEY_INVALID');
        value = JSON.parse(await fd.readFile('utf8'));
    } finally {
        await fd.close();
    }
    if (!record(value) || value.format !== 'nexowatt-eos-recovery-key/v1' || typeof value.key !== 'string')
        throw fail('EOS_BACKUP_KEY_INVALID');
    const key = Buffer.from(value.key, 'base64');
    if (
        key.length !== 32 ||
        (typeof value.fingerprint === 'string' && createHash('sha256').update(key).digest('hex') !== value.fingerprint)
    ) {
        key.fill(0);
        throw fail('EOS_BACKUP_KEY_INVALID');
    }
    return key;
}
/** Offline maintenance only. An existing runtime key is never overwritten. */
export async function installRecoveryKey(keyPath: string, dataDir: string): Promise<string> {
    const key = await recoveryKey(keyPath);
    const target = join(dataDir, 'recovery.key');
    let created = false;
    try {
        await privateDir(dataDir);
        const fd = await open(
            target,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
        );
        created = true;
        try {
            await fd.writeFile(key);
            await fd.sync();
        } finally {
            await fd.close();
        }
        return target;
    } catch (error) {
        if (created) await rm(target, { force: true });
        throw error;
    } finally {
        key.fill(0);
    }
}
export async function prepareRestore(archive: string, keyPath: string, output: string): Promise<string> {
    if (!ARCHIVE_NAME.test(basename(archive))) throw fail('EOS_BACKUP_ARCHIVE_NAME');
    const key = await recoveryKey(keyPath);
    let created = false;
    try {
        await mkdir(output, { mode: 0o700 });
        created = true;
        await privateDir(output);
        const destination = join(output, basename(archive, '.nwb') + '.archive');
        await decryptFile(archive, destination, key, 100 * 1024 ** 3);
        const fd = await open(destination, 'r'),
            magic = Buffer.alloc(4);
        try {
            await fd.read(magic, 0, 4, 0);
        } finally {
            await fd.close();
        }
        let extension =
            magic[0] === 0x50 && magic[1] === 0x4b
                ? '.zip'
                : magic[0] === 0x1f && magic[1] === 0x8b
                  ? '.tar.gz'
                  : '.archive';
        if (/-(?:legacy-homematic|ccu)-\d+\.nwb$/.test(archive)) extension = '.tar.sbk';
        const final = join(output, basename(archive, '.nwb') + extension);
        if (final !== destination) await rename(destination, final);
        return final;
    } catch (error) {
        if (created) await rm(output, { recursive: true, force: true });
        throw error;
    } finally {
        key.fill(0);
    }
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const get = (key: string): string => {
        const i = args.indexOf(key),
            value = args[i + 1];
        if (i < 0 || !value) throw fail('EOS_BACKUP_CLI_ARGUMENT');
        return resolve(value);
    };
    void Promise.resolve()
        .then(() =>
            args.includes('--install-key')
                ? installRecoveryKey(get('--key-file'), get('--data-dir'))
                : prepareRestore(get('--archive'), get('--key-file'), get('--output')),
        )
        .then(
            path => {
                process.stdout.write('Vorbereitet: ' + path + '\nKeine laufenden Controllerdaten verändert.\n');
            },
            error => {
                process.stderr.write((error instanceof Error ? error.message : 'EOS_BACKUP_RESTORE_FAILED') + '\n');
                process.exitCode = 1;
            },
        );
}
