import { EebusConfig } from './config';
import { DiscoveredShipNode } from './eebusTypes';
import { safeId, toBoolean } from './sanitizer';
import { isIP } from 'node:net';

type DiscoveryCallback = (node: DiscoveredShipNode) => void | Promise<void>;

export class DiscoveryService {
    private bonjour: any;
    private browsers: any[] = [];
    private stopped = true;
    private pending = 0;

    public constructor(
        private readonly adapter: any,
        private readonly config: EebusConfig,
        private readonly onNode: DiscoveryCallback,
    ) {}

    public start(): void {
        this.stopped = false;
        if (!this.config.discoveryEnabled) {
            this.adapter.log.info('EEBUS discovery is disabled.');
            return;
        }

        let Bonjour: any;
        try {
            ({ Bonjour } = require('bonjour-service'));
        } catch (error) {
            this.adapter.log.warn(
                `bonjour-service is not available. EEBUS mDNS discovery cannot start until dependencies are installed: ${String(
                    error,
                )}`,
            );
            return;
        }

        this.bonjour = new Bonjour({}, () => this.adapter.log.warn('EEBUS_MDNS_DISCOVERY_ERROR'));
        // bonjour-service 1.4.4 exposes errors on its underlying multicast-dns emitter, not Bonjour itself.
        this.bonjour.server.mdns.on('error', () => this.adapter.log.warn('EEBUS_MDNS_DISCOVERY_ERROR'));
        this.startBrowser('ship');
        this.startBrowser('shippairing');
        this.adapter.log.info('Started EEBUS mDNS discovery for _ship._tcp and _shippairing._tcp.');
    }

    public stop(): void {
        this.stopped = true;
        for (const browser of this.browsers) {
            try {
                browser.stop?.();
            } catch (error) {
                this.adapter.log.debug(`Could not stop mDNS browser: ${String(error)}`);
            }
        }

        this.browsers = [];

        try {
            this.bonjour?.destroy?.();
        } catch (error) {
            this.adapter.log.debug(`Could not destroy bonjour instance: ${String(error)}`);
        }

        this.bonjour = undefined;
    }

    private startBrowser(type: 'ship' | 'shippairing'): void {
        const browser = this.bonjour.find({ type, protocol: 'tcp' });
        browser.on('up', (service: unknown) => {
            if (this.stopped || this.pending >= 16) return;
            this.pending++;
            this.handleService(type, service).catch(() => this.adapter.log.warn('EEBUS_DISCOVERY_REJECTED'))
                .finally(() => { this.pending--; });
        });
        browser.on('error', (error: Error) => this.adapter.log.warn(`mDNS ${type} browser error: ${error.message}`));
        this.browsers.push(browser);
    }

    private async handleService(serviceType: 'ship' | 'shippairing', service: any): Promise<void> {
        if (this.stopped || !service || typeof service !== 'object' || Array.isArray(service)) return;
        const txt = normalizeTxt(service.txt || {});
        const id = txt.id || service.fqdn || service.name || txt.ski || `${service.host}:${service.port}`;
        const ski = String(txt.ski || '').toUpperCase();
        const host = firstAddress(service) || service.host || service.referer?.address || '';
        const port = Number(service.port || 0);
        if (!/^[A-F0-9]{40}$/.test(ski) || !Number.isInteger(port) || port < 1024 || port > 65535 || !isLocalAddress(host)) return;
        const path = txt.path || '/ship/';
        if (!/^\/[a-zA-Z0-9/_-]{0,63}$/.test(path)) return;
        const name = String(service.name || txt.model || txt.id || id).slice(0, 128);
        const categories = String(txt.cat || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

        const node: DiscoveredShipNode = {
            id,
            safeId: safeId(ski || id),
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
            register: toBoolean(txt.register, false),
            ecc: toBoolean(txt.ecc, false),
            txt,
            serviceType,
            lastSeen: new Date().toISOString(),
        };

        if (!this.stopped) await this.onNode(node);
    }
}

function normalizeTxt(txt: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(txt).slice(0, 32)) {
        if (!/^[a-zA-Z0-9_-]{1,32}$/.test(key)) continue;
        if (Array.isArray(value)) {
            result[key] = value.slice(0, 16).map(item => String(item).slice(0, 256)).join(',').slice(0, 1024);
        } else {
            result[key] = String(value ?? '').slice(0, 1024);
        }
    }

    return result;
}

function firstAddress(service: any): string {
    if (Array.isArray(service.addresses) && service.addresses.length > 0) {
        return String(service.addresses[0]);
    }

    return '';
}

function isLocalAddress(host: string): boolean {
    if (isIP(host) === 4) {
        const [a, b] = host.split('.').map(Number);
        return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 169 && b === 254 && host !== '169.254.169.254');
    }
    return isIP(host) === 6 && /^(?:f[cd][a-f0-9]{2}:|fe[89ab][a-f0-9]:)/i.test(host);
}
