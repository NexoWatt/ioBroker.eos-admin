/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Trennt Farm-Anforderung, Befehlsannahme und tatsächliche Messung.
 * Daten und Wirkung: Liest vorhandene Diagnose-Snapshots; keine Konfigurations-,
 * Freigabe- oder Geräteschreibzugriffe. Unbekannte Ursachen bleiben unbekannt.
 * Bei Änderungen: Zuordnungsschlüssel, veraltete JSON-Zeitstempel, Teilannahme,
 * Nullwerte und fehlende Statusdaten mit dem echten Renderer prüfen.
 */
(() => {
    type Row = Record<string, unknown>;
    const ageMs = 30000;
    const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
    const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const text = (value: unknown, max = 180): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
    function entry(snapshot: unknown, key: string): Row | null {
        if (!record(snapshot) || !Object.hasOwn(snapshot, key)) return null;
        const value: unknown = Reflect.get(snapshot, key); return record(value) ? value : null;
    }
    function fresh(ts: unknown, now: number): boolean {
        const value = number(ts); return value !== null && value > 0 && value <= now + 5000 && now - value <= ageMs;
    }
    function value(snapshot: unknown, key: string, connected: boolean, now: number): unknown {
        const row = entry(snapshot, key); return connected && row && fresh(row.ts, now) ? row.value : undefined;
    }
    function json(snapshot: unknown, key: string, connected: boolean, now: number): unknown {
        const raw = value(snapshot, key, connected, now);
        if (typeof raw !== 'string' || raw.length > 262144) return null;
        try { const result: unknown = JSON.parse(raw); return result; } catch { return null; }
    }
    function rows(snapshot: unknown, connected: boolean, now = Date.now()): Row[] {
        const data = json(snapshot, 'storageFarm.storagesStatusJson', connected, now);
        return Array.isArray(data) && data.length <= 128 ? data.filter(record) : [];
    }
    function dispatch(snapshot: unknown, connected: boolean, now: number): Row | null {
        const data = json(snapshot, 'storageFarm.lastDispatchJson', connected, now);
        return record(data) && fresh(data.ts, now) ? data : null;
    }
    function codes(value: unknown): string[] {
        return Array.isArray(value) ? value.slice(0, 20).map(item => text(item, 120)).filter(Boolean) : [];
    }
    const labels = new Map<string, string>([
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
    const reason = (code: string): string => labels.get(code) ?? code;
    function power(input: unknown): string {
        const n = number(input); if (n === null) return '—';
        const abs = Math.abs(n); return (abs >= 1000 ? (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' kW' : Math.round(n).toLocaleString('de-DE') + ' W');
    }
    function signed(input: unknown): string {
        const n = number(input); return n === null ? '—' : n > 0 ? 'Entladen ' + power(n) : n < 0 ? 'Laden ' + power(-n) : power(0);
    }
    function capability(input: unknown, direction: 'charge' | 'discharge'): string {
        if (!record(input)) return 'Nicht mitgeteilt';
        if (input.configured === false) return 'Nicht zugeordnet';
        if (input.configured !== true) return 'Zuordnung unbekannt';
        const status = text(input.status, 40), allowed = number(input.valueW);
        if (status === 'valid' && allowed !== null && allowed >= 0) return power(allowed) + (allowed === 0 ? ' · ' + reason(direction + '_capability_zero') : ' · aktuelle Gerätefreigabe');
        if (['missing', 'invalid', 'stale'].includes(status)) return reason(direction + '_capability_' + status);
        return 'Gerätefreigabe nicht bestätigt';
    }
    function set(id: string, content: string): void { const el = document.getElementById(id); if (el) el.textContent = content; }
    function status(row: unknown): string {
        if (!record(row)) return 'Status unbekannt';
        if (row.licenseBlocked === true) return 'Gesperrt: Lizenzgrenze';
        const discharge = codes(row.dischargeBlockedReasons), charge = codes(row.chargeBlockedReasons), common = codes(row.dispatchBlockedReasons);
        if (common.length) return 'Gesperrt: ' + common.map(reason).join(' · ');
        if (discharge.length && charge.length) return 'Laden / Entladen eingeschränkt';
        if (discharge.length) return 'Entladen gesperrt: ' + discharge.map(reason).join(' · ');
        if (charge.length) return 'Laden gesperrt: ' + charge.map(reason).join(' · ');
        if (row.online === true) return 'Messung online · Regelauftrag siehe unten';
        if (row.online === false) return 'Messung nicht aktuell';
        return 'Messstatus unbekannt';
    }
    function match(row: Row, members: Row[], results: Row[]): Row | null {
        const key = text(row.dispatchKey, 512);
        if (key) {
            if (members.filter(member => text(member.dispatchKey, 512) === key).length !== 1) return null;
            const same = results.filter(result => text(result.dispatchKey, 512) === key);
            if (same.length === 1) return same.at(0) ?? null;
            if (same.length > 1 || results.some(result => text(result.dispatchKey, 512))) return null;
        }
        const name = text(row.name);
        if (!name || members.filter(member => text(member.name) === name).length !== 1) return null;
        const same = results.filter(result => text(result.name) === name && !text(result.dispatchKey, 512));
        return same.length === 1 ? same.at(0) ?? null : null;
    }
    function line(parent: HTMLElement, label: string, content: string): void {
        const item = document.createElement('div'), title = document.createElement('dt'), body = document.createElement('dd');
        title.textContent = label; body.textContent = content || 'Unbekannt'; item.append(title, body); parent.append(item);
    }
    function memberDiagnostics(snapshot: unknown, connected: boolean, now: number, diag: Row | null): void {
        const container = document.getElementById('sf_dispatch_members'); if (!container) return;
        const expanded = new Set(Array.from(container.children).filter(item => item.hasAttribute('open')).map(item => item.getAttribute('data-member-key')));
        container.replaceChildren();
        const members = rows(snapshot, connected, now);
        const results = diag && Array.isArray(diag.results) && diag.results.length <= 128 ? diag.results.filter(record) : [];
        for (const row of members) {
            const detail = document.createElement('details'), heading = document.createElement('summary'), list = document.createElement('dl');
            const memberKey = text(row.dispatchKey, 512) || 'name:' + text(row.name);
            detail.setAttribute('data-member-key', memberKey);
            if (expanded.has(memberKey)) detail.setAttribute('open', '');
            detail.className = 'nw-farm-dispatch-member'; heading.textContent = text(row.name) || 'Speicher';
            list.className = 'nw-farm-dispatch-details'; detail.append(heading, list);
            const result = match(row, members, results);
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
                const readbacks: string[] = [];
                if (result.authorityBlocked === true) messages.push('Schreibzuständigkeit blockiert');
                if (result.directionSupported === false) messages.push('Richtung nicht unterstützt');
                if (result.commandAccepted === false) messages.push('Befehl nicht angenommen');
                if (result.ok === false) messages.push('Schreibauftrag fehlgeschlagen');
                if (record(result.writes)) for (const [kind, wr] of Object.entries(result.writes).slice(0, 12)) {
                    if (!record(wr)) continue;
                    const why = text(wr.reason); if (why) messages.push(reason(why));
                    const feedback = record(wr.readback) ? wr.readback : null;
                    const label = text(kind, 60) + ': ';
                    if (feedback && (feedback.ack === false || feedback.pending === true || feedback.status === 'pending-ack')) {
                        readbacks.push(label + 'Nur Sollwert im ioBroker-DP; Treiberquittierung ausstehend');
                    } else if (feedback?.ack === true && fresh(feedback.ts, now) && feedback.ok === true && wr.readbackOk === true) {
                        readbacks.push(label + 'Vom Treiber quittiert; physische Umsetzung nicht bestätigt');
                    } else if (feedback?.ack === true && !fresh(feedback.ts, now)) {
                        readbacks.push(label + 'Rücklesewert veraltet; aktuelle Quittierung unbestätigt');
                    } else if (wr.readbackSupported === true && wr.readbackOk === false) {
                        readbacks.push(label + 'Sollwert-Rücklesung nicht bestätigt');
                    } else {
                        readbacks.push(label + 'Quittierungsstatus nicht mitgeteilt');
                    }
                }
                line(list, 'DP-Rückmeldung', readbacks.length ? readbacks.join(' · ') : 'Keine aktuelle Quittierungsdiagnose; Gerätewirkung nur aus unabhängiger Messung ableiten');
                line(list, 'Schreibdiagnose', messages.length ? [...new Set(messages)].join(' · ') : 'Keine Fehlermeldung im letzten Schreibauftrag; reale Leistung separat prüfen');
                line(list, 'Statuszuordnung', reason(text(result.statusMatch)) || 'Nicht mitgeteilt');
            }
            container.append(detail);
        }
        if (!members.length) { const note = document.createElement('p'); note.textContent = 'Keine aktuellen Einzelspeicher-Diagnosen.'; container.append(note); }
    }
    function render(snapshot: unknown, connected: boolean, now = Date.now()): void {
        const diag = dispatch(snapshot, connected, now);
        const read = (key: string): unknown => value(snapshot, key, connected, now);
        const emsTarget = number(read('speicher.regelung.sollW'));
        const requested = diag ? number(diag.requestedW) : emsTarget;
        const accepted = diag ? number(diag.acceptedDeliveredW) : null;
        const overview = json(snapshot, 'storageFarm.overviewJson', connected, now);
        const battery = record(overview) && overview.v === 1 && fresh(overview.updatedAt, now) && record(overview.battery) ? overview.battery : null;
        const members = record(overview) && record(overview.members) ? number(overview.members.total) : null;
        const measured = battery && members !== null && Number.isInteger(members) && members > 0 && members <= 128 && battery.complete === true && battery.total === members && battery.valid === members ? number(battery.netW) : null;
        set('sf_dispatch_requested', signed(requested)); set('sf_dispatch_accepted', signed(accepted)); set('sf_dispatch_measured', signed(measured));
        set('sf_dispatch_requested_detail', diag ? 'Anforderung der letzten aktuellen Farm-Verteilung' : emsTarget !== null ? 'Aktuelles EMS-Soll; keine aktuelle Farm-Verteilung vorhanden' : 'Kein aktueller Anforderungswert');
        set('sf_dispatch_accepted_detail', 'An ioBroker-Schreibpfad übergeben; keine Treiber-, Geräte- oder Leistungsbestätigung');
        set('sf_dispatch_measured_detail', measured === null ? 'Keine vollständige aktuelle Batteriemessung' : 'Unabhängige aktuelle Batteriemessung der gesamten Farm');
        let summary = !connected ? 'Verbindung unterbrochen' : !diag ? 'Keine aktuelle Farm-Verteilung; Ursache nicht aus Messwerten ableitbar' : 'Aktuelle Farm-Verteilung vorhanden';
        if (diag) {
            const state = text(diag.status), why = text(diag.reason);
            if (emsTarget !== null && requested !== null && Math.abs(emsTarget - requested) > 1) summary = 'EMS-Ziel geändert; letzte Verteilung gehört zu einem anderen Sollwert';
            else if (requested === 0) summary = 'Aktuelle Nullvorgabe; keine Lade- oder Entladeleistung angefordert';
            else if (requested !== null && accepted === 0) summary = 'Leistung angefordert, aber kein Leistungsbefehl angenommen';
            else if (requested !== null && accepted !== null && Math.sign(requested) !== Math.sign(accepted)) summary = 'Richtung der Befehlsannahme weicht von der Anforderung ab';
            else if (requested !== null && accepted !== null && Math.abs(accepted) < Math.abs(requested)) summary = 'Leistungsanforderung nur teilweise angenommen';
            else if (accepted !== null && accepted !== 0) summary = 'Schreibauftrag übergeben; tatsächliche Leistung separat prüfen';
            if (state) summary += ' · ' + reason(state);
            if (why) summary += ' · ' + reason(why);
        }
        set('sf_dispatch_status', summary);
        const active = read('speicher.regelung.aktiv'), source = text(read('speicher.regelung.quelle')), why = text(read('speicher.regelung.grund'), 260);
        set('sf_dispatch_ems', 'Speicherregelung: ' + (active === true ? 'aktiv' : active === false ? 'deaktiviert' : 'Status unbekannt') + ' · EMS-Soll: ' + signed(emsTarget) + ' · Quelle: ' + (source || 'unbekannt') + ' · Grund: ' + (why || 'nicht mitgeteilt'));
        set('sf_dispatch_floor', diag && number(diag.dischargeFloorSocPct) !== null ? 'Mindest-SoC dieser Verteilung: ' + String(diag.dischargeFloorSocPct) + ' %' : 'Mindest-SoC der aktuellen Verteilung: nicht mitgeteilt');
        memberDiagnostics(snapshot, connected, now, diag);
    }
    const host = window as Window & { NWStorageFarmDispatch?: { render: typeof render; rows: typeof rows; status: typeof status } };
    host.NWStorageFarmDispatch = Object.freeze({ render, rows, status });
})();
