/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: ems/services/nvp-grants.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * ems/services/nvp-grants.js
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
 * Original-Hash: 1801f3872540cd12f4750c8967caecc1371212ca23eb68ed2c94accc688e00e4
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
 * Quelle: src-ts/runtime-executables/ems/services/nvp-grants.ts
 * Quell-Hash: sha256:5e73b91c3ef6ca9d73f7743e396e4088dd3db624b3f4cc72193160f98d79ea37
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/nvp-grants.js.
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
 * Aufgabe: Verwaltet Freigabeverträge, ihre Reihenfolge und konservative Reservierungen für externe Speicherregler.
 * Daten und Wirkung: Reiner Zustandsautomat; erzeugt Pakete und exportierbare Zustände, schreibt weder ioBroker-States noch Hardware. Diagnosepakete sind ausdrücklich nicht ausführbar.
 * Bei Änderungen: Empfang, angewandte Grenzen und Istwirkung getrennt halten. Zeitablauf allein löscht niemals eine im Fremdgerät möglicherweise noch geltende Freigabe.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/nvp-grants.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
const { randomUUID } = require('crypto');
/**
 * Code-Teil: finite
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
/**
 * Code-Teil: interval
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const interval = (min, max) => finite(min) && finite(max) && min <= max;
/**
 * Code-Teil: inside
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const inside = (min, max, outerMin, outerMax) => min >= outerMin && max <= outerMax;
/**
 * Code-Teil: validId
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(id);
/**
 * Der Automat ist als Vorbereitung für bestätigte Geräteprofile ausgelegt.
 * simulation=true ist der Standard. Ein neuer Prozess beginnt mit einer neuen
 * Sitzung und konservativen Gerätebounds; ein gespeicherter Empfangsstatus
 * stellt keine neue Synchronisierung her.
 */
class NvpGrantLedger {
    constructor(options = {}) {
        if (options.configVersion !== undefined && (!Number.isSafeInteger(options.configVersion) || options.configVersion < 1))
            throw new Error('NVP_INVALID_CONFIG_VERSION');
        this.sessionId = typeof options.sessionId === 'string' && options.sessionId.length > 0 && options.sessionId.length <= 128 ? options.sessionId : randomUUID();
        this.configVersion = options.configVersion || 1;
        this.simulation = options.simulation !== false;
        this.maxTtlMs = finite(options.maxTtlMs) && options.maxTtlMs > 0 && options.maxTtlMs <= 60000 ? options.maxTtlMs : 5000;
        this.maxEvidenceAgeMs = finite(options.maxEvidenceAgeMs) && options.maxEvidenceAgeMs > 0 && options.maxEvidenceAgeMs <= 60000 ? options.maxEvidenceAgeMs : 5000;
        this.profiles = new Set(Array.isArray(options.supportedProfileIds) ? options.supportedProfileIds : []);
        this.entries = new Map();
        if (options.participants !== undefined && (!Array.isArray(options.participants) || options.participants.length > 32))
            throw new Error('NVP_INVALID_PARTICIPANTS');
        for (const participant of options.participants || [])
            this.registerParticipant(participant);
    }
    /** Registriert Gerätefähigkeiten als volle Anfangsunsicherheit bis zur bestätigten neuen Sitzung. */
    registerParticipant(participant) {
        if (!participant || !validId(participant.id) || this.entries.has(participant.id) || this.entries.size >= 32 || !['M0', 'M1'].includes(participant.connectionPointId) || !interval(participant.minPowerW, participant.maxPowerW))
            throw new Error('NVP_INVALID_PARTICIPANT');
        this.entries.set(participant.id, {
            id: participant.id, connectionPointId: participant.connectionPointId, profileId: participant.profileId || '',
            deviceMinW: participant.minPowerW, deviceMaxW: participant.maxPowerW,
            appliedMinW: participant.minPowerW, appliedMaxW: participant.maxPowerW,
            synchronized: false, sequence: 0, receivedSequence: 0, appliedSequence: 0,
            pending: null, lastMeasurementW: null, lastEvidenceTs: null, lastEvidenceNow: null,
        });
    }
    /** Prüft zeitlich begrenzte, echte Rückmeldungen; ACK oder ein Zahlenstring genügen nicht. */
    evidenceValid(entry, evidence, now) {
        return !!evidence && finite(now) && finite(evidence.ts) && evidence.ts > 0 && evidence.ts <= now && now - evidence.ts <= this.maxEvidenceAgeMs &&
            evidence.sessionId === this.sessionId && evidence.configVersion === this.configVersion &&
            interval(evidence.appliedMinW, evidence.appliedMaxW) && inside(evidence.appliedMinW, evidence.appliedMaxW, entry.deviceMinW, entry.deviceMaxW) &&
            finite(evidence.powerW) && evidence.powerW >= evidence.appliedMinW && evidence.powerW <= evidence.appliedMaxW &&
            (!finite(entry.lastEvidenceTs) || evidence.ts >= entry.lastEvidenceTs) &&
            (!finite(entry.lastEvidenceNow) || now >= entry.lastEvidenceNow) && evidence.quality === 'confirmed';
    }
    /**
     * Der Profiladapter bestätigt den Zustand nach Start/Neustart ausdrücklich in
     * der neuen Sitzung. Alte persistierte Pakete werden nicht wiederverwendet.
     * Diagnose kann denselben Ablauf simulieren, ohne einen Writer zu erzeugen.
     */
    synchronize(id, evidence, now = Date.now()) {
        const entry = this.entries.get(id);
        if (!entry || entry.pending || !this.evidenceValid(entry, evidence, now))
            return false;
        if (!this.simulation && !this.profiles.has(entry.profileId))
            return false;
        entry.synchronized = true;
        entry.appliedMinW = evidence.appliedMinW;
        entry.appliedMaxW = evidence.appliedMaxW;
        entry.lastMeasurementW = evidence.powerW;
        entry.lastEvidenceTs = evidence.ts;
        entry.lastEvidenceNow = now;
        return true;
    }
    /**
     * Erzeugt genau ein Paket pro Teilnehmer. Ein noch ungeklärtes Paket darf nicht
     * durch weitere unbestätigte Pakete überholt werden. Seine mögliche Wirkung
     * bleibt zusammen mit dem zuvor angewandten Vertrag reserviert.
     */
    issue(input) {
        const entry = input && this.entries.get(input.id);
        const now = input && input.now;
        if (!entry || !entry.synchronized)
            return { valid: false, reason: 'not-synchronized' };
        if (entry.pending)
            return { valid: false, reason: 'pending-application' };
        if (!this.simulation && !this.profiles.has(entry.profileId))
            return { valid: false, reason: 'unverified-profile' };
        if (!finite(now) || !finite(input.validForMs) || input.validForMs <= 0 || input.validForMs > this.maxTtlMs || !interval(input.minPowerW, input.maxPowerW) || !inside(input.minPowerW, input.maxPowerW, entry.deviceMinW, entry.deviceMaxW))
            return { valid: false, reason: 'invalid-grant' };
        if (now < entry.lastEvidenceNow || now - entry.lastEvidenceTs > this.maxEvidenceAgeMs)
            return { valid: false, reason: 'stale-evidence' };
        if (entry.sequence >= Number.MAX_SAFE_INTEGER)
            return { valid: false, reason: 'sequence-exhausted' };
        const packet = Object.freeze({
            schemaVersion: 1, configVersion: this.configVersion, sessionId: this.sessionId,
            participantId: entry.id, connectionPointId: entry.connectionPointId,
            sequence: ++entry.sequence, minPowerW: input.minPowerW, maxPowerW: input.maxPowerW,
            issuedAt: now, validForMs: input.validForMs, expiresAt: now + input.validForMs,
            simulation: this.simulation, executable: !this.simulation,
        });
        entry.pending = packet;
        return { valid: true, packet };
    }
    /** Empfang bestätigt keine Anwendung: die reservierte Spanne wird nicht verengt. */
    received(packet) {
        const entry = this.matchPending(packet);
        if (!entry || entry.receivedSequence >= packet.sequence)
            return false;
        entry.receivedSequence = packet.sequence;
        return true;
    }
    matchPending(packet) {
        if (!packet || packet.sessionId !== this.sessionId || packet.configVersion !== this.configVersion || !Number.isSafeInteger(packet.sequence))
            return null;
        const entry = this.entries.get(packet.participantId);
        return entry && entry.pending && entry.pending.sequence === packet.sequence ? entry : null;
    }
    /**
     * Erst ein bestätigter angewandter Vertrag UND passende frische Istleistung
     * lösen die alte Reservierung ab. Die Istleistung allein beweist keine später
     * garantierte Senke; reserviert bleibt das ganze angewandte Intervall.
     */
    applied(packet, evidence, now = Date.now()) {
        const entry = this.matchPending(packet);
        if (!entry || !this.evidenceValid(entry, evidence, now) || now > entry.pending.expiresAt || evidence.ts < entry.pending.issuedAt || evidence.sequence !== packet.sequence)
            return false;
        if (!inside(evidence.appliedMinW, evidence.appliedMaxW, entry.pending.minPowerW, entry.pending.maxPowerW))
            return false;
        entry.appliedMinW = evidence.appliedMinW;
        entry.appliedMaxW = evidence.appliedMaxW;
        entry.appliedSequence = packet.sequence;
        entry.lastMeasurementW = evidence.powerW;
        entry.lastEvidenceTs = evidence.ts;
        entry.lastEvidenceNow = now;
        entry.pending = null;
        return true;
    }
    /**
     * Ablauf wird ausschließlich durch eine bestätigte lokale Rückfallrückmeldung
     * wirksam. Ein EOS-Timer allein darf alte Leistungsrechte nicht freigeben.
     */
    confirmFallback(id, evidence, now = Date.now()) {
        const entry = this.entries.get(id);
        if (!entry || !evidence || evidence.localFallbackConfirmed !== true || !this.evidenceValid(entry, evidence, now))
            return false;
        if (!this.simulation && !this.profiles.has(entry.profileId))
            return false;
        if (entry.pending && (evidence.sequence !== entry.pending.sequence || evidence.ts < entry.pending.issuedAt))
            return false;
        entry.appliedMinW = evidence.appliedMinW;
        entry.appliedMaxW = evidence.appliedMaxW;
        entry.lastMeasurementW = evidence.powerW;
        entry.lastEvidenceTs = evidence.ts;
        entry.lastEvidenceNow = now;
        entry.pending = null;
        entry.synchronized = true;
        return true;
    }
    /** Gibt Worst-Case-Intervalle zurück, auch wenn ein Paket inzwischen zeitlich abgelaufen ist. */
    reservedIntervals(now = Date.now()) {
        return [...this.entries.values()].map(entry => ({
            id: entry.id, connectionPointId: entry.connectionPointId,
            minPowerW: entry.pending ? Math.min(entry.appliedMinW, entry.pending.minPowerW) : entry.appliedMinW,
            maxPowerW: entry.pending ? Math.max(entry.appliedMaxW, entry.pending.maxPowerW) : entry.appliedMaxW,
            synchronized: entry.synchronized,
            received: !!entry.pending && entry.receivedSequence === entry.pending.sequence,
            appliedSequence: entry.appliedSequence,
            pendingSequence: entry.pending ? entry.pending.sequence : null,
            expiredUnconfirmed: !!entry.pending && finite(now) && now > entry.pending.expiresAt,
            powerW: entry.lastMeasurementW, evidenceTs: entry.lastEvidenceTs,
        }));
    }
    /** Ein Modus-/Lizenzwechsel benötigt Ablösung; ungeklärte oder nicht neutrale Verträge bleiben bindend. */
    canReleaseOwnership() {
        return [...this.entries.values()].every(entry => entry.synchronized && !entry.pending && entry.appliedMinW === 0 && entry.appliedMaxW === 0);
    }
    /** Export dient nur dem Nachweis. Neue Instanzen starten weiterhin mit Gerätebounds, nicht alten ACKs. */
    snapshot(now = Date.now()) {
        return { schemaVersion: 1, sessionId: this.sessionId, configVersion: this.configVersion, simulation: this.simulation, participants: this.reservedIntervals(now), canReleaseOwnership: this.canReleaseOwnership() };
    }
}
module.exports = { NvpGrantLedger };
