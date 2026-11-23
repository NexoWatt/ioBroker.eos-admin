/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-device-controls.ts
 * Quell-Hash: sha256:827865b7ebb9dd0d6208491cb5829939fcef55d3ce1d535555aedd9e965a3eac
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-device-controls.js.
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
 * Aufgabe: Stellt alle vom EOS-Server freigegebenen Gerätefunktionen lokal dar.
 * Daten und Wirkung: Prüft das Anzeige-DTO, sendet nur Geräteschlüssel und explizite
 * Bedienwerte über den bestehenden Auth-/CSRF-Pfad. Keine Datenpunkt-IDs aus dem Client.
 * Bei Änderungen: Unbekannte Werte, Nur-Lesen, Bestätigung, Zahlen-/Enum-Grenzen,
 * Touch-Abbruch und den Erhalt ungesendeter Eingaben bei Aktualisierungen prüfen.
 * Serverwerte bleiben Rückmeldungen; erfolgreiche Befehle werden nicht als physisch
 * bestätigt ausgegeben. Rendern, Fokussieren und das Öffnen von Details schreiben nie.
 */
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_DEVICE_CONTROLS)
        return;
    const rowSelector = '.nw-sh-device-controls';
    const remoteKeys = new Map([
        ['UP', { label: 'Nach oben', position: 'up' }], ['DOWN', { label: 'Nach unten', position: 'down' }],
        ['LEFT', { label: 'Nach links', position: 'left' }], ['RIGHT', { label: 'Nach rechts', position: 'right' }],
        ['OK', { label: 'OK', position: 'ok' }], ['ENTER', { label: 'OK', position: 'ok' }],
    ]);
    let confirmation = null;
    const volumeMemory = new Map();
    const historyPanels = new Map();
    const expandedSections = new Set();
    const mapImages = new Map();
    const volumeSteps = new Set(['VOLUME_UP', 'VOLUME_DOWN', 'VOL_UP', 'VOL_DOWN', 'VOLUMEUP', 'VOLUMEDOWN']);
    function record(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function text(value, fallback = '', limit = 256) {
        return typeof value === 'string' ? value.slice(0, limit) : fallback;
    }
    function scalar(value) {
        return typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
    }
    function finite(value) {
        return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    }
    function normalizeField(value) {
        if (!record(value) || typeof value.key !== 'string' || !value.key || value.key.length > 256)
            return null;
        if (value.type !== 'boolean' && value.type !== 'number' && value.type !== 'string' && value.type !== 'mixed')
            return null;
        const mixed = value.type === 'mixed';
        const type = value.type === 'boolean' || value.type === 'number' || value.type === 'string' ? value.type : typeof value.value === 'boolean' ? 'boolean' : typeof value.value === 'number' ? 'number' : 'string';
        const aliases = new Map([['indicator', 'value'], ['readout', 'value'], ['toggle', 'switch'], ['value', 'value'], ['switch', 'switch'], ['range', 'range'], ['number', 'number'], ['select', 'select'], ['text', 'text'], ['button', 'button']]);
        const kind = mixed ? 'value' : typeof value.kind === 'string' ? aliases.get(value.kind) : undefined;
        if (!kind)
            return null;
        const options = [];
        if (Array.isArray(value.options))
            for (const option of value.options.slice(0, 512)) {
                if (record(option) && scalar(option.value) && typeof option.value === type) {
                    if (value.key === 'KEY' && volumeSteps.has(String(option.value).toUpperCase()))
                        continue;
                    options.push({ value: option.value, label: text(option.label, String(option.value)) });
                }
            }
        const valid = value.valid === true && scalar(value.value) && typeof value.value === type;
        return {
            key: value.key, label: text(value.label, value.key), type, kind,
            value: valid && scalar(value.value) ? value.value : null, valid,
            writable: !mixed && value.writable === true, readable: value.readable === true, unit: text(value.unit, '', 32),
            min: finite(value.min), max: finite(value.max), step: finite(value.step), options,
            confirm: value.confirm === true, primary: value.primary === true,
            commandValue: scalar(value.commandValue) && typeof value.commandValue === value.type ? value.commandValue : undefined,
            age: finite(value.age), q: finite(value.q),
            ts: finite(value.ts), lc: finite(value.lc),
            ack: typeof value.ack === 'boolean' ? value.ack : undefined,
            error: typeof value.error === 'string' && /^EOS_CONTROL_[A-Z_]{1,80}$/.test(value.error) ? value.error : '',
        };
    }
    function normalize(value) {
        if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 512 || !record(value.deviceControls))
            return null;
        const controls = value.deviceControls;
        if (typeof controls.profile !== 'string' || !controls.profile || !Array.isArray(controls.fields))
            return null;
        const fields = [];
        const keys = new Set();
        for (const candidate of controls.fields.slice(0, 512)) {
            const field = normalizeField(candidate);
            if (field && !keys.has(field.key) && !volumeSteps.has(field.key.toUpperCase())) {
                keys.add(field.key);
                fields.push(field);
            }
        }
        return { id: value.id, name: text(value.alias, text(value.name, value.id)), profile: controls.profile.slice(0, 128), label: text(controls.label, 'Gerätefunktionen'), fields };
    }
    function element(tag, className, label = '') {
        const node = document.createElement(tag);
        node.className = className;
        node.textContent = label;
        return node;
    }
    function button(label, callback) {
        const node = element('button', 'nw-sh-dc-button', label);
        node.type = 'button';
        node.addEventListener('click', event => { event.stopPropagation(); if (!node.disabled)
            callback(); });
        return node;
    }
    function lazySection(details, key, populate) {
        let filled = false;
        const open = () => {
            if (details.open) {
                expandedSections.add(key);
                if (expandedSections.size > 256) {
                    const oldest = expandedSections.values().next();
                    if (!oldest.done)
                        expandedSections.delete(oldest.value);
                }
                if (!filled) {
                    filled = true;
                    populate();
                }
            }
            else
                expandedSections.delete(key);
        };
        details.open = expandedSections.has(key);
        details.addEventListener('toggle', open);
        open();
    }
    function current(field) {
        if (!field.readable)
            return 'Befehlsfunktion';
        if (!field.valid || field.value === null)
            return 'Keine Rückmeldung';
        if (field.key === 'MAP_BASE64' && typeof field.value === 'string')
            return 'Lokale Bilddaten vorhanden';
        const option = field.options.find(item => item.value === field.value);
        const value = option?.label ?? (typeof field.value === 'boolean' ? (field.value ? 'Ein' : 'Aus') : String(field.value));
        return field.unit ? `${value} ${field.unit}` : value;
    }
    function legal(field, value) {
        if (!field.writable || typeof value !== field.type)
            return false;
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))
                return false;
            if (field.step !== undefined && field.step > 0) {
                const steps = (value - (field.min ?? 0)) / field.step;
                if (Math.abs(steps - Math.round(steps)) > 1e-7)
                    return false;
            }
        }
        if (typeof value === 'string' && value.length > 4096)
            return false;
        return !field.options.length || field.options.some(item => item.value === value);
    }
    function removeConfirmation() {
        confirmation?.remove();
        confirmation = null;
    }
    async function send(device, field, value, row, confirmed) {
        if (!legal(field, value) || (field.confirm && !confirmed) || !row.isConnected)
            return;
        const status = row.querySelector('.nw-sh-dc-message');
        if (status)
            status.textContent = '';
        if (!host.NW_SH_FEEDBACK) {
            if (status)
                status.textContent = 'Bedienung derzeit nicht verfügbar. Bitte neu laden.';
            return;
        }
        try {
            const payload = { id: device.id, key: field.key, value };
            if (confirmed)
                payload.confirmed = true;
            const result = await host.NW_SH_FEEDBACK.post('/api/smarthome/control', payload, device.id);
            if (result?.ok === true)
                window.dispatchEvent(new CustomEvent('nw-smarthome-refresh', { detail: { id: device.id } }));
            else if (status)
                status.textContent = 'Befehl nicht bestätigt. Rückmeldung prüfen.';
        }
        catch {
            if (status)
                status.textContent = 'Befehl nicht bestätigt. Rückmeldung prüfen.';
        }
    }
    function request(device, field, value, row) {
        if (!legal(field, value))
            return;
        removeConfirmation();
        if (!field.confirm) {
            void send(device, field, value, row, false);
            return;
        }
        const panel = element('div', 'nw-sh-dc-confirm');
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', 'Befehl bestätigen');
        panel.append(element('p', '', `${field.label}: „${choiceLabel(device, field, value)}“ ausführen?`));
        const accept = button('Bestätigen', () => { removeConfirmation(); void send(device, field, value, row, true); });
        const cancel = button('Abbrechen', removeConfirmation);
        panel.append(accept, cancel);
        row.append(panel);
        confirmation = panel;
        accept.focus();
    }
    function choiceLabel(device, field, value) {
        const option = field.options.find(item => item.value === value);
        if (option)
            return option.label;
        if (field.type === 'boolean') {
            if (device.profile === 'gate' && field.key === 'SET')
                return value ? 'Öffnen' : 'Schließen';
            if (device.profile === 'lock' && field.key === 'SET')
                return value ? 'Verriegeln' : 'Entriegeln';
            return value ? 'Ein' : 'Aus';
        }
        return String(value);
    }
    function action(device, field, value, label, row) {
        const control = button(label, () => request(device, field, value, row));
        control.disabled = !legal(field, value);
        control.dataset.commandKey = field.key;
        return control;
    }
    function numeric(device, field, row) {
        const group = element('div', 'nw-sh-dc-numeric');
        const bounded = field.kind === 'range' && field.min !== undefined && field.max !== undefined && field.max > field.min;
        const input = element('input', 'nw-sh-dc-input');
        input.type = bounded ? 'range' : 'number';
        input.setAttribute('aria-label', field.label);
        input.disabled = !field.writable;
        if (field.min !== undefined)
            input.min = String(field.min);
        if (field.max !== undefined)
            input.max = String(field.max);
        input.step = field.step !== undefined && field.step > 0 ? String(field.step) : 'any';
        if (typeof field.value === 'number')
            input.value = String(field.value);
        else if (bounded)
            input.value = String(field.min);
        else
            input.value = '';
        const preview = element('output', 'nw-sh-dc-preview', field.valid ? current(field) : 'Wert wählen');
        const commit = () => {
            if (!input.value.trim())
                return;
            const value = Number(input.value);
            if (legal(field, value))
                request(device, field, value, row);
            else {
                const message = row.querySelector('.nw-sh-dc-message');
                if (message)
                    message.textContent = 'Bitte einen gültigen Wert innerhalb der Grenzen eingeben.';
            }
        };
        input.addEventListener('input', () => { preview.textContent = `${input.value}${field.unit ? ` ${field.unit}` : ''}`; });
        if (bounded) {
            input.addEventListener('change', commit);
            host.NW_SH_TOUCH?.bindRange(input);
            const min = field.min ?? 0;
            const max = field.max ?? 1;
            const value = Number(input.value);
            input.style.setProperty('--nw-range-fill', `${Math.max(0, Math.min(100, (value - min) / (max - min) * 100))}%`);
        }
        else {
            const apply = button('Übernehmen', commit);
            apply.disabled = !field.writable;
            group.append(apply);
        }
        group.prepend(input, preview);
        return group;
    }
    function remote(device, field, row) {
        if (device.profile !== 'tv' || field.key !== 'KEY' || !field.options.length)
            return null;
        const group = element('div', 'nw-sh-dc-remote');
        group.setAttribute('aria-label', 'Fernbedienung');
        const pad = element('div', 'nw-sh-dc-pad');
        const rest = element('div', 'nw-sh-dc-remote-keys');
        const extraOptions = [];
        const usedPositions = new Set();
        for (const option of field.options) {
            if (volumeSteps.has(String(option.value).toUpperCase()))
                continue;
            const descriptor = remoteKeys.get(String(option.value).toUpperCase());
            if (descriptor && !usedPositions.has(descriptor.position)) {
                const node = action(device, field, option.value, descriptor.label, row);
                node.dataset.position = descriptor.position;
                pad.append(node);
                usedPositions.add(descriptor.position);
            }
            else
                extraOptions.push(option);
        }
        if (pad.childElementCount)
            group.append(pad);
        if (extraOptions.length) {
            const more = element('details', 'nw-sh-dc-secondary');
            more.append(element('summary', '', 'Weitere Fernbedienungstasten'), rest);
            group.append(more);
            lazySection(more, JSON.stringify([device.id, field.key, 'remote']), () => { for (const option of extraOptions)
                rest.append(action(device, field, option.value, option.label, row)); });
        }
        return group;
    }
    function editor(device, field, row) {
        if (field.kind === 'value')
            return null;
        if (field.kind === 'button') {
            const value = field.commandValue ?? (field.type === 'boolean' ? true : undefined);
            if (value === undefined)
                return element('span', 'nw-sh-dc-hint', 'Kein eindeutiger Befehlswert hinterlegt');
            const label = field.key === 'STOP' || field.key === 'TILT_STOP' ? 'Stopp' : field.label;
            const node = action(device, field, value, label, row);
            if (label === 'Stopp')
                node.classList.add('nw-sh-dc-stop');
            return node;
        }
        const remoteControl = remote(device, field, row);
        if (remoteControl)
            return remoteControl;
        if (field.type === 'boolean' && field.kind !== 'select') {
            const group = element('div', 'nw-sh-dc-switch');
            group.setAttribute('role', 'group');
            group.setAttribute('aria-label', field.label);
            for (const value of [false, true]) {
                const node = action(device, field, value, choiceLabel(device, field, value), row);
                if (field.valid)
                    node.setAttribute('aria-pressed', String(field.value === value));
                group.append(node);
            }
            return group;
        }
        if (field.options.length || field.kind === 'select') {
            const group = element('div', 'nw-sh-dc-entry');
            const select = element('select', 'nw-sh-dc-input');
            select.setAttribute('aria-label', field.label);
            select.disabled = !field.writable || !field.options.length;
            const placeholder = element('option', '', 'Bitte wählen');
            placeholder.value = '';
            select.append(placeholder);
            field.options.forEach((option, index) => { const node = element('option', '', option.label); node.value = String(index); select.append(node); });
            const selected = field.valid ? field.options.findIndex(option => option.value === field.value) : -1;
            select.value = selected >= 0 ? String(selected) : '';
            const apply = button('Übernehmen', () => { const option = select.value === '' ? undefined : field.options[Number(select.value)]; if (option)
                request(device, field, option.value, row); });
            apply.disabled = select.disabled;
            group.append(select, apply);
            return group;
        }
        if (field.type === 'number')
            return numeric(device, field, row);
        const group = element('div', 'nw-sh-dc-entry');
        const input = element('input', 'nw-sh-dc-input');
        input.type = 'text';
        input.setAttribute('aria-label', field.label);
        input.maxLength = 4096;
        input.value = typeof field.value === 'string' ? field.value : '';
        input.placeholder = field.valid ? '' : 'Wert eingeben';
        input.disabled = !field.writable;
        const apply = button('Übernehmen', () => { request(device, field, input.value, row); });
        apply.disabled = !field.writable;
        group.append(input, apply);
        return group;
    }
    function renderField(device, field) {
        const row = element('section', 'nw-sh-dc-field');
        row.dataset.fieldKey = field.key;
        const head = element('div', 'nw-sh-dc-field-head');
        head.append(element('span', 'nw-sh-dc-label', field.label));
        const value = element('output', 'nw-sh-dc-value', current(field));
        value.dataset.valid = String(field.valid);
        value.setAttribute('aria-label', `${field.label}: ${field.ack === false ? 'angeforderter Wert' : 'Rückmeldung'}`);
        head.append(value);
        row.append(head);
        if (field.ack === false)
            row.append(element('small', 'nw-sh-dc-pending', 'Angefordert – Geräterückmeldung ausstehend'));
        if (field.error)
            row.append(element('small', 'nw-sh-dc-hint', `Status: ${field.error}`));
        if (field.q !== undefined && field.q !== 0)
            row.append(element('small', 'nw-sh-dc-hint', `Rückmeldung mit Qualitätskennzeichen ${field.q}`));
        if (field.age !== undefined && field.age >= 0)
            row.append(element('small', 'nw-sh-dc-age', `${field.ack === false ? 'Anforderung' : 'Rückmeldung'} vor ${field.age < 60000 ? `${Math.floor(field.age / 1000)} s` : `${Math.floor(field.age / 60000)} min`}`));
        if (device.profile === 'buttonSensor') {
            const at = field.lc ?? field.ts;
            if (at !== undefined && at > 0 && at <= 8640000000000000)
                row.append(element('small', 'nw-sh-dc-age', `${field.lc !== undefined ? 'Letzte Änderung' : 'Letzte Rückmeldung'}: ${new Date(at).toLocaleString('de-DE')}`));
        }
        const control = editor(device, field, row);
        if (control)
            row.append(control);
        if (device.profile === 'vacuumCleaner' && field.key === 'MAP_BASE64' && field.valid && field.readable && typeof field.value === 'string') {
            const data = field.value;
            const key = JSON.stringify([device.id, field.key, 'map']);
            const details = element('details', 'nw-sh-dc-secondary');
            details.append(element('summary', '', 'Lokale Karte anzeigen'));
            row.append(details);
            lazySection(details, key, () => {
                const cached = mapImages.get(key);
                if (cached?.value === data) {
                    details.append(cached.image);
                    return;
                }
                const url = rasterData(data);
                if (!url) {
                    details.append(element('p', 'nw-sh-dc-hint', 'Kein unterstütztes, begrenztes Rasterbild.'));
                    return;
                }
                const image = element('img', 'nw-sh-dc-map');
                image.alt = 'Vom Saugroboter bereitgestellte Karte';
                image.loading = 'lazy';
                image.decoding = 'async';
                image.src = url;
                mapImages.set(key, { value: data, image });
                details.append(image);
                if (mapImages.size > 4) {
                    const oldest = mapImages.keys().next();
                    if (!oldest.done) {
                        mapImages.get(oldest.value)?.image.remove();
                        mapImages.delete(oldest.value);
                    }
                }
            });
        }
        if (!field.writable && control)
            row.append(element('small', 'nw-sh-dc-hint', 'Nur Anzeige · keine Schreibfreigabe'));
        const message = element('p', 'nw-sh-dc-message');
        message.setAttribute('role', 'status');
        row.append(message);
        if (field.readable && (field.type === 'number' || field.type === 'boolean') && host.NW_SH_CUSTOM_VIEWS?.renderHistory) {
            const cacheKey = JSON.stringify([device.id, field.key]);
            const toggle = button(historyPanels.has(cacheKey) ? 'Verlauf schließen' : 'Verlauf anzeigen', () => {
                const previous = historyPanels.get(cacheKey);
                if (previous) {
                    previous.view.destroy();
                    previous.container.remove();
                    historyPanels.delete(cacheKey);
                    toggle.textContent = 'Verlauf anzeigen';
                    return;
                }
                const view = element('div', 'nw-sh-dc-history');
                view.setAttribute('aria-label', `${field.label}: Verlauf`);
                row.append(view);
                try {
                    const handle = host.NW_SH_CUSTOM_VIEWS?.renderHistory(view, runtimeDTO(device), field.key);
                    if (!handle) {
                        view.remove();
                        return;
                    }
                    historyPanels.set(cacheKey, { container: view, view: handle });
                    toggle.textContent = 'Verlauf schließen';
                    if (historyPanels.size > 16) {
                        const oldest = historyPanels.keys().next();
                        if (!oldest.done) {
                            const entry = historyPanels.get(oldest.value);
                            entry?.view.destroy();
                            entry?.container.remove();
                            historyPanels.delete(oldest.value);
                        }
                    }
                }
                catch {
                    view.textContent = 'Verlauf derzeit nicht verfügbar.';
                }
            });
            toggle.classList.add('nw-sh-dc-history-toggle');
            row.append(toggle);
            const cached = historyPanels.get(cacheKey);
            if (cached) {
                row.append(cached.container);
                cached.view.update(runtimeDTO(device));
            }
        }
        return row;
    }
    function runtimeDTO(device) {
        return { id: device.id, alias: device.name, deviceControls: { profile: device.profile, label: device.label, fields: device.fields } };
    }
    function priority(field) {
        if (field.key === 'STOP' || field.key === 'TILT_STOP')
            return 0;
        if (field.primary)
            return 1;
        if (['SET', 'ON_SET', 'POWER', 'SETPOINT', 'VOLUME', 'LEVEL', 'KEY'].includes(field.key))
            return 2;
        return field.writable ? 3 : 4;
    }
    function mediaPanel(device) {
        if (!['media', 'tv', 'volume', 'volumeGroup'].includes(device.profile))
            return null;
        const find = (key) => device.fields.find(field => field.key === key);
        const volume = find(device.profile === 'volume' || device.profile === 'volumeGroup' ? 'SET' : 'VOLUME');
        const actual = find(device.profile === 'volume' || device.profile === 'volumeGroup' ? 'ACTUAL' : 'VOLUME_ACTUAL') ?? volume;
        const value = actual?.valid && actual.ack !== false && typeof actual.value === 'number' ? actual.value : null;
        if (value !== null && value > 0) {
            volumeMemory.delete(device.id);
            volumeMemory.set(device.id, value);
            if (volumeMemory.size > 128) {
                const oldest = volumeMemory.keys().next();
                if (!oldest.done)
                    volumeMemory.delete(oldest.value);
            }
        }
        const panel = element('section', 'nw-sh-dc-media');
        const controls = element('div', 'nw-sh-dc-media-buttons');
        const keyField = find('KEY');
        const keyChoice = (keys) => keyField?.options.find(option => keys.includes(String(option.value).toUpperCase()));
        function command(key, label, fallbacks = []) {
            const field = find(key);
            if (field?.type === 'boolean' && field.writable)
                controls.append(action(device, field, true, label, panel));
            else {
                const choice = keyChoice(fallbacks);
                if (choice && keyField)
                    controls.append(action(device, keyField, choice.value, label, panel));
            }
        }
        for (const [key, label] of [['PREV', 'Zurück'], ['PLAY', 'Wiedergabe'], ['PAUSE', 'Pause'], ['STOP', 'Stopp'], ['NEXT', 'Weiter']]) {
            if (key && label)
                command(key, label, key === 'PREV' ? ['PREVIOUS', 'PREV', 'PREVIOUS_TRACK'] : key === 'NEXT' ? ['NEXT', 'NEXT_TRACK'] : [key]);
        }
        const mute = find('MUTE');
        if (mute?.type === 'boolean' && mute.writable) {
            controls.append(action(device, mute, true, 'Stummschalten', panel), action(device, mute, false, 'Ton einschalten', panel));
        }
        else if (!mute && volume?.type === 'number') {
            controls.append(action(device, volume, 0, 'Stummschalten', panel));
            const restore = volumeMemory.get(device.id);
            const node = action(device, volume, restore ?? Number.NaN, 'Lautstärke wiederherstellen', panel);
            if (restore === undefined)
                node.title = 'Noch keine Lautstärke über Null zurückgemeldet.';
            controls.append(node);
        }
        if (!controls.childElementCount)
            return null;
        panel.append(element('span', 'nw-sh-dc-profile', 'Medienbedienung'), controls);
        const status = element('p', 'nw-sh-dc-message');
        status.setAttribute('role', 'status');
        panel.append(status);
        return panel;
    }
    function summaryPanel(device) {
        const known = {
            warning: ['TITLE', 'LEVEL', 'INFO', 'START', 'END'],
            airQuality: ['AQI', 'CO2', 'TVOC', 'PM25', 'PM10', 'ACTUAL', 'HUMIDITY'],
            electricity: ['POWER', 'CURRENT', 'VOLTAGE', 'CONSUMPTION', 'FREQUENCY'],
            location: ['LATITUDE', 'LONGITUDE', 'GPS', 'ELEVATION', 'RADIUS', 'ACCURACY'],
            locationOne: ['GPS', 'ELEVATION', 'RADIUS', 'ACCURACY'],
            buttonSensor: ['PRESS', 'PRESS_LONG'],
        };
        const keys = Object.hasOwn(known, device.profile) ? known[device.profile] : undefined;
        if (!keys)
            return null;
        const selected = keys.map(key => device.fields.find(field => field.key === key)).filter((field) => field !== undefined);
        if (!selected.length)
            return null;
        const summary = element('section', 'nw-sh-dc-summary');
        summary.setAttribute('aria-label', `${device.label}: Übersicht`);
        for (const field of selected) {
            const item = element('div', 'nw-sh-dc-metric');
            item.append(element('span', 'nw-sh-dc-label', field.label), element('strong', 'nw-sh-dc-value', current(field)));
            const severity = device.fields.find(entry => entry.key === `${field.key}_LEVEL`);
            if (severity)
                item.append(element('span', 'nw-sh-dc-hint', current(severity)));
            if (field.ack === false)
                item.append(element('small', 'nw-sh-dc-pending', 'Angefordert – Geräterückmeldung ausstehend'));
            summary.append(item);
        }
        return summary;
    }
    function imagePanel(device) {
        if (device.profile !== 'image' && device.profile !== 'vacuumCleaner')
            return null;
        const keys = device.profile === 'vacuumCleaner' ? ['MAP_URL'] : ['URL', 'ACTUAL'];
        const field = device.fields.find(item => keys.includes(item.key) && item.valid && item.readable && typeof item.value === 'string');
        if (!field || typeof field.value !== 'string' || field.value.length > 4096)
            return null;
        try {
            const url = new URL(field.value);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
                return null;
            const panel = element('section', 'nw-sh-dc-image');
            const link = element('a', 'nw-sh-dc-button', device.profile === 'vacuumCleaner' ? 'Karte öffnen' : 'Bild öffnen');
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            panel.append(link, element('span', 'nw-sh-dc-hint', url.host));
            return panel;
        }
        catch {
            return null;
        }
    }
    function rasterData(value) {
        if (!value || value.length > 1024 * 1024)
            return null;
        const match = /^(?:data:image\/(png|jpeg|webp);base64,)?([A-Za-z0-9+/]+={0,2})$/.exec(value);
        if (!match?.[2])
            return null;
        try {
            const bytes = atob(match[2]);
            const b = (index) => bytes.charCodeAt(index);
            let mime = '';
            let width = 0;
            let height = 0;
            if (bytes.startsWith('\x89PNG\r\n\x1a\n') && bytes.length >= 24) {
                mime = 'png';
                width = b(16) * 16777216 + b(17) * 65536 + b(18) * 256 + b(19);
                height = b(20) * 16777216 + b(21) * 65536 + b(22) * 256 + b(23);
            }
            else if (bytes.startsWith('\xff\xd8')) {
                mime = 'jpeg';
                let cursor = 2;
                while (cursor + 9 < bytes.length && cursor < 65536) {
                    if (b(cursor) !== 255)
                        break;
                    const marker = b(cursor + 1);
                    const length = b(cursor + 2) * 256 + b(cursor + 3);
                    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
                        height = b(cursor + 5) * 256 + b(cursor + 6);
                        width = b(cursor + 7) * 256 + b(cursor + 8);
                        break;
                    }
                    if (length < 2)
                        break;
                    cursor += length + 2;
                }
            }
            else if (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP' && bytes.length >= 30) {
                mime = 'webp';
                const format = bytes.slice(12, 16);
                if (format === 'VP8X') {
                    width = 1 + b(24) + b(25) * 256 + b(26) * 65536;
                    height = 1 + b(27) + b(28) * 256 + b(29) * 65536;
                }
                else if (format === 'VP8 ' && bytes.slice(23, 26) === '\x9d\x01\x2a') {
                    width = (b(26) + b(27) * 256) & 16383;
                    height = (b(28) + b(29) * 256) & 16383;
                }
                else if (format === 'VP8L' && b(20) === 47) {
                    width = 1 + b(21) + ((b(22) & 63) << 8);
                    height = 1 + (b(22) >> 6) + (b(23) << 2) + ((b(24) & 15) << 10);
                }
            }
            if (!mime || (match[1] && match[1] !== mime) || width <= 0 || height <= 0 || width > 4096 || height > 4096 || width * height > 8 * 1024 * 1024)
                return null;
            return `data:image/${mime};base64,${match[2]}`;
        }
        catch {
            return null;
        }
    }
    function hex(rgb) {
        return `#${rgb.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
    }
    function rgbFromHex(value) {
        if (!/^#[0-9a-f]{6}$/i.test(value))
            return null;
        return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];
    }
    function hsv(rgb) {
        const [r, g, b] = rgb.map(value => value / 255);
        const maximum = Math.max(r, g, b);
        const difference = maximum - Math.min(r, g, b);
        const sector = !difference ? 0 : maximum === r ? ((g - b) / difference) % 6 : maximum === g ? (b - r) / difference + 2 : (r - g) / difference + 4;
        return [(sector * 60 + 360) % 360, maximum ? difference / maximum : 0, maximum];
    }
    function rgbFromHsv(hue, saturation) {
        const h = ((hue % 360) + 360) % 360;
        const chroma = Math.max(0, Math.min(1, saturation));
        const second = chroma * (1 - Math.abs((h / 60) % 2 - 1));
        const parts = h < 60 ? [chroma, second, 0] : h < 120 ? [second, chroma, 0] : h < 180 ? [0, chroma, second] : h < 240 ? [0, second, chroma] : h < 300 ? [second, 0, chroma] : [chroma, 0, second];
        return parts.map(part => Math.round((part + 1 - chroma) * 255));
    }
    function xy(rgb) {
        const [r, g, b] = rgb.map(value => { const v = value / 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; });
        const x = r * 0.664511 + g * 0.154324 + b * 0.162028;
        const y = r * 0.283881 + g * 0.668433 + b * 0.047685;
        const z = r * 0.000088 + g * 0.07231 + b * 0.986039;
        const sum = x + y + z;
        return sum ? [x / sum, y / sum] : [0.3127, 0.329];
    }
    function rgbFromXy(x, y) {
        if (y <= 0 || x < 0 || x + y > 1)
            return [0, 0, 0];
        const xx = x / y;
        const zz = (1 - x - y) / y;
        const values = [xx * 1.656492 - 0.354851 - zz * 0.255038, -xx * 0.707196 + 1.655397 + zz * 0.036152, xx * 0.051713 - 0.121364 + zz * 1.01153];
        return values.map(value => { const v = Math.max(0, value); return Math.min(255, Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))); });
    }
    function rgbFromKelvin(kelvin) {
        if (!Number.isFinite(kelvin) || kelvin <= 0)
            return [0, 0, 0];
        const t = kelvin / 100;
        return [t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592,
            t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492,
            t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307];
    }
    function proportion(field) {
        if (!field || !field.valid || typeof field.value !== 'number' || field.min === undefined || field.max === undefined || field.max <= field.min)
            return null;
        return Math.max(0, Math.min(1, (field.value - field.min) / (field.max - field.min)));
    }
    function scale(field, fraction) {
        if (!field || field.type !== 'number' || !field.writable || field.confirm || field.min === undefined || field.max === undefined || field.max <= field.min)
            return null;
        let value = field.min + Math.max(0, Math.min(1, fraction)) * (field.max - field.min);
        if (field.step !== undefined && field.step > 0)
            value = field.min + Math.round((value - field.min) / field.step) * field.step;
        value = Number(value.toFixed(10));
        return legal(field, value) ? { key: field.key, value } : null;
    }
    function colorWrites(device, rgb) {
        const field = (key) => device.fields.find(item => item.key === key);
        let writes = [];
        if (device.profile === 'rgbSingle' || device.profile === 'rgbwSingle') {
            const entry = field(device.profile === 'rgbSingle' ? 'RGB' : 'RGBW');
            const pattern = device.profile === 'rgbSingle' ? /^#?[0-9a-f]{6}$/i : /^#?[0-9a-f]{8}$/i;
            if (!entry || typeof entry.value !== 'string' || !pattern.test(entry.value))
                return [];
            const value = `${entry.value.startsWith('#') ? '#' : ''}${hex(rgb).slice(1)}${device.profile === 'rgbwSingle' ? entry.value.slice(-2) : ''}`;
            writes = [legal(entry, value) && !entry.confirm ? { key: entry.key, value } : null];
        }
        else if (device.profile === 'rgb') {
            writes = [scale(field('RED'), rgb[0] / 255), scale(field('GREEN'), rgb[1] / 255), scale(field('BLUE'), rgb[2] / 255)];
        }
        else if (device.profile === 'hue') {
            const [h, s] = hsv(rgb);
            writes = [scale(field('HUE'), h / 360)];
            if (field('SATURATION'))
                writes.push(scale(field('SATURATION'), s));
        }
        else if (device.profile === 'cie') {
            const entry = field('CIE');
            if (!entry || entry.type !== 'string')
                return [];
            const [x, y] = xy(rgb);
            const parts = `${x.toFixed(4)},${y.toFixed(4)}`;
            const value = typeof entry.value === 'string' && entry.value.trim().startsWith('[') ? `[${parts}]` : parts;
            writes = [legal(entry, value) && !entry.confirm ? { key: entry.key, value } : null];
        }
        return writes.length && writes.every((entry) => entry !== null) ? writes : [];
    }
    function reportedColor(device) {
        const field = (key) => device.fields.find(item => item.key === key);
        const raw = field(device.profile === 'rgbwSingle' ? 'RGBW' : 'RGB')?.value;
        if ((device.profile === 'rgbSingle' || device.profile === 'rgbwSingle') && typeof raw === 'string' && /^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.test(raw))
            return `#${raw.replace(/^#/, '').slice(0, 6)}`;
        if (device.profile === 'rgb') {
            const channels = ['RED', 'GREEN', 'BLUE'].map(key => proportion(field(key)));
            if (channels.every((channel) => channel !== null))
                return hex([channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0].map(channel => channel * 255));
        }
        if (device.profile === 'hue') {
            const h = proportion(field('HUE'));
            const s = field('SATURATION') ? proportion(field('SATURATION')) : 1;
            if (h !== null && s !== null)
                return hex(rgbFromHsv(h * 360, s));
        }
        if (device.profile === 'cie') {
            const value = field('CIE')?.value;
            if (typeof value === 'string' && /^\s*\[?\s*[\d.]+\s*,\s*[\d.]+\s*\]?\s*$/.test(value)) {
                const parts = value.replace(/[\[\]]/g, '').split(',').map(Number);
                const x = parts[0];
                const y = parts[1];
                if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y > 0 && x + y <= 1)
                    return hex(rgbFromXy(x, y));
            }
        }
        const ct = field('TEMPERATURE');
        if (device.profile === 'ct' && ct?.valid && typeof ct.value === 'number' && (ct.unit === 'K' || ct.unit.toLowerCase() === 'kelvin'))
            return hex(rgbFromKelvin(ct.value));
        return null;
    }
    async function sendColor(device, values, panel) {
        if (!panel.isConnected || !values.length || values.length > 4)
            return;
        const status = panel.querySelector('.nw-sh-dc-message');
        if (!host.NW_SH_FEEDBACK) {
            if (status)
                status.textContent = 'Bedienung derzeit nicht verfügbar. Bitte neu laden.';
            return;
        }
        try {
            const result = await host.NW_SH_FEEDBACK.post('/api/smarthome/control', { id: device.id, values }, device.id);
            if (result?.ok === true)
                window.dispatchEvent(new CustomEvent('nw-smarthome-refresh', { detail: { id: device.id } }));
            else if (status)
                status.textContent = 'Farbauftrag nicht bestätigt. Rückmeldung prüfen.';
        }
        catch {
            if (status)
                status.textContent = 'Farbauftrag nicht bestätigt. Rückmeldung prüfen.';
        }
    }
    function colorPanel(device) {
        if (!['rgbSingle', 'rgbwSingle', 'rgb', 'hue', 'cie', 'ct'].includes(device.profile))
            return null;
        const panel = element('section', 'nw-sh-dc-color');
        const actual = reportedColor(device);
        const swatch = element('span', 'nw-sh-dc-swatch');
        const pending = device.fields.some(field => field.ack === false && ['RGB', 'RGBW', 'RED', 'GREEN', 'BLUE', 'HUE', 'SATURATION', 'CIE', 'TEMPERATURE'].includes(field.key));
        swatch.setAttribute('aria-label', pending ? 'Angeforderte Farbe' : actual ? 'Zurückgemeldete Farbe' : 'Farbe nicht bekannt');
        if (actual)
            swatch.style.backgroundColor = actual;
        panel.append(swatch, element('span', 'nw-sh-dc-label', pending ? 'Farbe · Geräterückmeldung ausstehend' : actual ? 'Farbe · Rückmeldung' : 'Farbe · keine Rückmeldung'));
        if (device.profile === 'ct') {
            return panel;
        }
        const picker = element('input', 'nw-sh-dc-color-input');
        picker.type = 'color';
        picker.value = actual ?? '#ffffff';
        picker.setAttribute('aria-label', 'Neue Farbe wählen');
        picker.disabled = !colorWrites(device, [255, 0, 0]).length;
        const apply = button('Farbe übernehmen', () => { const rgb = rgbFromHex(picker.value); if (rgb)
            void sendColor(device, colorWrites(device, rgb), panel); });
        apply.disabled = picker.disabled;
        panel.append(picker, apply);
        if (picker.disabled)
            panel.append(element('p', 'nw-sh-dc-hint', 'Farbwahl nicht verfügbar.'));
        const status = element('p', 'nw-sh-dc-message');
        status.setAttribute('role', 'status');
        panel.append(status);
        return panel;
    }
    function render(device, compact) {
        const root = element('div', 'nw-sh-device-controls');
        root.dataset.profile = device.profile;
        root.dataset.shDeviceId = device.id;
        root.addEventListener('click', event => { event.stopPropagation(); });
        root.addEventListener('keydown', event => { if (event.key === 'Escape')
            removeConfirmation(); });
        const heading = element('div', 'nw-sh-dc-heading');
        heading.append(element('span', 'nw-sh-dc-profile', device.label), element('h3', 'nw-sh-dc-name', device.name));
        root.append(heading);
        const colors = colorPanel(device);
        if (colors)
            root.append(colors);
        const media = mediaPanel(device);
        if (media)
            root.append(media);
        const summary = summaryPanel(device);
        if (summary)
            root.append(summary);
        const image = imagePanel(device);
        if (image)
            root.append(image);
        if (device.profile === 'weatherCurrent' || device.profile === 'weatherForecast') {
            try {
                host.NW_SH_CUSTOM_VIEWS?.renderForecast?.(root, runtimeDTO(device));
            }
            catch { /* Einzelwerte bleiben auch ohne Zusatzdarstellung bedienbar. */ }
        }
        if (!device.fields.length)
            root.append(element('p', 'nw-sh-dc-hint', 'Für dieses Gerät sind noch keine Funktionen zugeordnet.'));
        const categories = element('div', 'nw-sh-dc-categories');
        let categorized = false;
        try {
            categorized = host.NW_SH_DEVICE_CATEGORIES?.render(categories, runtimeDTO(device), key => {
                const field = device.fields.find(candidate => candidate.key === key);
                return field ? renderField(device, field) : null;
            }, compact) === true;
        }
        catch { /* Die generische Bedienung bleibt verfügbar, falls die optionale Darstellung fehlt. */ }
        if (categorized)
            root.append(categories);
        else {
            const fields = [...device.fields].sort((a, b) => priority(a) - priority(b));
            const main = element('div', 'nw-sh-dc-grid');
            root.append(main);
            const first = compact ? Math.max(3, fields.filter(field => priority(field) < 2).length) : fields.length;
            for (const field of fields.slice(0, first))
                main.append(renderField(device, field));
            if (fields.length > first) {
                const extra = element('details', 'nw-sh-dc-secondary');
                extra.append(element('summary', '', `Weitere Funktionen (${fields.length - first})`));
                const grid = element('div', 'nw-sh-dc-grid');
                extra.append(grid);
                root.append(extra);
                lazySection(extra, JSON.stringify([device.id, 'fields']), () => { for (const field of fields.slice(first))
                    grid.append(renderField(device, field)); });
            }
        }
        host.NW_SH_FEEDBACK?.attachStatus(root, device.id);
        return root;
    }
    function isInteracting() {
        if (confirmation && !confirmation.isConnected)
            confirmation = null;
        const focused = document.activeElement;
        return !!confirmation || host.NW_SH_TOUCH?.isInteracting() === true ||
            (focused instanceof HTMLElement && focused.isConnected && focused.matches('input,select,textarea') && !!focused.closest(rowSelector));
    }
    window.addEventListener('pagehide', () => { removeConfirmation(); volumeMemory.clear(); expandedSections.clear(); mapImages.clear(); for (const entry of historyPanels.values())
        entry.view.destroy(); historyPanels.clear(); });
    host.NW_SH_DEVICE_CONTROLS = Object.freeze({
        renderTile(value) { const device = normalize(value); return device ? render(device, true) : null; },
        renderDetails(root, value) { const device = normalize(value); root.replaceChildren(); if (device)
            root.append(render(device, false)); },
        isInteracting,
    });
})();
