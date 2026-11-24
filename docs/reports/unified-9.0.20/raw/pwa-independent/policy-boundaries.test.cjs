'use strict';
// Independent negative request-policy checks; no credentials, device or DB I/O.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = '/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
const req = createRequire(path.join(root, 'package.json'));
const policy = req('tsx/cjs/api').require(path.join(root, 'ui/src-ts/runtime-executables/lib/ui-access-policy.ts'), __filename);
const aliases = ['/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-180x180-precomposed.png'];

test('Apple compatibility files are GET/HEAD-only public names', () => {
    for (const pathname of aliases) {
        for (const method of ['GET', 'HEAD']) {
            assert.equal(policy.isPublicUiRequest({ path: pathname, method }), true, `${method} ${pathname}`);
        }
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE']) {
            assert.equal(policy.isPublicUiRequest({ path: pathname, method }), false, `${method} ${pathname}`);
        }
    }
});

test('similar icon names and encoded protected paths do not become public', () => {
    const denied = [
        '/apple-touch-icon-999x999.png', '/apple-touch-icon-180x180.html',
        '/apple-touch-icon-180x180.png/config', '/apple-touch-icon-180x180.png.json',
        '/apple-touch-icon-180x180-precomposed.png.backup', '/apple-touch-icon-precomposed.png/../../config',
        '/apple-touch-icon-precomposed.png/../api/ems/status', '/assets/icons/../../api/ems/status',
        '/assets/icons/%2e%2e/%2e%2e/api/ems/status', '/%61pi/ems/status',
        '/static/%2e%2e/config', '/static/%5c..%5cconfig',
        '/api/config', '/static/index.html', '/static/history.html',
        '/apple-touch-icon-%00.png', '/apple-touch-icon-%GG.png',
    ];
    for (const pathname of denied) {
        assert.equal(policy.isPublicUiRequest({ path: pathname, method: 'GET' }), false, pathname);
    }
});

test('PWA requests do not create independent machine-command permission', () => {
    for (const pathname of aliases.concat(['/manifest.webmanifest', '/sw.js'])) {
        for (const method of ['GET', 'HEAD', 'POST']) {
            assert.equal(policy.isIndependentMachineRequest({ path: pathname, method }), false, `${method} ${pathname}`);
        }
    }
});
