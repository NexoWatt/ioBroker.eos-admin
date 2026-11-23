/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-layout-editor.ts
 * Quell-Hash: sha256:4012c7f9aa0b6619304fd35bc20b4a1d45eb93f099b178f6dce684253903eb4a
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-layout-editor.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_LAYOUT_EDITOR)
        return;
    const types = { switch: 'Schalter', dimmer: 'Dimmer', color: 'Farblicht', blind: 'Beschattung', rtr: 'Klima', scene: 'Szene', sensor: 'Sensor', player: 'Medien', camera: 'Kamera', widget: 'Widget', device: 'Gerät', logicStatus: 'Logikstatus' };
    const customNames = { clock: 'Uhr', gauge: 'Messinstrument', wind: 'Wind', presence: 'Anwesenheit', markdown: 'Notiz', iframe: 'Webansicht', universal: 'Universalansicht', energyFlow: 'Energiefluss', weather: 'Wetter', newline: 'Zeilenumbruch' };
    function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
    function identifier(value) { return typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value); }
    function devices(value) {
        if (!Array.isArray(value) || value.length > 2000)
            throw new Error('Geräteliste fehlt oder enthält mehr als 2000 Einträge.');
        const seen = new Set();
        return value.map((item, index) => {
            if (!record(item) || !identifier(item.id) || seen.has(item.id))
                throw new Error('Geräte-IDs fehlen oder sind doppelt. Anordnung wurde nicht geändert.');
            seen.add(item.id);
            const roomId = identifier(item.roomId) ? item.roomId : '';
            const floorId = !roomId && identifier(item.floorId) ? item.floorId : '';
            const kind = record(item.customView) && typeof item.customView.kind === 'string' ? item.customView.kind : '';
            const rawType = typeof item.type === 'string' ? item.type : 'device';
            return { id: item.id, name: typeof item.alias === 'string' && item.alias ? item.alias.slice(0, 240) : typeof item.name === 'string' && item.name ? item.name.slice(0, 240) : item.id,
                type: (kind && Object.hasOwn(customNames, kind) ? customNames[kind] : undefined) || (Object.hasOwn(types, rawType) ? types[rawType] : undefined) || rawType.slice(0, 80), roomId, floorId,
                group: roomId ? `room:${roomId}` : floorId ? `floor:${floorId}` : 'none',
                order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : Number.MAX_SAFE_INTEGER, index };
        });
    }
    function sorted(items) { return items.slice().sort((a, b) => a.order - b.order || a.index - b.index); }
    function reorder(input, sourceId, targetId, operation) {
        if (!['before', 'after', 'swap'].includes(operation))
            throw new Error('Ungültige Positionsänderung.');
        const all = devices(input);
        const source = all.find(item => item.id === sourceId);
        const target = all.find(item => item.id === targetId);
        if (!source || !target)
            throw new Error('Die ausgewählte Kachel ist nicht mehr vorhanden.');
        if (source.group !== target.group)
            throw new Error('Positionen können nur innerhalb desselben Raums getauscht oder verschoben werden. Den Raum unter Geräteeinstellungen ändern.');
        if (source.id === target.id)
            return [];
        const group = sorted(all.filter(item => item.group === source.group));
        const from = group.findIndex(item => item.id === source.id);
        const to = group.findIndex(item => item.id === target.id);
        const next = group.slice();
        if (operation === 'swap') {
            next[from] = target;
            next[to] = source;
        }
        else {
            next.splice(from, 1);
            const at = next.findIndex(item => item.id === target.id);
            next.splice(at + (operation === 'after' ? 1 : 0), 0, source);
        }
        if (next.every((item, index) => item.id === group[index]?.id))
            return [];
        const oldOrders = group.map(item => item.order);
        const keepSlots = oldOrders.every(order => Number.isFinite(order) && order !== Number.MAX_SAFE_INTEGER) && new Set(oldOrders).size === oldOrders.length;
        return next.map((item, index) => ({ id: item.id, order: keepSlots ? oldOrders[index] ?? index + 1 : index + 1 }));
    }
    function names(value) {
        if (!Array.isArray(value) || value.length > 2000)
            return new Map();
        const map = new Map();
        for (const item of value)
            if (record(item) && identifier(item.id))
                map.set(item.id, typeof item.name === 'string' && item.name ? item.name.slice(0, 240) : item.id);
        return map;
    }
    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node;
    }
    function button(label, callback) {
        const node = element('button', 'nw-config-btn nw-layout-editor__button', label);
        node.type = 'button';
        node.addEventListener('click', callback);
        return node;
    }
    function mount(container, options) {
        container.replaceChildren();
        const root = element('section', 'nw-layout-editor');
        root.dataset.mode = options.mode || 'layout';
        container.appendChild(root);
        const status = element('p', 'nw-layout-editor__status');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        let all;
        try {
            all = devices(options.devices);
        }
        catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Geräteliste konnte nicht geladen werden.';
            root.appendChild(status);
            return;
        }
        const roomNames = names(options.rooms);
        const floorNames = names(options.floors);
        const preferences = options.preferences || {};
        const editing = options.mode === 'devices';
        const toolbar = element('div', 'nw-layout-editor__toolbar');
        const search = element('input', 'nw-config-input nw-layout-editor__search');
        search.type = 'search';
        search.placeholder = 'Gerät, Typ oder ID suchen …';
        search.value = preferences.query || '';
        search.setAttribute('aria-label', 'Geräteliste durchsuchen');
        const filter = element('select', 'nw-config-select nw-layout-editor__room-filter');
        filter.setAttribute('aria-label', 'Raum filtern');
        const groups = [...new Set(all.map(item => item.group))];
        const groupName = (group) => group.startsWith('room:') ? roomNames.get(group.slice(5)) || `Raum ${group.slice(5)}` : group.startsWith('floor:') ? `Ohne Raum · ${floorNames.get(group.slice(6)) || group.slice(6)}` : 'Ohne Zuordnung';
        groups.sort((a, b) => groupName(a).localeCompare(groupName(b), 'de', { numeric: true }));
        for (const [value, label] of [['', 'Alle Räume'], ...groups.map(group => [group, groupName(group)])]) {
            const option = element('option', '', label || '');
            option.value = value || '';
            filter.appendChild(option);
        }
        filter.value = groups.includes(preferences.room || '') ? preferences.room || '' : '';
        toolbar.appendChild(search);
        toolbar.appendChild(filter);
        root.appendChild(toolbar);
        const hint = element('p', 'nw-layout-editor__hint', editing ? 'Gerät auswählen und die Einstellungen rechts bearbeiten. Die Suche berücksichtigt Name, Typ und ID.' : 'Kachel am Griff ziehen oder mit „Vor“ und „Zurück“ verschieben. Zwei Positionen lassen sich über die Auswahl tauschen. Änderungen gelten erst nach „Speichern“.');
        root.appendChild(hint);
        root.appendChild(status);
        const selection = element('div', 'nw-layout-editor__selection');
        root.appendChild(selection);
        const list = element('div', 'nw-layout-editor__groups');
        root.appendChild(list);
        let drag = null;
        let dragMode = 'before';
        function focusSelected(id) {
            const selected = Array.from(list.querySelectorAll('button[data-layout-select]')).find(node => node.dataset.layoutSelect === id);
            selected?.focus({ preventScroll: true });
        }
        function apply(source, target, operation) {
            try {
                const input = all.map(item => ({ id: item.id, roomId: item.roomId || null, floorId: item.floorId || null, order: item.order }));
                const patches = reorder(input, source, target, operation);
                if (!patches.length)
                    return;
                if (options.onChange(patches) === false) {
                    status.textContent = 'Der Entwurf wurde zwischenzeitlich geändert. Bitte die Ansicht erneut öffnen.';
                    return;
                }
                const orders = new Map(patches.map(patch => [patch.id, patch.order]));
                all = all.map(item => orders.has(item.id) ? { ...item, order: orders.get(item.id) ?? item.order } : item);
                preferences.selectedId = source;
                status.textContent = operation === 'swap' ? 'Positionen im Entwurf getauscht. Bitte speichern.' : 'Kachelposition im Entwurf geändert. Bitte speichern.';
                render();
                focusSelected(source);
            }
            catch (error) {
                status.textContent = error instanceof Error ? error.message : 'Positionsänderung wurde nicht übernommen.';
            }
        }
        function renderSelection() {
            selection.replaceChildren();
            if (editing)
                return;
            const selected = all.find(item => item.id === preferences.selectedId);
            const dragLabel = element('label', 'nw-layout-editor__field');
            dragLabel.appendChild(element('span', '', 'Beim Ziehen'));
            const mode = element('select', 'nw-config-select');
            for (const [value, label] of [['before', 'Vor Ziel einfügen'], ['swap', 'Positionen tauschen']]) {
                const option = element('option', '', label);
                option.value = value || '';
                mode.appendChild(option);
            }
            mode.value = dragMode;
            mode.addEventListener('change', () => { dragMode = mode.value === 'swap' ? 'swap' : 'before'; });
            dragLabel.appendChild(mode);
            selection.appendChild(dragLabel);
            if (!selected) {
                selection.appendChild(element('p', 'nw-layout-editor__hint', 'Eine Kachel auswählen, um ihre Position gezielt zu ändern.'));
                return;
            }
            selection.appendChild(element('strong', 'nw-layout-editor__selected-name', selected.name));
            const target = element('select', 'nw-config-select');
            target.setAttribute('aria-label', 'Zielkachel für die Positionsänderung');
            for (const item of sorted(all.filter(item => item.group === selected.group && item.id !== selected.id))) {
                const option = element('option', '', item.name);
                option.value = item.id;
                target.appendChild(option);
            }
            selection.appendChild(target);
            for (const [operation, label] of [['before', 'Davor einfügen'], ['after', 'Dahinter einfügen'], ['swap', 'Positionen tauschen']]) {
                const action = button(label, () => { if (target.value)
                    apply(selected.id, target.value, operation); });
                action.disabled = !target.options.length;
                selection.appendChild(action);
            }
        }
        function render() {
            renderSelection();
            list.replaceChildren();
            const query = search.value.trim().toLocaleLowerCase('de');
            let shown = 0;
            for (const group of groups) {
                if (filter.value && filter.value !== group)
                    continue;
                const complete = sorted(all.filter(item => item.group === group));
                const visible = complete.filter(item => !query || `${item.name} ${item.type} ${item.id}`.toLocaleLowerCase('de').includes(query));
                if (!visible.length)
                    continue;
                const section = element('section', 'nw-layout-editor__group');
                section.appendChild(element('h3', 'nw-layout-editor__group-title', `${groupName(group)} · ${complete.length}`));
                const grid = element('div', 'nw-layout-editor__grid');
                section.appendChild(grid);
                for (const item of visible) {
                    shown++;
                    const position = complete.findIndex(candidate => candidate.id === item.id);
                    const card = element('article', 'nw-layout-editor__tile');
                    card.dataset.layoutId = item.id;
                    if (item.id === preferences.selectedId)
                        card.dataset.selected = 'true';
                    const head = element('div', 'nw-layout-editor__tile-head');
                    head.appendChild(element('span', 'nw-layout-editor__position', `${position + 1}`));
                    const select = button(item.name, () => { preferences.selectedId = item.id; render(); if (editing)
                        options.onEdit?.(item.id);
                    else
                        focusSelected(item.id); });
                    select.className = 'nw-layout-editor__name';
                    select.dataset.layoutSelect = item.id;
                    select.setAttribute('aria-label', `${item.name}: ${editing ? 'Einstellungen öffnen' : 'auswählen'}, Platz ${position + 1}`);
                    head.appendChild(select);
                    card.appendChild(head);
                    card.appendChild(element('p', 'nw-layout-editor__type', item.type));
                    card.appendChild(element('p', 'nw-layout-editor__id', item.id));
                    if (!editing) {
                        const actions = element('div', 'nw-layout-editor__tile-actions');
                        const handle = button('Ziehen', () => { preferences.selectedId = item.id; renderSelection(); });
                        handle.className += ' nw-layout-editor__drag';
                        handle.draggable = true;
                        handle.setAttribute('aria-label', `${item.name} ziehen; alternativ Vor und Zurück verwenden`);
                        handle.addEventListener('dragstart', event => { drag = item.id; if (event.dataTransfer) {
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('application/x-nexowatt-layout', item.id);
                        } card.dataset.dragging = 'true'; });
                        handle.addEventListener('dragend', () => { drag = null; delete card.dataset.dragging; for (const node of Array.from(list.querySelectorAll('[data-drop-target]')))
                            delete node.dataset.dropTarget; });
                        card.addEventListener('dragover', event => { const source = all.find(candidate => candidate.id === drag); if (source?.group !== item.group || source.id === item.id)
                            return; event.preventDefault(); card.dataset.dropTarget = 'true'; });
                        card.addEventListener('dragleave', () => { delete card.dataset.dropTarget; });
                        card.addEventListener('drop', event => { event.preventDefault(); const source = drag; drag = null; delete card.dataset.dropTarget; if (source)
                            apply(source, item.id, dragMode); });
                        const before = button('Vor', () => { const previous = complete[position - 1]; if (previous)
                            apply(item.id, previous.id, 'before'); });
                        before.disabled = position === 0;
                        before.setAttribute('aria-label', `${item.name} einen Platz nach vorn`);
                        const after = button('Zurück', () => { const next = complete[position + 1]; if (next)
                            apply(item.id, next.id, 'after'); });
                        after.disabled = position === complete.length - 1;
                        after.setAttribute('aria-label', `${item.name} einen Platz nach hinten`);
                        select.addEventListener('keydown', event => { if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key))
                            return; event.preventDefault(); const target = complete[position + (event.key === 'ArrowUp' ? -1 : 1)]; if (target)
                            apply(item.id, target.id, event.key === 'ArrowUp' ? 'before' : 'after'); });
                        actions.appendChild(handle);
                        actions.appendChild(before);
                        actions.appendChild(after);
                        card.appendChild(actions);
                    }
                    else if (options.onEdit)
                        card.appendChild(button('Bearbeiten', () => { preferences.selectedId = item.id; render(); options.onEdit?.(item.id); }));
                    grid.appendChild(card);
                }
                list.appendChild(section);
            }
            if (!shown)
                list.appendChild(element('p', 'nw-layout-editor__empty', all.length ? 'Keine Geräte für diesen Filter.' : 'Noch keine Geräte vorhanden. Geräte manuell anlegen oder über Auto-Erkennung übernehmen.'));
        }
        search.addEventListener('input', () => { preferences.query = search.value; render(); });
        filter.addEventListener('change', () => { preferences.room = filter.value; render(); });
        render();
    }
    host.NW_SH_LAYOUT_EDITOR = Object.freeze({ mount, reorder });
})();
