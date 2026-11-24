'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArguments, resolveController, validAcl, decodeOutput, createCliReader, assessObject, collectDiagnostics, writeReport } = require('../tools/eos-coexistence-recovery.cjs');
const prior = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x664, state: 0x664 };
const current = { ...prior, object: 0x660 };
const id = 'system.adapter.backitup.0';
const observed = (acl = current, old = prior) => [{ value: acl }, { value: true }, { value: old }];

test('recovery defaults to check and rejects all writes and unknown target paths', () => {
    const options = parseArguments(['--check']);
    assert.equal(options.directory, '/opt/iobroker');
    assert.ok(options.ids.includes(id));
    assert.ok(parseArguments(['--object', 'system.adapter.backitup.2']).ids.includes('system.adapter.backitup.2'));
    for (const args of [['--apply'], ['--check', '--apply'], ['--iobroker-dir', 'relative'], ['--output', 'relative'], ['--exec', '/bin/sh'], ['--object', 'system.adapter.javascript.0'], ['--object', 'backitup.0; echo bad'], ['--check', '--check']]) assert.throws(() => parseArguments(args), /ARGUMENTS_INVALID|APPLY_NOT_SUPPORTED/);
});

test('valid saved ACL with exact old EOS target produces only a conditional review proposal', () => {
    const reads = observed(); const before = structuredClone(reads);
    const result = assessObject(id, reads);
    assert.equal(result.status, 'REVIEW_PRIOR_ACL_RESTORE');
    assert.equal(result.applied, false);
    assert.equal(result.action, 'MANUAL_REVIEW_ONLY');
    assert.deepEqual(result.priorAcl, prior);
    assert.deepEqual(reads, before);
});

test('changed current ACL including preserved state bits never gets a restore proposal', () => {
    for (const acl of [{ ...current, object: 0x666 }, { ...current, owner: 'system.user.other' }, { ...current, ownerGroup: 'system.group.custom' }, { ...current, state: 0x660 }]) {
        const result = assessObject(id, observed(acl));
        assert.equal(result.status, 'CURRENT_ACL_CHANGED_OR_CUSTOM_GROUP');
        assert.equal(result.priorAcl, undefined);
        assert.equal(result.applied, false);
    }
});

test('missing, corrupt and non-ACL preimages are preserved without invented defaults', () => {
    for (const value of [null, undefined, 'broken JSON with private-value', [], {}, { ...prior, object: 0x999 }, { ...prior, access_token: 'private-value' }, JSON.parse('{"__proto__":{"admin":true}}')]) {
        const result = assessObject(id, [{ value: current }, { value: true }, { value }]);
        assert.match(result.status, /^PRIOR_ACL_(?:MISSING|INVALID)$/);
        assert.equal(result.priorAcl, undefined);
        assert.equal(JSON.stringify(result).includes('private-value'), false);
    }
    const result = assessObject(id, [{ value: current }, { value: true }, { absent: true }]);
    assert.equal(result.status, 'PRIOR_ACL_MISSING');
});

test('unmanaged or unreadable objects never become write candidates', () => {
    for (const marker of [{ absent: true }, { value: false }, { value: null }]) assert.equal(assessObject(id, [{ value: current }, marker, { value: prior }]).status, 'NOT_MANAGED');
    assert.equal(assessObject(id, [{ error: 'CLI_READ_FAILED' }, { value: true }, { value: prior }]).status, 'READ_UNAVAILABLE');
    assert.throws(() => assessObject('system.adapter.javascript.0', observed()), /OBJECT_NOT_ALLOWED/);
});

test('only bounded ordinary ACLs and JSON values can be reported', () => {
    assert.equal(validAcl(prior), true);
    assert.equal(validAcl({ ...prior, object: -1 }), false);
    assert.equal(validAcl({ ...prior, object: 0x800 }), false);
    assert.equal(validAcl({ ...prior, owner: 'system.user.admin\nprivate-value' }), false);
    assert.deepEqual(decodeOutput('undefined\n'), { absent: true });
    assert.deepEqual(decodeOutput(JSON.stringify(prior)), { value: prior });
    assert.deepEqual(decodeOutput('x'.repeat(16385)), { error: 'OUTPUT_LIMIT' });
    assert.deepEqual(decodeOutput('private-value'), { error: 'VALUE_INVALID' });
});

test('reader executes only fixed property gets without shell or inherited Node injection', async () => {
    const target = { cli: '/tmp/path;not-a-command/iobroker.js', directory: '/tmp/path;not-a-command' };
    const reader = createCliReader(target, (binary, argv, options, callback) => {
        assert.equal(binary, process.execPath);
        assert.deepEqual(argv, [target.cli, 'object', 'get', id, 'acl']);
        assert.equal(options.shell, false);
        assert.equal(options.env.NODE_OPTIONS, undefined);
        assert.equal(options.env.NODE_PATH, undefined);
        assert.equal(options.maxBuffer, 16384);
        assert.ok(options.timeout > 0 && options.timeout <= 5000);
        callback(null, JSON.stringify(current));
    });
    assert.deepEqual(await reader(id, 'acl'), { value: current });
    const denied = createCliReader(target, () => assert.fail('forbidden request spawned'));
    for (const [object, field] of [[id, 'native'], [id, 'common.password'], [id, 'acl=666'], ['system.user.admin', 'common.password']]) assert.deepEqual(await denied(object, field), { error: 'READ_NOT_ALLOWED' });
});

test('child failures never expose stderr or sensitive output', async () => {
    const reader = createCliReader({ cli: '/tmp/iobroker.js', directory: '/tmp' }, (_binary, _argv, _options, callback) => {
        callback(Object.assign(new Error('private-value'), { stderr: 'private-value', killed: true }), 'private-value');
    });
    const result = await reader(id, 'acl');
    assert.deepEqual(result, { error: 'TIMEOUT' });
    assert.equal(JSON.stringify(result).includes('private-value'), false);
});

test('administrator capability damage without preimage is diagnosed but not reset', async () => {
    const report = await collectDiagnostics(async (_id, field) => {
        if (field === 'common.acl.file') return { value: { list: false, read: false, write: true, create: true, delete: true } };
        return { absent: true };
    }, [id], '7.2.5');
    assert.equal(report.readOnly, true);
    assert.equal(report.administratorFilePermissions.status, 'REVIEW_FILE_CAPABILITIES_NO_PREIMAGE');
    assert.equal(report.administratorFilePermissions.applied, false);
    assert.equal(report.objects[0].status, 'NOT_MANAGED');
});

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-coexistence-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const controller = path.join(root, 'node_modules/iobroker.js-controller');
    fs.mkdirSync(controller, { recursive: true });
    fs.writeFileSync(path.join(controller, 'package.json'), JSON.stringify({ name: 'iobroker.js-controller', version: '7.2.5' }));
    const stateFile = path.join(root, 'fixture-state.json');
    fs.writeFileSync(stateFile, JSON.stringify({ configuration: 'keep', access_token: 'private-value' }));
    const logFile = path.join(root, 'fixture-calls.jsonl');
    fs.writeFileSync(path.join(controller, 'iobroker.js'), `
        const fs = require('node:fs');
        const args = process.argv.slice(2);
        fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(args) + '\\n');
        if (args[0] !== 'object' || args[1] !== 'get') throw new Error('write forbidden');
        const fields = { acl: ${JSON.stringify(current)}, 'native._nexowattEosAclManaged': true, 'native._nexowattEosAclPrevious': ${JSON.stringify(JSON.stringify(prior))}, 'common.acl.file': { list: false, read: false } };
        const value = fields[args[3]];
        console.log(value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
    `);
    return { root, stateFile, logFile, controller };
}

test('standalone fake-controller run works after EOS removal and never writes live configuration', t => {
    const f = fixture(t); const stateBefore = fs.readFileSync(f.stateFile);
    const tool = path.resolve(__dirname, '../tools/eos-coexistence-recovery.cjs');
    const reportPath = path.join(f.root, 'report.json');
    const output = execFileSync(process.execPath, [tool, '--check', '--iobroker-dir', f.root, '--output', reportPath], { encoding: 'utf8', timeout: 15000 });
    const report = JSON.parse(output);
    assert.equal(report.objects.find(row => row.id === id).status, 'REVIEW_PRIOR_ACL_RESTORE');
    assert.equal(report.applied, false);
    assert.equal(output.includes('private-value'), false);
    assert.deepEqual(fs.readFileSync(f.stateFile), stateBefore);
    assert.deepEqual(JSON.parse(fs.readFileSync(reportPath, 'utf8')), report);
    if (process.platform !== 'win32') assert.equal(fs.statSync(reportPath).mode & 0o077, 0);
    const calls = fs.readFileSync(f.logFile, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.length, 25);
    assert.ok(calls.every(args => args.length === 4 && args[0] === 'object' && args[1] === 'get'));
    assert.throws(() => execFileSync(process.execPath, [tool, '--apply', '--iobroker-dir', f.root], { stdio: 'pipe' }));
    assert.equal(fs.readFileSync(f.logFile, 'utf8').trim().split('\n').length, calls.length);
});

test('controller identity and report-file protections reject substitution or overwrite', t => {
    const f = fixture(t); assert.equal(resolveController(f.root).version, '7.2.5');
    fs.writeFileSync(path.join(f.controller, 'package.json'), JSON.stringify({ name: 'not-controller', version: '7.2.5' }));
    assert.throws(() => resolveController(f.root), /CONTROLLER_PATH_INVALID/);
    const output = path.join(f.root, 'existing'); fs.writeFileSync(output, 'keep');
    assert.throws(() => writeReport(output, { readOnly: true }), /REPORT_WRITE_FAILED/);
    assert.equal(fs.readFileSync(output, 'utf8'), 'keep');
});
