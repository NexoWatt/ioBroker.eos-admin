/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: www/storagefarm-dispatch.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * www/storagefarm-dispatch.js
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
 * Original-Hash: 8a0b1ea6a8bcaf9dda940de28ab475f50267abb3163c1aa690402f714f0efc9f
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
 * Quelle: src-ts/runtime-executables/www/storagefarm-dispatch.ts
 * Quell-Hash: sha256:f54b8d56d29ca18d2df3759a765e70f61c0e9f6ad60ea2a047e8419e851b55bc
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/storagefarm-dispatch.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Trennt Farm-Anforderung, Befehlsannahme und tatsächliche Messung.
 * Daten und Wirkung: Liest vorhandene Diagnose-Snapshots; keine Konfigurations-,
 * Freigabe- oder Geräteschreibzugriffe. Unbekannte Ursachen bleiben unbekannt.
 * Bei Änderungen: Zuordnungsschlüssel, veraltete JSON-Zeitstempel, Teilannahme,
 * Nullwerte und fehlende Statusdaten mit dem echten Renderer prüfen.
 */
(() => {
    const ageMs = 30000;
/**
 * Code-Teil: record
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
/**
 * Code-Teil: number
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
/**
 * Code-Teil: text
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const text = (value, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : '';
/**
 * Code-Teil: entry
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function entry(snapshot, key) {
        if (!record(snapshot) || !Object.hasOwn(snapshot, key))
            return null;
        const value = Reflect.get(snapshot, key);
        return record(value) ? value : null;
    }
/**
 * Code-Teil: fresh
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function fresh(ts, now) {
        const value = number(ts);
        return value !== null && value > 0 && value <= now + 5000 && now - value <= ageMs;
    }
/**
 * Code-Teil: value
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function value(snapshot, key, connected, now) {
        const row = entry(snapshot, key);
        return connected && row && row.ack !== false && (row.q === undefined || row.q === 0) && fresh(row.ts, now) ? row.value : undefined;
    }
/**
 * Code-Teil: json
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function json(snapshot, key, connected, now) {
        const raw = value(snapshot, key, connected, now);
        if (typeof raw !== 'string' || raw.length > 262144)
            return null;
        try {
            const result = JSON.parse(raw);
            return result;
        }
        catch {
            return null;
        }
    }
/**
 * Code-Teil: rows
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function rows(snapshot, connected, now = Date.now()) {
        const data = json(snapshot, 'storageFarm.storagesStatusJson', connected, now);
        return Array.isArray(data) && data.length <= 128 ? data.filter(record) : [];
    }
/**
 * Code-Teil: dispatch
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function dispatch(snapshot, connected, now) {
        const data = json(snapshot, 'storageFarm.lastDispatchJson', connected, now);
        return record(data) && fresh(data.ts, now) ? data : null;
    }
/**
 * Code-Teil: codes
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function codes(value) {
        return Array.isArray(value) ? value.slice(0, 20).map(item => text(item, 120)).filter(Boolean) : [];
    }
    const labels = new Map([
        ['available_false', 'Gerät nicht freigegeben'], ['fault_active', 'Gerätestörung'],
        ['device_offline', 'Gerät offline'], ['license_storage_limit', 'Lizenzgrenze'],
        ['charge_not_allowed', 'Laden nicht freigegeben'], ['discharge_not_allowed', 'Entladen nicht freigegeben'],
        ['charge_setpoint_missing', 'Lade-Sollwert fehlt'], ['discharge_setpoint_missing', 'Entlade-Sollwert fehlt'],
        ['charge_limit_zero', 'Ladelimit 0 W'], ['discharge_limit_zero', 'Entladelimit 0 W'],
        ['charge_capability_zero', 'Gerät sperrt Laden'], ['discharge_capability_zero', 'Gerät sperrt Entladen'],
        ['charge_capability_missing', 'Ladefreigabe des Geräts fehlt'], ['discharge_capability_missing', 'Entladefreigabe des Geräts fehlt'],
        ['charge_capability_invalid', 'Ladefreigabe des Geräts ungültig'], ['discharge_capability_invalid', 'Entladefreigabe des Geräts ungültig'],
        ['charge_capability_stale', 'Ladefreigabe des Geräts veraltet'], ['discharge_capability_stale', 'Entladefreigabe des Geräts veraltet'],
        ['soc_below_discharge_floor', 'Mindest-SoC erreicht'], ['soc_at_or_below_discharge_floor', 'Mindest-SoC erreicht'],
        ['soc_missing', 'SoC für diese Verteilung fehlt'],
        ['farm-limited', 'Verteilung begrenzt'], ['farm-write-failed', 'Schreibauftrag fehlgeschlagen'],
        ['farm-partial', 'Schreibauftrag teilweise angenommen'], ['farm-stop', 'Nullvorgabe angenommen'],
        ['farm-stop-failed', 'Nullvorgabe nicht vollständig angenommen'], ['fenecon-handover-wait', 'Übergabe wartet auf Watchdog'],
        ['direct-ess-watchdog-active', 'Direkter ESS-Watchdog noch aktiv'], ['fenecon-farm-config-invalid', 'Farmkonfiguration ungültig'],
        ['missing', 'Zuordnung fehlt'], ['command-dp-mismatch', 'Sollwert-Rücklesung weicht ab'],
        ['pending-ack', 'Treiberquittierung ausstehend'], ['driver-acknowledged', 'Vom Treiber quittiert, Gerätewirkung separat prüfen'],
    ]);
/**
 * Code-Teil: reason
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const reason = (code) => labels.get(code) ?? code;
/**
 * Code-Teil: power
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function power(input) {
        const n = number(input);
        if (n === null)
            return '—';
        const abs = Math.abs(n);
        return (abs >= 1000 ? (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' kW' : Math.round(n).toLocaleString('de-DE') + ' W');
    }
/**
 * Code-Teil: signed
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function signed(input, converter = false) {
        const n = number(input);
        if (n === null)
            return '—';
        if (n === 0)
            return power(0);
        const direction = converter ? (n > 0 ? 'AC-Abgabe' : 'AC-Aufnahme') : (n > 0 ? 'Entladen' : 'Laden');
        return direction + ' ' + power(Math.abs(n));
    }
/**
 * Code-Teil: capability
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function capability(input, direction) {
        if (!record(input))
            return 'Nicht mitgeteilt';
        if (input.configured === false)
            return 'Nicht zugeordnet';
        if (input.configured !== true)
            return 'Zuordnung unbekannt';
        const status = text(input.status, 40), allowed = number(input.valueW);
        if (status === 'valid' && allowed !== null && allowed >= 0)
            return power(allowed) + (allowed === 0 ? ' · ' + reason(direction + '_capability_zero') : ' · aktuelle Gerätefreigabe');
        if (['missing', 'invalid', 'stale'].includes(status))
            return reason(direction + '_capability_' + status);
        return 'Gerätefreigabe nicht bestätigt';
    }
/**
 * Code-Teil: set
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function set(id, content) { const el = document.getElementById(id); if (el)
        el.textContent = content; }
/**
 * Code-Teil: status
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function status(row) {
        if (!record(row))
            return 'Status unbekannt';
        if (row.licenseBlocked === true)
            return 'Gesperrt: Lizenzgrenze';
        const discharge = codes(row.dischargeBlockedReasons), charge = codes(row.chargeBlockedReasons), common = codes(row.dispatchBlockedReasons);
        if (common.length)
            return 'Gesperrt: ' + common.map(reason).join(' · ');
        if (discharge.length && charge.length)
            return 'Laden / Entladen eingeschränkt';
        if (discharge.length)
            return 'Entladen gesperrt: ' + discharge.map(reason).join(' · ');
        if (charge.length)
            return 'Laden gesperrt: ' + charge.map(reason).join(' · ');
        if (row.online === true)
            return 'Messung online · Regelauftrag siehe unten';
        if (row.online === false)
            return 'Messung nicht aktuell';
        return 'Messstatus unbekannt';
    }
/**
 * Code-Teil: match
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function match(row, members, results) {
        const key = text(row.dispatchKey, 512);
        if (key) {
            if (members.filter(member => text(member.dispatchKey, 512) === key).length !== 1)
                return null;
            const same = results.filter(result => text(result.dispatchKey, 512) === key);
            if (same.length === 1)
                return same.at(0) ?? null;
            if (same.length > 1 || results.some(result => text(result.dispatchKey, 512)))
                return null;
        }
        const name = text(row.name);
        if (!name || members.filter(member => text(member.name) === name).length !== 1)
            return null;
        const same = results.filter(result => text(result.name) === name && !text(result.dispatchKey, 512));
        return same.length === 1 ? same.at(0) ?? null : null;
    }
/**
 * Code-Teil: line
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function line(parent, label, content) {
        const item = document.createElement('div'), title = document.createElement('dt'), body = document.createElement('dd');
        title.textContent = label;
        body.textContent = content || 'Unbekannt';
        item.append(title, body);
        parent.append(item);
    }
/**
 * Code-Teil: memberDiagnostics
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function memberDiagnostics(snapshot, connected, now, diag) {
        const container = document.getElementById('sf_dispatch_members');
        if (!container)
            return;
        const expanded = new Set(Array.from(container.children).filter(item => item.hasAttribute('open')).map(item => item.getAttribute('data-member-key')));
        container.replaceChildren();
        const members = rows(snapshot, connected, now);
        const results = diag && Array.isArray(diag.results) && diag.results.length <= 128 ? diag.results.filter(record) : [];
        const display = window.NexoWattLiveDisplay;
        const warnings = [];
        for (const row of members) {
            const detail = document.createElement('details'), heading = document.createElement('summary'), list = document.createElement('dl');
            const memberKey = text(row.dispatchKey, 512) || 'name:' + text(row.name);
            detail.setAttribute('data-member-key', memberKey);
            if (expanded.has(memberKey))
                detail.setAttribute('open', '');
            detail.className = 'nw-farm-dispatch-member';
            heading.textContent = text(row.name) || 'Speicher';
            list.className = 'nw-farm-dispatch-details';
            detail.append(heading, list);
            const result = match(row, members, results);
            const comparison = row.dispatchKey && members.filter(other => other.dispatchKey === row.dispatchKey).length === 1
                ? display?.farmPowerComparison?.(row, now) : null;
            if (comparison) {
                const delta = number(comparison.differenceW);
                const difference = delta !== null ? delta.toLocaleString('de-DE', { maximumSignificantDigits: 12 }) + ' W' : '—';
                const converter = comparison.domain === 'ess-ac';
                const detailText = 'Soll ' + signed(comparison.targetW, converter) + ' · Ist ' + signed(comparison.measuredW, converter) + ' · Abweichung ' + difference;
                line(list, converter ? 'Soll-/Ist-Vergleich · ESS-Wechselrichter (AC)' : 'Soll-/Ist-Vergleich', detailText);
                if (comparison.warning === true) {
                    const name = text(row.name) || 'Speicher';
                    warnings.push(name + ' (' + difference + ')');
                    heading.textContent = name + ' · Leistungsabweichung';
                    detail.setAttribute('data-warning', 'true');
                }
            }
            else {
                line(list, 'Soll-/Ist-Vergleich', 'Kein zeitlich zuordenbares Wertepaar');
            }
            const blocked = [...codes(row.dispatchBlockedReasons), ...codes(row.dischargeBlockedReasons)];
            line(list, 'Entladehinweise', blocked.length ? [...new Set(blocked)].map(reason).join(' · ') : 'Keine Sperre gemeldet; keine Zusage einer Zuteilung');
            const hasConfiguredLimit = Object.hasOwn(row, 'configuredMaxDischargeW');
            const configuredLimit = hasConfiguredLimit ? row.configuredMaxDischargeW : row.maxDischargeW;
            line(list, 'Konfiguriertes Entladelimit', hasConfiguredLimit && configuredLimit === null ? 'Keine feste Grenze hinterlegt' : power(configuredLimit));
            line(list, 'Gerätefreigabe Entladen', capability(row.dischargeCapability, 'discharge'));
            line(list, 'Gerätefreigabe Laden', capability(row.chargeCapability, 'charge'));
            line(list, 'Zuteilung der letzten Verteilung', result ? 'Laden ' + power(result.chargeW) + ' · Entladen ' + power(result.dischargeW) : 'Keine eindeutige aktuelle Zuordnung');
            line(list, 'An Schreibpfad übergeben', result ? power(result.acceptedW) : '—');
            if (result) {
                line(list, 'Freigabe dieses Regelauftrags', result.directionDispatchAvailable === true ? 'Für diese Anforderung berücksichtigbar' : result.directionDispatchAvailable === false ? 'Für diese Anforderung ausgeschlossen' : 'Nicht mitgeteilt');
                line(list, 'Mindest-SoC dieses Entladeauftrags', number(result.dischargeFloorSocPct) !== null ? String(result.dischargeFloorSocPct) + ' %' : 'Nicht mitgeteilt');
                line(list, 'Effektives Limit dieses Entladeauftrags', number(result.effectiveMaxDischargeW) !== null ? power(result.effectiveMaxDischargeW) : 'Kein numerischer Grenzwert mitgeteilt');
                const messages = codes(result.blockedReasons).map(reason);
                const readbacks = [];
                if (result.authorityBlocked === true)
                    messages.push('Schreibzuständigkeit blockiert');
                if (result.directionSupported === false)
                    messages.push('Richtung nicht unterstützt');
                if (result.commandAccepted === false)
                    messages.push('Befehl nicht angenommen');
                if (result.ok === false)
                    messages.push('Schreibauftrag fehlgeschlagen');
                if (record(result.writes))
                    for (const [kind, wr] of Object.entries(result.writes).slice(0, 12)) {
                        if (!record(wr))
                            continue;
                        const why = text(wr.reason);
                        if (why)
                            messages.push(reason(why));
                        const feedback = record(wr.readback) ? wr.readback : null;
                        const label = text(kind, 60) + ': ';
                        if (feedback && (feedback.ack === false || feedback.pending === true || feedback.status === 'pending-ack')) {
                            readbacks.push(label + 'Nur Sollwert im ioBroker-DP; Treiberquittierung ausstehend');
                        }
                        else if (feedback?.ack === true && fresh(feedback.ts, now) && feedback.ok === true && wr.readbackOk === true) {
                            readbacks.push(label + 'Vom Treiber quittiert; physische Umsetzung nicht bestätigt');
                        }
                        else if (feedback?.ack === true && !fresh(feedback.ts, now)) {
                            readbacks.push(label + 'Rücklesewert veraltet; aktuelle Quittierung unbestätigt');
                        }
                        else if (wr.readbackSupported === true && wr.readbackOk === false) {
                            readbacks.push(label + 'Sollwert-Rücklesung nicht bestätigt');
                        }
                        else {
                            readbacks.push(label + 'Quittierungsstatus nicht mitgeteilt');
                        }
                    }
                line(list, 'DP-Rückmeldung', readbacks.length ? readbacks.join(' · ') : 'Keine aktuelle Quittierungsdiagnose; Gerätewirkung nur aus unabhängiger Messung ableiten');
                line(list, 'Schreibdiagnose', messages.length ? [...new Set(messages)].join(' · ') : 'Keine Fehlermeldung im letzten Schreibauftrag; reale Leistung separat prüfen');
                line(list, 'Statuszuordnung', reason(text(result.statusMatch)) || 'Nicht mitgeteilt');
            }
            container.append(detail);
        }
        const alert = document.getElementById('sf_dispatch_deviation');
        if (alert) {
            alert.hidden = !warnings.length;
            alert.textContent = warnings.length ? 'Leistungsabweichung: ' + warnings.join(' · ') : '';
        }
        if (!members.length) {
            const note = document.createElement('p');
            note.textContent = 'Keine aktuellen Einzelspeicher-Diagnosen.';
            container.append(note);
        }
    }
/**
 * Code-Teil: render
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    function render(snapshot, connected, now = Date.now()) {
        const diag = dispatch(snapshot, connected, now);
/**
 * Code-Teil: read
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
        const read = (key) => value(snapshot, key, connected, now);
        const enabledState = read('speicher.regelung.aktiv');
        const decision = json(snapshot, 'speicher.regelung.dispatcherJson', connected, now);
        // Die Entscheidung ist pro Reglerzyklus datiert. Aktiv/Quelle als Einzelwerte
        // werden dagegen nur bei Änderung geschrieben und können im Normalbetrieb alt sein.
        const activeTs = number(entry(snapshot, 'speicher.regelung.aktiv')?.ts);
        const decisionTs = record(decision) ? number(decision.ts) : null;
        const current = record(decision) && decisionTs !== null && fresh(decisionTs, now)
            && typeof decision.active === 'boolean' && !(decision.active && decision.disabled === true)
            && !(typeof enabledState === 'boolean' && enabledState !== decision.active && activeTs !== null && activeTs >= decisionTs)
            ? decision : null;
        const active = current ? current.active : enabledState;
        const emsTarget = active === false ? null : number(read('speicher.regelung.sollW'));
        const requested = diag ? number(diag.requestedW) : emsTarget;
        const accepted = diag ? number(diag.acceptedDeliveredW) : null;
        const overview = json(snapshot, 'storageFarm.overviewJson', connected, now);
        const battery = record(overview) && overview.v === 1 && fresh(overview.updatedAt, now) && record(overview.battery) ? overview.battery : null;
        const members = record(overview) && record(overview.members) ? number(overview.members.total) : null;
        const measured = battery && members !== null && Number.isInteger(members) && members > 0 && members <= 128 && battery.complete === true && battery.total === members && battery.valid === members ? number(battery.netW) : null;
        set('sf_dispatch_requested', signed(requested));
        set('sf_dispatch_accepted', signed(accepted));
        set('sf_dispatch_measured', signed(measured));
        set('sf_dispatch_requested_detail', diag ? 'Anforderung der letzten aktuellen Farm-Verteilung' : emsTarget !== null ? 'Aktuelles EMS-Soll; keine aktuelle Farm-Verteilung vorhanden' : 'Kein aktueller Anforderungswert');
        set('sf_dispatch_accepted_detail', 'An ioBroker-Schreibpfad übergeben; keine Treiber-, Geräte- oder Leistungsbestätigung');
        set('sf_dispatch_measured_detail', measured === null ? 'Keine vollständige aktuelle Batteriemessung' : 'Unabhängige aktuelle Batteriemessung der gesamten Farm');
        let summary = !connected ? 'Verbindung unterbrochen' : !diag ? 'Keine aktuelle Farm-Verteilung; Ursache nicht aus Messwerten ableitbar' : 'Aktuelle Farm-Verteilung vorhanden';
        if (diag) {
            const state = text(diag.status), why = text(diag.reason);
            if (emsTarget !== null && requested !== null && Math.abs(emsTarget - requested) > 1)
                summary = 'EMS-Ziel geändert; letzte Verteilung gehört zu einem anderen Sollwert';
            else if (requested === 0)
                summary = 'Aktuelle Nullvorgabe; keine Lade- oder Entladeleistung angefordert';
            else if (requested !== null && accepted === 0)
                summary = 'Leistung angefordert, aber kein Leistungsbefehl angenommen';
            else if (requested !== null && accepted !== null && Math.sign(requested) !== Math.sign(accepted))
                summary = 'Richtung der Befehlsannahme weicht von der Anforderung ab';
            else if (requested !== null && accepted !== null && Math.abs(accepted) < Math.abs(requested))
                summary = 'Leistungsanforderung nur teilweise angenommen';
            else if (accepted !== null && accepted !== 0)
                summary = 'Schreibauftrag übergeben';
            if (state)
                summary += ' · ' + reason(state);
            if (why)
                summary += ' · ' + reason(why);
            const dispatchSource = text(diag.source);
            if (dispatchSource && (!current || dispatchSource !== text(current.src)))
                summary += ' · Quelle des letzten Farmauftrags: ' + dispatchSource;
        }
        set('sf_dispatch_status', summary);
        const writeWarning = diag && (diag.writeOk === false || ['farm-write-failed', 'farm-partial', 'farm-stop-failed'].includes(text(diag.status))
            || (requested !== null && accepted !== null && (Math.abs(accepted) < Math.abs(requested) || Math.sign(requested) !== Math.sign(accepted))));
        document.getElementById('sf_dispatch_status')?.setAttribute('data-warning', writeWarning ? 'true' : 'false');
        const source = text(current ? current.src : read('speicher.regelung.quelle'));
        const why = text(current ? current.reason : read('speicher.regelung.grund'), 260);
        const target = current
            ? ' · Reglerziel vor Schreibprüfung: ' + signed(active === true ? current.finalW : null)
            : ' · EMS-Soll: ' + signed(emsTarget);
        set('sf_dispatch_ems', 'Speicherregelung: ' + (active === true ? 'aktiv' : active === false ? 'deaktiviert' : 'Status unbekannt') + target + ' · Quelle: ' + (source || 'unbekannt') + ' · Grund: ' + (why || 'nicht mitgeteilt'));
        set('sf_dispatch_floor', diag && number(diag.dischargeFloorSocPct) !== null ? 'Mindest-SoC dieser Verteilung: ' + String(diag.dischargeFloorSocPct) + ' %' : 'Mindest-SoC der aktuellen Verteilung: nicht mitgeteilt');
        memberDiagnostics(snapshot, connected, now, diag);
    }
    const host = window;
    host.NWStorageFarmDispatch = Object.freeze({ render, rows, status });
})();
