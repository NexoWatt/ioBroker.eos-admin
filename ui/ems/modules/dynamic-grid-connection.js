/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts
 * Quell-Hash: sha256:d93be3dbcbb7545cf6090a4333031f76187563039fbffb29c28a447721435a17
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/modules/dynamic-grid-connection.js.
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
 * Aufgabe: Führt die eigenständige App Dynamischer Netzanschluss mit getrennten M0-/M1-Regelbereichen und einem gemeinsamen Schreibplan aus.
 * Daten und Wirkung: Liest konfigurierte Messungen, nutzt bestehende Speicher-/Tarif-Policies und den gemeinsamen Intervallsolver; schreibt ausschließlich über den generischen dynamischen Writer. Behält unbestätigte Befehle und alte externe Freigaben im Budget.
 * Bei Änderungen: Messung, Befehlsecho und Istwirkung getrennt halten; lokale Ausfälle begrenzen ihren Bereich, M0-Ausfall sperrt neue Befehle. Handover darf benötigte Stützleistung nicht pauschal abschalten.
 * Verknüpfungen: docs/dev/DYNAMIC_GRID_CONTRACT.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const { validateDynamicGridConfig, dynamicGridReadIds, collectDynamicSnapshot } = require('../services/dynamic-grid-config');
const { planGroups } = require('../services/nvp-group-planner');
const { groupStorages, affectsPoint } = require('../services/nvp-topology');
const { solveDynamicDispatch, operatingLimits } = require('../services/nvp-budget');
const { resolveStrictStorageTariffPermission, resolveStorageLicensePowerProfile, applyStorageLicensePowerLimit } = require('./storage-control');
const { liveSafetyEnvelope, evaluateFlexibleLoadRequest, evaluateSafetyCommandPermission, commitFlexibleLoadDecision } = require('../services/safety-envelope');
const { getAcceptedPowerEffectSnapshot, recordAcceptedActuatorTransition } = require('../services/accepted-power-effects');
const { DynamicGridWriter } = require('../services/dynamic-grid-writer');
const { evaluateArbitrageRequest, selectConfiguredArbitrageRequest } = require('../services/arbitrage-control');
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const activeApp = (root) => root?.emsApps?.apps?.dynamicGrid?.installed === true && root?.emsApps?.apps?.dynamicGrid?.enabled === true;
const clone = (value) => JSON.parse(JSON.stringify(value));
const configKey = (root) => JSON.stringify({ app: root?.emsApps?.apps?.dynamicGrid, config: root?.dynamicGridConnection, datapoints: root?.datapoints, invert: root?.settings?.flowInvertGrid });
const actuatorKey = (config) => JSON.stringify({ points: (config?.points || []).map((p) => ({ id: p.id, measurement: p.measurement })), storages: (config?.storages || []).map((s) => ({ id: s.id, command: s.command, powerMeasurement: s.powerMeasurement, connectionPointId: s.connectionPointId })), pvAssignments: config?.pvAssignments || [] });
const fresh = (sample, now, maxAgeMs) => sample?.valid === true && finite(sample.ts) && sample.ts > 0 && sample.ts <= now && now - sample.ts <= maxAgeMs;
/** Gemeinsame Bestandsgrenzen werden einmal als Standort-/Kategoriecap übernommen, nie je Batterie vervielfacht. */
function resolveDynamicSafety(adapter, dp, config, snapshot) {
    const chargeCapacityW = config.storages.reduce((n, s) => n + s.maxChargeW, 0);
    const dischargeCapacityW = config.storages.reduce((n, s) => n + s.maxDischargeW, 0);
    const profile = resolveStorageLicensePowerProfile(adapter, {}, config.storages, 'farm');
    let chargeW = Math.abs(applyStorageLicensePowerLimit(-chargeCapacityW, profile).targetW);
    let dischargeW = Math.max(0, applyStorageLicensePowerLimit(dischargeCapacityW, profile).targetW);
    const caps = adapter._emsCaps || {};
    if (finite(caps.storageChargeLimitW))
        chargeW = Math.min(chargeW, Math.max(0, caps.storageChargeLimitW));
    if (finite(caps.storageDischargeLimitW))
        dischargeW = Math.min(dischargeW, Math.max(0, caps.storageDischargeLimitW));
    const mesh = adapter._meshCoordinator?.currentLimits?.();
    if (mesh?.required) {
        chargeW = Math.min(chargeW, finite(mesh.limits?.chargeW) ? Math.max(0, mesh.limits.chargeW) : 0);
        dischargeW = Math.min(dischargeW, finite(mesh.limits?.dischargeW) ? Math.max(0, mesh.limits.dischargeW) : 0);
    }
    const required = adapter._nwSafetyEnvelopeRequired === true || !!adapter._emsSafetyCycle || !!adapter.emsEngine;
    let envelope = null, decision = null;
    if (required) {
        try {
            envelope = liveSafetyEnvelope(adapter, dp, { now: Date.now(), generation: adapter._emsSafetyCycle?.generation });
        }
        catch {
            envelope = null;
        }
        const samples = config.storages.map((storage) => snapshot.storages?.[storage.id]);
        const actualFresh = samples.every((sample, index) => fresh(sample, Date.now(), config.storages[index].powerMeasurement.maxAgeMs));
        const currentActualW = actualFresh ? samples.reduce((n, sample) => n + Math.max(0, -sample.valueW), 0) : 0;
        decision = evaluateFlexibleLoadRequest(adapter, { key: 'storage:dynamicGrid', app: 'storage', requestedW: chargeW, currentActualW, currentActualFresh: actualFresh, phaseCount: Math.max(1, envelope?.phase?.requiredCount || 3), deviceCapW: chargeW, now: Date.now() });
        chargeW = Math.min(chargeW, finite(decision?.allowedW) ? Math.max(0, decision.allowedW) : 0);
        const dischargePermission = evaluateSafetyCommandPermission(adapter, { key: 'storage:dynamicGrid', app: 'storage', requestedActive: true, now: Date.now() });
        if (!envelope?.valid || envelope.forceZero || envelope.emergencyStop || dischargePermission.allowed !== true) {
            // Keine neue Leistung bei fehlender Freigabe. Der NVP-Solver entscheidet
            // separat, ob ein Reduzieren vorhandener Stützleistung überhaupt möglich ist.
            dischargeW = 0;
        }
    }
    const rowCaps = {};
    for (const storage of config.storages)
        rowCaps[storage.id] = { chargeW: chargeCapacityW > 0 ? chargeW * storage.maxChargeW / chargeCapacityW : 0, dischargeW: dischargeCapacityW > 0 ? dischargeW * storage.maxDischargeW / dischargeCapacityW : 0 };
    const importCaps = [caps.grid?.gridImportLimitW_effective, envelope?.grid?.maxImportW, mesh?.required ? mesh.limits?.importW : null].filter((value) => finite(value) && value >= 0);
    const exportCaps = [mesh?.required ? mesh.limits?.exportW : null].filter((value) => finite(value) && value >= 0);
    return { chargeW, dischargeW, rowCaps, decision, envelopeValid: !required || envelope?.valid === true, reason: decision?.reason || 'configured-device-limits', importLimitW: importCaps.length ? Math.min(...importCaps) : null, exportLimitW: exportCaps.length ? Math.min(...exportCaps) : null };
}
/** Reine Budgetvorbereitung: keine Befehlserfolge als bereits gemessene Entlastung abziehen. */
function buildDispatchInput(config, snapshot, plan, pending, options = {}) {
    const now = options.nowMs || Date.now();
    const points = (config.points || []).filter((point) => fresh(snapshot.points?.[point.id], now, point.measurement?.maxAgeMs || 5000)).map(operatingLimits);
    const rootPoint = points.find((point) => point.id === 'M0');
    if (rootPoint && options.hardLimits) {
        if (finite(options.hardLimits.importLimitW))
            rootPoint.importLimitW = Math.min(rootPoint.importLimitW, options.hardLimits.importLimitW);
        if (finite(options.hardLimits.exportLimitW))
            rootPoint.exportLimitW = Math.min(rootPoint.exportLimitW, options.hardLimits.exportLimitW);
    }
    const requests = new Map((plan.requests || []).filter((r) => finite(r.proposedW)).map((r) => [r.storageId, r]));
    const participants = [];
    const excluded = [];
    for (const storage of config.storages || []) {
        const actual = snapshot.storages?.[storage.id];
        const telemetry = snapshot.storageTelemetry?.[storage.id];
        const pointValid = points.some((point) => point.id === storage.controlPointId);
        const coherentTimes = [snapshot.points?.M0?.ts, snapshot.points?.[storage.controlPointId]?.ts, actual?.ts, telemetry?.ts];
        const coherent = coherentTimes.every(finite) && Math.max(...coherentTimes) - Math.min(...coherentTimes) <= config.maxSkewMs;
        const eligible = fresh(actual, now, storage.powerMeasurement.maxAgeMs) && finite(actual.valueW) && fresh(telemetry, now, storage.socMeasurement.maxAgeMs) && telemetry.available === true && pointValid && coherent;
        const request = requests.get(storage.id);
        if (!eligible || (storage.authority !== 'external' && !request && !options.handover)) {
            excluded.push(storage);
            continue;
        }
        let minPowerW = -storage.maxChargeW;
        let maxPowerW = storage.maxDischargeW;
        const hardCap = options.hardLimits?.rowCaps?.[storage.id];
        if (hardCap) {
            minPowerW = Math.max(minPowerW, -hardCap.chargeW);
            maxPowerW = Math.min(maxPowerW, hardCap.dischargeW);
        }
        if (telemetry.socPct >= storage.maxSoc)
            minPowerW = 0;
        if (telemetry.socPct <= storage.minSoc)
            maxPowerW = 0;
        const deviceMinW = minPowerW, deviceMaxW = maxPowerW;
        if (request && finite(request.minW))
            minPowerW = Math.max(minPowerW, request.minW);
        if (request && finite(request.maxW))
            maxPowerW = Math.min(maxPowerW, request.maxW);
        if (minPowerW > maxPowerW) {
            minPowerW = deviceMinW;
            maxPowerW = deviceMaxW;
        }
        const previous = pending[storage.id];
        let reservedMinW = actual.valueW, reservedMaxW = actual.valueW;
        if (previous) {
            reservedMinW = Math.min(reservedMinW, previous.minPowerW);
            reservedMaxW = Math.max(reservedMaxW, previous.maxPowerW);
        }
        else {
            reservedMinW = Math.min(reservedMinW, -storage.maxChargeW);
            reservedMaxW = Math.max(reservedMaxW, storage.maxDischargeW);
        }
        if (!previous && storage.authority === 'external') {
            // Beim Prozessstart darf ein noch wirksamer externer Vertrag nicht als 0
            // erscheinen. Ohne bestätigte Anwendungsrückmeldung bleibt volle Fähigkeit.
            const readback = snapshot.readbacks?.[storage.id];
            const charge = readback?.appliedMaxCharge;
            const discharge = readback?.appliedMaxDischarge;
            if (charge?.valid && discharge?.valid && finite(charge.valueW) && finite(discharge.valueW)) {
                reservedMinW = Math.min(reservedMinW, -charge.valueW);
                reservedMaxW = Math.max(reservedMaxW, discharge.valueW);
            }
            else {
                reservedMinW = Math.min(reservedMinW, -storage.maxChargeW);
                reservedMaxW = Math.max(reservedMaxW, storage.maxDischargeW);
            }
        }
        participants.push({ id: storage.id, connectionPointId: storage.connectionPointId, authority: storage.authority, actualW: actual.valueW, minPowerW, maxPowerW, requestedW: options.handover ? 0 : request?.proposedW, desiredMinW: options.handover ? 0 : minPowerW, desiredMaxW: options.handover ? 0 : maxPowerW, reservedMinW, reservedMaxW, priority: finite(storage.priority) ? storage.priority : 100 });
    }
    const residuals = {};
    for (const point of points) {
        const currentGridW = snapshot.points[point.id].valueW;
        const baseline = currentGridW + participants.filter(p => affectsPoint(p.connectionPointId, point.id)).reduce((sum, p) => sum + p.actualW, 0);
        let minW = baseline, maxW = baseline;
        // PV ist eine maximal verfügbare Quelle, keine garantierte Mindestleistung.
        // Ein vollständiger Ausfall/Abregeln darf vorhandene Ladefreigaben nicht überbuchen.
        for (const pv of config.pvAssignments || []) {
            if (!affectsPoint(pv.connectionPointId, point.id))
                continue;
            const actual = snapshot.pv?.[pv.id];
            if (actual?.valid && finite(actual.valueW))
                maxW += Math.max(0, actual.valueW);
            else
                maxW += Math.max(0, pv.referencePowerW || 0);
            const outstanding = (options.pendingPvEffects || []).find((entry) => entry.id === pv.id);
            const possibleGenerationW = finite(outstanding?.maxGenerationW) ? outstanding.maxGenerationW : pv.referencePowerW;
            if (finite(possibleGenerationW))
                minW -= Math.max(0, possibleGenerationW - (actual?.valid && finite(actual.valueW) ? actual.valueW : 0));
        }
        for (const storage of excluded) {
            if (!affectsPoint(storage.connectionPointId, point.id))
                continue;
            const actual = snapshot.storages?.[storage.id];
            const old = pending[storage.id] || { minPowerW: -storage.maxChargeW, maxPowerW: storage.maxDischargeW };
            if (actual?.valid && finite(actual.valueW)) {
                minW -= Math.max(0, old.maxPowerW - actual.valueW);
                maxW += Math.max(0, actual.valueW - old.minPowerW);
            }
            else {
                const uncertainty = storage.maxChargeW + storage.maxDischargeW;
                minW -= uncertainty;
                maxW += uncertainty;
            }
        }
        for (const effect of options.otherEffects || []) {
            if (!finite(effect.netLoadDeltaW))
                continue;
            // Fremde Verbraucher haben ohne explizite Zuordnung keine beweisbare
            // M1-Lage. Für M1 wie M0 zählt deshalb die jeweils ungünstige Möglichkeit.
            minW += Math.min(0, effect.netLoadDeltaW);
            maxW += Math.max(0, effect.netLoadDeltaW);
        }
        residuals[point.id] = { minW, maxW };
    }
    return { points, residuals, participants, excludedIds: excluded.map(s => s.id) };
}
class DynamicGridConnectionModule {
    constructor(adapter, _dp, licenseAllowed = () => true) {
        this.generation = 0;
        this.stopped = false;
        this.readBusy = false;
        this.busy = false;
        this.config = null;
        this.fingerprint = '';
        this.pending = Object.create(null);
        this.plannerState = {};
        this.transitionRequested = false;
        this.preparedHandover = false;
        this.statesReady = false;
        this.retainedConfigs = [];
        this.adapter = adapter;
        this.dp = _dp || null;
        this.licenseAllowed = licenseAllowed;
        this.writer = new DynamicGridWriter(adapter);
        adapter._nwPrepareDynamicGridTransition = (nextRoot) => this.prepareTransition(nextRoot);
        adapter._nwCancelDynamicGridTransition = () => { this.transitionRequested = false; this.preparedHandover = false; this.generation++; };
        adapter._nwCommitDynamicGridConfig = () => { this.generation++; this.transitionRequested = false; this.fingerprint = ''; };
        adapter._nwPreviewDynamicGrid = (raw, root) => this.preview(raw, root);
    }
    async init() { }
    /** Eine begrenzte Sammelabfrage; ein ausstehender Read darf keine Promise-Kette je Tick erzeugen. */
    async readStates(ids) {
        if (this.readBusy)
            throw new Error('measurement-read-busy');
        this.readBusy = true;
        let timer;
        const work = Promise.resolve().then(() => this.adapter.getForeignStatesAsync(ids)).finally(() => { this.readBusy = false; });
        try {
            return await Promise.race([work, new Promise((_r, reject) => { timer = setTimeout(() => reject(new Error('measurement-read-timeout')), 1500); })]) || {};
        }
        finally {
            clearTimeout(timer);
        }
    }
    async validate(raw, root) {
        if (typeof this.adapter._nwValidateDynamicGridConfig === 'function')
            return this.adapter._nwValidateDynamicGridConfig(raw, root);
        return validateDynamicGridConfig(raw, { rootConfig: root, active: true, generalMeasurement: this.adapter._nwDynamicGridGeneralMeasurement });
    }
    /** Nutzt den bestehenden Tarifentscheid; fehlende Freigabe fällt auf lokale EVO zurück. */
    plannerOptions(config, snapshot, handover = false, safety = null) {
        const now = Date.now();
        const tariff = this.adapter._tarifVis || {};
        const permission = resolveStrictStorageTariffPermission(tariff, { nowMs: now });
        const tariffRequestsByGroup = {}, peakTargetsByGroup = {}, arbitrageRequestsByGroup = {};
        const partnerIntentsByGroup = Object.create(null);
        for (const group of groupStorages(config)) {
            const strategy = group.storages[0]?.strategy || {};
            const actual = group.storages.reduce((sum, storage) => sum + (snapshot.storages?.[storage.id]?.valueW || 0), 0);
            const grid = snapshot.points?.[group.controlPointId]?.valueW;
            if (group.primaryPurpose === 'tariff' && finite(grid)) {
                const chargeAllowed = permission.allowed && finite(tariff.ts) && tariff.ts <= now;
                tariffRequestsByGroup[group.id] = { valid: true, ts: now, requestedW: chargeAllowed ? -group.storages.reduce((sum, s) => sum + s.maxChargeW, 0) : grid + actual - (strategy.targetGridImportW ?? 50), source: chargeAllowed ? 'existing-tariff-permission' : 'self-consumption-fallback' };
            }
            if (group.primaryPurpose === 'peakShaving' && finite(strategy.peakLimitW))
                peakTargetsByGroup[group.id] = { valid: true, ts: now, targetImportW: strategy.peakLimitW };
            if (group.primaryPurpose === 'arbitrage' && group.authority === 'eos') {
                // Capability und Telemetrie werden ohne vorausgesetzte Partnerlease
                // bereitgestellt; sie stammen nur aus dem validierten lokalen Vertrag.
                if (safety) {
                    if (!this.adapter._nwPartnerResourceAvailability)
                        this.adapter._nwPartnerResourceAvailability = Object.create(null);
                    this.adapter._nwPartnerResourceAvailability[group.id] = { available: !handover && activeApp(this.adapter.config) && this.licenseAllowed(), ts: now };
                    if (!this.adapter._nwPartnerStorageTelemetry)
                        this.adapter._nwPartnerStorageTelemetry = Object.create(null);
                    const measured = group.storages.map((storage) => snapshot.storages?.[storage.id]);
                    const states = group.storages.map((storage) => snapshot.storageTelemetry?.[storage.id]);
                    const valid = measured.every((sample) => sample?.valid === true && finite(sample.valueW) && finite(sample.ts))
                        && states.every((state) => state?.valid === true && state.available === true && finite(state.socPct) && finite(state.ts));
                    this.adapter._nwPartnerStorageTelemetry[group.id] = { resourceId: group.id,
                        socPct: valid ? Math.min(...states.map((state) => state.socPct)) : null,
                        powerW: valid ? measured.reduce((sum, sample) => sum + sample.valueW, 0) : null, gridPowerW: grid,
                        socTs: valid ? Math.min(...states.map((state) => state.ts)) : null,
                        powerTs: valid ? Math.min(...measured.map((sample) => sample.ts)) : null,
                        gridTs: snapshot.points?.[group.controlPointId]?.ts, valid: valid && snapshot.points?.[group.controlPointId]?.valid === true };
                }
                const values = group.storages.map((storage) => snapshot.requests?.[storage.id]);
                if (values.every((value, index) => fresh(value, now, group.storages[index].requestPowerMeasurement?.maxAgeMs || 5000) && finite(value.valueW)))
                    arbitrageRequestsByGroup[group.id] = { valid: true, ts: Math.min(...values.map((value) => value.ts)), requestedW: values.reduce((sum, value) => sum + value.valueW, 0) };
                const mappedPartnerResource = (this.adapter.config?.partnerIntegrations?.arbitrage?.resources || []).some((resource) => resource.id === group.id);
                const selection = !handover && typeof this.adapter._nwGetPartnerStorageRequest === 'function'
                    ? selectConfiguredArbitrageRequest(this.adapter.config, group.id, (id) => this.adapter._nwGetPartnerStorageRequest(id)) : null;
                // Ohne aktuellen Partnerauftrag wird ein lokaler Rückfallwunsch 0 W
                // geplant. Der gemeinsame Intervallsolver darf notwendige Netzstützung
                // erhalten; dies ist keine pauschale Abschaltung oder fremde Freigabe.
                if (mappedPartnerResource)
                    arbitrageRequestsByGroup[group.id] = { valid: true, ts: now, requestedW: 0, trustedPartnerRequest: true, partnerFallback: true };
                if (selection && safety && !handover) {
                    const point = config.points.find((p) => p.id === group.controlPointId);
                    const samples = group.storages.map((storage) => snapshot.storages?.[storage.id]);
                    const telemetry = group.storages.map((storage) => snapshot.storageTelemetry?.[storage.id]);
                    const allFresh = group.storages.every((storage, index) => fresh(samples[index], now, storage.powerMeasurement.maxAgeMs) && finite(samples[index]?.valueW)
                        && fresh(telemetry[index], now, storage.socMeasurement.maxAgeMs) && finite(telemetry[index]?.socPct) && telemetry[index]?.available === true);
                    const direction = selection.request.action;
                    const worstSoc = allFresh ? (direction === 'charge' ? Math.max(...telemetry.map((t) => t.socPct)) : Math.min(...telemetry.map((t) => t.socPct))) : null;
                    const chargeCap = group.storages.reduce((sum, storage) => sum + (safety.rowCaps?.[storage.id]?.chargeW || 0), 0);
                    const dischargeCap = group.storages.reduce((sum, storage) => sum + (safety.rowCaps?.[storage.id]?.dischargeW || 0), 0);
                    const context = { now, resourceId: group.id, appActive: true, commissioned: selection.commissioned,
                        writerActive: safety.envelopeValid === true, available: allFresh,
                        sampleMaxAgeMs: Math.min(15000, point?.measurement?.maxAgeMs || 5000, ...group.storages.map((s) => Math.min(s.powerMeasurement.maxAgeMs, s.socMeasurement.maxAgeMs))), maxSkewMs: config.maxSkewMs,
                        soc: { value: worstSoc, ts: allFresh ? Math.min(...telemetry.map((t) => t.ts)) : null, valid: allFresh },
                        batteryPower: { value: actual, ts: allFresh ? Math.min(...samples.map((s) => s.ts)) : null, valid: allFresh },
                        gridPower: { value: grid, ts: snapshot.points?.[group.controlPointId]?.ts, valid: snapshot.points?.[group.controlPointId]?.valid === true },
                        limits: { ...selection.limits,
                            minSoc: Math.max(selection.limits.minSoc, ...group.storages.map((s) => s.minSoc)),
                            maxSoc: Math.min(selection.limits.maxSoc, ...group.storages.map((s) => s.maxSoc)),
                            maxImportW: Math.min(selection.limits.maxImportW, Math.max(0, point.importLimitW - point.importReserveW)),
                            maxExportW: Math.min(selection.limits.maxExportW, Math.max(0, point.exportLimitW - point.exportReserveW)) },
                        grant: { maxChargeW: chargeCap, maxDischargeW: dischargeCap, issuedAt: now, expiresAt: now + 1000 } };
                    const decision = evaluateArbitrageRequest(selection.request, context);
                    if (!this.adapter._nwPartnerArbitrageDecisions)
                        this.adapter._nwPartnerArbitrageDecisions = Object.create(null);
                    this.adapter._nwPartnerArbitrageDecisions[group.id] = decision;
                    if (decision.status !== 'rejected' && finite(decision.targetW)) {
                        arbitrageRequestsByGroup[group.id] = { valid: true, ts: now, requestedW: decision.targetW, trustedPartnerRequest: true };
                        partnerIntentsByGroup[group.id] = { selection, decision, context };
                    }
                }
            }
        }
        return { nowMs: now, rootConfig: this.adapter.config || {}, storageTelemetry: snapshot.storageTelemetry, previousState: this.plannerState, tariffSnapshot: tariff, tariffRequestsByGroup: config.origin === 'dynamicGridConnection' ? {} : tariffRequestsByGroup, peakTargetsByGroup, arbitrageRequestsByGroup, partnerIntentsByGroup, handover };
    }
    /** Alte EOS-Ziele werden nur durch echte, nach dem Befehl gemessene Leistung freigegeben. */
    reconcile(config, snapshot) {
        const now = Date.now();
        for (const storage of config.storages || []) {
            const old = this.pending[storage.id];
            if (!old)
                continue;
            const actual = snapshot.storages?.[storage.id];
            if (!fresh(actual, now, storage.powerMeasurement.maxAgeMs) || !finite(actual.valueW))
                continue;
            if (storage.authority !== 'external' && old.commandConfirmed && actual.ts >= old.commandTs && finite(old.targetW) && Math.abs(actual.valueW - old.targetW) <= storage.configuredToleranceW) {
                this.pending[storage.id] = { ...old, minPowerW: Math.min(actual.valueW, old.targetW), maxPowerW: Math.max(actual.valueW, old.targetW), actualW: actual.valueW, actualTs: actual.ts, appliedConfirmed: true };
            }
            if (storage.authority === 'external') {
                const rb = snapshot.readbacks?.[storage.id] || {};
                const charge = rb.appliedMaxCharge, discharge = rb.appliedMaxDischarge;
                if (old.commandConfirmed && charge?.valid && discharge?.valid && charge.ts >= old.commandTs && discharge.ts >= old.commandTs && finite(charge.valueW) && finite(discharge.valueW) && charge.valueW <= -old.nextMinPowerW && discharge.valueW <= old.nextMaxPowerW) {
                    this.pending[storage.id] = { ...old, minPowerW: Math.min(actual.valueW, -charge.valueW), maxPowerW: Math.max(actual.valueW, discharge.valueW), actualW: actual.valueW, actualTs: actual.ts, appliedConfirmed: true };
                }
            }
        }
    }
    runtime(config, snapshot, epoch, key, allowSave = false, maintenance = false) {
        const cycleId = this.adapter._nwActiveEmsCycleId;
        const isCurrent = () => (maintenance || this.licenseAllowed()) && (cycleId === undefined || this.adapter._nwActiveEmsCycleId === cycleId) && !this.stopped && this.generation === epoch && configKey(this.adapter.config || {}) === key && (allowSave || this.adapter._nwDynamicGridSaveInFlight !== true) && !this.adapter._nwShuttingDown;
        const runtime = { active: true, handover: maintenance, status: 'planning', configVersion: config.configVersion, config, snapshot, ts: Date.now(), generation: epoch, configFingerprint: key, writer: this.writer, isCurrent, measurementIds: dynamicGridReadIds(config), collectSnapshot: (states, now) => collectDynamicSnapshot(config, states, now), retainedConfigs: this.retainedConfigs, lifecycleOwnershipConfig: this.transitionRequested ? config : null, pendingIntervals: Object.values(this.pending), storageResults: [], grants: [] };
        this.adapter._nwDynamicGridConnectionRuntime = runtime;
        return runtime;
    }
    async publish(status) {
        this.adapter._nwDynamicGridStatus = status;
        if (!this.statesReady) {
            await this.adapter.setObjectNotExistsAsync('dynamicGridConnection', { type: 'channel', common: { name: 'Dynamischer Netzanschluss' }, native: {} });
            for (const [id, type] of [['status', 'string'], ['statusJson', 'string'], ['active', 'boolean']])
                await this.adapter.setObjectNotExistsAsync(`dynamicGridConnection.${id}`, { type: 'state', common: { name: id, type, role: type === 'boolean' ? 'indicator' : 'text', read: true, write: false }, native: {} });
            this.statesReady = true;
        }
        await this.adapter.setStateAsync('dynamicGridConnection.status', { val: status.status, ack: true });
        await this.adapter.setStateAsync('dynamicGridConnection.statusJson', { val: JSON.stringify(status), ack: true });
        await this.adapter.setStateAsync('dynamicGridConnection.active', { val: status.active === true, ack: true });
    }
    /** Vorschau teilt die Rechenpfade; sie reserviert und schreibt keine Aktoren. */
    async preview(raw, root = this.adapter.config) {
        const validation = await this.validate(raw, root);
        if (!validation.valid || !validation.topology)
            return { active: false, status: 'config_invalid', errors: validation.errors, activationErrors: validation.activationErrors, writesPerformed: 0 };
        const config = validation.topology;
        const snapshot = collectDynamicSnapshot(config, await this.readStates(dynamicGridReadIds(config)), Date.now());
        const groups = planGroups(config, { ...snapshot, valid: true }, this.plannerOptions(config, snapshot));
        const input = buildDispatchInput(config, snapshot, groups, {}, { nowMs: Date.now() });
        const budget = solveDynamicDispatch(input);
        return { active: false, hypothetical: true, status: 'preview', configVersion: config.configVersion, snapshot, groups: groups.groups, budget, writesPerformed: 0 };
    }
    /** Mappingwechsel bleibt bei fehlender Bestätigung atomar beim bisherigen Vertrag. */
    async prepareTransition(nextRoot) {
        if (!this.config && activeApp(this.adapter.config || {})) {
            const previous = await this.validate(this.adapter.config.dynamicGridConnection, this.adapter.config);
            if (!previous.valid || !previous.topology)
                return { ok: false, status: 'handover_pending', reason: 'previous-active-contract-unavailable' };
            this.config = previous.topology;
            this.fingerprint = configKey(this.adapter.config);
        }
        if (!this.config)
            return { ok: true, status: 'no-owned-actuators' };
        const nextActive = activeApp(nextRoot);
        const next = nextActive ? await this.validate(nextRoot.dynamicGridConnection, nextRoot) : null;
        if (nextActive && (!next?.valid || !next.topology))
            return { ok: false, status: 'config_invalid', reason: 'next-contract-invalid' };
        if (nextActive && next?.valid && actuatorKey(this.config) === actuatorKey(next.topology))
            return { ok: true, status: 'same-actuator-contract' };
        this.transitionRequested = true;
        this.retainedConfigs = [this.config];
        if (this.adapter._nwDynamicGridConnectionRuntime)
            this.adapter._nwDynamicGridConnectionRuntime.retainedConfigs = this.retainedConfigs;
        if (this.busy || this.writer.hasPendingWrites()) {
            this.generation++;
            return { ok: false, status: 'handover_pending', reason: 'in-flight-cycle' };
        }
        await this.execute(this.config, true, true);
        return { ok: this.preparedHandover, status: this.preparedHandover ? 'handover_confirmed' : 'handover_pending', reason: this.preparedHandover ? '' : 'Warte auf sicheren Übergang und gemessene Nulllast.' };
    }
    async execute(config, handover = false, allowSave = false) {
        if (this.busy || this.stopped)
            return;
        this.busy = true;
        const epoch = ++this.generation;
        const key = configKey(this.adapter.config || {});
        try {
            const snapshot = collectDynamicSnapshot(config, await this.readStates(dynamicGridReadIds(config)), Date.now());
            if (this.generation !== epoch || configKey(this.adapter.config || {}) !== key)
                return;
            this.reconcile(config, snapshot);
            for (const storage of config.storages || []) {
                if (this.pending[storage.id])
                    continue;
                const actual = snapshot.storages?.[storage.id];
                this.pending[storage.id] = { id: storage.id, connectionPointId: storage.connectionPointId, minPowerW: Math.min(-storage.maxChargeW, actual?.valid ? actual.valueW : 0), maxPowerW: Math.max(storage.maxDischargeW, actual?.valid ? actual.valueW : 0), actualW: actual?.valid ? actual.valueW : null, actualTs: actual?.ts || null, commandAccepted: false, commandConfirmed: false, appliedConfirmed: false, reason: 'startup-contract-unconfirmed' };
            }
            const runtime = this.runtime(config, snapshot, epoch, key, allowSave, handover);
            const hardLimits = resolveDynamicSafety(this.adapter, this.dp, config, snapshot);
            const plannerOptions = this.plannerOptions(config, snapshot, handover, hardLimits);
            const groups = planGroups(config, { ...snapshot, valid: true }, plannerOptions);
            const ledger = getAcceptedPowerEffectSnapshot(this.adapter);
            const input = buildDispatchInput(config, snapshot, groups, this.pending, { nowMs: Date.now(), handover, hardLimits, pendingPvEffects: this.adapter._nwDynamicGridPvRuntime?.pendingEffects || [], otherEffects: (ledger.entries || []).filter((e) => !String(e.key).startsWith('dynamicGrid.') && e.accepted === true) });
            const budget = solveDynamicDispatch(input);
            const unknownOtherEffects = (ledger.entries || []).some((e) => !String(e.key).startsWith('dynamicGrid.') && e.accepted === true && e.uncertain === true);
            const results = [];
            const zeroConfirmed = config.storages.every((storage) => {
                const actual = snapshot.storages?.[storage.id], p = this.pending[storage.id];
                return actual?.valid && Math.abs(actual.valueW) <= storage.configuredToleranceW && p?.appliedConfirmed && Math.abs(p.minPowerW) <= storage.configuredToleranceW && Math.abs(p.maxPowerW) <= storage.configuredToleranceW;
            });
            // Die Übergabe umfasst auch noch mögliche PV-Erzeugung und fremde
            // Übergänge. Speicher-Ist=0 allein gibt die bisherige Stellhoheit nicht frei.
            const handoverReady = zeroConfirmed && budget.valid === true && budget.safe === true && !unknownOtherEffects && !this.writer.hasPendingWrites();
            if (handover)
                this.preparedHandover = handoverReady;
            const commands = !this.writer.hasPendingWrites() && !unknownOtherEffects && !(handover && zeroConfirmed) && budget.valid && (budget.safe || budget.recoveryAllowed) ? (budget.commands || []) : [];
            for (const command of commands) {
                const storage = config.storages.find((s) => s.id === command.id);
                if (!storage)
                    continue;
                const participant = input.participants.find((p) => p.id === storage.id);
                const guard = () => {
                    const partnerIntent = plannerOptions.partnerIntentsByGroup?.[storage.dispatchGroupId];
                    if (partnerIntent) {
                        const selection = selectConfiguredArbitrageRequest(this.adapter.config, storage.dispatchGroupId, (id) => this.adapter._nwGetPartnerStorageRequest(id));
                        if (!selection || selection.fingerprint !== partnerIntent.selection.fingerprint)
                            return false;
                        const decision = evaluateArbitrageRequest(selection.request, { ...partnerIntent.context, now: Date.now() });
                        if (decision.status === 'rejected' || Date.now() >= decision.validUntil)
                            return false;
                        const economicCommands = commands.filter((candidate) => candidate.recovery !== true
                            && config.storages.find((row) => row.id === candidate.id)?.dispatchGroupId === storage.dispatchGroupId);
                        if (!economicCommands.every((candidate) => finite(candidate.targetW)))
                            return false;
                        const total = economicCommands.reduce((sum, candidate) => sum + candidate.targetW, 0);
                        if (total !== 0 && (Math.sign(total) !== Math.sign(decision.targetW) || Math.abs(total) > Math.abs(decision.targetW) + 1e-6))
                            return false;
                    }
                    const live = resolveDynamicSafety(this.adapter, this.dp, config, snapshot);
                    const cap = live.rowCaps[storage.id];
                    const requestedMin = finite(command.targetW) ? command.targetW : command.minPowerW;
                    const requestedMax = finite(command.targetW) ? command.targetW : command.maxPowerW;
                    const hardAllowed = requestedMin >= -cap.chargeW - 1e-6 && requestedMax <= cap.dischargeW + 1e-6 && (live.importLimitW === null || live.importLimitW >= (input.points.find((point) => point.id === 'M0')?.importLimitW ?? 0)) && (live.exportLimitW === null || live.exportLimitW >= (input.points.find((point) => point.id === 'M0')?.exportLimitW ?? 0));
                    return hardAllowed && runtime.isCurrent() && fresh(snapshot.points?.M0, Date.now(), config.points.find((p) => p.id === 'M0')?.measurement?.maxAgeMs || 5000) && fresh(snapshot.points?.[storage.controlPointId], Date.now(), config.points.find((p) => p.id === storage.controlPointId)?.measurement?.maxAgeMs || 5000) && fresh(snapshot.storages?.[storage.id], Date.now(), storage.powerMeasurement.maxAgeMs) && fresh(snapshot.storageTelemetry?.[storage.id], Date.now(), Math.min(storage.socMeasurement.maxAgeMs, storage.availability?.maxAgeMs || storage.socMeasurement.maxAgeMs));
                };
                if (!guard())
                    break;
                const old = this.pending[storage.id];
                const nextMin = finite(command.targetW) ? command.targetW : command.minPowerW;
                const nextMax = finite(command.targetW) ? command.targetW : command.maxPowerW;
                // Absicht VOR dem await reservieren: auch ein Transport-Timeout kann
                // einen später wirksamen Befehl hinterlassen.
                this.pending[storage.id] = { id: storage.id, connectionPointId: storage.connectionPointId, minPowerW: Math.min(participant.reservedMinW, nextMin), maxPowerW: Math.max(participant.reservedMaxW, nextMax), nextMinPowerW: nextMin, nextMaxPowerW: nextMax, targetW: command.targetW, actualW: participant.actualW, actualTs: snapshot.storages[storage.id].ts, commandTs: old?.nextMinPowerW === nextMin && old?.nextMaxPowerW === nextMax ? old.commandTs : Date.now(), commandAccepted: false, commandConfirmed: false, appliedConfirmed: old?.appliedConfirmed === true && old?.nextMinPowerW === nextMin && old?.nextMaxPowerW === nextMax, validUntilMs: storage.command.watchdog ? Date.now() + storage.command.watchdog.ttlMs : null };
                runtime.pendingIntervals = Object.values(this.pending);
                const result = await this.writer.writeStorage(storage, { ...command, previousLimits: old ? { maxCharge: -old.minPowerW, maxDischarge: old.maxPowerW } : undefined }, guard);
                this.pending[storage.id].commandAccepted = result.accepted;
                this.pending[storage.id].commandConfirmed = result.commandConfirmed;
                results.push({ ...result, requestedW: groups.requests?.find((r) => r.storageId === storage.id)?.requestedW ?? null, targetW: command.targetW ?? null, minPowerW: nextMin, maxPowerW: nextMax, actualW: participant.actualW, appliedConfirmed: false });
                recordAcceptedActuatorTransition(this.adapter, { key: `dynamicGrid.${storage.id}`, accepted: result.accepted, commandChanged: true, uncertain: true, source: 'dynamicGridConnection', reason: 'await-physical-feedback' });
                if (!result.commandConfirmed)
                    break;
            }
            if (hardLimits.decision) {
                const reservedChargeW = Object.values(this.pending).reduce((sum, p) => sum + Math.max(0, -p.minPowerW), 0);
                const actualChargeW = config.storages.reduce((sum, storage) => sum + Math.max(0, -(snapshot.storages?.[storage.id]?.valueW || 0)), 0);
                commitFlexibleLoadDecision(this.adapter, { ...hardLimits.decision, allowedW: reservedChargeW, reservation: { targetW: reservedChargeW, deltaW: Math.max(0, reservedChargeW - actualChargeW), phaseDeltaW: Math.max(0, reservedChargeW - actualChargeW), app: 'storage' } }, true);
            }
            const byGroup = {};
            for (const group of groups.groups || []) {
                const ids = config.storages.filter((s) => s.dispatchGroupId === group.id).map((s) => s.id);
                const accepted = results.filter(r => ids.includes(r.id) && r.commandConfirmed && finite(r.targetW));
                if (accepted.length === ids.length)
                    byGroup[group.id] = { ts: Date.now(), limitedTargetW: accepted.reduce((sum, r) => sum + r.targetW, 0), members: Object.fromEntries(accepted.map(r => [r.id, { ts: Date.now(), limitedTargetW: r.targetW }])) };
            }
            this.plannerState = { configVersion: config.configVersion, groups: byGroup };
            runtime.status = this.writer.hasPendingWrites() ? 'hardware-write-pending' : unknownOtherEffects ? 'other-actuator-transition-unconfirmed' : handover ? (this.preparedHandover ? 'handover_confirmed' : 'handover_pending') : (snapshot.points?.M0?.valid ? budget.status || (budget.safe ? 'active' : 'constrained') : 'root-measurement-unavailable');
            runtime.storageResults = results;
            runtime.grants = budget.commands || [];
            runtime.pendingIntervals = Object.values(this.pending);
            runtime.groups = groups.groups;
            runtime.budget = budget;
            await this.publish({ active: true, status: runtime.status, configVersion: config.configVersion, ts: Date.now(), snapshot, groups: groups.groups, budget, hardLimits: { chargeW: hardLimits.chargeW, dischargeW: hardLimits.dischargeW, reason: hardLimits.reason }, storageResults: results, pendingIntervals: runtime.pendingIntervals, handover, writesPerformed: results.reduce((n, r) => n + r.writes.filter((w) => w.writeIssued && w.accepted).length, 0), writeAttempts: results.reduce((n, r) => n + r.writes.filter((w) => w.writeIssued).length, 0) });
        }
        catch (error) {
            if (this.adapter._nwDynamicGridConnectionRuntime)
                this.adapter._nwDynamicGridConnectionRuntime.status = 'runtime_error';
            await this.publish({ active: true, status: 'runtime_error', reason: String(error?.message || error), configVersion: config.configVersion, ts: Date.now(), pendingIntervals: Object.values(this.pending) });
        }
        finally {
            this.busy = false;
        }
    }
    async tick() {
        if (this.stopped || this.busy || this.adapter._nwDynamicGridSaveInFlight)
            return;
        const root = this.adapter.config || {};
        const requested = activeApp(root) && this.licenseAllowed();
        if (!requested && !this.config)
            return;
        if (!requested || this.transitionRequested) {
            if (this.config && (!this.preparedHandover || !requested)) {
                this.retainedConfigs = [this.config];
                await this.execute(this.config, true);
            }
            if (!this.preparedHandover)
                return;
            if (!requested) {
                this.config = null;
                this.pending = Object.create(null);
                this.retainedConfigs = [];
                this.transitionRequested = false;
                this.adapter._nwDynamicGridConnectionRuntime = { active: false, status: 'inactive', retainedConfigs: [], pendingIntervals: [], isCurrent: () => false };
                await this.publish({ active: false, status: 'inactive', configVersion: root.dynamicGridConnection?.configVersion, ts: Date.now() });
                return;
            }
            if (configKey(root) === this.fingerprint)
                return;
            this.transitionRequested = false;
        }
        const key = configKey(root);
        if (key !== this.fingerprint) {
            const validation = await this.validate(root.dynamicGridConnection, root);
            if (!validation.valid || !validation.topology) {
                this.adapter._nwDynamicGridConnectionRuntime = { active: true, status: 'config_invalid', config: this.config, retainedConfigs: this.retainedConfigs, pendingIntervals: Object.values(this.pending), isCurrent: () => false };
                await this.publish({ active: true, status: 'config_invalid', configVersion: root.dynamicGridConnection?.configVersion, errors: validation.errors, activationErrors: validation.activationErrors, ts: Date.now() });
                return;
            }
            if (this.config && actuatorKey(this.config) !== actuatorKey(validation.topology) && !this.preparedHandover) {
                this.transitionRequested = true;
                this.retainedConfigs = [this.config];
                await this.execute(this.config, true);
                return;
            }
            this.config = validation.topology;
            this.fingerprint = key;
            this.plannerState = {};
            this.retainedConfigs = [];
            if (this.preparedHandover)
                this.pending = Object.create(null);
            this.preparedHandover = false;
        }
        if (this.config)
            await this.execute(this.config);
    }
    async deactivate() {
        this.transitionRequested = true;
        if (!this.config)
            return { ok: true };
        this.retainedConfigs = [this.config];
        await this.execute(this.config, true, true);
        return { ok: this.preparedHandover };
    }
    stop() { this.stopped = true; this.generation++; }
}
module.exports = { DynamicGridConnectionModule, buildDispatchInput, resolveDynamicSafety, activeApp };
