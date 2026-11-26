/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { createRequire } = require('node:module');
const runtimeRequire = createRequire(__filename);
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { readDashboardNotificationStatus } = require('./eosRuntimeHealth');

const LABELS = { ui:'Oberfläche', ems:'Energiemanagement', devices:'Geräte', eebus:'EEBus', backup:'Sicherung', ocpp:'OCPP-Ladestationen' };
const FLAGS = ['notifyEnabled', 'email', 'notifySystem', 'notifyCommunication', 'notifyRecovery', 'notifyCharging', 'notifyInverters', 'notifyHardCurtailment'];
const sources = ['devices', 'eebus', 'ocpp'];

function incidentEvents(observation, categories, records) {
    const events = [];
    const retain = id => {
        const rec = records.get(id);
        if (rec) events.push({ ...rec.meta, hold:true });
    };
    const paused = id => records.delete(id); // Planned removal never acknowledges a physical recovery.
    if (categories.has('system')) for (const [module, label] of Object.entries(LABELS)) {
        const id = 'supervisor:process:' + module;
        const state = observation?.processes?.[module];
        if (state === 'offline') events.push({ id, category:'system', title:label + ' – EOS-Prozess ausgefallen', message:'Die Prozessüberwachung bestätigt einen Ausfall. Im EOS-Admin den Prozessstatus prüfen.', severity:'critical' });
        else if (state === 'disabled') paused(id);
        else if (state !== 'online') retain(id);
    }
    if (categories.has('communications')) for (const source of sources) {
        const prefix = 'supervisor:device:' + source + ':';
        const group = observation?.devices?.[source];
        const observed = new Set();
        const list = Array.isArray(group?.tracked) ? group.tracked : [];
        for (const item of list) {
            if (!/^[a-f0-9]{64}$/.test(item.key)) continue;
            const id = prefix + item.key; observed.add(id);
            if (item.state === 'offline') events.push({id, category:'communications', title:item.name + ' – Gerät nicht erreichbar',
                message:'Die Geräteanbindung bestätigt, dass dieses eingerichtete Gerät offline ist.', severity:'critical'});
            else if (item.state === 'disabled') paused(id);
            else if (item.state !== 'online') retain(id);
        }
        for (const id of records.keys()) if (id.startsWith(prefix) && !observed.has(id)) {
            if (group?.complete === true || observation?.processes?.[source] === 'disabled') paused(id);
            else retain(id);
        }
    }
    return events;
}

class EosSupervisorNotifications {
    constructor(owner, observe, options = {}) {
        this.owner = owner;
        this.observe = observe;
        this.options = options;
        this.closed = false;
    }
    start() {
        if (!this.timer && !this.closed) {
            this.timer = setInterval(() => { void this.tick(); }, 10000);
            this.timer.unref?.();
        }
    }
    async tick() {
        if (this.closed || this.busy) return;
        this.busy = true;
        try {
            const migration = this.owner.config?.eosUiMigration;
            const namespace = migration?.preserveNamespace === true && /^nexowatt-ui\.\d+$/.test(migration.source)
                ? migration.source : this.owner.namespace;
            const authorized = () => !this.closed && (namespace === this.owner.namespace || this.owner.eosMigration?.allowsStartup?.('ui') !== false);
            if (!authorized()) {
                this.mail?.close(); this.mail = null; this.disabledHandled = false;
                return;
            }
            if (this.namespace !== namespace) {
                this.mail?.close(); this.mail = null; this.disabledHandled = false; this.namespace = namespace;
            }
            const prefix = namespace + '.settings.';
            const master = await this.owner.getForeignStateAsync(prefix + 'notifyEnabled');
            if (this.closed || !master || master.ack === false || master.q && master.q !== 0) return;
            if (master.val !== true && master.val !== false) return;
            if (!master.val) {
                if (this.disabledHandled) return;
                if (!this.mail) {
                    const directory = this.options.directory || runtimeRequire('@iobroker/adapter-core').getAbsoluteInstanceDataDir(namespace);
                    try { await fs.access(join(directory,'notification-ledger.json')); }
                    catch (error) { if (error.code === 'ENOENT') this.disabledHandled = true; return; }
                }
            } else this.disabledHandled = false;
            let settings = { notifyEnabled:master.val };
            if (master.val) {
                const states = await this.owner.getForeignStatesAsync(FLAGS.filter(key => key !== 'notifyEnabled').map(key => prefix + key));
                if (this.closed || !states || !states[prefix + 'email']) return;
                for (const key of FLAGS.slice(1)) {
                    const state = states[prefix + key];
                    if (state && state.ack !== false && (state.q === undefined || state.q === 0)) settings[key] = state.val;
                    else if (state || key === 'email') return;
                }
            }
            this.settings = settings;
            if (!this.mail) {
                const plain = {
                    namespace, getForeignObjectAsync: id => this.owner.getForeignObjectAsync(id), getForeignStateAsync: id => this.owner.getForeignStateAsync(id),
                    getForeignStatesAsync: ids => this.owner.getForeignStatesAsync(ids),
                    _notifyGetSettingBool: (key, fallback) => Object.hasOwn(this.settings,key) ? this.settings[key] === true : fallback,
                    _notifyGetSettingString: (key, fallback) => typeof this.settings[key] === 'string' ? this.settings[key] : fallback,
                    _notifySetDebugState: (key, val) => this.closed ? Promise.resolve() : this.owner.setForeignStateChangedAsync(namespace + '.notifications.' + key, val, true),
                };
                const { NotificationMail } = runtimeRequire('../../ui/lib/notification-mail');
                this.mail = new NotificationMail(plain, { ...this.options, authorized, supervision:true, observations:this.observe, events:incidentEvents });
            }
            await this.mail.tick();
            if (!master.val && this.mail.disabledCleared) this.disabledHandled = true;
        } catch {
            // Missing controller data cannot acknowledge an alarm. Retry on the next normal monitoring cycle.
        } finally { this.busy = false; }
    }
    close() {
        this.closed = true;
        clearInterval(this.timer); this.timer = null;
        this.mail?.close();
    }
}

function startSupervisorNotifications(owner, host, runtimeStatus, controls) {
    const service = new EosSupervisorNotifications(owner, () => ({
        ...readDashboardNotificationStatus(host, runtimeStatus, controls),
        namespaces: {devices:host.namespace('devices'), ocpp:host.namespace('ocpp')},
        chargingManagement: owner.config?.eosUi?.chargingManagement || { wallboxes:owner.config?.eosUi?.settingsConfig?.evcsList },
    }));
    service.start();
    return service;
}
module.exports = { startSupervisorNotifications, EosSupervisorNotifications, incidentEvents };
