/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
// @ts-check
const { isAbsolute, join, relative, sep, win32 } = require('node:path');
/**
 * @param {unknown} value Candidate exception or record.
 * @returns {value is Record<string, unknown>} Whether named properties can be inspected.
 */
const record = value => value !== null && typeof value === 'object';
/**
 * @param {string} value Absolute runtime source filename.
 * @param {string} baseDir Installed EOS package root.
 * @returns {string|null} Bounded package-relative source name, or no publishable path.
 */
function packagePath(value, baseDir) {
    if (!isAbsolute(value)) {
        return null;
    }
    const local = relative(baseDir, value).split(sep).join('/');
    return /^(?:modules|build|node_modules)\/[A-Za-z0-9@._/-]{1,200}$/.test(local) && !local.split('/').includes('..')
        ? local
        : null;
}
/**
 * Preserve an actionable missing-import diagnosis without publishing the raw
 * exception, absolute installation paths, configuration or a JavaScript stack.
 * The process boundary transports only the fixed error code; detail stays in
 * the administrator's bounded server log.
 *
 * @param {unknown} issue Original module-loading exception.
 * @param {string} baseDir Installed EOS package root.
 * @param {string} id Known hosted module identifier.
 * @param {(message:string)=>void} report Administrator log sink.
 * @returns {(Error & {code:string})|null} Fixed transport-safe error, or null for an unrelated failure.
 */
function reportModuleLoadFailure(issue, baseDir, id, report) {
    if (!record(issue) || !['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(String(issue.code))) {
        return null;
    }
    const moduleId = /^(?:devices|eebus|backup|ocpp)$/.test(id) ? id : 'unknown';
    const message = typeof issue.message === 'string' && issue.message.length <= 16384 ? issue.message : '';
    const requested = /^Cannot find (?:module|package) ['"]([^'"\r\n]{1,512})['"]/.exec(message)?.[1];
    let missing = 'unavailable';
    if (requested) {
        if (isAbsolute(requested) || win32.isAbsolute(requested)) {
            missing = packagePath(requested, baseDir) || 'outside-package';
        }
        else if (/^(?:@?[A-Za-z0-9][A-Za-z0-9._/-]*|\.{1,2}\/[A-Za-z0-9._/-]+)$/.test(requested) &&
            requested.length <= 200) {
            missing = requested;
        }
    }
    const sources = Array.isArray(issue.requireStack)
        ? issue.requireStack
            .slice(0, 8)
            .filter(value => typeof value === 'string')
            .map(value => packagePath(value, baseDir))
            .filter(value => value !== null)
            .slice(0, 3)
        : [];
    const detail = `EOS_MODULE_DEPENDENCY_MISSING: ${moduleId}; missing=${missing}; from=${sources.join(' <- ') || 'unavailable'}`;
    report(detail);
    return Object.assign(new Error('EOS_MODULE_DEPENDENCY_MISSING'), { code: 'EOS_MODULE_DEPENDENCY_MISSING' });
}
/**
 * @param {string} baseDir Installed EOS package root.
 * @param {string} id Known hosted module identifier.
 * @param {(message:string)=>void} report Administrator log sink.
 * @returns {unknown} Module exports for validation by the receiving boundary.
 */
function loadModuleFactory(baseDir, id, report) {
    if (!/^(?:devices|eebus|backup|ocpp)$/.test(id)) {
        throw Object.assign(new Error('EOS_MODULE_UNKNOWN'), { code: 'EOS_MODULE_UNKNOWN' });
    }
    try {
        return require(join(baseDir, 'modules', id, 'index.js'));
    }
    catch (issue) {
        throw reportModuleLoadFailure(issue, baseDir, id, report) || issue;
    }
}
module.exports = { loadModuleFactory, reportModuleLoadFailure };
//# sourceMappingURL=eosModuleLoad.js.map