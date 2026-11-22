/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/services/nvp-budget.ts
 * Quell-Hash: sha256:48948bfa897061d745fbc88ff444106e8fbc791f88973b6c01e1de02358885a8
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/nvp-budget.js.
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
 * Aufgabe: Berechnet gemeinsame, konservative Leistungsintervalle für die NVP-Bereiche M0 und M1.
 * Daten und Wirkung: Verarbeitet geprüfte Leistungen in W (Bezug positiv, Speicherentladung positiv); erzeugt reine Rechenergebnisse ohne Gerätezugriff.
 * Bei Änderungen: Alle Extremkombinationen, alte Freigaben, lokale Grenzen und Übergänge prüfen. Eine erlaubte Speicherladung ist keine zugesagte PV-Senke.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/nvp-budget.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const { affectsPoint } = require('./nvp-topology');
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const bound = (value) => value === null || (finite(value) && value >= 0);
const interval = (a, b) => finite(a) && finite(b) && a <= b;
/** Zieht eine feste Reserve genau einmal von der jeweiligen bekannten Anschlussgrenze ab. */
function operatingLimits(point) {
    const result = { valid: true, id: point && point.id };
    for (const side of ['import', 'export']) {
        const limit = point && point[`${side}LimitW`], reserve = point && point[`${side}ReserveW`];
        if (!bound(limit) || (point.id === 'M0' && limit === null) || !finite(reserve) || reserve < 0 || (limit === null ? reserve !== 0 : reserve > limit))
            return { valid: false, reason: 'invalid-operating-limit', id: point && point.id };
        result[`${side}LimitW`] = limit === null ? null : limit - reserve;
        result[`${side}ConnectionLimitW`] = limit;
        result[`${side}ReserveW`] = reserve;
    }
    return result;
}
/**
 * Restleistung enthält den betrachteten Speicher noch nicht, wohl aber alle
 * anderen elektrisch enthaltenen Bereiche. Die Intervallgrenzen müssen die
 * gesamte vorgesehene Gültigkeitsdauer abdecken; ein Momentanwert genügt nur
 * für ausdrücklich als momentan gekennzeichnete Diagnose.
 */
function computeStorageCorridor(input) {
    const { residualMinW, residualMaxW, importLimitW, exportLimitW, minPowerW, maxPowerW } = input || {};
    if (!interval(residualMinW, residualMaxW) || !interval(minPowerW, maxPowerW) || !bound(importLimitW) || !bound(exportLimitW))
        return { valid: false, reason: 'invalid-input', minPowerW: null, maxPowerW: null, containsZero: false, requiresSupport: false, maxChargeW: null, maxDischargeW: null };
    const low = Math.max(minPowerW, importLimitW === null ? minPowerW : residualMaxW - importLimitW);
    const high = Math.min(maxPowerW, exportLimitW === null ? maxPowerW : residualMinW + exportLimitW);
    const valid = finite(low) && finite(high) && low <= high;
    const containsZero = valid && low <= 0 && high >= 0;
    return {
        valid, reason: valid ? (containsZero ? 'ok' : 'mandatory-support') : 'empty-interval',
        minPowerW: low, maxPowerW: high, containsZero, requiresSupport: valid && !containsZero,
        // Keine Maximalfreigabe ausgeben, wenn der Vertrag eine Mindestleistung benötigt.
        maxChargeW: containsZero ? Math.max(0, -low) : null,
        maxDischargeW: containsZero ? Math.max(0, high) : null,
        requiredChargeW: valid && high < 0 ? -high : 0,
        requiredDischargeW: valid && low > 0 ? low : 0,
    };
}
/**
 * Prüft die vollständige kartesische Menge unabhängiger Teilnehmerleistungen.
 * Jede Wirkung wird nur an enthaltenen Messpunkten berücksichtigt; M1 wird
 * deshalb nie zusätzlich zum gemessenen M0 als Standortlast addiert.
 */
function evaluateIntervals(input) {
    if (!input || !Array.isArray(input.points) || !input.points.length || !Array.isArray(input.participants) || !input.residuals)
        return { valid: false, safe: false, reason: 'invalid-input', points: [] };
    const ids = new Set(), pointIds = new Set();
    if (input.participants.length > 32 || input.points.length > 2)
        return { valid: false, safe: false, reason: 'size-limit', points: [] };
    for (const participant of input.participants) {
        if (!participant || typeof participant.id !== 'string' || !participant.id || ids.has(participant.id) || !['M0', 'M1'].includes(participant.connectionPointId) || !interval(participant.minPowerW, participant.maxPowerW))
            return { valid: false, safe: false, reason: 'invalid-participant', points: [] };
        ids.add(participant.id);
    }
    const points = [];
    for (const point of input.points) {
        if (!point || typeof point !== 'object' || Array.isArray(point))
            return { valid: false, safe: false, reason: 'invalid-point', points: [] };
        const residual = input.residuals[point.id];
        if (!['M0', 'M1'].includes(point.id) || pointIds.has(point.id) || !bound(point.importLimitW) || !bound(point.exportLimitW) || (point.id === 'M0' && (point.importLimitW === null || point.exportLimitW === null)) || !residual || !interval(residual.minW, residual.maxW))
            return { valid: false, safe: false, reason: 'invalid-point', points: [] };
        pointIds.add(point.id);
        const participants = input.participants.filter((p) => affectsPoint(p.connectionPointId, point.id));
        const sumMinW = participants.reduce((sum, p) => sum + p.minPowerW, 0);
        const sumMaxW = participants.reduce((sum, p) => sum + p.maxPowerW, 0);
        const gridMinW = residual.minW - sumMaxW, gridMaxW = residual.maxW - sumMinW;
        if (!finite(gridMinW) || !finite(gridMaxW))
            return { valid: false, safe: false, reason: 'overflow', points: [] };
        const importViolationW = point.importLimitW === null ? 0 : Math.max(0, gridMaxW - point.importLimitW);
        const exportViolationW = point.exportLimitW === null ? 0 : Math.max(0, -point.exportLimitW - gridMinW);
        points.push({ id: point.id, gridMinW, gridMaxW, importViolationW, exportViolationW, safe: importViolationW === 0 && exportViolationW === 0 });
    }
    // Eine lokale Prüfung allein darf nicht versehentlich als Standortfreigabe gelten.
    if (!pointIds.has('M0'))
        return { valid: false, safe: false, reason: 'root-required', points };
    return { valid: true, safe: points.every(p => p.safe), reason: points.every(p => p.safe) ? 'ok' : 'limit-exceeded', points };
}
/**
 * Verteilt unabhängige Freigaben deterministisch nach Priorität. Zuerst bleiben
 * alle noch wirksamen Intervalle reserviert. Erst danach wird jedes Intervall
 * innerhalb des gemeinsam verbleibenden Budgets erweitert. Unterstützende
 * Gegenfahrpläne werden nie als garantiert angenommen. Eine erforderliche
 * Mindestleistung muss ein gesonderter verbindlicher Vertrag sicherstellen.
 */
function allocateIndependentBudgets(input) {
    if (!input || !Array.isArray(input.participants))
        return { valid: false, safe: false, reason: 'invalid-input', participants: [], points: [] };
    const participants = [];
    for (const p of input.participants) {
        if (!p || !interval(p.minPowerW, p.maxPowerW))
            return { valid: false, safe: false, reason: 'invalid-capability', participants: [], points: [] };
        const hasReservation = Object.prototype.hasOwnProperty.call(p, 'reservedMinW') || Object.prototype.hasOwnProperty.call(p, 'reservedMaxW');
        const min = hasReservation ? p.reservedMinW : 0, max = hasReservation ? p.reservedMaxW : 0;
        const desiredMin = Object.prototype.hasOwnProperty.call(p, 'desiredMinW') ? p.desiredMinW : p.minPowerW;
        const desiredMax = Object.prototype.hasOwnProperty.call(p, 'desiredMaxW') ? p.desiredMaxW : p.maxPowerW;
        if (!interval(min, max) || !interval(desiredMin, desiredMax) || min < p.minPowerW || max > p.maxPowerW || desiredMin < p.minPowerW || desiredMax > p.maxPowerW)
            return { valid: false, safe: false, reason: 'invalid-reservation-or-request', participants: [], points: [] };
        participants.push({ id: p.id, connectionPointId: p.connectionPointId, minPowerW: min, maxPowerW: max, desiredMinW: desiredMin, desiredMaxW: desiredMax, deviceMinW: p.minPowerW, deviceMaxW: p.maxPowerW, priority: finite(p.priority) ? p.priority : 0, reservedMinW: min, reservedMaxW: max });
    }
    const baseline = evaluateIntervals({ ...input, participants });
    if (!baseline.valid || !baseline.safe)
        return { ...baseline, valid: false, reason: baseline.valid ? 'existing-reservations-or-residual-exceed-limits' : baseline.reason, participants, grants: [] };
    const order = participants.slice().sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    for (const p of order) {
        let low = p.deviceMinW, high = p.deviceMaxW;
        for (const point of input.points) {
            if (!affectsPoint(p.connectionPointId, point.id))
                continue;
            const residual = input.residuals[point.id];
            const others = participants.filter(other => other !== p && affectsPoint(other.connectionPointId, point.id));
            const sumMin = others.reduce((sum, other) => sum + other.minPowerW, 0);
            const sumMax = others.reduce((sum, other) => sum + other.maxPowerW, 0);
            if (point.importLimitW !== null)
                low = Math.max(low, residual.maxW - point.importLimitW - sumMin);
            if (point.exportLimitW !== null)
                high = Math.min(high, residual.minW + point.exportLimitW - sumMax);
        }
        // Kürzungen der Reservierung werden hier ausdrücklich nicht als wirksam verbucht.
        p.minPowerW = Math.min(p.reservedMinW, Math.max(low, p.desiredMinW));
        p.maxPowerW = Math.max(p.reservedMaxW, Math.min(high, p.desiredMaxW));
        p.limited = p.minPowerW !== p.desiredMinW || p.maxPowerW !== p.desiredMaxW;
    }
    const result = evaluateIntervals({ ...input, participants });
    return { ...result, participants, grants: result.valid && result.safe ? participants.map(p => ({ id: p.id, connectionPointId: p.connectionPointId, minPowerW: p.minPowerW, maxPowerW: p.maxPowerW, maxChargeW: p.minPowerW <= 0 && p.maxPowerW >= 0 ? -p.minPowerW : null, maxDischargeW: p.minPowerW <= 0 && p.maxPowerW >= 0 ? p.maxPowerW : null, limited: p.limited })) : [] };
}
/**
 * Führt bereits in dieselbe AC-Erzeugungsgröße umgerechnete PV-Anforderungen
 * zusammen. Exportgrenzen sind hier unzulässig: sie müssen vorher aus der
 * Bereichsbilanz einschließlich verbindlicher Speicherintervalle entstehen.
 * Ungültige Anforderungen ergeben keinen stillen 100-%-Fallback.
 */
function computePvLimit(input) {
    if (!input || !finite(input.deviceMaxW) || input.deviceMaxW < 0 || !Array.isArray(input.requirements))
        return { valid: false, limitW: null, reason: 'invalid-input' };
    let limitW = input.deviceMaxW;
    const reasons = [];
    for (const request of input.requirements) {
        if (!request || request.valid !== true || request.kind !== 'generation' || !finite(request.limitW) || request.limitW < 0)
            return { valid: false, limitW: null, reason: 'invalid-or-stale-requirement' };
        if (request.limitW <= limitW) {
            limitW = request.limitW;
            if (typeof request.source === 'string')
                reasons.push(request.source);
        }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'previousW') || Object.prototype.hasOwnProperty.call(input, 'rampUpW')) {
        if (!finite(input.previousW) || input.previousW < 0 || !finite(input.rampUpW) || input.rampUpW < 0)
            return { valid: false, limitW: null, reason: 'invalid-ramp' };
        // Neue Einschränkungen sofort; nur Lockerungen werden über die Hochrampe begrenzt.
        limitW = Math.min(limitW, input.previousW + input.rampUpW);
    }
    return { valid: true, limitW, reason: reasons.length ? reasons.join(',') : 'device-limit' };
}
/** Ein hybrider AC-Port wird als eine gemeinsame Kapazität behandelt, nicht als PV plus volle Batterie-Nennleistung. */
function hybridStorageBounds(input) {
    if (!input || !finite(input.acPortLimitW) || input.acPortLimitW < 0 || !interval(input.pvMinW, input.pvMaxW) || input.pvMinW < 0 || !interval(input.minPowerW, input.maxPowerW))
        return { valid: false, reason: 'invalid-hybrid-input' };
    const minPowerW = Math.max(input.minPowerW, -input.acPortLimitW - input.pvMinW);
    const maxPowerW = Math.min(input.maxPowerW, input.acPortLimitW - input.pvMaxW);
    return { valid: minPowerW <= maxPowerW, minPowerW, maxPowerW, reason: minPowerW <= maxPowerW ? 'ok' : 'empty-hybrid-interval' };
}
/**
 * Verteilt einen bereits begrenzten Summensollwert auf individuelle Korridore.
 * Die Korridore enthalten bereits SoC, Leistung und jede einzelne Rampe. Ein
 * Leistungsrest wird deterministisch dem letzten noch verfügbaren Gerät zugeteilt.
 */
function distributeTarget(rows, totalW) {
    const current = rows.reduce((sum, row) => sum + row.targetW, 0);
    let remainder = totalW - current;
    for (const [index, row] of rows.entries()) {
        const remainingRows = rows.slice(index);
        const room = remainingRows.reduce((sum, r) => sum + (remainder >= 0 ? r.maxPowerW - r.targetW : r.targetW - r.minPowerW), 0);
        if (room <= 0 || Math.abs(remainder) <= 1e-9)
            break;
        const ownRoom = remainder >= 0 ? row.maxPowerW - row.targetW : row.targetW - row.minPowerW;
        const change = remainder * ownRoom / room;
        const next = Math.min(row.maxPowerW, Math.max(row.minPowerW, row.targetW + change));
        remainder -= next - row.targetW;
        row.targetW = next;
    }
}
/**
 * Wählt EOS-Sollwerte und unabhängige externe Freigaben gemeinsam. Restlasten
 * müssen den gesamten kommenden Zeitraum einschließlich möglicher PV-Abregelung
 * abdecken. Positive Speicherleistung entlastet Bezug. Alte Freigaben dürfen
 * außerhalb aktueller SoC-/Rampenkorridore liegen: sie bleiben dennoch reserviert.
 *
 * Für sichere Ausgangslagen wird jede neue Leistung nur innerhalb der Hülle
 * aller alten und neuen Intervalle zugelassen. Bereits bestehende Verletzungen
 * werden nicht als sichere Freigabe umgedeutet: nicht verschlechternde
 * EOS-Stützschritte und echte Verkleinerungen alter externer Verträge sind als
 * recovery=true ausführbar. Externe Maxima sind keine zugesagte Stützleistung.
 */
function solveDynamicDispatch(input) {
    const invalid = (reason) => ({ valid: false, safe: false, status: 'invalid', reason, commands: [], participants: [], points: [], transitionPoints: [], recoveryAllowed: false, requiresConfirmation: false });
    if (!input || !Array.isArray(input.participants) || input.participants.length > 32)
        return invalid('invalid-participants');
    const participants = [];
    for (const p of input.participants) {
        if (!p || !['eos', 'external'].includes(p.authority) || !finite(p.actualW) || !interval(p.minPowerW, p.maxPowerW)
            || !interval(p.reservedMinW, p.reservedMaxW) || p.actualW < p.reservedMinW || p.actualW > p.reservedMaxW)
            return invalid('invalid-capability-or-reservation');
        if (p.authority === 'eos' && !finite(p.requestedW))
            return invalid('invalid-eos-request');
        const desiredMinW = p.desiredMinW === undefined ? p.minPowerW : p.desiredMinW;
        const desiredMaxW = p.desiredMaxW === undefined ? p.maxPowerW : p.desiredMaxW;
        if (p.authority === 'external' && (!interval(desiredMinW, desiredMaxW) || desiredMinW > 0 || desiredMaxW < 0 || desiredMinW < p.minPowerW || desiredMaxW > p.maxPowerW))
            return invalid('external-maxima-require-zero');
        participants.push({ ...p, desiredMinW, desiredMaxW, targetW: p.authority === 'eos' ? Math.min(p.maxPowerW, Math.max(p.minPowerW, p.requestedW)) : null, transitionMinW: p.reservedMinW, transitionMaxW: p.reservedMaxW });
    }
    const asIntervals = (rows) => rows.map(p => ({ id: p.id, connectionPointId: p.connectionPointId, minPowerW: p.transitionMinW, maxPowerW: p.transitionMaxW }));
    const baseline = evaluateIntervals({ ...input, participants: asIntervals(participants) });
    if (!baseline.valid)
        return invalid(baseline.reason);
    const eos = participants.filter(p => p.authority === 'eos');
    const external = participants.filter(p => p.authority === 'external');
    const inner = eos.filter(p => p.connectionPointId === 'M1');
    const outer = eos.filter(p => p.connectionPointId === 'M0');
    const sum = (rows, key) => rows.reduce((value, row) => value + row[key], 0);
    const requirement = (pointId) => {
        const point = input.points.find((p) => p.id === pointId);
        if (!point)
            return { low: -Infinity, high: Infinity };
        const residual = input.residuals[pointId];
        const reservations = external.filter(p => affectsPoint(p.connectionPointId, pointId));
        return { low: point.importLimitW === null ? -Infinity : residual.maxW - point.importLimitW - sum(reservations, 'reservedMinW'), high: point.exportLimitW === null ? Infinity : residual.minW + point.exportLimitW - sum(reservations, 'reservedMaxW') };
    };
    const rootRequirement = requirement('M0'), localRequirement = requirement('M1');
    const iMin = sum(inner, 'minPowerW'), iMax = sum(inner, 'maxPowerW');
    const oMin = sum(outer, 'minPowerW'), oMax = sum(outer, 'maxPowerW');
    const innerLow = Math.max(iMin, localRequirement.low, rootRequirement.low - oMax);
    const innerHigh = Math.min(iMax, localRequirement.high, rootRequirement.high - oMin);
    let endpointFeasible = innerLow <= innerHigh;
    const clip = (v, low, high) => Math.min(high, Math.max(low, v));
    let innerTarget;
    if (endpointFeasible)
        innerTarget = clip(sum(inner, 'targetW'), innerLow, innerHigh);
    else {
        // Bei zu kleiner Kapazität bleibt die bestmögliche Entlastung nutzbar; eine
        // unerreichbare Grenze erzeugt weiter unten einen sichtbaren Restfehler.
        const localLow = Math.max(iMin, localRequirement.low), localHigh = Math.min(iMax, localRequirement.high);
        innerTarget = localLow <= localHigh ? clip(sum(inner, 'targetW'), localLow, localHigh)
            : localRequirement.low > iMax ? iMax : localRequirement.high < iMin ? iMin : clip(sum(inner, 'targetW'), iMin, iMax);
        if (innerTarget + oMax < rootRequirement.low)
            innerTarget = Math.min(iMax, Math.max(innerTarget, rootRequirement.low - oMax));
        if (innerTarget + oMin > rootRequirement.high)
            innerTarget = Math.max(iMin, Math.min(innerTarget, rootRequirement.high - oMin));
    }
    const outerLow = Math.max(oMin, rootRequirement.low - innerTarget), outerHigh = Math.min(oMax, rootRequirement.high - innerTarget);
    endpointFeasible = endpointFeasible && outerLow <= outerHigh;
    const outerTarget = outerLow <= outerHigh ? clip(sum(outer, 'targetW'), outerLow, outerHigh)
        : rootRequirement.low - innerTarget > oMax ? oMax : rootRequirement.high - innerTarget < oMin ? oMin : clip(sum(outer, 'targetW'), oMin, oMax);
    distributeTarget(inner, innerTarget);
    distributeTarget(outer, outerTarget);
    const desiredEndpoint = participants.map(p => ({ id: p.id, connectionPointId: p.connectionPointId, minPowerW: p.authority === 'eos' ? p.targetW : p.reservedMinW, maxPowerW: p.authority === 'eos' ? p.targetW : p.reservedMaxW }));
    const plannedEndpoint = evaluateIntervals({ ...input, participants: desiredEndpoint });
    endpointFeasible = endpointFeasible && plannedEndpoint.safe;
    const commands = [];
    const order = eos.slice().sort((a, b) => (finite(a.priority) ? a.priority : 0) - (finite(b.priority) ? b.priority : 0) || a.id.localeCompare(b.id));
    for (const participant of order) {
        let low = participant.minPowerW, high = participant.maxPowerW;
        for (const point of input.points) {
            if (!affectsPoint(participant.connectionPointId, point.id))
                continue;
            const before = baseline.points.find((p) => p.id === point.id);
            const residual = input.residuals[point.id];
            const others = participants.filter(p => p !== participant && affectsPoint(p.connectionPointId, point.id));
            // Bei vorhandenem Fehler ist exakt die bestehende Überschreitung die
            // äußerste Übergangsgrenze, niemals eine zusätzliche neue Freigabe.
            const importBoundary = point.importLimitW === null ? null : Math.max(point.importLimitW, before.gridMaxW);
            const exportBoundary = point.exportLimitW === null ? null : Math.max(point.exportLimitW, -before.gridMinW);
            if (importBoundary !== null)
                low = Math.max(low, residual.maxW - importBoundary - sum(others, 'transitionMinW'));
            if (exportBoundary !== null)
                high = Math.min(high, residual.minW + exportBoundary - sum(others, 'transitionMaxW'));
        }
        if (low > high) {
            participant.blockedReason = 'transition-corridor-empty';
            continue;
        }
        const targetW = clip(participant.targetW, low, high);
        const recovery = !baseline.safe;
        if (recovery) {
            // Nach Neustart kann Ist=Soll sein, während ein unbekannter alter Auftrag
            // weiterhin den vollen Korridor reserviert. Ein bestätigter erneuter
            // Auftrag muss diese Unsicherheit verengen dürfen, ohne Istwirkung zu erfinden.
            const confirmedCandidate = evaluateIntervals({ ...input, participants: participants.map(p => ({ id: p.id, connectionPointId: p.connectionPointId, minPowerW: p === participant ? targetW : p.transitionMinW, maxPowerW: p === participant ? targetW : p.transitionMaxW })) });
            const helps = confirmedCandidate.valid && confirmedCandidate.points.some((point) => {
                const before = baseline.points.find((p) => p.id === point.id);
                return point.importViolationW < before.importViolationW || point.exportViolationW < before.exportViolationW;
            });
            if (!helps) {
                participant.blockedReason = 'no-monotone-recovery';
                continue;
            }
        }
        participant.targetW = targetW;
        participant.transitionMinW = Math.min(participant.reservedMinW, targetW);
        participant.transitionMaxW = Math.max(participant.reservedMaxW, targetW);
        participant.limited = targetW !== participant.requestedW;
        commands.push({ id: participant.id, connectionPointId: participant.connectionPointId, authority: 'eos', targetW, minPowerW: targetW, maxPowerW: targetW, recovery });
    }
    // Erst nach allen reservierten EOS-Übergängen entstehen unabhängige Maxima.
    // Eine geplante, aber noch nicht gemessene Entlastung ist damit kein Guthaben.
    if (baseline.safe)
        for (const p of external.slice().sort((a, b) => (finite(a.priority) ? a.priority : 0) - (finite(b.priority) ? b.priority : 0) || a.id.localeCompare(b.id))) {
            let low = p.minPowerW, high = p.maxPowerW;
            for (const point of input.points) {
                if (!affectsPoint(p.connectionPointId, point.id))
                    continue;
                const residual = input.residuals[point.id];
                const others = participants.filter(other => other !== p && affectsPoint(other.connectionPointId, point.id));
                if (point.importLimitW !== null)
                    low = Math.max(low, residual.maxW - point.importLimitW - sum(others, 'transitionMinW'));
                if (point.exportLimitW !== null)
                    high = Math.min(high, residual.minW + point.exportLimitW - sum(others, 'transitionMaxW'));
            }
            if (low > 0 || high < 0 || low > high) {
                p.blockedReason = 'mandatory-support-not-a-maximum';
                continue;
            }
            const minPowerW = Math.max(p.desiredMinW, low), maxPowerW = Math.min(p.desiredMaxW, high);
            p.grantMinW = minPowerW;
            p.grantMaxW = maxPowerW;
            p.transitionMinW = Math.min(p.reservedMinW, minPowerW);
            p.transitionMaxW = Math.max(p.reservedMaxW, maxPowerW);
            p.limited = minPowerW !== p.desiredMinW || maxPowerW !== p.desiredMaxW;
            commands.push({ id: p.id, connectionPointId: p.connectionPointId, authority: 'external', minPowerW, maxPowerW, maxChargeW: Math.max(0, -minPowerW), maxDischargeW: Math.max(0, maxPowerW), recovery: false });
        }
    else {
        // Ein anfänglich voll reservierter externer Regler darf eine strengere
        // Maximalgrenze erhalten. Die alte Grenze bleibt bis zur bestätigten
        // Anwendung reserviert; ein ACK allein erzeugt keinerlei neues Budget.
        const contractions = external.filter(p => p.reservedMinW <= 0 && p.reservedMaxW >= 0).map(p => ({ p,
            minW: Math.max(p.reservedMinW, p.minPowerW, p.desiredMinW),
            maxW: Math.min(p.reservedMaxW, p.maxPowerW, p.desiredMaxW),
        })).filter(row => row.minW <= 0 && row.maxW >= 0);
        for (const point of input.points) {
            const contained = contractions.filter(row => affectsPoint(row.p.connectionPointId, point.id));
            const controlled = eos.filter(p => affectsPoint(p.connectionPointId, point.id));
            const residual = input.residuals[point.id];
            const charge = contained.reduce((total, row) => total - row.minW, 0);
            const discharge = contained.reduce((total, row) => total + row.maxW, 0);
            const allowedCharge = point.importLimitW === null ? charge : Math.max(0, point.importLimitW - residual.maxW + sum(controlled, 'transitionMinW'));
            const allowedDischarge = point.exportLimitW === null ? discharge : Math.max(0, point.exportLimitW + residual.minW - sum(controlled, 'transitionMaxW'));
            if (charge > allowedCharge && charge > 0)
                for (const row of contained)
                    row.minW *= allowedCharge / charge;
            if (discharge > allowedDischarge && discharge > 0)
                for (const row of contained)
                    row.maxW *= allowedDischarge / discharge;
        }
        for (const row of contractions) {
            const p = row.p;
            if (row.minW === p.reservedMinW && row.maxW === p.reservedMaxW)
                continue;
            p.grantMinW = row.minW;
            p.grantMaxW = row.maxW;
            p.limited = true;
            commands.push({ id: p.id, connectionPointId: p.connectionPointId, authority: 'external', minPowerW: row.minW, maxPowerW: row.maxW, maxChargeW: Math.max(0, -row.minW), maxDischargeW: Math.max(0, row.maxW), recovery: true });
        }
    }
    const transition = evaluateIntervals({ ...input, participants: asIntervals(participants) });
    const nonWorsening = transition.valid && transition.points.every((point) => {
        const before = baseline.points.find((p) => p.id === point.id);
        return point.importViolationW <= before.importViolationW + 1e-7 && point.exportViolationW <= before.exportViolationW + 1e-7;
    });
    if (!nonWorsening || (baseline.safe && !transition.safe))
        return { ...invalid('transition-proof-failed'), points: plannedEndpoint.points, transitionPoints: transition.points };
    const recoveryAllowed = !baseline.safe && commands.some(c => c.recovery);
    return {
        valid: true, safe: baseline.safe && transition.safe, status: recoveryAllowed ? (endpointFeasible ? 'recovering' : 'recovery_capacity_insufficient') : baseline.safe ? 'planned' : 'blocked',
        reason: recoveryAllowed ? (endpointFeasible ? 'mandatory-support-recovery' : 'reservation-recovery-or-insufficient-capability') : baseline.safe ? 'transition-envelope-safe' : 'no-nonworsening-recovery',
        commands, participants: participants.map(p => ({ ...p, minPowerW: p.transitionMinW, maxPowerW: p.transitionMaxW, capabilityMinW: p.minPowerW, capabilityMaxW: p.maxPowerW })),
        points: plannedEndpoint.points, transitionPoints: transition.points, baselinePoints: baseline.points,
        recoveryAllowed, endpointFeasible, requiresConfirmation: commands.some(c => c.authority === 'external' || c.targetW !== participants.find(p => p.id === c.id)?.actualW),
    };
}
module.exports = { operatingLimits, computeStorageCorridor, evaluateIntervals, allocateIndependentBudgets, computePvLimit, hybridStorageBounds, solveDynamicDispatch };
