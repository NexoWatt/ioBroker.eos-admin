#!/usr/bin/env node
'use strict';
// Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE.
// Derive runtime closure from the full npm CycloneDX 1.5 graph, then add
// reviewed vendored code. Shared production/development nodes stay included.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const vendor = require('./nexowatt-vendored-webserver.cjs');
const ROOT = path.resolve(__dirname, '..');
const BOM_PATH = 'release-manifests/unified/runtime.cdx.json';
const FULL_BOM_PATH = 'release-manifests/unified/build-environment.cdx.json';
const HASH = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function readRegular(relative, maxBytes) {
    let file = ROOT;
    for (const part of relative.split('/')) {
        if (!part || part === '.' || part === '..' || part.includes('\\')) throw new Error('SBOM_PATH_INVALID');
        file = path.join(file, part);
        if (fs.lstatSync(file).isSymbolicLink()) throw new Error('SBOM_SYMLINK_REJECTED');
    }
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const stat = fs.fstatSync(descriptor);
        if (!stat.isFile() || stat.size > maxBytes) throw new Error('SBOM_INPUT_LIMIT');
        const bytes = fs.readFileSync(descriptor);
        if (bytes.length > maxBytes) throw new Error('SBOM_INPUT_LIMIT');
        return bytes;
    } finally { fs.closeSync(descriptor); }
}

function selectRuntime(full, pkg, lock) {
    if (full.bomFormat !== 'CycloneDX' || full.specVersion !== '1.5' || !Array.isArray(full.components) ||
        !Array.isArray(full.dependencies) || full.metadata?.component?.name !== pkg.name ||
        full.metadata.component.version !== pkg.version || !pkg.dependencies ||
        lock.packages?.['']?.version !== pkg.version || lock.packages[''].name !== pkg.name) throw new Error('SBOM_FULL_INPUT_INVALID');
    const rootRef = full.metadata.component['bom-ref'];
    const components = new Map();
    for (const component of full.components) {
        const ref = component['bom-ref'];
        if (typeof ref !== 'string' || !ref || components.has(ref) || ref === rootRef) throw new Error('SBOM_COMPONENT_REFS_INVALID');
        components.set(ref, component);
    }
    const dependencies = new Map();
    for (const row of full.dependencies) {
        if (typeof row.ref !== 'string' || dependencies.has(row.ref) || !Array.isArray(row.dependsOn) ||
            row.dependsOn.some(ref => typeof ref !== 'string' || !ref)) throw new Error('SBOM_GRAPH_INVALID');
        dependencies.set(row.ref, row);
    }
    if (!dependencies.has(rootRef)) throw new Error('SBOM_ROOT_DEPENDENCY_INVALID');
    const directRefs = Object.entries(pkg.dependencies).map(([name, specifier]) => {
        const entry = lock.packages[`node_modules/${name}`];
        if (!entry || entry.link || typeof entry.version !== 'string' || lock.packages[''].dependencies?.[name] !== specifier) throw new Error('SBOM_LOCK_DEPENDENCY_INVALID');
        const ref = `${entry.name || name}@${entry.version}`;
        const component = components.get(ref);
        if (!component || component.version !== entry.version || ![name, entry.name || name].includes(component.name) ||
            !dependencies.get(rootRef).dependsOn.includes(ref)) throw new Error('SBOM_DIRECT_DEPENDENCY_MISSING');
        return ref;
    });
    const selected = new Set();
    const queue = [...new Set(directRefs)];
    for (let index = 0; index < queue.length; index++) {
        const ref = queue[index];
        if (selected.has(ref)) continue;
        if (ref === rootRef || !components.has(ref) || !dependencies.has(ref)) throw new Error('SBOM_GRAPH_REFERENCE_MISSING');
        selected.add(ref);
        queue.push(...dependencies.get(ref).dependsOn.filter(child => !selected.has(child)));
    }
    const result = structuredClone(full);
    result.components = result.components.filter(component => selected.has(component['bom-ref']));
    result.dependencies = result.dependencies.filter(row => row.ref === rootRef || selected.has(row.ref));
    result.dependencies.find(row => row.ref === rootRef).dependsOn = [...new Set(directRefs)];
    return { bom: result, directRefs: [...new Set(directRefs)] };
}

function enrich(bom, pkg, provenance, provenanceSha256) {
    if (pkg.name !== 'iobroker.eos-admin' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(pkg.version || '') ||
        bom.bomFormat !== 'CycloneDX' || bom.specVersion !== '1.5' ||
        bom.metadata?.component?.name !== pkg.name || bom.metadata.component.version !== pkg.version ||
        !Array.isArray(bom.components) || !Array.isArray(bom.dependencies) ||
        !Number.isSafeInteger(bom.version) || bom.version < 1 || bom.version === Number.MAX_SAFE_INTEGER ||
        !/^[a-f0-9]{64}$/.test(provenanceSha256 || '') ||
        provenance.name !== '@iobroker/webserver' || provenance.version !== '3.4.0' || provenance.upstream?.license !== 'MIT' ||
        !/^[a-f0-9]{64}$/.test(provenance.upstream.sha256 || '') || !Array.isArray(provenance.changes?.reviewedPatches)) {
        throw new Error('SBOM_INPUT_INVALID');
    }
    const result = structuredClone(bom);
    const rootRef = result.metadata.component['bom-ref'];
    const rootDependencies = result.dependencies.filter(row => row.ref === rootRef);
    if (typeof rootRef !== 'string' || !rootRef || rootDependencies.length !== 1 || !Array.isArray(rootDependencies[0].dependsOn)) throw new Error('SBOM_ROOT_DEPENDENCY_INVALID');
    const refs = result.components.map(row => row['bom-ref']);
    if (refs.some(ref => typeof ref !== 'string' || !ref) || new Set(refs).size !== refs.length) throw new Error('SBOM_COMPONENT_REFS_INVALID');
    const version = `${provenance.version}+nexowatt.${pkg.version}`;
    const ref = `nexowatt:vendored:webserver@${version}`;
    const properties = [
        { name: 'nexowatt:distribution', value: 'vendored-source' },
        // CycloneDX 1.5 deprecates component.modified: pedigree carries the ancestry.
        { name: 'nexowatt:modified', value: 'true' },
        { name: 'nexowatt:provenance:path', value: vendor.PROVENANCE },
        { name: 'nexowatt:provenance:sha256', value: provenanceSha256 },
        { name: 'nexowatt:source-root', value: provenance.sourceRoot },
        { name: 'nexowatt:runtime-root', value: provenance.runtimeRoot },
    ];
    for (const patch of provenance.changes.reviewedPatches) {
        if (typeof patch.id !== 'string' || typeof patch.path !== 'string' || !/^[a-f0-9]{64}$/.test(patch.sha256 || '')) throw new Error('SBOM_PATCH_INVALID');
        properties.push({ name: `nexowatt:patch:${patch.id}:path`, value: patch.path });
        properties.push({ name: `nexowatt:patch:${patch.id}:sha256`, value: patch.sha256 });
    }
    const component = {
        'bom-ref': ref,
        type: 'library',
        name: provenance.name,
        version,
        scope: 'required',
        description: 'Locally vendored @iobroker/webserver 3.4.0 with two reviewed certificate-material logging replacements; not an unmodified registry release.',
        licenses: [{ license: { id: 'MIT' } }],
        pedigree: {
            ancestors: [{
                type: 'library', name: provenance.name, version: provenance.version,
                purl: 'pkg:npm/%40iobroker/webserver@3.4.0',
                hashes: [{ alg: 'SHA-256', content: provenance.upstream.sha256 }],
                licenses: [{ license: { id: 'MIT' } }],
                externalReferences: [{ type: 'distribution', url: provenance.upstream.url }],
            }],
            notes: 'Original upstream archive and file hashes are retained in the bound provenance. Only collection counts and certificate availability remain in the two reviewed log messages.',
        },
        properties,
    };
    const directRefs = [];
    for (const [name, expected] of Object.entries(provenance.directDependencies)) {
        const canonicalName = expected.entry.name || name;
        const purl = `pkg:npm/${canonicalName.replace('@', '%40')}@${expected.entry.version}`;
        const matches = result.components.filter(row => row.version === expected.entry.version &&
            (row.purl === purl || [name, canonicalName].includes(row.name)));
        if (matches.length !== 1) throw new Error('SBOM_VENDOR_DEPENDENCY_MISSING');
        directRefs.push(matches[0]['bom-ref']);
    }
    const existing = result.components.filter(row => row['bom-ref'].startsWith('nexowatt:vendored:webserver@'));
    if (existing.length > 1 || (existing.length === 1 && !isDeepStrictEqual(existing[0], component))) throw new Error('SBOM_VENDOR_CONFLICT');
    if (!existing.length) result.components.push(component);
    if (!rootDependencies[0].dependsOn.includes(ref)) rootDependencies[0].dependsOn.push(ref);
    const expectedDependency = { ref, dependsOn: directRefs };
    const dependency = result.dependencies.filter(row => row.ref === ref);
    if (dependency.length > 1 || (dependency.length && !isDeepStrictEqual(dependency[0], expectedDependency))) throw new Error('SBOM_VENDOR_DEPENDENCY_CONFLICT');
    if (!dependency.length) result.dependencies.push(expectedDependency);
    if (isDeepStrictEqual(result, bom)) return { bom: result, changed: false, ref };
    result.version += 1;
    return { bom: result, changed: true, ref };
}

/** Record integrated proprietary source modules alongside their locked protocol dependencies. */
function enrichModules(bom, pkg, root = ROOT) {
    const result = structuredClone(bom);
    const rootRow = result.dependencies.find(row => row.ref === result.metadata.component['bom-ref']);
    if (!rootRow) throw new Error('SBOM_MODULE_ROOT_MISSING');
    for (const id of ['devices', 'eebus', 'backup']) {
        const directory = `modules/${id}`;
        const file = path.join(root, directory, 'provenance.json');
        const bytes = fs.readFileSync(file);
        const origin = JSON.parse(bytes);
        const ref = `nexowatt:integrated:${id}@${pkg.version}`;
        const hashes = [];
        const visit = relative => {
            for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
                const local = `${relative}/${name}`;
                const stat = fs.lstatSync(path.join(root, local));
                if (stat.isSymbolicLink()) throw new Error('SBOM_MODULE_SYMLINK');
                if (name === 'node_modules' || name === '.git') throw new Error('SBOM_MODULE_UNEXPECTED_TREE');
                if (stat.isDirectory()) visit(local);
                else if (stat.isFile()) hashes.push([local, HASH(fs.readFileSync(path.join(root, local)))]);
                else throw new Error('SBOM_MODULE_FILE_INVALID');
            }
        };
        visit(directory);
        if (typeof origin.version !== 'string' || typeof origin.name !== 'string') throw new Error('SBOM_MODULE_PROVENANCE_INVALID');
        const component = { type: 'library', 'bom-ref': ref, name: `NexoWatt EOS integrated ${id}`, version: pkg.version,
            scope: 'required', licenses: [{ license: { name: 'NexoWatt Proprietary License' } }],
            hashes: [{ alg: 'SHA-256', content: HASH(JSON.stringify(hashes)) }],
            pedigree: { ancestors: [{ type: 'library', name: origin.name, version: origin.version,
                ...(origin.upstream?.license === 'MIT' ? { licenses: [{ license: { id: 'MIT' } }] } : {}) }],
                notes: 'Modified integrated source; upstream license notices remain applicable. Target-device commissioning and backup recovery acceptance are separate from software tests.' },
            properties: [{ name: 'nexowatt:source-root', value: directory },
                { name: 'nexowatt:provenance:sha256', value: HASH(bytes) },
                { name: 'nexowatt:tree-hash-format', value: 'SHA-256 of sorted relative path / SHA-256 JSON pairs' }] };
        if (result.components.some(row => row['bom-ref'] === ref)) throw new Error('SBOM_MODULE_DUPLICATE');
        result.components.push(component);
        rootRow.dependsOn.push(ref);
        const names = id === 'devices' ? ['axios', 'modbus-serial', 'mqtt', 'serialport']
            : id === 'eebus' ? ['ws', 'bonjour-service']
                : ['tar-fs', 'cron-parser', 'ftp', 'dropbox', 'fast-xml-parser', 'axios', 'mqtt'];
        const dependsOn = names.map(name => {
            const item = result.components.find(row => row.name === name && row.version === require(path.join(root, 'package-lock.json')).packages[`node_modules/${name}`].version);
            if (!item) throw new Error('SBOM_MODULE_DEPENDENCY_MISSING');
            return item['bom-ref'];
        });
        result.dependencies.push({ ref, dependsOn });
    }
    return result;
}

function main(args) {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('SBOM_ARGUMENTS_INVALID');
    let bytes = null;
    try { bytes = readRegular(BOM_PATH, 16 * 1024 * 1024); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const pkg = JSON.parse(readRegular('package.json', 1024 * 1024));
    const lock = JSON.parse(readRegular('package-lock.json', 16 * 1024 * 1024));
    const admission = vendor.inspectVendoredWebserver(pkg, lock, ROOT);
    if (admission) throw new Error(admission);
    const provenanceBytes = readRegular(vendor.PROVENANCE, 64 * 1024);
    const full = JSON.parse(readRegular(FULL_BOM_PATH, 16 * 1024 * 1024));
    const runtime = selectRuntime(full, pkg, lock);
    const output = enrich(runtime.bom, pkg, JSON.parse(provenanceBytes), HASH(provenanceBytes));
    output.bom = enrichModules(output.bom, pkg);
    const serialized = Buffer.from(JSON.stringify(output.bom, null, 2) + '\n');
    const changed = !bytes || !serialized.equals(bytes);
    if (args[0] === '--check' && changed) throw new Error('SBOM_VENDOR_ENRICHMENT_REQUIRED');
    if (changed) {
        // Detect another release step replacing the input while enrichment runs.
        let current = null;
        try { current = readRegular(BOM_PATH, 16 * 1024 * 1024); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (bytes ? !current?.equals(bytes) : current !== null) throw new Error('SBOM_INPUT_CHANGED');
        const target = path.join(ROOT, BOM_PATH);
        const temporary = `${target}.vendored-${process.pid}.tmp`;
        let created = false;
        try {
            fs.writeFileSync(temporary, serialized, { flag: 'wx', mode: 0o644 });
            created = true;
            fs.renameSync(temporary, target);
        } finally {
            if (created) {
                // Preserve the write/rename error; an undeletable temporary BOM
                // is never treated as the completed target or as a successful run.
                try { fs.unlinkSync(temporary); } catch { /* Already renamed, or original failure remains authoritative. */ }
            }
        }
    }
    process.stdout.write(JSON.stringify({ changed, component: output.ref, fullComponents: full.components.length,
        runtimeDirectDependencies: runtime.directRefs.length, components: output.bom.components.length, bomVersion: output.bom.version }) + '\n');
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) {
        process.stderr.write(`EOS vendored SBOM: ${/^(?:SBOM|VENDORED)_[A-Z_]+$/.test(error.message) ? error.message : 'SBOM_FAILED'}\n`);
        process.exitCode = 1;
    }
}
module.exports = { enrich, selectRuntime, enrichModules };
