/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-device-config.ts
 * Quell-Hash: sha256:64f3ab313554194047b2a285360ad27323d4bcb83e45cc758e2b3e9f804a8b5f
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-device-config.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_DEVICE_CONFIG)
        return;
    const scalarTypes = ['boolean', 'number', 'string'];
    const genericRoles = new Set(['', 'state', 'value', 'level', 'switch', 'sensor', 'indicator', 'button']);
    const directionTerms = {
        read: ['ruckmeldung', 'feedback', 'status', 'lesen', 'read'],
        write: ['befehl', 'command', 'schreiben', 'write'],
    };
    const temperatureUnits = new Set(['°c', '°f', 'k']);
    const switchSignal = {
        label: 'Schalten', read: ['sensor.switch', 'state.switch', 'sensor.light', 'state.light'],
        write: ['switch', 'switch.light', 'switch.power', 'switch.socket'],
        keywords: ['schalten', 'switch', 'schaltstatus', 'switch status', 'on off', 'ein aus'],
    };
    const dimmerSignal = {
        label: 'Dimmen', read: ['value.dimmer', 'value.brightness'], write: ['level.dimmer', 'level.brightness'],
        keywords: ['dimmen', 'dimmer', 'dimming', 'helligkeit', 'brightness', 'dimmwert', 'dim value', 'dim level'],
    };
    const blindSignal = {
        label: 'Jalousieposition', read: ['value.blind', 'value.position.blind'], write: ['level.blind', 'level.position.blind'],
        keywords: ['jalousie', 'jalousieposition', 'rollladen', 'rolladen', 'rollladenposition', 'raffstore', 'blind', 'blind position', 'shutter', 'shutter position'],
    };
    const tiltSignal = {
        label: 'Lamellenposition', read: ['value.tilt', 'value.open.tilt'], write: ['level.tilt', 'level.open.tilt'],
        keywords: ['lamellen', 'lamellenposition', 'lamellenwinkel', 'slat', 'slat angle', 'tilt'],
    };
    const climateSignal = {
        label: 'Temperatur', read: ['value.temperature'], write: ['level.temperature'],
        keywords: ['temperatur', 'temperature', 'isttemperatur', 'actual temperature', 'solltemperatur', 'target temperature', 'setpoint'],
    };
    const humiditySignal = {
        label: 'Luftfeuchte', read: ['value.humidity', 'value.humidity.relative'], write: [],
        keywords: ['luftfeuchte', 'luftfeuchtigkeit', 'relative feuchte', 'humidity', 'relative humidity'],
    };
    const temperatureProfiles = new Set(['temperature', 'thermostat', 'airCondition', 'weatherCurrent']);
    const lightProfiles = new Set(['dimmer', 'rgb', 'rgbSingle', 'rgbwSingle', 'cie', 'ct', 'hue']);
    const blindProfiles = new Set(['blind', 'blindButtons']);
    const statusSignals = new Map([
        ['UNREACH', { label: 'Erreichbarkeit', read: ['indicator.maintenance.unreach', 'indicator.unreach'], write: [], keywords: ['erreichbarkeit', 'nicht erreichbar', 'unreachable', 'offline'] }],
        ['ERROR', { label: 'Störung', read: ['indicator.error'], write: [], keywords: ['störung', 'fehler', 'fault', 'error'] }],
        ['WORKING', { label: 'Betriebsstatus', read: ['indicator.working'], write: [], keywords: ['betrieb', 'in betrieb', 'working', 'running'] }],
        ['DIRECTION', { label: 'Fahrtrichtung', read: ['indicator.direction', 'value.direction'], write: [], keywords: ['fahrtrichtung', 'direction'] }],
        ['LOWBAT', { label: 'Batteriestatus', read: ['indicator.maintenance.lowbat', 'indicator.maintenance.battery'], write: [], keywords: ['batterie schwach', 'low battery', 'lowbat'] }],
        ['BATTERY', { label: 'Batteriestand', read: ['value.battery'], write: [], keywords: ['batteriestand', 'battery level', 'battery'] }],
    ]);
    const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
    const maxFields = 128;
    const maxResponseBytes = 1024 * 1024;
    let catalog = null;
    let customViews = [];
    const invalidEditors = new Set();
    function record(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function scalarType(value) {
        return value === 'boolean' || value === 'number' || value === 'string';
    }
    function normalizeWords(value) {
        return value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
    }
    /** Die Schlüssel SET und ACTUAL erhalten ihre Bedeutung erst im konkreten Bedienprofil. */
    function signalFor(profile, field) {
        if (field === 'HUMIDITY' || (profile === 'humidity' && field === 'ACTUAL') || (profile === 'temperature' && field === 'SECOND'))
            return humiditySignal;
        if (temperatureProfiles.has(profile) && (field === 'ACTUAL' || field === 'SET'))
            return climateSignal;
        if (field === 'SET_HEATING' || field === 'SET_COOLING') {
            const heating = field === 'SET_HEATING';
            return { ...climateSignal, write: [heating ? 'level.temperature.heating' : 'level.temperature.cooling'] };
        }
        if (['ON_SET', 'ON_ACTUAL', 'ON', 'POWER'].includes(field) || (['light', 'socket'].includes(profile) && ['SET', 'ACTUAL'].includes(field)))
            return switchSignal;
        if (lightProfiles.has(profile) && ['SET', 'ACTUAL', 'DIMMER', 'BRIGHTNESS'].includes(field))
            return dimmerSignal;
        if (blindProfiles.has(profile)) {
            if (['SET', 'ACTUAL'].includes(field))
                return blindSignal;
            if (['TILT_SET', 'TILT_ACTUAL'].includes(field))
                return tiltSignal;
            if (['OPEN', 'CLOSE', 'STOP', 'TILT_OPEN', 'TILT_CLOSE', 'TILT_STOP'].includes(field)) {
                const [action, target] = field.startsWith('TILT_') ? [field.slice(5).toLowerCase(), 'tilt'] : [field.toLowerCase(), 'blind'];
                const keywords = action === 'open' ? ['auf', 'öffnen', 'open', 'up'] : action === 'close' ? ['ab', 'schließen', 'close', 'down'] : ['stopp', 'stop', 'halt'];
                return { label: '', read: [], write: [`button.${action}.${target}`, `action.${action}.${target}`], keywords };
            }
            if (field === 'DIRECTION_ENUM')
                return statusSignals.get('DIRECTION');
        }
        if (field === 'ACTUAL') {
            if (profile === 'contact' || profile === 'door' || profile === 'window') {
                return { label: 'Kontaktstatus', read: [`sensor.${profile}`], write: [], keywords: ['kontakt', 'fensterkontakt', 'türkontakt', 'contact', 'window contact', 'door contact'] };
            }
            if (profile === 'motion')
                return { label: 'Bewegung', read: ['sensor.motion'], write: [], keywords: ['bewegung', 'bewegungsmelder', 'motion', 'motion sensor'] };
        }
        return statusSignals.get(field);
    }
    function pickerHint(profile, field, direction) {
        if (!field.types.length)
            return undefined;
        const signal = signalFor(profile, field.key);
        const specific = signal?.label && field.label !== signal.label ? `${signal.label} · ${field.label}` : field.label;
        return { label: specific, direction, types: field.types, unit: field.unit, roles: signal?.[direction] ?? [],
            keywords: (signal?.keywords ?? []).map(normalizeWords) };
    }
    /** Filtert vom Server gelieferte Objektmetadaten. Ein Name ist nur ein Prüfhinweis. */
    function profileCandidate(value, hint) {
        if (!record(value) || !dpId(value.id) || !scalarType(value.type) || !hint.types.includes(value.type) || value[hint.direction] !== true)
            return null;
        const role = typeof value.role === 'string' ? value.role.trim().toLowerCase().slice(0, 128) : '';
        const unit = typeof value.unit === 'string' ? value.unit.trim().slice(0, 40) : '';
        const actualUnit = unit.normalize('NFKC').toLowerCase();
        const profileUnit = hint.unit.normalize('NFKC').trim().toLowerCase();
        // Messwerte zeigen ihre Quell-Einheit an. Befehle rechnen keine Einheiten um.
        const temperatureReading = hint.direction === 'read' && profileUnit === '°c'
            && hint.roles.includes('value.temperature') && temperatureUnits.has(actualUnit);
        if (actualUnit && profileUnit && actualUnit !== profileUnit && !temperatureReading)
            return null;
        const name = typeof value.name === 'string' ? value.name.slice(0, 300) : '';
        const roleMatch = hint.roles.includes(role);
        let nameMatch = false;
        if (!roleMatch && genericRoles.has(role) && hint.keywords.length) {
            const text = ` ${normalizeWords(`${value.id} ${name}`)} `;
            nameMatch = hint.keywords.some(keyword => text.includes(` ${keyword} `));
        }
        return { id: value.id, name, role, type: value.type, unit, read: value.read === true, write: value.write === true,
            match: roleMatch ? 'role' : nameMatch ? 'name' : 'type' };
    }
    /** Deutsche und englische Funktionsbegriffe führen zum selben Profilfilter. Ortsnamen und IDs bleiben echte Suchbegriffe. */
    function profileSearchQuery(query, hint) {
        const normalized = normalizeWords(query);
        return hint.keywords.includes(normalized) || directionTerms[hint.direction].includes(normalized) ? '' : query;
    }
    function key(value) {
        return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value) && !forbidden.has(value);
    }
    function fieldKey(value) {
        return typeof value === 'string' && value.length <= 80 && /^[A-Z][A-Z0-9_]*(?:%d)?$/.test(value) && !forbidden.has(value);
    }
    function dpId(value) {
        return typeof value === 'string' && value.length > 0 && value.length <= 512
            && value === value.trim() && !/[\u0000-\u0020\u007f*?\[\]{}]/.test(value)
            && !/^(?:system\.|admin\.\d+(?:\.|$))/i.test(value)
            && !/(?:^|\.)(?:__proto__|prototype|constructor|password|passwd|secret|token|credentials?|privatekey|private_key)(?:\.|$)/i.test(value);
    }
    function copyMapping(value) {
        if (value === null || value === undefined)
            return null;
        if (!record(value) || !key(value.profile) || !Array.isArray(value.fields) || value.fields.length > maxFields)
            throw new Error('Ungültige gespeicherte Profilzuordnung. Die vorhandenen Daten bleiben erhalten.');
        const result = { profile: value.profile, fields: [] };
        const seen = new Set();
        for (const field of value.fields) {
            if (!record(field) || !fieldKey(field.key) || seen.has(field.key))
                throw new Error('Ungültige oder doppelte Profilfelder. Die vorhandenen Daten bleiben erhalten.');
            seen.add(field.key);
            const row = { key: field.key };
            for (const direction of ['readId', 'writeId']) {
                const value = field[direction];
                if (value !== null && value !== undefined && value !== '') {
                    if (!dpId(value))
                        throw new Error('Ungültige Datenpunkt-ID im Bedienprofil. Die vorhandenen Daten bleiben erhalten.');
                    row[direction] = value;
                }
            }
            result.fields.push(row);
        }
        return result;
    }
    function validationError(value, required) {
        for (const editor of invalidEditors) {
            if (!editor.isConnected)
                invalidEditors.delete(editor);
        }
        if (invalidEditors.size)
            return 'Bitte die ungültigen Datenpunkt-Eingaben im Bedienprofil korrigieren; gespeichert wird erst nach der Korrektur.';
        try {
            const mapping = copyMapping(value);
            if (required && (!mapping || !mapping.fields.some(field => field.readId || field.writeId)))
                return 'Bitte ein Bedienprofil wählen und mindestens einen Datenpunkt zuordnen.';
            return null;
        }
        catch (error) {
            return error instanceof Error ? error.message : 'Ungültige Profilzuordnung.';
        }
    }
    function profiles(value) {
        if (!record(value) || value.ok !== true || !Array.isArray(value.profiles) || value.profiles.length > 128 || value.profiles.length === 0)
            throw new Error('Der Bedienprofil-Katalog ist ungültig.');
        const ids = new Set();
        return value.profiles.map((profile) => {
            if (!record(profile) || !key(profile.id) || ids.has(profile.id) || typeof profile.label !== 'string' || profile.label.length > 240 || !Array.isArray(profile.fields) || profile.fields.length > maxFields)
                throw new Error('Der Bedienprofil-Katalog ist ungültig.');
            ids.add(profile.id);
            const seen = new Set();
            const fields = profile.fields.map((field) => {
                if (!record(field) || !fieldKey(field.key) || seen.has(field.key) || typeof field.label !== 'string' || field.label.length > 240 || typeof field.type !== 'string' || field.type.length > 32 || typeof field.read !== 'boolean' || typeof field.write !== 'boolean')
                    throw new Error('Der Bedienprofil-Katalog enthält ungültige Felder.');
                seen.add(field.key);
                const allowedTypes = field.types;
                const types = Array.isArray(allowedTypes) ? scalarTypes.filter(type => allowedTypes.includes(type))
                    : scalarType(field.type) ? [field.type] : field.type === 'mixed' ? scalarTypes : [];
                return { key: field.key, label: field.label, type: field.type, types, read: field.read, write: field.write,
                    unit: typeof field.unit === 'string' ? field.unit.slice(0, 40) : '', required: field.required === true };
            });
            return { id: profile.id, label: profile.label, fields };
        });
    }
    function fieldFor(profile, name) {
        if (!profile)
            return undefined;
        const exact = profile.fields.find(field => field.key === name);
        if (exact)
            return exact;
        const template = profile.fields.find(field => field.key.endsWith('%d') && name.startsWith(field.key.slice(0, -2)) && /^\d{1,3}$/.test(name.slice(field.key.length - 2)));
        if (template)
            return { ...template, key: name, label: `${template.label} · ${name.slice(template.key.length - 2)}` };
        if (profile.id === 'universal' && fieldKey(name))
            return { key: name, label: name, type: 'mixed', types: scalarTypes, unit: '', read: true, write: true, required: false };
        return undefined;
    }
    async function readCatalog() {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch('/api/smarthome/control-profiles', { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
            if (!response.ok)
                throw new Error(response.status === 401 ? 'Sitzung abgelaufen. Bitte erneut bei EOS anmelden.' : response.status === 403 ? 'Keine Berechtigung für die SmartHome-Konfiguration.' : 'Bedienprofile sind derzeit nicht verfügbar.');
            if (!response.body)
                throw new Error('Der Bedienprofil-Katalog ist leer.');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let bytes = 0;
            let text = '';
            try {
                for (;;) {
                    const chunk = await reader.read();
                    if (chunk.done)
                        break;
                    bytes += chunk.value.byteLength;
                    if (bytes > maxResponseBytes) {
                        controller.abort();
                        throw new Error('Der Bedienprofil-Katalog überschreitet die erlaubte Größe.');
                    }
                    text += decoder.decode(chunk.value, { stream: true });
                }
                text += decoder.decode();
            }
            finally {
                reader.releaseLock();
            }
            const parsed = JSON.parse(text);
            const result = profiles(parsed);
            customViews = record(parsed) && Array.isArray(parsed.customViews) ? parsed.customViews : [];
            return result;
        }
        catch (error) {
            if (controller.signal.aborted)
                throw new Error('Bedienprofile konnten nicht vollständig geladen werden. Bitte erneut versuchen.');
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }
    function load() {
        if (!catalog)
            catalog = readCatalog().catch((error) => { catalog = null; throw error; });
        return catalog;
    }
    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node;
    }
    function button(label, callback) {
        const node = element('button', 'nw-config-btn nw-sh-profile__button', label);
        node.type = 'button';
        node.addEventListener('click', callback);
        return node;
    }
    function mount(container, initial, options) {
        const root = element('details', 'nw-sh-profile');
        root.open = options.expanded === true;
        const heading = element('summary', 'nw-sh-profile__heading', 'Vollständige Gerätebedienung');
        root.appendChild(heading);
        root.appendChild(element('p', 'nw-sh-profile__intro', 'Bedienprofil auswählen und die verfügbaren Funktionen mit Datenpunkten verbinden. Lesen und Schreiben werden getrennt zugeordnet. Räume und Funktionen bleiben frei wählbar.'));
        const status = element('p', 'nw-sh-profile__status', 'Bedienprofile werden geladen …');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        root.appendChild(status);
        container.appendChild(root);
        let mapping;
        try {
            mapping = copyMapping(initial);
        }
        catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Die vorhandene Zuordnung konnte nicht gelesen werden.';
            status.dataset.state = 'error';
            return;
        }
        const content = element('div', 'nw-sh-profile__content');
        root.appendChild(content);
        const invalidFields = new Set();
        function commit(next) {
            mapping = copyMapping(next);
            options.onChange(copyMapping(next));
            status.textContent = 'Zuordnung im Entwurf geändert. Oben „Speichern“ wählen, um sie zu übernehmen.';
            status.dataset.state = 'draft';
        }
        function render(all) {
            invalidFields.clear();
            invalidEditors.delete(root);
            content.replaceChildren();
            const current = mapping ? all.find(profile => profile.id === mapping?.profile) : undefined;
            const controls = element('div', 'nw-sh-profile__selector');
            const select = element('select', 'nw-config-select nw-sh-profile__select');
            select.setAttribute('aria-label', 'Bedienprofil');
            const empty = element('option', '', 'Kein zusätzliches Bedienprofil');
            empty.value = '';
            select.appendChild(empty);
            if (mapping && !current) {
                const missing = element('option', '', `Nicht verfügbar: ${mapping.profile}`);
                missing.value = mapping.profile;
                select.appendChild(missing);
            }
            for (const profile of all) {
                const option = element('option', '', `${profile.label} · ${profile.id}`);
                option.value = profile.id;
                select.appendChild(option);
            }
            select.value = mapping?.profile || '';
            select.disabled = !!options.fixedProfile;
            const changeNote = element('p', 'nw-sh-profile__change-note');
            changeNote.hidden = true;
            const apply = button('Profil übernehmen', () => {
                const chosen = all.find(profile => profile.id === select.value);
                if (select.value && !chosen)
                    return;
                const proposed = chosen ? { profile: chosen.id, fields: [] } : null;
                const removed = [];
                for (const row of mapping?.fields || []) {
                    const target = fieldFor(chosen, row.key);
                    const kept = { key: row.key };
                    if (row.readId) {
                        if (target?.read)
                            kept.readId = row.readId;
                        else
                            removed.push(`${row.key} (Lesen)`);
                    }
                    if (row.writeId) {
                        if (target?.write)
                            kept.writeId = row.writeId;
                        else
                            removed.push(`${row.key} (Schreiben)`);
                    }
                    if (proposed && (kept.readId || kept.writeId))
                        proposed.fields.push(kept);
                }
                if (removed.length && !window.confirm(`Beim Profilwechsel entfallen folgende Zuordnungen im Entwurf:\n${removed.join(', ')}\n\nProfil trotzdem übernehmen? Gerätewerte werden dabei nicht geschrieben.`))
                    return;
                commit(proposed);
                render(all);
            });
            apply.disabled = true;
            apply.hidden = !!options.fixedProfile;
            select.addEventListener('change', () => {
                apply.disabled = select.value === (mapping?.profile || '');
                changeNote.hidden = apply.disabled;
                changeNote.textContent = 'Ein Profilwechsel wird erst mit „Profil übernehmen“ in den Entwurf übernommen. Gemeinsame Zuordnungen bleiben erhalten; entfallende Zuordnungen werden vorher angezeigt.';
            });
            controls.appendChild(select);
            controls.appendChild(apply);
            content.appendChild(controls);
            content.appendChild(changeNote);
            if (options.fixedProfile)
                content.appendChild(element('p', 'nw-sh-profile__hint', 'Das Bedienprofil gehört zur ausgewählten eigenen Ansicht. Den Ansichtstyp im Abschnitt „Eigene Ansicht“ ändern.'));
            if (!mapping) {
                content.appendChild(element('p', 'nw-sh-profile__hint', 'Die vorhandene Kachelbedienung bleibt erhalten. Ein Profil ergänzt weitere Bedien- und Anzeigefunktionen.'));
                return;
            }
            if (!current) {
                content.appendChild(element('p', 'nw-sh-profile__warning', 'Das gespeicherte Profil ist im aktuellen Katalog nicht verfügbar. Seine Zuordnungen bleiben erhalten. Ein anderes Profil nur nach Prüfung übernehmen.'));
            }
            const known = new Set((current?.fields || []).map(field => field.key));
            const extra = mapping.fields.filter(field => !known.has(field.key));
            const sourceFields = [...(current?.fields || []), ...extra.map(row => fieldFor(current, row.key) || { key: row.key, label: row.key, type: 'unbekannt', types: [], unit: '', read: true, write: true, required: false })];
            function addField(name) {
                if (!mapping || !fieldKey(name) || !fieldFor(current, name))
                    return;
                if (mapping.fields.some(field => field.key === name)) {
                    status.textContent = 'Diese Funktion ist bereits angelegt.';
                    return;
                }
                if (mapping.fields.length >= maxFields) {
                    status.textContent = 'Maximal 128 Profilfunktionen können zugeordnet werden.';
                    status.dataset.state = 'error';
                    return;
                }
                commit({ profile: mapping.profile, fields: [...mapping.fields, { key: name }] });
                render(all);
            }
            if (current?.id === 'universal') {
                const add = element('div', 'nw-sh-profile__selector');
                const name = element('input', 'nw-config-input');
                name.type = 'text';
                name.maxLength = 64;
                name.placeholder = 'Funktionsschlüssel, z. B. CUSTOM_VALUE';
                name.setAttribute('aria-label', 'Universellen Funktionsschlüssel hinzufügen');
                add.appendChild(name);
                add.appendChild(button('Funktion hinzufügen', () => {
                    const value = name.value.trim();
                    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(value)) {
                        status.textContent = 'Funktionsschlüssel: Großbuchstaben, Ziffern und Unterstriche; maximal 64 Zeichen, beginnend mit einem Buchstaben.';
                        status.dataset.state = 'error';
                        return;
                    }
                    addField(value);
                }));
                content.appendChild(add);
            }
            const search = element('input', 'nw-config-input nw-sh-profile__search');
            search.type = 'search';
            search.placeholder = 'Funktion oder Datenpunkt suchen …';
            search.setAttribute('aria-label', 'Profilfunktionen filtern');
            content.appendChild(search);
            const summary = element('p', 'nw-sh-profile__hint', `${sourceFields.length} Funktionen verfügbar. Nicht benötigte Datenpunkte können leer bleiben. Ein Pflicht-Hinweis bezieht sich auf die automatische Erkennung.`);
            content.appendChild(summary);
            const fields = element('div', 'nw-sh-profile__fields');
            content.appendChild(fields);
            const filterRows = [];
            for (const field of sourceFields) {
                const unknown = !fieldFor(current, field.key);
                const row = element('section', 'nw-sh-profile__field');
                row.dataset.profileKey = field.key;
                row.appendChild(element('h5', 'nw-sh-profile__field-title', field.label || field.key));
                row.appendChild(element('p', 'nw-sh-profile__field-meta', `${field.key} · ${field.type}${field.unit ? ` · ${field.unit}` : ''}${field.required ? ' · Für Erkennung vorgesehen' : ' · Optional'}`));
                if (unknown)
                    row.appendChild(element('p', 'nw-sh-profile__warning', 'Nicht im aktuellen Profilkatalog. Bestehende Zuordnung bleibt erhalten; bitte vor dem Speichern prüfen.'));
                if (field.key.endsWith('%d') && !mapping.fields.some(item => item.key === field.key && (item.readId || item.writeId))) {
                    row.appendChild(element('p', 'nw-sh-profile__hint', 'Wettervorlage: Tagesindex auswählen, danach den konkreten Datenpunkt zuordnen.'));
                    const day = element('input', 'nw-config-input');
                    day.type = 'number';
                    day.min = '0';
                    day.max = '999';
                    day.step = '1';
                    day.value = '0';
                    day.setAttribute('aria-label', `${field.label}: Tagesindex`);
                    row.appendChild(day);
                    row.appendChild(button('Tagesfunktion hinzufügen', () => {
                        const index = Number(day.value);
                        if (!/^\d{1,3}$/.test(day.value) || !Number.isInteger(index) || index < 0 || index > 999) {
                            status.textContent = 'Tagesindex muss eine ganze Zahl zwischen 0 und 999 sein.';
                            status.dataset.state = 'error';
                            return;
                        }
                        addField(field.key.slice(0, -2) + String(index));
                    }));
                    fields.appendChild(row);
                    filterRows.push({ node: row, matches: () => `${field.key} ${field.label}`.toLocaleLowerCase('de') });
                    continue;
                }
                for (const direction of ['readId', 'writeId']) {
                    const enabled = direction === 'readId' ? field.read : field.write;
                    const existing = mapping.fields.find(item => item.key === field.key)?.[direction];
                    if (!enabled && !existing)
                        continue;
                    const label = direction === 'readId' ? 'Lesen (Rückmeldung)' : 'Schreiben (Befehl)';
                    const picker = options.createDpInput(label, existing || '', value => {
                        if (!mapping)
                            return;
                        const trimmed = value.trim();
                        const editKey = `${field.key}.${direction}`;
                        if (trimmed && !dpId(trimmed)) {
                            invalidFields.add(editKey);
                            invalidEditors.add(root);
                            status.textContent = 'Konkrete Geräte-Datenpunkt-ID erforderlich: maximal 512 Zeichen, ohne Platzhalter, System- oder Geheimniszugriff.';
                            status.dataset.state = 'error';
                            return;
                        }
                        invalidFields.delete(editKey);
                        if (!invalidFields.size)
                            invalidEditors.delete(root);
                        const next = copyMapping(mapping);
                        if (!next)
                            return;
                        let target = next.fields.find(item => item.key === field.key);
                        if (!target && trimmed) {
                            if (next.fields.length >= maxFields) {
                                status.textContent = 'Maximal 128 Profilfunktionen können zugeordnet werden.';
                                status.dataset.state = 'error';
                                return;
                            }
                            target = { key: field.key };
                            next.fields.push(target);
                        }
                        if (target) {
                            if (trimmed)
                                target[direction] = trimmed;
                            else
                                delete target[direction];
                            next.fields = next.fields.filter(item => item.readId || item.writeId);
                        }
                        commit(next);
                    }, current && !unknown && enabled ? pickerHint(current.id, field, direction === 'readId' ? 'read' : 'write') : undefined);
                    if (!enabled || unknown)
                        picker.appendChild(element('p', 'nw-sh-profile__warning', 'Diese Zuordnung wird vom aktuellen Profil nicht unterstützt. Entfernen oder ein passendes Profil auswählen.'));
                    row.appendChild(picker);
                }
                if (unknown)
                    row.appendChild(button('Unbekannte Zuordnung entfernen', () => {
                        if (!mapping || !window.confirm(`Zuordnung „${field.key}“ aus dem Entwurf entfernen?`))
                            return;
                        commit({ profile: mapping.profile, fields: mapping.fields.filter(item => item.key !== field.key) });
                        render(all);
                    }));
                filterRows.push({ node: row, matches: () => `${field.key} ${field.label} ${(mapping?.fields.find(item => item.key === field.key)?.readId) || ''} ${(mapping?.fields.find(item => item.key === field.key)?.writeId) || ''}`.toLocaleLowerCase('de') });
                fields.appendChild(row);
            }
            search.addEventListener('input', () => {
                const query = search.value.trim().toLocaleLowerCase('de');
                let visible = 0;
                for (const row of filterRows) {
                    row.node.hidden = !!query && !row.matches().includes(query);
                    if (!row.node.hidden)
                        visible++;
                }
                summary.textContent = `${visible} von ${sourceFields.length} Funktionen angezeigt. Nicht benötigte Datenpunkte können leer bleiben.`;
            });
        }
        function start() {
            status.textContent = 'Bedienprofile werden geladen …';
            status.dataset.state = 'loading';
            void load().then(all => {
                if (!root.isConnected)
                    return;
                status.textContent = 'Manuelle Zuordnung und Datenpunktauswahl ändern nur die Konfiguration, keine Gerätewerte.';
                status.dataset.state = 'ready';
                render(all);
            }).catch((error) => {
                if (!root.isConnected)
                    return;
                status.textContent = error instanceof Error ? error.message : 'Bedienprofile konnten nicht geladen werden.';
                status.dataset.state = 'error';
                content.replaceChildren(button('Erneut laden', start));
            });
        }
        let started = false;
        const ensureLoaded = () => { if (root.open && !started) {
            started = true;
            start();
        } };
        root.addEventListener('toggle', ensureLoaded);
        ensureLoaded();
    }
    async function loadCustomViews() { await load(); return customViews; }
    host.NW_SH_DEVICE_CONFIG = Object.freeze({ mount, validationError, loadCustomViews, profileCandidate, profileSearchQuery });
})();
