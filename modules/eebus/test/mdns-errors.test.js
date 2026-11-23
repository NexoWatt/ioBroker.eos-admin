'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const { DiscoveryService } = require('../build/lib/discoveryService');
const { ShipEndpoint } = require('../build/lib/shipEndpoint');
const { getConfig } = require('../build/lib/config');

test('mDNS callback, transport and advertisement errors are contained by discovery and SHIP publisher', async () => {
    const created = [];
    const warnings = [];
    const load = Module._load;
    class Bonjour {
        constructor(_options, errorCallback) { this.server = { mdns: new EventEmitter() }; this.errorCallback = errorCallback; created.push(this); }
        find() { return Object.assign(new EventEmitter(), { stop() {} }); }
        publish() { this.advertisement = Object.assign(new EventEmitter(), { stop() {} }); return this.advertisement; }
        destroy() { this.destroyed = true; }
    }
    Module._load = function(name, parent, isMain) { return name === 'bonjour-service' ? { Bonjour } : load.call(this, name, parent, isMain); };
    const adapter = { log: { warn: value => warnings.push(value), info() {}, debug() {} } };
    const config = getConfig({});
    const discovery = new DiscoveryService(adapter, config, async () => {});
    const endpoint = new ShipEndpoint(adapter, config, { shipId: 'test', localSki: 'A'.repeat(40) }, async () => {}, async () => {}, async () => {}, async () => {}, async () => {}, async () => false);
    try {
        discovery.start(); endpoint.publishMdnsIfEnabled(4712);
        assert.equal(created.length, 2);
        for (const client of created) {
            assert.doesNotThrow(() => client.errorCallback(new Error('simulated send failure')));
            assert.doesNotThrow(() => client.server.mdns.emit('error', new Error('simulated socket failure')));
            client.advertisement?.emit('error', new Error('simulated announce failure'));
        }
        assert.equal(warnings.filter(message => /EEBUS_MDNS_/.test(message)).length, 5);
        discovery.stop(); await endpoint.stop();
        assert.ok(created.every(client => client.destroyed));
    } finally { Module._load = load; discovery.stop(); await endpoint.stop(); }
});
