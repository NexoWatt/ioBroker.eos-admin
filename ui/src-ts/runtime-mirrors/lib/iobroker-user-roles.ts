/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/iobroker-user-roles.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/iobroker-user-roles.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: e8025bef0be913cf51628923d85f4fd11b868f845f3e74b2e782af803e689788
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/iobroker-user-roles.ts
 * Quell-Hash: sha256:c835b25eff79526f750fafe864a36f8460173434117243c11bcb96294a906b81
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/iobroker-user-roles.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIoBrokerRolePolicy = createIoBrokerRolePolicy;
exports.resolveIoBrokerRoleInfo = resolveIoBrokerRoleInfo;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ordnet kanonische ioBroker-Konten ausschließlich anhand ihrer Gruppen
 * den EOS-Rollen zu; Benutzer- und Anzeigenamen verleihen keine Berechtigung.
 * Daten und Wirkung: Validierte Gruppenlisten aus lokaler Adapterkonfiguration;
 * ausschließlich lesender Zugriff auf aktuelle system.group-Objekte. Keine
 * Änderung von Konten, Passwörtern, Gruppen oder Geräte-/Regelungsdaten.
 * Sicherheitsgrenze: Exakte Objekt-ID, Typ group und direkte Mitgliedschaft der
 * authentifizierten system.user-ID sind erforderlich. Fehlerhafte Konfiguration,
 * fehlerhafte bestehende Objekte und Lesefehler verweigern sämtliche Rollen.
 * Fehlende oder deaktivierte Gruppen verleihen keine Rolle. Bei mehreren gültigen
 * Zuordnungen gilt Admin vor Installer vor Customer. Implizite Namenregeln und
 * frühere Benutzerlisten werden nicht übernommen.
 * Zeitbudget: Maximal 5.000 ms insgesamt; ioBroker-Leseaufrufe sind nicht abbrechbar,
 * späte Ergebnisse werden verworfen und starten keine weiteren Leseaufrufe.
 * Bei Änderungen: Gruppenzuordnung, Widerruf und Rollenpriorität gemeinsam prüfen.
 * Nachweise: docs/reports/groups-auth-2026-11-03/GRUPPENMODUL_PRUEFVERMERK_DE.md
 */
const node_perf_hooks_1 = require("node:perf_hooks");
const MAX_SUFFIX_LENGTH = 128;
const MAX_CONFIG_CHARS = 8192;
const MAX_GROUPS_PER_FIELD = 32;
const MAX_GROUPS_TOTAL = 128;
const MAX_MEMBERS_PER_GROUP = 10000;
const ROLE_TIMEOUT_MS = 5000;
const FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;
const DEFAULT_ADMIN = ['system.group.administrator', 'system.group.eosAdmin', 'system.group.nexowattAdmin'];
const DEFAULT_INSTALLER = ['system.group.installer', 'system.group.eosInstaller', 'system.group.nexowattInstaller'];
const DEFAULT_CUSTOMER = ['system.group.user', 'system.group.eosUser', 'system.group.nexowattUser'];
/**
 * Code-Teil: record
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Kanonische ID-Suffixe unverändert prüfen; keine erneute Namensnormalisierung. */
function canonicalSuffix(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_SUFFIX_LENGTH
        && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
        && value.replace(FORBIDDEN_CHARS, '') === value;
}
/**
 * Code-Teil: groupId
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function groupId(value) {
    return typeof value === 'string' && value.startsWith('system.group.') && canonicalSuffix(value.slice(13));
}
/**
 * Code-Teil: memberId
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function memberId(value) {
    return typeof value === 'string' && value.startsWith('system.user.') && canonicalSuffix(value.slice(12));
}
/** Leer/fehlend ergänzt keine Gruppen; fremde Typen und zu große Listen sperren. */
function configuredGroups(value) {
    if (value === undefined)
        return [];
    let items;
    if (typeof value === 'string') {
        if (value.length > MAX_CONFIG_CHARS)
            return null;
        items = value.split(/[\n,;]+/u);
    }
    else if (Array.isArray(value)) {
        items = value;
    }
    else
        return null;
    if (items.length > MAX_GROUPS_PER_FIELD)
        return null;
    const groups = [];
    for (const item of items) {
        if (typeof item !== 'string' || item.length > MAX_CONFIG_CHARS)
            return null;
        const id = item.trim();
        if (!id)
            continue;
        if (!groupId(id))
            return null;
        groups.push(id);
    }
    return Array.from(new Set(groups));
}
/**
 * Code-Teil: policy
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function policy(admin, installer, customer, valid) {
    return Object.freeze({
        valid,
        adminGroups: Object.freeze(admin),
        installerGroups: Object.freeze(installer),
        customerGroups: Object.freeze(customer),
    });
}
/**
 * Lokale Gruppenzuordnung einmalig validieren. Standardgruppen bleiben verfügbar;
 * individuelle vollständige Gruppen-IDs ergänzen sie. auth.installerGroups bleibt
 * als alter Gruppenvertrag erhalten. Benutzerlisten werden bewusst nicht gelesen.
 */
function createIoBrokerRolePolicy(accessControl = {}, auth = {}) {
/**
 * Code-Teil: invalid
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const invalid = () => policy([], [], [], false);
    try {
        if (!record(accessControl) || !record(auth))
            return invalid();
        const admin = configuredGroups(accessControl.adminGroups);
        const installer = configuredGroups(accessControl.installerGroups);
        const customer = configuredGroups(accessControl.customerGroups);
        const legacyInstaller = configuredGroups(auth.installerGroups);
        if (!admin || !installer || !customer || !legacyInstaller)
            return invalid();
        const admins = Array.from(new Set([...DEFAULT_ADMIN, ...admin]));
        const installers = Array.from(new Set([...DEFAULT_INSTALLER, ...installer, ...legacyInstaller]));
        const customers = Array.from(new Set([...DEFAULT_CUSTOMER, ...customer]));
        if (new Set([...admins, ...installers, ...customers]).size > MAX_GROUPS_TOTAL)
            return invalid();
        return policy(admins, installers, customers, true);
    }
    catch (_error) {
        return invalid();
    }
}
/** Abgeschlossene Rollenabbildung; keine dynamischen Capability-/Objektindizes. */
function roleInfo(user, role, groups) {
    const capabilities = role === 'admin' ? ['*'] : role === 'installer' ? [
        'frontend.open', 'appcenter.open', 'simulation.open', 'mapping.edit',
        'chargepoints.configure', 'mesh.configure', 'exportGuard.configure',
        'smarthome.configure', 'nexologic.configure', 'diagnostics.open',
        'energyWallet.customerSettings',
    ] : role === 'customer' ? ['frontend.open', 'energyWallet.customerSettings'] : [];
    return {
        user, role, roles: role === 'none' ? [] : [role], groups, capabilities,
        isAdmin: role === 'admin', isInstaller: role === 'admin' || role === 'installer',
        isCustomer: role === 'customer',
    };
}
/**
 * Aktuelle Gruppen pro Zugriff prüfen. Ein unbekanntes oder gruppenloses Konto
 * erhält none. Die Kontoprüfung/Authentifizierung muss der Aufrufer vorher leisten.
 * Keine gecachten Gruppen: Entfernung, Löschung und Sperre wirken beim nächsten
 * Zugriff. timeoutMs darf das gemeinsame Budget für Tests nur verkürzen.
 */
function resolveIoBrokerRoleInfo(adapter, user, rolePolicy, timeoutMs = ROLE_TIMEOUT_MS) {
    const canonicalUser = canonicalSuffix(user) ? user : null;
/**
 * Code-Teil: denied
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const denied = () => roleInfo(canonicalUser, 'none', []);
    if (!canonicalUser || rolePolicy.valid !== true)
        return Promise.resolve(denied());
    const allGroups = Array.from(new Set([...rolePolicy.adminGroups, ...rolePolicy.installerGroups, ...rolePolicy.customerGroups]));
    if (allGroups.length > MAX_GROUPS_TOTAL || !allGroups.every(groupId))
        return Promise.resolve(denied());
    const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, ROLE_TIMEOUT_MS) : ROLE_TIMEOUT_MS;
    const deadline = node_perf_hooks_1.performance.now() + budget;
    return new Promise(resolve => {
        let active = true;
/**
 * Code-Teil: inTime
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const inTime = () => active && node_perf_hooks_1.performance.now() < deadline;
/**
 * Code-Teil: finish
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const finish = (value) => {
            if (!active)
                return;
            const accepted = inTime();
            active = false;
            clearTimeout(timer);
            resolve(accepted ? value : denied());
        };
        const timer = setTimeout(() => finish(denied()), budget);
/**
 * Code-Teil: run
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const run = async () => {
            try {
                const groups = [];
                const canonicalId = 'system.user.' + canonicalUser;
                for (const id of allGroups) {
                    if (!inTime()) {
                        finish(denied());
                        return;
                    }
                    const object = await adapter.getForeignObjectAsync(id);
                    if (!inTime()) {
                        finish(denied());
                        return;
                    }
                    if (object === null || object === undefined)
                        continue;
                    if (!record(object) || object._id !== id || object.type !== 'group' || !record(object.common)) {
                        finish(denied());
                        return;
                    }
                    const common = object.common;
                    if (common.enabled !== undefined && typeof common.enabled !== 'boolean') {
                        finish(denied());
                        return;
                    }
                    if (common.enabled === false)
                        continue;
                    if (!Array.isArray(common.members) || common.members.length > MAX_MEMBERS_PER_GROUP || !common.members.every(memberId)) {
                        finish(denied());
                        return;
                    }
                    if (common.members.includes(canonicalId))
                        groups.push(id);
                }
                let role = 'none';
                if (groups.some(id => rolePolicy.adminGroups.includes(id)))
                    role = 'admin';
                else if (groups.some(id => rolePolicy.installerGroups.includes(id)))
                    role = 'installer';
                else if (groups.some(id => rolePolicy.customerGroups.includes(id)))
                    role = 'customer';
                finish(roleInfo(canonicalUser, role, groups));
            }
            catch (_error) {
                finish(denied());
            }
        };
        void run();
    });
}
