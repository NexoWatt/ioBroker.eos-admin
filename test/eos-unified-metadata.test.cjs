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
test('own instance states have meaningful roles without changing existing state types', () => {
    const io = require('../io-package.json');
    const states = io.instanceObjects.filter(object => object.type === 'state');
    assert.ok(states.length > 0);
    for (const state of states) {
        assert.equal(typeof state.common.role, 'string', `${state._id}: missing role`);
        assert.notEqual(state.common.role, 'state', `${state._id}: generic role obscures the state purpose`);
    }
    const expected = {
        'info.connected': ['string', 'text'],
        'info.newsFeed': ['json', 'json'],
        'info.newsETag': ['string', 'text'],
        'info.newsLastId': ['string', 'text'],
        'info.connection': ['boolean', 'indicator.connected'],
    };
    for (const [id, metadata] of Object.entries(expected)) {
        const state = states.find(object => object._id === id);
        assert.ok(state, id);
        assert.deepEqual([state.common.type, state.common.role], metadata, id);
        assert.equal(state.common.write, false, `${id}: diagnostic state must remain read-only`);
    }
});
test('one installable adapter and a retained Express4 UI runtime', () => {
    const p = require('../package.json');
    assert.ok(!p.dependencies['iobroker.nexowatt-ui']);
    assert.match(p.dependencies.express4, /^npm:express@4\./);
    assert.equal(require('express4/package.json').version, '4.22.3');
    assert.equal(p.license, 'SEE LICENSE IN LICENSE');
});
