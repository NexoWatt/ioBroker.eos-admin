// @ts-check
'use strict';
// Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
// Release evidence is recorded explicitly after testing. Publishing only verifies it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/** @typedef {{tests:number, pass:number, fail:number, skipped:number, cancelled:number}} TestResult */
/** @typedef {{path:string, sha256:string}} FileEvidence */
/** @typedef {{major:number, nodeVersion:string, command:string, result:TestResult, log:FileEvidence, runtime:FileEvidence}} RunEvidence */
/** @typedef {{schema:number, version:string, snapshot:{algorithm:string, files:number, sha256:string}, evidence:{index:FileEvidence, runs:RunEvidence[]}}} ReleaseEvidence */
/** @typedef {{root?:string}} Options */

const VALIDATION = 'release-manifests/unified/validation.json';
const COUNTERS = /** @type {const} */ (['tests', 'pass', 'fail', 'skipped', 'cancelled']);
const TEST_COMMAND = 'npm run test:unified && npm run test:retained && npm run test:modules';
const MIN_TESTS = 1207;
const MIN_PASS = 1205;
const MAX_SKIPPED = 2;
const SHA256 = /^[a-f0-9]{64}$/;

/** @param {string} message @returns {never} */
function reject(message) {
    throw new Error(`RELEASE_VALIDATION_INVALID: ${message}`);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Buffer|string} value @returns {string} */
function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

/** @param {Options} options @returns {string} */
function resolveRoot(options) {
    return fs.realpathSync(path.resolve(options.root || path.join(__dirname, '..')));
}

/** Check each fixed, repository-relative path component before reading or writing. @param {string} root @param {string} relative @param {boolean} [allowMissingLeaf] @returns {string} */
function safePath(root, relative, allowMissingLeaf = false) {
    if (!/^[A-Za-z0-9_.\-/]+$/.test(relative) || relative.startsWith('/') || relative.split('/').some(part => !part || part === '.' || part === '..')) reject('non-local evidence path');
    let current = root;
    const parts = relative.split('/');
    for (const [i, part] of parts.entries()) {
        current = path.join(current, part);
        let stat;
        try { stat = fs.lstatSync(current); }
        catch (error) {
            if (allowMissingLeaf && i === parts.length - 1 && error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return current;
            throw error;
        }
        if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory()) || (i === parts.length - 1 && !stat.isFile())) reject(`unsafe evidence path: ${relative}`);
    }
    return current;
}

/** @param {string} root @param {string} relative @param {number} limit @returns {Buffer} */
function readBounded(root, relative, limit) {
    const absolute = safePath(root, relative);
    const before = fs.lstatSync(absolute);
    if (before.size > limit) reject(`evidence file too large: ${relative}`);
    const fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const opened = fs.fstatSync(fd);
        if (!opened.isFile() || opened.size > limit || opened.dev !== before.dev || opened.ino !== before.ino) reject(`evidence file changed while opening: ${relative}`);
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
            const length = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
            if (!length) reject(`evidence file truncated: ${relative}`);
            offset += length;
        }
        const after = fs.fstatSync(fd);
        if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) reject(`evidence file changed while reading: ${relative}`);
        return bytes;
    } finally { fs.closeSync(fd); }
}

/** @param {Buffer} bytes @param {string} label @returns {Record<string, unknown>} */
function readJson(bytes, label) {
    /** @type {unknown} */
    const value = JSON.parse(bytes.toString('utf8'));
    if (!record(value)) reject(`invalid ${label}`);
    return value;
}

/** @param {unknown} value @param {string} label @returns {TestResult} */
function resultCounters(value, label) {
    if (!record(value) || Object.keys(value).length !== COUNTERS.length) reject(`incomplete counters: ${label}`);
    /** @type {TestResult} */
    const result = { tests: 0, pass: 0, fail: 0, skipped: 0, cancelled: 0 };
    for (const key of COUNTERS) {
        const count = value[key];
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 1000000) reject(`invalid ${key}: ${label}`);
        result[key] = count;
    }
    if (result.fail || result.cancelled || result.tests !== result.pass + result.skipped || result.tests < MIN_TESTS || result.pass < MIN_PASS || result.skipped > MAX_SKIPPED) reject(`failed or reduced full test run: ${label}`);
    return result;
}

/** Parse the five actual Node test-runner summaries in the full npm-test transcript. @param {string} text @param {string} version @param {Record<string, unknown>} scripts @returns {TestResult} */
function parseTestLog(text, version, scripts) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const phases = ['test', 'test:unified', 'test:retained', 'test:modules'];
    let phase = -1;
    const perPhase = [0, 0, 0, 0];
    const minimumScope = [765, 48, 327, 4, 63];
    let summaries = 0;
    let expectedCommand = '';
    /** @type {Record<string, number>|null} */
    let block = null;
    /** @type {TestResult} */
    const total = { tests: 0, pass: 0, fail: 0, skipped: 0, cancelled: 0 };
    let commands = 0;
    for (const line of lines) {
        if (expectedCommand) {
            if (line !== expectedCommand) reject('test command differs from current package scripts');
            expectedCommand = '';
        }
        if (line === `> ${TEST_COMMAND}`) commands++;
        if (line.startsWith('> iobroker.eos-admin@')) {
            phase++;
            if (phase >= phases.length || line !== `> iobroker.eos-admin@${version} ${phases[phase]}` || block) reject('wrong version, order or incomplete npm test phase');
            const name = phases[phase];
            const script = name && scripts[name];
            if (typeof script !== 'string' || !script || script.length > 65536 || /[\r\n]/.test(script)) reject('current test phase command missing');
            expectedCommand = `> ${script}`;
        }
        const match = /^(?:ℹ|#) (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/.exec(line);
        if (!match) continue;
        const field = match[1];
        if (!field) reject('missing test summary field');
        const count = Number(match[2]);
        if (!Number.isSafeInteger(count) || count > 1000000 || phase < 1) reject('invalid test summary');
        if (field === 'tests') {
            if (block) reject('truncated test summary');
            block = {};
        }
        if (!block || Object.hasOwn(block, field)) reject('duplicate or incomplete test summary');
        block[field] = count;
        if (field === 'todo') {
            if (Object.keys(block).length !== 6 || block.todo || block.fail || block.cancelled || !block.pass || !block.tests || typeof block.skipped !== 'number' || block.tests !== block.pass + block.skipped) reject('failed or incomplete test summary');
            const minimum = minimumScope[summaries++];
            if (!minimum || block.tests < minimum) reject('reduced test phase scope');
            for (const key of COUNTERS) {
                const value = block[key];
                if (typeof value !== 'number') reject('incomplete test counters');
                total[key] += value;
            }
            perPhase[phase] = (perPhase[phase] || 0) + 1;
            block = null;
        }
    }
    if (block || expectedCommand || phase !== 3 || commands !== 1 || perPhase.join(',') !== '0,1,1,3') reject('full npm test transcript required');
    return resultCounters(total, 'test transcript');
}

/** @param {string} text @param {number} major @returns {string} */
function runtimeVersion(text, major) {
    const match = /^v(22|24)\.(\d+)\.(\d+)\s*$/.exec(text);
    if (!match || Number(match[1]) !== major) reject(`Node ${major} runtime evidence missing`);
    const minor = Number(match[2]);
    const patch = Number(match[3]);
    const minimumMinor = major === 22 ? 23 : 22;
    const minimumPatch = major === 22 ? 4 : 1;
    if (!Number.isSafeInteger(minor) || !Number.isSafeInteger(patch) || minor < minimumMinor || (minor === minimumMinor && patch < minimumPatch)) reject(`unsupported Node ${major} runtime evidence`);
    return `v${major}.${minor}.${patch}`;
}

/** @param {string} root @param {string} relative @param {Record<string, unknown>} index @param {number} limit @returns {{bytes:Buffer, evidence:FileEvidence}} */
function indexedFile(root, relative, index, limit) {
    const file = path.posix.basename(relative);
    if (!Array.isArray(index.files)) reject('INDEX files missing');
    const entries = index.files.filter(entry => record(entry) && entry.file === file);
    if (entries.length !== 1 || !record(entries[0]) || typeof entries[0].deliveredSha256 !== 'string' || !SHA256.test(entries[0].deliveredSha256)) reject(`INDEX entry missing or ambiguous: ${file}`);
    const bytes = readBounded(root, relative, limit);
    const hash = sha256(bytes);
    if (hash !== entries[0].deliveredSha256) reject(`INDEX hash differs: ${file}`);
    return { bytes, evidence: { path: relative, sha256: hash } };
}

/** @param {string} root @param {boolean} [requireStored] @returns {ReleaseEvidence} */
function collect(root, requireStored = false) {
    const pkg = readJson(readBounded(root, 'package.json', 2 * 1024 * 1024), 'package');
    const version = pkg.version;
    if (pkg.name !== 'iobroker.eos-admin' || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) || !record(pkg.scripts) || pkg.scripts.test !== TEST_COMMAND) reject('package identity or full test command differs');
    const raw = `docs/reports/unified-${version}/raw`;
    const indexPath = `${raw}/INDEX.json`;
    const indexBytes = readBounded(root, indexPath, 2 * 1024 * 1024);
    const index = readJson(indexBytes, 'INDEX');
    if (index.version !== version || !record(index.results)) reject('INDEX version/results differ');
    /** @type {RunEvidence[]} */
    const runs = [];
    for (const major of [22, 24]) {
        const log = indexedFile(root, `${raw}/node${major}-tests-final.log`, index, 32 * 1024 * 1024);
        const runtime = indexedFile(root, `${raw}/node${major}-version.log`, index, 128);
        const result = parseTestLog(log.bytes.toString('utf8'), version, pkg.scripts);
        const claimed = resultCounters(index.results[`node${major}-tests-final`], `Node ${major} INDEX`);
        if (COUNTERS.some(key => result[key] !== claimed[key])) reject(`INDEX totals differ from Node ${major} transcript`);
        runs.push({ major, nodeVersion: runtimeVersion(runtime.bytes.toString('utf8'), major), command: 'npm test', result, log: log.evidence, runtime: runtime.evidence });
    }
    const [node22, node24] = runs;
    if (!node22 || !node24 || COUNTERS.some(key => node22.result[key] !== node24.result[key])) reject('Node 22/24 full test scope differs');
    safePath(root, 'tools/eos-release-manifest.cjs');
    /** @type {unknown} */
    const manifest = require(path.join(root, 'tools/eos-release-manifest.cjs'));
    if (!record(manifest) || typeof manifest.snapshot !== 'function') reject('release snapshot unavailable');
    /** @type {unknown} */
    const snapshot = manifest.snapshot();
    if (!record(snapshot)) reject('release snapshot invalid');
    if (requireStored && !Object.hasOwn(snapshot, VALIDATION)) reject('validation record outside release snapshot');
    /** @type {Record<string, string>} */
    const files = Object.create(null);
    for (const relative of Object.keys(snapshot).sort()) {
        if (relative === VALIDATION) continue;
        const hash = snapshot[relative];
        if (typeof hash !== 'string' || !SHA256.test(hash)) reject('release snapshot hash invalid');
        files[relative] = hash;
    }
    const indexEvidence = { path: indexPath, sha256: sha256(indexBytes) };
    for (const item of [indexEvidence, ...runs.flatMap(run => [run.log, run.runtime])]) {
        if (files[item.path] !== item.sha256) reject(`evidence outside release snapshot or changed: ${item.path}`);
    }
    if (!files['package.json'] || !files['tools/eos-release-evidence.cjs']) reject('release evidence verifier outside snapshot');
    return { schema: 1, version, snapshot: { algorithm: 'SHA-256', files: Object.keys(files).length, sha256: sha256(JSON.stringify(files)) }, evidence: { index: indexEvidence, runs } };
}

/** Read-only: verifies the delivered tests and their binding to the current release files. @param {Options} [options] @returns {ReleaseEvidence} */
function check(options = {}) {
    const root = resolveRoot(options);
    const stored = readJson(readBounded(root, VALIDATION, 128 * 1024), 'validation record');
    const current = collect(root, true);
    if (JSON.stringify(stored) !== JSON.stringify(current)) reject('record differs from release files or test evidence; run reviewed release validation before sealing');
    return current;
}

/** Explicit release-author action; never called by prepack or prepublishOnly. @param {Options} [options] @returns {ReleaseEvidence} */
function write(options = {}) {
    const root = resolveRoot(options);
    const evidence = collect(root);
    const target = safePath(root, VALIDATION, true);
    const temporary = `${target}.${crypto.randomBytes(12).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, target);
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return evidence;
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) reject('usage: node tools/eos-release-evidence.cjs [--write]');
        const result = args.length ? write() : check();
        console.log(`EOS ${result.version}: Testbelege fuer Node 22 und 24 ${args.length ? 'explizit aufgezeichnet' : 'unveraendert verifiziert'}; keine Tests beim Publish nachinstalliert oder neu ausgefuehrt.`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'RELEASE_VALIDATION_INVALID');
        process.exitCode = 1;
    }
}

module.exports = { check, write };
