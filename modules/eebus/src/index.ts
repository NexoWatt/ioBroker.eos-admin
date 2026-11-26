import { emptyReport } from './lib/partnerMonitor';
import { EebusConfig, getConfig } from './lib/config';
import { EebusRuntime } from './lib/eebusRuntime';
import { IdentityManager } from './lib/identityManager';
import { ObjectFactory } from './lib/objectFactory';
import { EebusIdentity } from './lib/eebusTypes';
import { prepareLegacyEebus } from './lib/legacyMigration';

interface HostedAdapter {
    namespace: string;
    eosTargetNamespace?: string;
    log: { info(message: string): void; warn(message: string): void; error(message: string): void; debug(message: string): void };
    getStateAsync(id: string): Promise<ioBroker.State | null | undefined>;
    setStateAsync(id: string, state: { val: ioBroker.StateValue; ack: boolean }): Promise<unknown>;
    subscribeStates?(pattern: string): void;
    subscribeStatesAsync?(pattern: string): Promise<unknown>;
    unsubscribeStates?(pattern: string): void;
    unsubscribeStatesAsync?(pattern: string): Promise<unknown>;
    canOperate?: () => boolean;
}
interface Options { adapter: HostedAdapter; canOperate: () => boolean; config?: unknown; dataDir: string }
export const defaults = Object.freeze({ enabled: false, shipPort: 4712, discoveryEnabled: true, commandDryRun: true,
    autoApplyClsLimits: false, ianaPen: '999999', serviceName: 'NexoWatt EOS', brand: 'NexoWatt', model: 'EOS',
    measurementIntervalSec: 10, metadataIntervalSec: 60 });
const booleans = ['enabled', 'discoveryEnabled', 'commandDryRun', 'autoApplyClsLimits', 'shipServerEnabled', 'autoConnectEnabled',
    'spineDiscoveryEnabled', 'nexowattBridgeEnabled', 'sendImplementationResultToCls'];
const numbers: Record<string, [number, number]> = { shipPort: [1024, 65535], measurementIntervalSec: [5, 3600], metadataIntervalSec: [30, 86400],
    nexowattBridgeHeartbeatSec: [5, 300], nexowattBridgeRequestTimeoutMs: [100, 5000], nexowattAcceptanceTargetMs: [50, 5000],
    nexowattControlTargetMs: [100, 10000], nexowattFeedbackTargetMs: [200, 15000], nexowattImplementationTimeoutMs: [1500, 30000],
    clsHeartbeatTimeoutSec: [5, 3600] };
const strings: Record<string, number> = { ianaPen: 6, serviceName: 63, brand: 32, model: 32, pairingPin: 32, shipPath: 32 };
const patterns = ['devices.*.control.*', 'devices.*.limits.*', 'devices.*.pairing.*', 'pairing.autoAcceptNewDevices'];
const actions: Record<string, string> = { 'pairing.approve': 'pairing.approve', 'pairing.reject': 'pairing.reject',
    'device.connect': 'control.connect', 'device.disconnect': 'control.disconnect', 'device.refresh': 'control.refreshNodeManagement' };

/** Strict configuration boundary; all network/actuation settings are explicit, trust bypasses cannot be imported. */
export function validateConfig(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('EEBUS_CONFIG_INVALID');
    const value = input as Record<string, unknown>;
    const result: Record<string, unknown> = { ...defaults };
    for (const [key, item] of Object.entries(value)) {
        if (booleans.includes(key)) { if (typeof item !== 'boolean') throw new Error(`EEBUS_CONFIG_${key}`); }
        else if (numbers[key]) { const [min, max] = numbers[key]; if (typeof item !== 'number' || !Number.isInteger(item) || item < min || item > max) throw new Error(`EEBUS_CONFIG_${key}`); }
        else if (strings[key]) { if (typeof item !== 'string' || Buffer.byteLength(item) > strings[key] || /[\u0000-\u001f\u007f]/.test(item)) throw new Error(`EEBUS_CONFIG_${key}`); }
        else throw new Error(`EEBUS_CONFIG_UNSUPPORTED_${key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`);
        result[key] = item;
    }
    if ([443, 8081, 8188].includes(Number(result.shipPort))) throw new Error('EEBUS_PORT_RESERVED');
    if (!/^\d{1,6}$/.test(String(result.ianaPen))) throw new Error('EEBUS_IANA_PEN_INVALID');
    if (result.shipPath && !/^\/[a-zA-Z0-9/_-]*$/.test(String(result.shipPath))) throw new Error('EEBUS_SHIP_PATH_INVALID');
    return result;
}

export function migrateLegacyConfig(input: unknown): { config: Record<string, unknown>; omittedFields: string[]; requiresPairing: boolean } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('EEBUS_CONFIG_INVALID');
    const original = input as Record<string, unknown>;
    const normalized = getConfig(original);
    const selected: Record<string, unknown> = {};
    const allowed = new Set([...booleans, ...Object.keys(numbers), ...Object.keys(strings)]);
    for (const [key, value] of Object.entries(normalized)) if (allowed.has(key) && key !== 'pairingPin') selected[key] = value;
    selected.enabled = false;
    selected.commandDryRun = true;
    selected.autoApplyClsLimits = false;
    const config = validateConfig(selected);
    return { config, omittedFields: Object.keys(original).filter(key => !allowed.has(key) || key === 'pairingPin'), requiresPairing: true };
}

export function preflightLegacyConfig(input: unknown, context: Parameters<typeof prepareLegacyEebus>[1]) {
    return prepareLegacyEebus(input, context, validateConfig);
}

export function createHostedModule(options: Options) {
    if (!options || typeof options.canOperate !== 'function' || !options.dataDir) throw new Error('EEBUS_HOST_CONTRACT');
    const selected = validateConfig(options.config || {});
    const config: EebusConfig = getConfig({ ...selected, autoAcceptNewDevices: false, allowCommandsToUntrustedDevices: false,
        debugRawMessages: false, nexowattUiInstance: options.adapter.eosTargetNamespace || options.adapter.namespace.replace(/\.eebus$/, '') });
    // A hosted bridge targets only this adapter's embedded EMS, never an automatically selected legacy controller.
    config.nexowattUiInstance = options.adapter.eosTargetNamespace || options.adapter.namespace.replace(/\.eebus$/, '');
    const adapter = Object.create(options.adapter) as HostedAdapter;
    adapter.canOperate = options.canOperate;
    let runtime: EebusRuntime | undefined;
    let identity: EebusIdentity | undefined;
    let running = false;
    let stopping = false;
    let inFlight = 0;
    const objectFactory = new ObjectFactory(adapter);
    return {
        async start(): Promise<void> {
            if (running) return;
            if (!options.canOperate()) throw new Error('EEBUS_LICENSE_REQUIRED');
            stopping = false;
            await objectFactory.ensureBaseObjects();
            identity = await new IdentityManager(options.dataDir, config).ensureIdentity();
            if (stopping || !options.canOperate()) throw new Error('EEBUS_START_CANCELLED');
            await objectFactory.publishIdentity(identity, config);
            runtime = new EebusRuntime(adapter, config, identity, objectFactory);
            try {
                await runtime.start();
                if (stopping || !options.canOperate()) throw new Error('EEBUS_START_CANCELLED');
                for (const pattern of patterns) {
                    if (adapter.subscribeStatesAsync) await adapter.subscribeStatesAsync(pattern);
                    else if (adapter.subscribeStates) adapter.subscribeStates(pattern);
                    else throw new Error('EEBUS_HOST_SUBSCRIPTIONS_REQUIRED');
                }
                running = true;
                if (config.ianaPen === '999999') adapter.log.warn('EEBUS_IANA_PEN_PLACEHOLDER: Herstellerkennung vor Serienfreigabe konfigurieren.');
            } catch (error) { await runtime.stop(); runtime = undefined; throw error; }
        },
        async stop(): Promise<void> {
            stopping = true;
            running = false;
            for (const pattern of patterns) {
                try {
                    if (adapter.unsubscribeStatesAsync) await adapter.unsubscribeStatesAsync(pattern);
                    else adapter.unsubscribeStates?.(pattern);
                } catch { adapter.log.debug('EEBUS_HOST_UNSUBSCRIBE_STOPPED'); }
            }
            const current = runtime;
            runtime = undefined;
            await current?.stop();
        },
        async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
            if (!runtime) return;
            // Acknowledged trust revocation also invalidates live sessions. It must not be filtered by the host.
            if (state?.ack && !/\.pairing\.(trusted|pinnedFingerprint)$/.test(id)) return;
            await runtime.handleStateChange(id, state);
        },
        async onMessage(message: { command?: string; message?: unknown; from?: string; callback?: unknown }): Promise<void> {
            if (message?.command !== 'nexowatt.para14a.implementation.v1' || !running || !options.canOperate()) return;
            await runtime?.handleMessage(message);
        },
        async command(name: string, payload: unknown): Promise<{ accepted: boolean }> {
            if (!running || !runtime || stopping || !options.canOperate()) throw new Error('EEBUS_NOT_RUNNING');
            if ((!Object.hasOwn(actions,name) && name !== 'device.monitor') || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('EEBUS_COMMAND_INVALID');
            const deviceId = (payload as Record<string, unknown>).deviceId;
            if (typeof deviceId !== 'string' || !/^[A-Fa-f0-9]{40}$/.test(deviceId)) throw new Error('EEBUS_DEVICE_UNKNOWN');
            const observed = runtime.getNodes().some(node => node.safeId === deviceId);
            if (!observed && !(name === 'device.monitor' && runtime.partnerMonitor.list().some(peer => peer.id === deviceId))) throw new Error('EEBUS_DEVICE_UNKNOWN');
            if (inFlight >= 16) throw new Error('EEBUS_COMMAND_BUSY');
            inFlight++;
            try {
                if (name === 'device.monitor') {
                    const data = payload as Record<string,unknown>;
                    if (typeof data.enabled !== 'boolean') throw new Error('EEBUS_COMMAND_INVALID');
                    await runtime.partnerMonitor.configure(deviceId, data.name, data.enabled);
                    return { accepted: options.canOperate() && !stopping };
                }
                await runtime.handleStateChange(`${adapter.namespace}.devices.${deviceId}.${actions[name]}`, { val: true, ack: false, ts: Date.now(), lc: Date.now(), from: adapter.namespace });
                return { accepted: options.canOperate() && !stopping };
            } finally { inFlight--; }
        },
        getDashboardDeviceHealth() {
            if (!running || stopping || !runtime || !options.canOperate()) return emptyReport(selected.enabled === false);
            return runtime.partnerMonitor.report();
        },
        async getStatus() {
            const monitored = new Map((runtime?.partnerMonitor.list() || []).map(p=>[p.id,p]));
            const nodes = runtime?.getNodes() || [];
            const devices = [];
            for (const node of nodes.slice(0, 128)) {
                const [trust, connection, fingerprint] = await Promise.all([
                    adapter.getStateAsync(`devices.${node.safeId}.pairing.trusted`),
                    adapter.getStateAsync(`devices.${node.safeId}.connection.shipState`),
                    adapter.getStateAsync(`devices.${node.safeId}.pairing.remoteFingerprint`),
                ]);
                const entry=monitored.get(node.safeId); monitored.delete(node.safeId);
                devices.push({ monitorName:entry?.name || '', monitorPaused:entry?.paused === true, canMonitor:runtime?.canMonitorPartner(node.safeId) === true,
                    id: node.safeId, name: node.name.slice(0, 128), ski: node.ski, fingerprint: String(fingerprint?.val || ''),
                    trusted: trust?.val === true, connected: connection?.val === 'data-exchange', state: String(connection?.val || 'discovered') });
            }
            // A monitored peer can be removed here even before it advertises after a restart.
            for (const entry of monitored.values()) devices.push({ id:entry.id, name:entry.name, ski:entry.id, fingerprint:'',
                trusted:false, connected:false, state:'Nicht verbunden', monitorName:entry.name, monitorPaused:entry.paused, canMonitor:false });
            devices.sort((a,b)=>Number(!!b.monitorName)-Number(!!a.monitorName));
            return { running, localSki: identity?.localSki || '', certificateFingerprint: identity?.certificateFingerprint || '',
                shipPort: config.shipPort, commandDryRun: config.commandDryRun, devices };
        },
    };
}
