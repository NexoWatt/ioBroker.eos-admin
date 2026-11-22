/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/services/nvp-group-planner.ts
 * Quell-Hash: sha256:63b5fb93c8369b221887f77cf6c850a6d74ee5db8f4a55d8957c6534705f35b5
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/nvp-group-planner.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Berechnet lokale Speicheranforderungen je lokalem Regelbereich und homogener Dispatchgruppe.
 * Daten und Wirkung: Liest validierte NVP-Snapshots in W, gemeinsam verwendete Policy-Bausteine und frische SoC-/Verfügbarkeitsangaben; liefert Pläne für Diagnose oder aktiven Betrieb und getrennte Rampenzustände, niemals Gerätebefehle.
 * Bei Änderungen: Lokale Bilanz nur einmal ausgleichen, M0 nicht zu M1 addieren, fehlende Fähigkeit nicht erfinden und globale Budgetbegrenzungen an den Gruppenzustand zurückmelden.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/nvp-group-planner.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const { groupStorages } = require('./nvp-topology');
const { resolveStorageOperatingPolicy, resolveNvpBandTarget } = require('./storage-self-consumption-policy');
const { resolveStorageGridChargePermission } = require('../modules/tarif-vis');
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => record(value) && Object.prototype.hasOwnProperty.call(value, key);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/**
 * Ein Rechenplan darf nur aktuelle numerische Rückmeldungen verwenden. Empfang,
 * gesendeter Sollwert und angewandte Leistung sind getrennt; diese Funktion
 * bewertet daher ausschließlich den ausdrücklich übergebenen Messzeitpunkt.
 */
function fresh(value, now, maxAgeMs) {
    return record(value) && value.valid === true && finite(value.ts)
        && value.ts > 0 && value.ts <= now && now - value.ts <= maxAgeMs;
}
/**
 * Verwendet dieselbe SoC-/Zielbanddefinition wie die bestehende Speicherregelung.
 * Eine Gruppenzuordnung verändert keine globale Konfiguration. Optionale
 * gruppenspezifische Policies werden als vollständiger Resolver-Eingang übergeben.
 */
function policyFor(group, rootConfig, groupPolicies) {
    if (record(groupPolicies[group.id]))
        return resolveStorageOperatingPolicy(groupPolicies[group.id]);
    const multiUse = rootConfig.installerConfig && rootConfig.installerConfig.storageMultiUse;
    return resolveStorageOperatingPolicy({
        storageConfig: rootConfig.storage || {},
        storageFarmConfig: rootConfig.storageFarm || {},
        selectedTopology: group.storages.some((storage) => String(storage.id).startsWith('storage-farm-')) ? 'farm' : 'single',
        multiUseConfig: multiUse || null,
        multiUseActive: rootConfig.enableMultiUse === true && !!multiUse && multiUse.enabled === true,
        standaloneDefaultEnabled: true,
        standaloneDefaultMinSocPct: 10,
        standaloneDefaultMaxSocPct: 100,
        standaloneDefaultTargetGridImportW: 50,
        standaloneDefaultImportThresholdW: 20,
    });
}
/** Die neue App verwendet ausschließlich eigene Grenzen und eigenes Zielband;
 * der gemeinsame Resolver liefert die erprobte Policy-Semantik ohne globale
 * Single-/Farm-/MultiUse-Einstellungen zu übernehmen. */
function ownPolicyFor(storage) {
    const strategy = record(storage.strategy) ? storage.strategy : {};
    return resolveStorageOperatingPolicy({
        storageConfig: {
            standaloneSelfDischargeEnabled: true,
            standaloneSelfMinSocPct: storage.minSoc,
            standaloneSelfMaxSocPct: storage.maxSoc,
            standaloneSelfTargetGridImportW: strategy.targetGridImportW,
            standaloneSelfImportThresholdW: strategy.importThresholdW,
        },
        selectedTopology: 'single', multiUseActive: false,
        standaloneDefaultEnabled: true,
    });
}
/** Der wirtschaftliche Tarifzustand ist gemeinsam, Ausgang, Leistung und SoC
 * gehören jedoch zur neuen Gruppe. Ein alter, zukünftiger oder gesperrter
 * Tarif gibt ausschließlich Eigenverbrauch frei, niemals blindes Netzladen. */
function tariffPermission(group, options, now, maxAgeMs) {
    const tariff = record(options.tariffSnapshot) ? options.tariffSnapshot : {};
    const current = finite(tariff.ts) && tariff.ts > 0 && tariff.ts <= now && now - tariff.ts <= maxAgeMs;
    const priority = Number(tariff.prioritaet);
    return resolveStorageGridChargePermission({
        appCenterAllowed: group.primaryPurpose === 'tariff',
        tariffActive: current && tariff.tarifAktiv === true,
        currentPriceFresh: current && tariff.currentPriceFresh === true,
        tariffState: tariff.state,
        manualNetFeeEnabled: tariff.netFeeEnabled === true,
        manualNtWindowActive: tariff.storageManualWindowActive === true && String(tariff.netFeeMode).toUpperCase() === 'NT',
        priorityAllowsStorage: priority === 1 || priority === 2,
        storageWriterAvailable: group.authority === 'eos',
        storagePowerW: group.storages.reduce((sum, storage) => sum + (finite(storage.maxChargeW) ? storage.maxChargeW : 0), 0),
    });
}
/**
 * Teilt genau einen Gruppenbedarf unter Berücksichtigung der individuellen
 * Grenzen auf. Ausgangspunkt sind gemessene Leistungen, keine früher gesendeten
 * Befehle. Jeder Teilnehmer erhält höchstens seine Grenze; ein Restbedarf bleibt
 * sichtbar. Die Funktion erteilt keine physische Leistungsfreigabe.
 */
function allocate(requestedW, members) {
    const minW = members.reduce((sum, member) => sum + member.minW, 0);
    const maxW = members.reduce((sum, member) => sum + member.maxW, 0);
    const targetW = clamp(requestedW, minW, maxW);
    const proposals = members.map(member => ({
        id: member.id,
        proposedW: clamp(member.actualW, member.minW, member.maxW),
        minW: member.minW,
        maxW: member.maxW,
        actualW: member.actualW,
    }));
    const initialW = proposals.reduce((sum, member) => sum + member.proposedW, 0);
    const deltaW = targetW - initialW;
    const headrooms = proposals.map(member => deltaW >= 0 ? member.maxW - member.proposedW : member.proposedW - member.minW);
    const headroomW = headrooms.reduce((sum, value) => sum + value, 0);
    if (headroomW > 0 && Math.abs(deltaW) > 0) {
        proposals.forEach((member, index) => {
            member.proposedW = clamp(member.proposedW + deltaW * (headrooms[index] ?? 0) / headroomW, member.minW, member.maxW);
        });
    }
    const proposedW = proposals.reduce((sum, member) => sum + member.proposedW, 0);
    return { requestedW, proposedW, minW, maxW, unservedW: requestedW - proposedW, proposals };
}
/**
 * Erstellt lesbare Gruppenpläne; auch im aktiven Modus bleibt applied=false. Konvention:
 * Netzbezug positiv; Speicherentladung positiv. Lokal gilt r = g + Summe(p_ist).
 * Gruppen-Policies berechnen ihren Fehler einmal am zugeordneten Messpunkt;
 * die nachfolgende M0-Budgetprüfung muss sämtliche gleichzeitigen Intervalle und
 * Altfreigaben prüfen. Kein Ergebnis dieser Funktion ist bereits angewandt.
 *
 * storageTelemetry[id]: {valid,socPct,ts,available,maxChargeW?,maxDischargeW?,maxDeltaWPerSec?}.
 * tariffSnapshot: frischer gemeinsamer Tarifzustand; tariffRequestsByGroup[id]: {valid,ts,requestedW}.
 * peakTargetsByGroup[id]: {valid,ts,targetImportW}; externalRequestsByGroup[id]: {valid,ts,requestedW}.
 * budgetFeedbackByStorage[id]: {valid,ts,configVersion,acceptedW}; individuelle Rampenrückführung.
 * budgetFeedbackByGroup[id]: {valid,ts,configVersion,acceptedW}; nur Rampenrückführung,
 * niemals Istwirkungsnachweis. Ohne passende Version wird Rückführung ignoriert.
 */
function planGroups(config, snapshot, options = {}) {
    const now = finite(options.nowMs) ? options.nowMs : (finite(snapshot && snapshot.ts) ? snapshot.ts : Date.now());
    const groups = [];
    const requests = [];
    const issues = [];
    const nextState = { configVersion: config && config.configVersion, groups: Object.create(null) };
    const hypothetical = !(config && config.operation === 'active');
    const ownApp = !!config && config.origin === 'dynamicGridConnection';
    const output = { status: hypothetical ? 'diagnostic' : 'planned', hypothetical, applied: false, groups, requests, issues, nextState, ts: now };
    if (!config || config.mode !== 'dynamic')
        return { ...output, status: 'static', hypothetical: false };
    if (!record(snapshot) || snapshot.valid !== true || snapshot.configVersion !== config.configVersion) {
        issues.push({ code: 'snapshot-invalid', message: 'Kein gültiger, zur Konfigurationsversion passender Messzyklus.' });
        return output;
    }
    const rootConfig = record(options.rootConfig) ? options.rootConfig : {};
    const telemetry = record(options.storageTelemetry) ? options.storageTelemetry : {};
    const groupPolicies = record(options.groupPolicies) ? options.groupPolicies : {};
    const maxTelemetryAgeMs = finite(options.telemetryMaxAgeMs) && options.telemetryMaxAgeMs > 0 ? Math.min(60000, options.telemetryMaxAgeMs) : 15000;
    const requestMaxAgeMs = finite(options.requestMaxAgeMs) && options.requestMaxAgeMs > 0 ? Math.min(15000, options.requestMaxAgeMs) : 5000;
    const candidates = groupStorages(config);
    const localRegulators = new Map();
    const localPurposes = ownApp ? ['selfConsumption', 'zeroExport', 'tariff'] : ['selfConsumption', 'zeroExport'];
    for (const group of candidates) {
        if (group.authority === 'eos' && localPurposes.includes(group.primaryPurpose)) {
            localRegulators.set(group.controlPointId, (localRegulators.get(group.controlPointId) || 0) + 1);
        }
    }
    for (const group of candidates) {
        const row = {
            id: group.id, connectionPointId: group.connectionPointId, controlPointId: group.controlPointId,
            primaryPurpose: group.primaryPurpose, authority: group.authority, ancestorGuards: group.ancestorGuards,
            hypothetical, applied: false, status: hypothetical ? 'diagnostic' : 'planned', requestedW: null, proposedW: null,
            unservedW: null, constraints: [], members: [],
        };
        groups.push(row);
        const block = (code, message) => {
            row.status = code;
            row.reason = message;
            issues.push({ groupId: group.id, code, message });
        };
        const signatures = new Set(group.storages.map((storage) => [storage.connectionPointId, storage.controlPointId, storage.primaryPurpose, storage.authority].join('|')));
        if (signatures.size !== 1 || group.connectionPointId !== group.controlPointId) {
            block('group-invalid', 'Bereich, Aufgabe und Stellhoheit müssen innerhalb der Gruppe eindeutig sein.');
            continue;
        }
        if (group.authority === 'external') {
            row.status = 'external-corridor-only';
            row.reason = 'Externer Regler wählt den Fahrpunkt; EOS berechnet hier keinen Lade- oder Entladeauftrag.';
            for (const storage of group.storages)
                requests.push({ storageId: storage.id, groupId: group.id, authority: 'external', requestedW: null, proposedW: null, hypothetical, applied: false, status: row.status });
            continue;
        }
        if (localPurposes.includes(group.primaryPurpose) && (localRegulators.get(group.controlPointId) || 0) > 1) {
            block('duplicate-local-regulator', 'Mehrere Gruppen würden denselben lokalen Bilanzfehler ausgleichen; eine gemeinsame Gruppe ist erforderlich.');
            continue;
        }
        const point = (config.points || []).find((value) => value.id === group.controlPointId);
        const pointSample = snapshot.points && snapshot.points[group.controlPointId];
        const actuals = group.storages.map((storage) => snapshot.storages && snapshot.storages[storage.id]);
        if (!point || !fresh(pointSample, now, point.measurement.maxAgeMs) || !finite(pointSample.valueW)
            || actuals.some((sample, index) => !fresh(sample, now, group.storages[index].powerMeasurement.maxAgeMs) || !finite(sample.valueW))) {
            block('measurements-unavailable', 'Lokale Netz- und Speicher-Istwerte sind nicht vollständig frisch.');
            continue;
        }
        const actualW = actuals.reduce((sum, sample) => sum + sample.valueW, 0);
        const residualW = pointSample.valueW + actualW;
        const strategy = record(group.storages[0].strategy) ? group.storages[0].strategy : {};
        if (ownApp && group.storages.some((storage) => {
            const tuning = record(storage.strategy) ? storage.strategy : {};
            return ['targetGridImportW', 'importThresholdW', ...(group.primaryPurpose === 'peakShaving' ? ['peakLimitW'] : [])]
                .some(key => tuning[key] !== strategy[key]);
        })) {
            block('group-strategy-conflict', 'Eine Dispatchgruppe benötigt ein gemeinsames Zielband und Peak-Ziel.');
            continue;
        }
        const policy = ownApp ? ownPolicyFor(group.storages[0]) : policyFor(group, rootConfig, groupPolicies);
        row.gridW = pointSample.valueW;
        row.actualW = actualW;
        row.residualWithoutGroupW = residualW;
        row.policySource = ownApp ? 'dynamicGridConnection.strategy' : policy.source;
        let requestedW = null;
        if (group.primaryPurpose === 'selfConsumption') {
            if (policy.self.enabled !== true) {
                block('policy-disabled', 'Die Eigenverbrauchs-Policy ist deaktiviert.');
                continue;
            }
            row.targetGridW = policy.self.targetGridImportW;
            row.band = resolveNvpBandTarget(pointSample.valueW, row.targetGridW, policy.self.importThresholdW);
            requestedW = row.band.outsideBand ? residualW - row.targetGridW : actualW;
        }
        else if (group.primaryPurpose === 'zeroExport') {
            if (!finite(point.exportLimitW) || !finite(point.exportReserveW)) {
                block('local-export-limit-unknown', 'Lokale Exportgrenze und Reserve sind für die Nulleinspeiseplanung erforderlich.');
                continue;
            }
            const exportBudgetW = Math.max(0, point.exportLimitW - point.exportReserveW);
            row.targetGridW = -exportBudgetW;
            // Reiner Export-Guard erzeugt keinen Entladeauftrag. Vorhandene Ladung wird
            // nur so weit angefordert, wie der lokale Überschuss sie rechnerisch braucht.
            requestedW = Math.min(0, residualW + exportBudgetW);
        }
        else if (group.primaryPurpose === 'peakShaving') {
            const peak = options.peakTargetsByGroup && options.peakTargetsByGroup[group.id];
            const freshTarget = fresh(peak, now, requestMaxAgeMs) && finite(peak.targetImportW) && peak.targetImportW >= 0;
            const configuredTarget = ownApp && finite(strategy.peakLimitW) && strategy.peakLimitW >= 0;
            if (!freshTarget && !configuredTarget) {
                block('peak-target-unavailable', 'Kein gruppenspezifisches Peak-Shaving-Ziel; Anschlussgrenze ist kein wirtschaftliches Ziel.');
                continue;
            }
            row.targetGridW = freshTarget ? peak.targetImportW : strategy.peakLimitW;
            requestedW = Math.max(0, residualW - row.targetGridW);
        }
        else if (group.primaryPurpose === 'tariff') {
            const tariff = options.tariffRequestsByGroup && options.tariffRequestsByGroup[group.id];
            const freshRequest = fresh(tariff, now, requestMaxAgeMs) && finite(tariff.requestedW);
            if (ownApp) {
                row.tariffPermission = tariffPermission(group, options, now, requestMaxAgeMs);
                if (row.tariffPermission.allowed) {
                    requestedW = freshRequest ? tariff.requestedW : -group.storages.reduce((sum, storage) => sum + storage.maxChargeW, 0);
                }
                else {
                    row.targetGridW = policy.self.targetGridImportW;
                    row.band = resolveNvpBandTarget(pointSample.valueW, row.targetGridW, policy.self.importThresholdW);
                    requestedW = row.band.outsideBand ? residualW - row.targetGridW : actualW;
                    row.constraints.push('tariff-eigenverbrauch-fallback');
                }
            }
            else {
                if (!freshRequest) {
                    block('tariff-request-unavailable', 'Kein frischer gruppenspezifischer Auftrag des bestehenden Tarifplaners.');
                    continue;
                }
                requestedW = tariff.requestedW;
            }
        }
        else if (['arbitrage', 'externalArbitrage'].includes(group.primaryPurpose)) {
            const source = options.externalRequestsByGroup || options.arbitrageRequestsByGroup;
            const request = source && source[group.id];
            // Der Marker entsteht ausschließlich im internen Partner-Policy-Pfad nach
            // lokaler Freigabe oder als lokaler Rückfallwunsch. Er ist kein Feld der
            // öffentlichen WSS-Nachricht und erzeugt keinen zweiten Schreibpfad.
            const configuredRequest = request?.trustedPartnerRequest === true
                || group.storages.some((storage) => record(storage.requestPowerMeasurement) && !!storage.requestPowerMeasurement.stateId);
            if (!configuredRequest || !fresh(request, now, requestMaxAgeMs) || !finite(request.requestedW)) {
                block('arbitrage-request-unavailable', 'EOS-Arbitrage benötigt eine explizite Anforderungsquelle und einen frischen Leistungsauftrag.');
                continue;
            }
            requestedW = request.requestedW;
        }
        else {
            block('purpose-unsupported', 'Die Aufgabe hat keinen bestätigten EOS-Gruppenplaner.');
            continue;
        }
        if (!finite(requestedW)) {
            block('request-invalid', 'Der Gruppenplaner hat keinen endlichen Leistungsbedarf ermittelt.');
            continue;
        }
        row.requestedW = requestedW;
        const partnerRequest = options.arbitrageRequestsByGroup?.[group.id];
        const partnerBounded = ['arbitrage', 'externalArbitrage'].includes(group.primaryPurpose) && partnerRequest?.trustedPartnerRequest === true;
        const members = [];
        for (let index = 0; index < group.storages.length; index++) {
            const storage = group.storages[index];
            const actual = actuals[index].valueW;
            const state = telemetry[storage.id];
            const member = { id: storage.id, actualW: actual, available: false, minW: null, maxW: null, reason: '' };
            row.members.push(member);
            if (!fresh(state, now, maxTelemetryAgeMs) || !finite(state.socPct) || state.socPct < 0 || state.socPct > 100 || state.available !== true) {
                member.reason = 'soc-or-availability-unverified';
                continue;
            }
            if (![storage.maxChargeW, storage.maxDischargeW, storage.minSoc, storage.maxSoc].every(finite)
                || storage.maxChargeW < 0 || storage.maxDischargeW < 0 || storage.minSoc < 0 || storage.maxSoc > 100 || storage.minSoc > storage.maxSoc) {
                member.reason = 'device-limits-unknown';
                continue;
            }
            if (ownApp && !hypothetical && (!finite(storage.maxDeltaWPerSec) || storage.maxDeltaWPerSec <= 0)) {
                member.reason = 'ramp-profile-unverified';
                continue;
            }
            let chargeW = storage.maxChargeW;
            let dischargeW = storage.maxDischargeW;
            for (const key of ['maxChargeW', 'maxDischargeW']) {
                if (own(state, key) && (!finite(state[key]) || state[key] < 0))
                    member.reason = 'device-derating-invalid';
            }
            if (member.reason)
                continue;
            if (finite(state.maxChargeW))
                chargeW = Math.min(chargeW, state.maxChargeW);
            if (finite(state.maxDischargeW))
                dischargeW = Math.min(dischargeW, state.maxDischargeW);
            const memberPolicy = ownApp ? ownPolicyFor(storage) : policy;
            const policyMin = group.primaryPurpose === 'peakShaving' ? memberPolicy.lsk.minSocPct : memberPolicy.self.minSocPct;
            const policyMax = group.primaryPurpose === 'peakShaving' ? memberPolicy.lsk.maxSocPct : memberPolicy.self.maxSocPct;
            const minSoc = Math.max(storage.minSoc, memberPolicy.reserve.enabled ? memberPolicy.reserve.minSocPct : 0, policyMin);
            const maxSoc = Math.min(storage.maxSoc, policyMax);
            if (state.socPct <= minSoc)
                dischargeW = 0;
            if (state.socPct >= maxSoc)
                chargeW = 0;
            member.available = true;
            member.socPct = state.socPct;
            member.minW = chargeW === 0 ? 0 : -chargeW;
            member.maxW = dischargeW;
            member.reason = chargeW === 0 || dischargeW === 0 ? 'soc-or-device-limited' : 'ok';
            members.push(member);
        }
        if (members.length !== group.storages.length) {
            block('capability-unverified', 'Anforderung berechnet; keine Leistungszusage ohne frischen SoC und bestätigte Verfügbarkeit jedes Gruppenteilnehmers.');
            continue;
        }
        const previous = options.previousState && options.previousState.configVersion === config.configVersion && options.previousState.groups && options.previousState.groups[group.id];
        const feedback = options.budgetFeedbackByGroup && options.budgetFeedbackByGroup[group.id];
        const feedbackValid = fresh(feedback, now, maxTelemetryAgeMs) && feedback.configVersion === config.configVersion && finite(feedback.acceptedW);
        const previousValid = record(previous) && finite(previous.ts) && previous.ts > 0 && previous.ts <= now && now - previous.ts <= maxTelemetryAgeMs && finite(previous.limitedTargetW);
        let feedbackUsed = false;
        let verified = true;
        let totalAllowanceW = 0;
        let totalAnchorW = 0;
        for (const [index, member] of members.entries()) {
            const storage = group.storages[index];
            const state = telemetry[storage.id];
            // Eine Gruppen-Summenrampe kann einzelne langsame Geräte überfordern.
            // Deshalb werden Grenzen vor der gemeinsamen Verteilung je Gerät geschnitten.
            const ramp = finite(storage.maxDeltaWPerSec) ? storage.maxDeltaWPerSec : state.maxDeltaWPerSec;
            if (!finite(ramp) || ramp <= 0) {
                verified = false;
                member.ramp = { verified: false };
                continue;
            }
            const individual = options.budgetFeedbackByStorage && options.budgetFeedbackByStorage[storage.id];
            const groupMember = feedbackValid && record(feedback.members) && feedback.members[storage.id];
            const selectedFeedback = fresh(individual, now, maxTelemetryAgeMs) && individual.configVersion === config.configVersion && finite(individual.acceptedW)
                ? individual : (feedbackValid && finite(groupMember && groupMember.acceptedW) ? { ...feedback, acceptedW: groupMember.acceptedW } : (feedbackValid && members.length === 1 ? feedback : null));
            const previousMember = previousValid && record(previous.members) && previous.members[storage.id];
            const priorW = finite(previousMember && previousMember.limitedTargetW) ? previousMember.limitedTargetW : (previousValid && members.length === 1 ? previous.limitedTargetW : null);
            const anchorW = selectedFeedback ? selectedFeedback.acceptedW : (finite(priorW) ? priorW : member.actualW);
            const anchorTs = selectedFeedback ? selectedFeedback.ts : (finite(priorW) ? previous.ts : actuals[index].ts);
            const elapsedSec = Math.max(0, Math.min(maxTelemetryAgeMs, now - anchorTs)) / 1000;
            const allowanceW = ramp * elapsedSec;
            // Harte SoC-/Gerätegrenzen haben Vorrang vor einer weichen Sollwertrampe.
            const boundedAnchorW = clamp(anchorW, member.minW, member.maxW);
            member.minW = Math.max(member.minW, boundedAnchorW - allowanceW);
            member.maxW = Math.min(member.maxW, boundedAnchorW + allowanceW);
            if (partnerBounded) {
                // Ein alter Rampenanker ist keine fortdauernde Partnerfreigabe. Null
                // bleibt erreichbar; Richtung und Betrag bleiben im aktuellen Vertrag.
                // Notwendige Netzstützung entscheidet weiterhin der zentrale Solver.
                member.minW = Math.min(0, Math.max(member.minW, Math.min(0, requestedW)));
                member.maxW = Math.max(0, Math.min(member.maxW, Math.max(0, requestedW)));
            }
            member.ramp = { verified: true, anchorW, allowanceW, elapsedSec, feedbackUsed: !!selectedFeedback };
            feedbackUsed = feedbackUsed || !!selectedFeedback;
            totalAllowanceW += allowanceW;
            totalAnchorW += anchorW;
        }
        if (!verified)
            row.constraints.push('ramp-profile-unverified');
        const allocation = allocate(requestedW, members);
        row.ramp = { verified, limited: allocation.proposedW !== requestedW, anchorW: totalAnchorW, allowanceW: totalAllowanceW, feedbackUsed };
        row.proposedW = allocation.proposedW;
        row.unservedW = requestedW - allocation.proposedW;
        row.minW = allocation.minW;
        row.maxW = allocation.maxW;
        row.status = hypothetical ? 'hypothetical-request' : 'planned-request';
        row.reason = 'Lokaler Rechenvorschlag; M0-/Übergangsprüfung und Geräteausgabe erfolgen im nachgelagerten gemeinsamen Writer.';
        nextState.groups[group.id] = { ts: now, limitedTargetW: allocation.proposedW, actualW, hypothetical, members: Object.fromEntries(allocation.proposals.map((proposal) => [proposal.id, { ts: now, limitedTargetW: proposal.proposedW }])) };
        for (const proposal of allocation.proposals)
            requests.push({
                storageId: proposal.id, groupId: group.id, connectionPointId: group.connectionPointId,
                controlPointId: group.controlPointId, authority: group.authority, primaryPurpose: group.primaryPurpose,
                requestedW: proposal.proposedW, groupRequestedW: requestedW, proposedW: proposal.proposedW,
                actualW: proposal.actualW, minW: proposal.minW, maxW: proposal.maxW,
                hypothetical, applied: false, status: hypothetical ? 'diagnostic' : 'planned',
            });
    }
    return output;
}
module.exports = { planGroups };
