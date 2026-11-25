'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { PartnerWebSocketClient } = require('../ui/lib/partner-websocket');

test('generated partner runtime resolves the real CommonJS WebSocket export', () => {
    // Exercise the distributed JavaScript with the real ws package, while the
    // transport is an in-memory socket. No external partner or device is called.
    const client = Object.create(PartnerWebSocketClient.prototype);
    let submitted = null;
    client.authorized = () => true;
    client.generation = 1;
    client.socket = { readyState: WebSocket.OPEN, bufferedAmount: 0,
        send(text, options, callback) { submitted = { text, options }; callback(); } };
    assert.equal(client.send('interop-check'), true);
    assert.deepEqual(submitted, { text: 'interop-check', options: { binary: false, compress: false } });
    client.authorized = () => false;
    assert.equal(client.send('unauthorized'), false);
    assert.equal(submitted.text, 'interop-check');
});
