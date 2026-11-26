"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryService = void 0;
const sanitizer_1 = require("./sanitizer");
const node_net_1 = require("node:net");
class DiscoveryService {
    adapter;
    config;
    onNode;
    bonjour;
    browsers = [];
    stopped = true;
    pending = 0;
    constructor(adapter, config, onNode) {
        this.adapter = adapter;
        this.config = config;
        this.onNode = onNode;
    }
    start() {
        this.stopped = false;
        if (!this.config.discoveryEnabled) {
            this.adapter.log.info('EEBUS discovery is disabled.');
            return;
        }
        let Bonjour;
        try {
            ({ Bonjour } = require('bonjour-service'));
        }
        catch (error) {
            this.adapter.log.warn(`bonjour-service is not available. EEBUS mDNS discovery cannot start until dependencies are installed: ${String(error)}`);
            return;
        }
        this.bonjour = new Bonjour({}, () => this.adapter.log.warn('EEBUS_MDNS_DISCOVERY_ERROR'));
        // bonjour-service 1.4.4 exposes errors on its underlying multicast-dns emitter, not Bonjour itself.
        this.bonjour.server.mdns.on('error', () => this.adapter.log.warn('EEBUS_MDNS_DISCOVERY_ERROR'));
        this.startBrowser('ship');
        this.startBrowser('shippairing');
        this.adapter.log.info('Started EEBUS mDNS discovery for _ship._tcp and _shippairing._tcp.');
    }
    stop() {
        this.stopped = true;
        for (const browser of this.browsers) {
            try {
                browser.stop?.();
            }
            catch (error) {
                this.adapter.log.debug(`Could not stop mDNS browser: ${String(error)}`);
            }
        }
        this.browsers = [];
        try {
            this.bonjour?.destroy?.();
        }
        catch (error) {
            this.adapter.log.debug(`Could not destroy bonjour instance: ${String(error)}`);
        }
        this.bonjour = undefined;
    }
    startBrowser(type) {
        const browser = this.bonjour.find({ type, protocol: 'tcp' });
        browser.on('up', (service) => {
            if (this.stopped || this.pending >= 16)
                return;
            this.pending++;
            this.handleService(type, service).catch(() => this.adapter.log.warn('EEBUS_DISCOVERY_REJECTED'))
                .finally(() => { this.pending--; });
        });
        browser.on('error', (error) => this.adapter.log.warn(`mDNS ${type} browser error: ${error.message}`));
        this.browsers.push(browser);
    }
    async handleService(serviceType, service) {
        if (this.stopped || !service || typeof service !== 'object' || Array.isArray(service))
            return;
        const txt = normalizeTxt(service.txt || {});
        const id = txt.id || service.fqdn || service.name || txt.ski || `${service.host}:${service.port}`;
        const ski = String(txt.ski || '').toUpperCase();
        const host = firstAddress(service) || service.host || service.referer?.address || '';
        const port = Number(service.port || 0);
        if (!/^[A-F0-9]{40}$/.test(ski) || !Number.isInteger(port) || port < 1024 || port > 65535 || !isLocalAddress(host))
            return;
        const path = txt.path || '/ship/';
        if (!/^\/[a-zA-Z0-9/_-]{0,63}$/.test(path))
            return;
        const name = String(service.name || txt.model || txt.id || id).slice(0, 128);
        const categories = String(txt.cat || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        const node = {
            id,
            safeId: (0, sanitizer_1.safeId)(ski || id),
            name,
            host,
            port,
            path: txt.path || '/ship/',
            ski,
            brand: txt.brand || '',
            type: txt.type || '',
            model: txt.model || '',
            serial: txt.serial || '',
            categories,
            register: (0, sanitizer_1.toBoolean)(txt.register, false),
            ecc: (0, sanitizer_1.toBoolean)(txt.ecc, false),
            txt,
            serviceType,
            lastSeen: new Date().toISOString(),
        };
        if (!this.stopped)
            await this.onNode(node);
    }
}
exports.DiscoveryService = DiscoveryService;
function normalizeTxt(txt) {
    const result = {};
    for (const [key, value] of Object.entries(txt).slice(0, 32)) {
        if (!/^[a-zA-Z0-9_-]{1,32}$/.test(key))
            continue;
        if (Array.isArray(value)) {
            result[key] = value.slice(0, 16).map(item => String(item).slice(0, 256)).join(',').slice(0, 1024);
        }
        else {
            result[key] = String(value ?? '').slice(0, 1024);
        }
    }
    return result;
}
function firstAddress(service) {
    if (Array.isArray(service.addresses) && service.addresses.length > 0) {
        return String(service.addresses[0]);
    }
    return '';
}
function isLocalAddress(host) {
    if ((0, node_net_1.isIP)(host) === 4) {
        const [a, b] = host.split('.').map(Number);
        return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 169 && b === 254 && host !== '169.254.169.254');
    }
    return (0, node_net_1.isIP)(host) === 6 && /^(?:f[cd][a-f0-9]{2}:|fe[89ab][a-f0-9]:)/i.test(host);
}
