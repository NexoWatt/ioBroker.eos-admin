'use strict';
// Socket signing material belongs to this EOS instance. Never initialize or rotate
// the platform secret used by ioBroker Admin and existing encrypted adapter data.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const failure = () => new Error('EOS_SOCKET_SECRET_UNAVAILABLE');
function privateEntry(stat, directory) {
    if ((directory ? !stat.isDirectory() : !stat.isFile()) || stat.isSymbolicLink()) {
        throw failure();
    }
    if (process.platform !== 'win32') {
        if ((stat.mode & 0o077) !== 0) {
            throw failure();
        }
        if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
            throw failure();
        }
    }
}
function loadEosSocketSecret(instanceDirectory) {
    if (typeof instanceDirectory !== 'string' || !path.isAbsolute(instanceDirectory)) {
        throw failure();
    }
    const base = fs.lstatSync(instanceDirectory);
    if (!base.isDirectory() || base.isSymbolicLink()) {
        throw failure();
    }
    const directory = path.join(instanceDirectory, 'security');
    try {
        fs.mkdirSync(directory, { mode: 0o700 });
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw failure();
        }
    }
    privateEntry(fs.lstatSync(directory), true);
    const filename = path.join(directory, 'socket-secret');
    const read = () => {
        const before = fs.lstatSync(filename);
        privateEntry(before, false);
        if (before.size !== 32 || before.nlink !== 1) {
            throw failure();
        }
        const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        try {
            const opened = fs.fstatSync(fd);
            privateEntry(opened, false);
            if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== 32 || opened.nlink !== 1) {
                throw failure();
            }
            const content = fs.readFileSync(fd);
            if (content.length !== 32) {
                throw failure();
            }
            return content.toString('hex');
        }
        finally {
            fs.closeSync(fd);
        }
    };
    try {
        return read();
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            throw failure();
        }
    }
    const temporary = path.join(directory, `.socket-secret-${randomBytes(16).toString('hex')}.tmp`);
    let fd;
    let cleanupFailed = false;
    try {
        fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
        fs.writeFileSync(fd, randomBytes(32));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;
        // Atomic create-if-absent: an already initialized key is never replaced,
        // including two simultaneous EOS starts. Readers never see a partial key.
        try {
            fs.linkSync(temporary, filename);
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw failure();
            }
        }
    }
    catch {
        throw failure();
    }
    finally {
        if (fd !== undefined) {
            fs.closeSync(fd);
        }
        try {
            fs.unlinkSync(temporary);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                cleanupFailed = true;
            }
        }
    }
    if (cleanupFailed) {
        throw failure();
    }
    try {
        return read();
    }
    catch {
        throw failure();
    }
}
module.exports = { loadEosSocketSecret };
//# sourceMappingURL=eosSocketSecret.js.map