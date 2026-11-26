"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.record = record;
exports.fail = fail;
exports.str = str;
exports.num = num;
exports.flag = flag;
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function fail(code) {
    return Object.assign(new Error(code), { code });
}
function str(c, key, fallback = '') {
    const v = c[key];
    return typeof v === 'string' ? v : fallback;
}
function num(c, key, fallback) {
    const v = Number(c[key]);
    return Number.isFinite(v) ? v : fallback;
}
function flag(c, key) {
    return c[key] === true;
}
