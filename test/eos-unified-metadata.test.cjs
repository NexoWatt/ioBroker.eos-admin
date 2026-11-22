'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const JSON5 = require('json5');
const root = path.resolve(__dirname, '..');
test('unified metadata validates against the unchanged upstream schema', () => {
    const ajv = new Ajv({allErrors: true, strict: false});
    ajv.addSchema(require('./schemas/jsonConfig.json'));
    const validate = ajv.compile(require('./schemas/io-package.json'));
    const io = require('../io-package.json');
    assert.ok(validate(io), JSON.stringify(validate.errors));
    assert.equal(io.common.version, require('../package.json').version);
    assert.equal(io.native.auth, true);
    assert.equal(io.native.bind, '0.0.0.0');
    assert.equal(io.native.secure, true);
    assert.equal(io.native.eosLockLegacyAdmin, false);
    assert.equal(io.native.certPublic, 'defaultPublic');
    assert.equal(io.native.certPrivate, 'defaultPrivate');
    assert.equal(io.native.port, 8188);
    assert.equal(io.common.licenseInformation.type, 'paid');
    assert.equal(io.common.compact, false);
});
test('ioBroker JSON configuration remains valid', () => {
    const ajv = new Ajv({allErrors: true, strict: false});
    const validate = ajv.compile(require('./schemas/jsonConfig.json'));
    const config = JSON5.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json5'), 'utf8'));
    assert.ok(validate(config), JSON.stringify(validate.errors));
});
test('one installable adapter and a retained Express4 UI runtime', () => {
    const p = require('../package.json');
    assert.ok(!p.dependencies['iobroker.nexowatt-ui']);
    assert.match(p.dependencies.express4, /^npm:express@4\./);
    assert.equal(require('express4/package.json').version, '4.22.3');
    assert.equal(p.license, 'SEE LICENSE IN LICENSE');
});
