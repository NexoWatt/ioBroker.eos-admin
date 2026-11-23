#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-check
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bereitet einen überkopierten, bereits geprüften Repo-Lieferstand für npm vor.
 * Daten und Wirkung: Prüft alle aktuellen Dateihashes, sichert ausschließlich katalogisierte
 * Altdateien außerhalb des Repositorys und entfernt nur deren unveränderte Originale.
 * Bei Änderungen: Windows-Pfade, vollständige Vorprüfung, Sicherung, Rollback und Links prüfen.
 * Grenze: Kein Rebuild, keine Neuversiegelung und keine Transaktion gegen einen gleichzeitig
 * mit denselben Benutzerrechten schreibenden Prozess. Die npm-/Releaseprüfung läuft danach weiter.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SEAL = 'release-manifests/unified/files.json';
const CATALOG = 'release-manifests/unified/obsolete-admin-assets.json';
const MANIFEST_TOOL = 'tools/eos-release-manifest.cjs';
const SELF = 'tools/eos-prepare-publish.cjs';
const MAX_FILES = 30000;
const MAX_FILE = 128 * 1024 * 1024;
const MAX_JSON = 16 * 1024 * 1024;
const MAX_TOTAL = 1024 * 1024 * 1024;
const DIGEST = /^[a-f0-9]{64}$/;
/** @typedef {{sha256:string, bytes:number, identity:import('node:fs').Stats, data:Buffer|null}} Snapshot */
/** @typedef {{version:string, files:Map<string,string>, snapshot:Snapshot}} Seal */
/** @typedef {{relative:string, snapshot:Snapshot, state:string}} Candidate */
class PublishPreparationError extends Error {
    /** @param {string} code @param {string} message */
    constructor(code, message) { super(`${code}: ${message}`); this.name = 'PublishPreparationError'; this.code = code; }
}
/** @param {string} code @param {string} message @returns {never} */
function stop(code, message) { throw new PublishPreparationError(code, message); }
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} relative @returns {string} */
function validPath(relative) {
    if (typeof relative !== 'string' || !relative || relative.length > 1024 || relative.includes('\\') || path.posix.isAbsolute(relative)) {
        stop('EOS_PUBLISH_PATH', 'Ungültiger relativer Dateipfad; nichts bereinigt.');
    }
    for (const part of relative.split('/')) {
        if (!part || part === '.' || part === '..' || part.length > 255 || /[<>:"|?*]/.test(part)
            || [...part].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
            || /[ .]$/.test(part) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)) {
            stop('EOS_PUBLISH_PATH', 'Nicht portabler oder unsicherer Dateipfad; nichts bereinigt.');
        }
    }
    return relative;
}
/** Prüft jedes Elternsegment; lstat erkennt auch kaputte Symlinks/Junctions.
 * @param {string} root @param {string} relative @returns {import('node:fs').Stats} */
function noLinks(root, relative) {
    let target = root;
    let stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) stop('EOS_PUBLISH_LINK', 'Projekt-/Sicherungspfad ist kein normaler Ordner.');
    const parts = relative ? validPath(relative).split('/') : [];
    for (let index = 0; index < parts.length; index++) {
        target = path.join(target, /** @type {string} */ (parts[index]));
        stat = fs.lstatSync(target);
        if (stat.isSymbolicLink()) stop('EOS_PUBLISH_LINK', `Verknüpfung nicht zulässig: ${relative}`);
        if (index < parts.length - 1 && !stat.isDirectory()) stop('EOS_PUBLISH_PATH', `Elternpfad ist kein Ordner: ${relative}`);
    }
    return stat;
}
/** @param {import('node:fs').Stats} a @param {import('node:fs').Stats} b */
function sameIdentity(a, b) {
    return a.isFile() && b.isFile() && a.nlink === 1 && b.nlink === 1 && a.dev === b.dev && a.ino === b.ino
        && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
/** @param {string} root @param {string} relative @param {boolean} [collect] @returns {Snapshot} */
function readSnapshot(root, relative, collect = false) {
    const before = noLinks(root, relative);
    if (!before.isFile() || before.nlink !== 1 || before.size > MAX_FILE) stop('EOS_PUBLISH_FILE', `Keine zulässige unverknüpfte Datei: ${relative}`);
    const fd = fs.openSync(path.join(root, relative), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const opened = fs.fstatSync(fd);
        if (!sameIdentity(before, opened)) stop('EOS_PUBLISH_RACE', `Datei beim Öffnen verändert: ${relative}`);
        const hash = crypto.createHash('sha256'); const buffer = Buffer.allocUnsafe(65536);
        /** @type {Buffer[]} */ const chunks = [];
        let count = 0;
        for (;;) {
            const length = fs.readSync(fd, buffer, 0, buffer.length, null);
            if (!length) break;
            count += length;
            if (count > MAX_FILE) stop('EOS_PUBLISH_LIMIT', 'Dateigröße überschreitet die Vorbereitungsgrenze.');
            const chunk = buffer.subarray(0, length); hash.update(chunk);
            if (collect) chunks.push(Buffer.from(chunk));
        }
        if (!sameIdentity(opened, fs.fstatSync(fd)) || !sameIdentity(opened, noLinks(root, relative))) stop('EOS_PUBLISH_RACE', `Datei beim Lesen verändert: ${relative}`);
        return { sha256: hash.digest('hex'), bytes: count, identity: opened, data: collect ? Buffer.concat(chunks) : null };
    } finally { fs.closeSync(fd); }
}
/** @param {string} root @param {string} relative @returns {{value:unknown, snapshot:Snapshot}} */
function readJson(root, relative) {
    if (noLinks(root, relative).size > MAX_JSON) stop('EOS_PUBLISH_LIMIT', `Metadaten zu groß: ${relative}`);
    const snapshot = readSnapshot(root, relative, true);
    try { return { value: JSON.parse(/** @type {Buffer} */ (snapshot.data).toString('utf8')), snapshot }; }
    catch { return stop('EOS_PUBLISH_METADATA', `Ungültige JSON-Metadaten: ${relative}`); }
}
/** @param {string[]} paths */
function uniqueWindowsPaths(paths) {
    const seen = new Set();
    for (const relative of paths) {
        validPath(relative); const folded = relative.toLowerCase();
        if (seen.has(folded)) stop('EOS_PUBLISH_CASE_COLLISION', `Unter Windows kollidierende Pfade: ${relative}`);
        seen.add(folded);
    }
}
/** @param {string} root @returns {Seal} */
function loadSeal(root) {
    const { value, snapshot } = readJson(root, SEAL);
    if (!record(value) || value.schema !== 1 || value.algorithm !== 'SHA-256' || typeof value.version !== 'string'
        || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version) || !record(value.files)) stop('EOS_PUBLISH_METADATA', 'Unvollständige Release-Versiegelung.');
    const entries = Object.entries(value.files);
    if (!entries.length || entries.length > MAX_FILES) stop('EOS_PUBLISH_LIMIT', 'Unzulässige Anzahl versiegelter Dateien.');
    const files = new Map();
    for (const [relative, digest] of entries) {
        validPath(relative);
        if (typeof digest !== 'string' || !DIGEST.test(digest)) stop('EOS_PUBLISH_METADATA', 'Ungültiger Dateihash in der Versiegelung.');
        files.set(relative, digest);
    }
    uniqueWindowsPaths([...files.keys()]);
    for (const required of ['package.json', CATALOG, SELF, MANIFEST_TOOL]) if (!files.has(required)) stop('EOS_PUBLISH_METADATA', `Vorbereitungsdatei nicht versiegelt: ${required}`);
    return { version: value.version, files, snapshot };
}
/** Vor jeder Mutation sämtliche aktuellen Quellen prüfen, nicht nur die UI.
 * @param {string} root @param {Seal} seal */
function verifyCurrent(root, seal) {
    let total = 0;
    for (const [relative, expected] of seal.files) {
        let snapshot;
        try { snapshot = readSnapshot(root, relative); }
        catch (error) {
            if (error instanceof PublishPreparationError) throw error;
            stop('EOS_PUBLISH_CURRENT_MISSING', `Aktuelle Release-Datei fehlt oder ist nicht lesbar: ${relative}. ZIP vollständig kopieren.`);
        }
        total += snapshot.bytes;
        if (total > MAX_TOTAL) stop('EOS_PUBLISH_LIMIT', 'Aktueller Releasebestand ist zu groß.');
        if (snapshot.sha256 !== expected) stop('EOS_PUBLISH_CURRENT_CHANGED', `Aktuelle Release-Datei verändert: ${relative}. Keine Bereinigung oder Neuversiegelung.`);
    }
    if (readSnapshot(root, SEAL).sha256 !== seal.snapshot.sha256) stop('EOS_PUBLISH_RACE', 'Release-Versiegelung während der Prüfung verändert.');
}
/** @param {string} root @returns {Map<string, Set<string>>} */
function loadCatalog(root) {
    const { value } = readJson(root, CATALOG);
    if (!record(value) || value.schema !== 1 || value.algorithm !== 'SHA-256' || !record(value.files)) stop('EOS_PUBLISH_METADATA', 'Unvollständiger Altdateikatalog.');
    const entries = Object.entries(value.files);
    if (entries.length > MAX_FILES * 3) stop('EOS_PUBLISH_LIMIT', 'Altdateikatalog ist zu groß.');
    const catalog = new Map();
    for (const [relative, hashes] of entries) {
        validPath(relative);
        if (!relative.startsWith('adminWww/') || !Array.isArray(hashes) || !hashes.length || hashes.length > 100
            || hashes.some(digest => typeof digest !== 'string' || !DIGEST.test(digest))) stop('EOS_PUBLISH_METADATA', 'Ungültiger Eintrag im Altdateikatalog.');
        catalog.set(relative, new Set(/** @type {string[]} */ (hashes)));
    }
    return catalog;
}
/** Gesamten Adminbaum vor der Mutation lstat-prüfen, auch nicht gelistete Links.
 * @param {string} root */
function checkAdminTree(root) {
    let count = 0;
    /** @param {string} relative */
    function walk(relative) {
        if (++count > MAX_FILES * 3) stop('EOS_PUBLISH_LIMIT', 'Admin-Dateibaum ist zu groß.');
        const stat = noLinks(root, relative);
        if (stat.isFile()) {
            if (stat.nlink !== 1) stop('EOS_PUBLISH_FILE', `Hartverknüpfte Datei: ${relative}`);
            return;
        }
        if (!stat.isDirectory()) stop('EOS_PUBLISH_FILE', `Spezialdatei: ${relative}`);
        const names = fs.readdirSync(path.join(root, relative)); uniqueWindowsPaths(names);
        for (const name of names) walk(`${relative}/${name}`);
    }
    walk('adminWww');
}
/** @param {string} root @returns {{listFiles:()=>string[],check:()=>number}} */
function manifestApi(root) {
    const value = /** @type {unknown} */ (require(path.join(root, MANIFEST_TOOL)));
    if (!record(value) || typeof value.listFiles !== 'function' || typeof value.check !== 'function') stop('EOS_PUBLISH_METADATA', 'Releaseprüfer hat eine ungültige Schnittstelle.');
    const listFiles = value.listFiles; const check = value.check;
    return {
        listFiles: () => {
            const listed = /** @type {unknown} */ (listFiles());
            if (!Array.isArray(listed) || listed.length > MAX_FILES * 3 || listed.some(item => typeof item !== 'string')) stop('EOS_PUBLISH_METADATA', 'Ungültige Dateiliste des Releaseprüfers.');
            uniqueWindowsPaths(listed); return listed;
        },
        check: () => {
            const count = /** @type {unknown} */ (check());
            if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) stop('EOS_PUBLISH_METADATA', 'Ungültiges Prüfergebnis.');
            return count;
        },
    };
}
/** Konservative Referenzprüfung verhindert das Entfernen noch benannter Assets.
 * @param {string} root @param {Seal} seal @param {Candidate[]} candidates */
function verifyUnreferenced(root, seal, candidates) {
    const basenames = new Set(candidates.map(item => path.posix.basename(item.relative)));
    for (const relative of seal.files.keys()) {
        if (!relative.startsWith('adminWww/') || !/\.(?:js|mjs|cjs|html|json|css|map)$/.test(relative)) continue;
        const text = /** @type {Buffer} */ (readSnapshot(root, relative, true).data);
        const content = text.toString('utf8');
        for (const match of content.matchAll(/[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,12}/g)) {
            if (basenames.has(match[0])) stop('EOS_PUBLISH_ASSET_REFERENCED', `Aktueller Admin-Build verweist noch auf eine Altdatei: ${match[0]}`);
        }
        for (const name of basenames) if (/[^A-Za-z0-9_.-]/.test(name) && content.includes(name)) stop('EOS_PUBLISH_ASSET_REFERENCED', 'Aktueller Admin-Build verweist auf eine Altdatei.');
    }
}
/** @param {string} root @param {string} relative */
function ensureDirectories(root, relative) {
    let current = '';
    for (const part of validPath(relative).split('/').slice(0, -1)) {
        current = current ? `${current}/${part}` : part;
        try { fs.mkdirSync(path.join(root, current), { mode: 0o700 }); }
        catch (error) { if (!record(error) || error.code !== 'EEXIST') throw error; }
        if (!noLinks(root, current).isDirectory()) stop('EOS_PUBLISH_PATH', 'Sicherungspfad ist kein normaler Ordner.');
    }
}
/** @param {string} absolute @param {Buffer|string} data */
function writeExclusive(absolute, data) {
    const fd = fs.openSync(absolute, 'wx', 0o600);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
/** @param {string} root @param {Candidate} item */
function unchangedCandidate(root, item) {
    const current = readSnapshot(root, item.relative, true);
    if (!sameIdentity(current.identity, item.snapshot.identity) || current.sha256 !== item.snapshot.sha256) stop('EOS_PUBLISH_RACE', `Altdatei während der Vorbereitung verändert: ${item.relative}`);
    return /** @type {Buffer} */ (current.data);
}
/** @param {{root?:string}} [options] @returns {{version:string,quarantined:string[],backupDir:string|null,verifiedFiles:number}} */
function preparePublish(options = {}) {
    const root = path.resolve(options.root || path.join(__dirname, '..'));
    noLinks(root, '');
    const seal = loadSeal(root); verifyCurrent(root, seal);
    const pkg = readJson(root, 'package.json').value;
    if (!record(pkg) || pkg.name !== 'iobroker.eos-admin' || pkg.version !== seal.version) stop('EOS_PUBLISH_VERSION', 'Paketname oder Version passt nicht zur Versiegelung.');
    const catalog = loadCatalog(root); checkAdminTree(root);
    const api = manifestApi(root); const currentPaths = api.listFiles();
    const foldedSealed = new Set([...seal.files.keys()].map(relative => relative.toLowerCase()));
    /** @type {Candidate[]} */ const candidates = [];
    let bytes = 0;
    for (const relative of currentPaths) {
        if (seal.files.has(relative)) continue;
        if (foldedSealed.has(relative.toLowerCase())) stop('EOS_PUBLISH_CASE_COLLISION', `Zusatzdatei kollidiert mit aktueller Datei: ${relative}`);
        const hashes = catalog.get(relative);
        if (!relative.startsWith('adminWww/') || !hashes) stop('EOS_PUBLISH_EXTRA_UNKNOWN', `Unbekannte Zusatzdatei bleibt erhalten: ${relative}. Vollständigen Lieferstand und eigene Änderungen prüfen.`);
        const snapshot = readSnapshot(root, relative); bytes += snapshot.bytes;
        if (!hashes.has(snapshot.sha256)) stop('EOS_PUBLISH_EXTRA_CHANGED', `Altdatei hat unbekannten Inhalt und bleibt erhalten: ${relative}`);
        if (bytes > MAX_TOTAL) stop('EOS_PUBLISH_LIMIT', 'Altdateibestand ist zu groß.');
        candidates.push({ relative, snapshot, state: 'planned' });
    }
    if (!candidates.length) return { version: seal.version, quarantined: [], backupDir: null, verifiedFiles: api.check() };
    verifyUnreferenced(root, seal, candidates);
    const parent = fs.realpathSync(path.dirname(root));
    const backupDir = fs.mkdtempSync(path.join(parent, `${path.basename(root)}.publish-backup-`));
    fs.chmodSync(backupDir, 0o700);
    /** @type {number|undefined} */ let receiptFd;
    /** @param {string} state @param {string} [code] */
    const receipt = (state, code = '') => {
        const text = JSON.stringify({ schema: 1, version: seal.version, originalRoot: root, createdAt: new Date().toISOString(), state,
            ...(code ? { errorCode: code } : {}), files: candidates.map(item => ({ path: item.relative, sha256: item.snapshot.sha256, state: item.state })) }, null, 2) + '\n';
        if (receiptFd === undefined) receiptFd = fs.openSync(path.join(backupDir, 'restore.json'), 'wx', 0o600);
        const data = Buffer.from(text); let written = 0;
        while (written < data.length) { const count = fs.writeSync(receiptFd, data, written, data.length - written, written); if (count <= 0) stop('EOS_PUBLISH_IO', 'Wiederherstellungsplan konnte nicht geschrieben werden.'); written += count; }
        fs.ftruncateSync(receiptFd, data.length); fs.fsyncSync(receiptFd);
    };
    try {
        receipt('backing-up');
        // Zuerst alle Sicherungen bestätigen, erst danach Originale entfernen.
        for (const item of candidates) {
            const data = unchangedCandidate(root, item); ensureDirectories(backupDir, item.relative);
            writeExclusive(path.join(backupDir, item.relative), data);
            if (readSnapshot(backupDir, item.relative).sha256 !== item.snapshot.sha256) stop('EOS_PUBLISH_BACKUP', 'Sicherung konnte nicht bestätigt werden.');
            item.state = 'copied'; receipt('backing-up');
        }
        verifyCurrent(root, seal); checkAdminTree(root);
        for (const item of candidates) {
            unchangedCandidate(root, item);
            fs.unlinkSync(path.join(root, item.relative)); item.state = 'removed'; receipt('removing');
        }
        const verifiedFiles = api.check();
        if (readSnapshot(root, SEAL).sha256 !== seal.snapshot.sha256) stop('EOS_PUBLISH_RACE', 'Release-Versiegelung während der Vorbereitung verändert.');
        receipt('complete');
        return { version: seal.version, quarantined: candidates.map(item => item.relative), backupDir, verifiedFiles };
    } catch (error) {
        let conflicts = 0;
        for (const item of candidates) {
            if (item.state !== 'removed') continue;
            try {
                ensureDirectories(root, item.relative);
                const stored = readSnapshot(backupDir, item.relative, true);
                if (stored.sha256 !== item.snapshot.sha256) stop('EOS_PUBLISH_BACKUP', 'Sicherung vor Rückfall verändert.');
                writeExclusive(path.join(root, item.relative), /** @type {Buffer} */ (stored.data));
                if (readSnapshot(root, item.relative).sha256 !== item.snapshot.sha256) stop('EOS_PUBLISH_RESTORE_CONFLICT', 'Rückgesicherte Datei wurde verändert.');
                item.state = 'restored';
            } catch { item.state = 'restore-conflict'; conflicts++; }
        }
        const code = error instanceof PublishPreparationError ? error.code : 'EOS_PUBLISH_IO';
        try { receipt(conflicts ? 'restore-conflict' : 'aborted-restored', code); } catch { /* Sicherung bleibt auch bei vollem Datenträger erhalten. */ }
        return stop(conflicts ? 'EOS_PUBLISH_RESTORE_CONFLICT' : code, `Vorbereitung abgebrochen. ${conflicts ? 'Ein Rückfall war nicht vollständig möglich; neue Dateien wurden nicht überschrieben. ' : 'Bereits entfernte Originale wurden zurückgesichert. '}Sicherung und Wiederherstellungsplan: ${backupDir}`);
    } finally { if (receiptFd !== undefined) fs.closeSync(receiptFd); }
}
if (require.main === module) {
    try {
        if (process.argv.length > 2) stop('EOS_PUBLISH_ARGUMENTS', 'Aufruf ohne Zusatzparameter; im Repository npm publish verwenden.');
        const result = preparePublish();
        if (result.quarantined.length) console.log(`[EOS npm] ${result.quarantined.length} bestätigte alte Admin-Dateien gesichert. Sicherung: ${result.backupDir}`);
        console.log(`[EOS npm] ${result.version}: ${result.verifiedFiles} aktuelle Release-Dateien unverändert geprüft; Veröffentlichung wird fortgesetzt.`);
    } catch (error) {
        console.error(`[EOS npm] ${error instanceof PublishPreparationError ? error.message : 'Vorbereitung fehlgeschlagen; keine Veröffentlichung. Repository und Schreibrechte prüfen.'}`);
        process.exitCode = 1;
    }
}
module.exports = { preparePublish, PublishPreparationError };
