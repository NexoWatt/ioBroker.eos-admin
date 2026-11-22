'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const helper = import('../src-admin/src/helpers/eosEntryLink.ts');
const utilities = import('../src-admin/src/helpers/utils.ts');
const pattern = '%protocol%://%bind%:%port%';

test('the current EOS entry uses the working HTTPS origin instead of the saved old port', async () => {
    const { currentEosEntryLink } = await helper;
    const { replaceLink } = await utilities;
    const context = {
        instances: { 'system.adapter.eos-admin.0': { _id: 'system.adapter.eos-admin.0', common: { name: 'eos-admin', host: 'test-host' }, native: { secure: true, bind: '192.0.2.40', port: 3188 } } },
        hostname: '192.0.2.40', adminInstance: 'eos-admin.0', hosts: {},
    };
    assert.equal(replaceLink(pattern, 'eos-admin', 0, context)[0].url, 'https://192.0.2.40:3188');
    assert.equal(currentEosEntryLink(pattern, 'eos-admin', 0, 'eos-admin.0', 'https://192.0.2.40:8188/system/#tab-instances'), 'https://192.0.2.40:8188/');
    assert.equal(context.instances['system.adapter.eos-admin.0'].native.port, 3188, 'link correction never mutates configured listeners');
});

test('HTTPS aliases, default 443, IPv6 and proxy access keep the exact current origin', async () => {
    const { currentEosEntryLink } = await helper;
    for (const [page, expected] of [
        ['https://NexoWattEOS:443/system/', 'https://nexowatteos/'],
        ['https://192.0.2.40/system/', 'https://192.0.2.40/'],
        ['https://[2001:db8::40]:8188/system/', 'https://[2001:db8::40]:8188/'],
        ['https://eos.example/system/?embedded=1', 'https://eos.example/'],
    ]) {
        assert.equal(currentEosEntryLink(`${pattern}/`, 'eos-admin', 0, 'eos-admin.0', page), expected);
    }
});

test('other instances, legacy UI, third-party links and custom pages retain their targets', async () => {
    const { currentEosEntryLink } = await helper;
    const page = 'https://nexowatteos/system/';
    for (const args of [
        [pattern, 'eos-admin', 1, 'eos-admin.0'],
        [pattern, 'eos-admin', 0, 'eos-admin.1'],
        [pattern, 'nexowatt-ui', 0, 'eos-admin.0'],
        [pattern, 'admin', 0, 'eos-admin.0'],
        [pattern, 'eos-admin', 0, ''],
        [`${pattern}/other-page`, 'eos-admin', 0, 'eos-admin.0'],
        ['https://docs.example/', 'eos-admin', 0, 'eos-admin.0'],
        ['https://custom.example:3188/', 'eos-admin', 0, 'eos-admin.0'],
    ]) assert.equal(currentEosEntryLink(...args, page), null);
});

test('an invalid or unencrypted browser URL never becomes a new EOS entry authority', async () => {
    const { currentEosEntryLink } = await helper;
    for (const page of ['http://192.0.2.40:8188/system/', 'http://localhost:3000/', 'file:///system/', '//nexowatteos/system/', 'https://user:secret@nexowatteos/system/', 'not a URL']) {
        assert.equal(currentEosEntryLink(pattern, 'eos-admin', 0, 'eos-admin.0', page), null);
    }
    for (const instance of [-1, NaN, Infinity, 0.5]) {
        assert.equal(currentEosEntryLink(pattern, 'eos-admin', instance, `eos-admin.${instance}`, 'https://nexowatteos/system/'), null);
    }
});
