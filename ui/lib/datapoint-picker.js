/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/datapoint-picker.ts
 * Quell-Hash: sha256:2395476303e197eed42fa43f1a8524351343b5cdd576ed1384d388e517360177
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/datapoint-picker.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDatapointPicker = registerDatapointPicker;
const ephemeral_cache_1 = require("./ephemeral-cache");
function buildPickerTree(items) {
    const root = { children: null, item: null };
    for (const item of items) {
        if (!item.id)
            continue;
        let node = root;
        for (const segment of item.id.split('.')) {
            if (!segment)
                continue;
            const children = node.children ?? (node.children = Object.create(null));
            node = children[segment] ?? (children[segment] = { children: null, item: null });
        }
        node.item = item;
    }
    return root;
}
const SEARCH_MAX_AGE_MS = 15000;
const TREE_MAX_AGE_MS = 30000;
const ALLOWED_TYPES = new Set(['boolean', 'number', 'string']);
const PREFERRED_PREFIXES = ['0_userdata.0.', 'alias.0.', 'javascript.0.'];
function csvFilter(value, maxItems, validator) {
    if (value === undefined)
        return new Set();
    if (typeof value !== 'string' || !value || value.length > 1024)
        return null;
    const entries = value.split(',');
    return entries.length <= maxItems && entries.every(validator) ? new Set(entries) : null;
}
/** Shares one idle-expiring state metadata index between the two installer views. */
function registerDatapointPicker(app, owner, requireDpDiscovery, time) {
    let closed = false;
    const snapshot = new ephemeral_cache_1.ExpiringSnapshot(async () => {
        if (closed)
            throw new Error('EOS_UI_STOPPING');
        const objects = (await owner.getForeignObjectsAsync?.('*', 'state')) || {};
        if (closed)
            throw new Error('EOS_UI_STOPPING');
        const items = [];
        for (const id of Object.keys(objects)) {
            const common = objects[id]?.common;
            if (!common)
                continue;
            const nameRaw = common.name || '';
            const name = typeof nameRaw === 'string' ? nameRaw : JSON.stringify(nameRaw);
            items.push({
                id,
                name,
                role: common.role || '',
                type: common.type || '',
                unit: common.unit || '',
                read: common.read === true,
                write: common.write === true,
                idLower: id.toLowerCase(),
                nameLower: String(name).toLowerCase(),
            });
        }
        items.sort((a, b) => a.idLower.localeCompare(b.idLower));
        return { items, trie: null };
    }, TREE_MAX_AGE_MS, time);
    app.get('/api/smarthome/dpsearch', requireDpDiscovery, async (req, res) => {
        try {
            const qLower = String(req.query?.q || '').trim().toLowerCase();
            const direction = req.query?.direction;
            const types = csvFilter(req.query?.types, 3, value => ALLOWED_TYPES.has(value));
            const roles = csvFilter(req.query?.roles, 16, value => /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(value));
            if ((direction !== undefined && direction !== 'read' && direction !== 'write') || !types || !roles) {
                return void res.status(400).json({ ok: false, error: 'EOS_DP_FILTER_INVALID' });
            }
            const requestedLimit = Number.parseInt(String(req.query?.limit || ''), 10);
            const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 5000) : 200;
            if (typeof owner.getForeignObjectsAsync !== 'function') {
                owner.log.warn('SmartHomeConfig dpsearch: getForeignObjectsAsync not available');
                return void res.json({ ok: false, error: 'datapoint search not supported' });
            }
            const { items } = await snapshot.get(false, SEARCH_MAX_AGE_MS);
            const results = [];
            const seen = new Set();
            const matchesQuery = (item) => !qLower || item.idLower.includes(qLower) || item.nameLower.includes(qLower)
                || (direction && typeof item.role === 'string' && item.role.toLowerCase().includes(qLower));
            const pushItem = (item) => {
                const { id, name, role, type, unit, read, write } = item;
                if (!id || seen.has(id) || (direction && item[direction] !== true) || (types.size && !types.has(type)))
                    return;
                seen.add(id);
                results.push({ id, name, role, type, unit, read, write });
            };
            // Reserving the first matches by role keeps a useful result near the top of a large tree.
            if (roles.size) {
                for (const item of items) {
                    if (roles.has(item.role) && matchesQuery(item))
                        pushItem(item);
                    if (results.length >= limit)
                        return void res.json({ ok: true, results });
                }
            }
            if (!qLower) {
                for (const prefix of PREFERRED_PREFIXES) {
                    for (const item of items) {
                        if (!item.idLower.startsWith(prefix))
                            continue;
                        pushItem(item);
                        if (results.length >= limit)
                            return void res.json({ ok: true, results });
                    }
                }
            }
            for (const item of items) {
                if (matchesQuery(item))
                    pushItem(item);
                if (results.length >= limit)
                    break;
            }
            res.json({ ok: true, results });
        }
        catch (error) {
            owner.log.warn('SmartHomeConfig dpsearch error: ' + (error instanceof Error ? error.message : String(error)));
            res.status(500).json({ ok: false, error: 'internal error' });
        }
    });
    app.get(['/api/object/tree', '/api/smarthome/object/tree'], requireDpDiscovery, async (req, res) => {
        try {
            const prefix = String(req.query?.prefix || '').trim();
            if (typeof owner.getForeignObjectsAsync !== 'function') {
                return void res.status(500).json({ ok: false, error: 'getForeignObjectsAsync not available' });
            }
            const index = await snapshot.get(false, TREE_MAX_AGE_MS);
            const parts = prefix ? prefix.split('.').filter(Boolean) : [];
            let node = index.trie ?? (index.trie = buildPickerTree(index.items));
            for (const segment of parts) {
                const child = node.children?.[segment];
                if (!child)
                    return void res.json({ ok: true, prefix, children: [] });
                node = child;
            }
            const branches = node.children;
            if (!branches)
                return void res.json({ ok: true, prefix, children: [] });
            const labels = Object.keys(branches).sort((a, b) => a.localeCompare(b));
            const children = labels.map(label => {
                const child = branches[label];
                const item = child?.item;
                return {
                    id: prefix ? `${prefix}.${label}` : label,
                    label,
                    hasChildren: !!child.children,
                    isState: !!item,
                    name: item ? item.name : '',
                    role: item ? item.role : '',
                    type: item ? item.type : '',
                    unit: item ? item.unit : '',
                    ...(item ? { read: item.read, write: item.write } : {}),
                };
            });
            res.json({ ok: true, prefix, children });
        }
        catch (error) {
            try {
                owner.log.warn('object tree API error: ' + (error instanceof Error ? error.message : String(error)));
            }
            catch { /* response still required */ }
            res.status(500).json({ ok: false, error: 'internal error' });
        }
    });
    return { close() { closed = true; snapshot.close(); } };
}
