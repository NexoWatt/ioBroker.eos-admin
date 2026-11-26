/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Lokale Auswahl, kompakte Listen, Aktionsmenüs und transaktionale Formularfenster.
 * Daten und Wirkung: Textbasierte Darstellung sowie begrenztes Lesen der Erkennung.
 * Host besitzt Entwurf, Validierung, Aliasfreigabe und dauerhaftes Speichern.
 * Bei Änderungen: Menüebenen, Fokus, Abbruch, Entwurfsgrenzen, Antwortlimits und Pagination prüfen. */
interface NwSetupPreferences { floorId?: string; roomId?: string; query?: string }
interface NwSetupOptions {
  config: unknown; preferences: NwSetupPreferences;
  onEdit(kind: 'floor' | 'room' | 'device', id: string): void;
  onAdd(kind: 'floor' | 'room' | 'device'): void; onDetect(): void;
}
interface NwDetectionPreferences {
  selected?: string[]; query?: string; roomId?: string; showConfigured?: boolean; useAliases?: boolean;
  folder?: string; sourceFilter?: string; roomFilter?: string; filtersOpen?: boolean;
}
interface NwDetectionOptions {
  suggestions: unknown; rooms: unknown; preferences: NwDetectionPreferences; canAlias: boolean; busy?: boolean;
  onDetails(id: string): void; onImport(ids: string[], roomId: string): void;
}
interface NwSetupDialogOptions {
  title: string; description?: string; render(body: HTMLElement): void;
  onApply?: () => boolean | Promise<boolean>; onCancel?: () => void;
  beforeClose?: () => boolean; applyLabel?: string;
}
interface NwSetupDialogHandle { body: HTMLElement; close(): boolean; refresh(): void; isOpen(): boolean; setError(message: string): void }
interface NwSetupApi {
  mountSetup(container: HTMLElement, options: NwSetupOptions): void;
  mountDetection(container: HTMLElement, options: NwDetectionOptions): void;
  openDialog(options: NwSetupDialogOptions): NwSetupDialogHandle | null;
  cloneConfig(value: unknown): Record<string, unknown>;
  hasDialog(): boolean;
  readDetection(force: boolean): Promise<Record<string, unknown>>;
}
(function () {
  'use strict';
  const host: Window & { NW_SH_SETUP?: NwSetupApi } = window;
  if (host.NW_SH_SETUP) return;
  /**
   * Koordiniert ausschließlich die zwei statischen Aktionsmenüs der Einrichtung.
   * Native Details-/Summary-Bedienung bleibt erhalten; Wechsel, Außenklick,
   * Fokuswechsel und Escape schließen offene Menüs ohne Konfiguration oder API.
   * Ein Dialog erhält Escape weiterhin selbst, sobald der Fokus außerhalb liegt.
   */
  function bindActionMenus(): void {
    const menus = Array.from(document.querySelectorAll<HTMLDetailsElement>('.nw-setup-project-actions, .nw-shcfg-more'));
    if (menus.length === 0) return;
    const closeOthers = (keep?: HTMLDetailsElement): void => { for (const menu of menus) if (menu !== keep) menu.open = false; };
    for (const menu of menus) menu.addEventListener('toggle', () => { if (menu.open) closeOthers(menu); });
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const menu = menus.find(item => item.contains(target));
      if (!menu) { closeOthers(); return; }
      closeOthers(menu);
      if (target instanceof Element && target.closest('button,a[href]') && !target.closest('summary')) menu.open = false;
    });
    document.addEventListener('focusin', event => {
      const target = event.target;
      if (target instanceof Node) closeOthers(menus.find(menu => menu.contains(target)));
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const menu = menus.find(item => item.open && item.contains(document.activeElement));
      closeOthers();
      if (!menu) return;
      event.preventDefault();
      menu.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    });
  }
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value.slice(0, 300) : fallback;
  const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(record) : [];
  const id = (value: unknown): string => typeof value === 'string' && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';
  function cloneConfig(value: unknown): Record<string, unknown> {
    if (!record(value)) throw new Error('Konfigurationsentwurf fehlt.');
    const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }]; const seen = new Set<object>(); let count = 0;
    while (stack.length) {
      const item = stack.pop(); if (!item) break;
      if (++count > 200000 || item.depth > 40) throw new Error('Konfigurationsstruktur ist zu groß oder zu tief.');
      if (item.value && typeof item.value === 'object') {
        if (seen.has(item.value)) throw new Error('Zyklischer Konfigurationsentwurf.'); seen.add(item.value);
        for (const [key, child] of Object.entries(item.value)) {
          if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unzulässiger Konfigurationsschlüssel.');
          stack.push({ value: child, depth: item.depth + 1 });
        }
      }
    }
    const json = JSON.stringify(value);
    if (json.length > 4 * 1024 * 1024) throw new Error('Konfigurationsentwurf ist zu groß.');
    const clone: unknown = JSON.parse(json); if (!record(clone)) throw new Error('Ungültiger Konfigurationsentwurf.'); return clone;
  }
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content?: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); node.className = className; if (content !== undefined) node.textContent = content; return node; }
  function button(label: string, callback: () => void, primary = false): HTMLButtonElement { const node = el('button', 'nw-config-btn' + (primary ? ' nw-config-btn--primary' : ''), label); node.type = 'button'; node.addEventListener('click', callback); return node; }
  function selectField(label: string, options: { value: string; label: string }[], value: string, change: (value: string) => void): HTMLLabelElement {
    const field = el('label', 'nw-setup-field'); field.appendChild(el('span', '', label)); const select = el('select', 'nw-config-select');
    for (const option of options) { const node = el('option', '', option.label); node.value = option.value; select.appendChild(node); }
    select.value = value; select.addEventListener('change', () => change(select.value)); field.appendChild(select); return field;
  }
  const name = (row: Record<string, unknown>): string => text(row.alias) || text(row.name) || text(row.id, 'Unbenannt');
  const types: Record<string, string> = { device: 'Gerät', switch: 'Schalter', dimmer: 'Dimmer', color: 'Farblicht', blind: 'Beschattung', rtr: 'Raumklima', sensor: 'Sensor', player: 'Medien', camera: 'Kamera', scene: 'Szene', widget: 'Widget', logicStatus: 'Logikstatus' };
  const typeLabel = (value: unknown): string => typeof value === 'string' && Object.hasOwn(types, value) ? types[value] || 'Gerät' : text(value, 'Gerät');
  const discoveryFolders = [
    { id: 'all', label: 'Alle Geräte', keywords: '' },
    { id: 'switch', label: 'Schalten', keywords: 'schalter licht lampe steckdose ein aus an switch on off relay light lamp socket outlet' },
    { id: 'dimmer', label: 'Dimmen', keywords: 'dimmer dimmwert helligkeit lichtstärke dimming brightness light level' },
    { id: 'blind', label: 'Jalousie & Rollladen', keywords: 'jalousien rollläden rolladen rollo rollos raffstore beschattung blind blinds shutter roller shade' },
    { id: 'climate', label: 'Temperatur & Klima', keywords: 'heizung raumklima thermostat temperature climate heating' },
    { id: 'status', label: 'Status & Sensoren', keywords: 'zustand rückmeldung rueckmeldung messwert feedback actual status sensor' },
    { id: 'other', label: 'Weitere Funktionen', keywords: 'weitere sonstige other additional' },
    { id: 'review', label: 'Manuell prüfen', keywords: 'mehrdeutig unklar pruefen review manual ambiguous' },
  ] as const;
  type DiscoveryFolder = typeof discoveryFolders[number]['id'];
  type DetectionItem = {
    row: Record<string, unknown>; id: string; folders: Set<DiscoveryFolder>;
    sources: string[]; roomOptions: { value: string; label: string }[];
  };
  const searchMaxLength = 512;
  // These words describe existing fields. Shared profile keys such as SET and
  // ACTUAL need a specific device profile or an explicit ioBroker role.
  const fieldKeywords = new Map<string, string>([
    ['OPEN', 'auf öffnen auffahren open raise'], ['CLOSE', 'ab schließen abfahren close lower'], ['STOP', 'stopp anhalten stop'],
    ['TILT_SET', 'lamellenwinkel lamellen tilt slats'], ['TILT_ACTUAL', 'lamellenstatus lamellen tilt slats feedback'],
    ['TILT_OPEN', 'lamellen öffnen open slats'], ['TILT_CLOSE', 'lamellen schließen close slats'], ['TILT_STOP', 'lamellen stopp stop slats'],
    ['ON_ACTUAL', 'schaltstatus schaltzustand switch state'], ['HUMIDITY', 'luftfeuchte humidity'], ['LOWBAT', 'batterie schwach low battery'],
    ['BATTERY', 'batterie battery'], ['UNREACH', 'erreichbarkeit erreichbar reachability reachable offline'], ['ERROR', 'störung fehler fault error'],
    ['blind:SET', 'sollposition rollladenposition position setzen target position'], ['blind:ACTUAL', 'istposition rollladenposition positionsstatus actual position'],
    ['thermostat:SET', 'solltemperatur sollwert setpoint target temperature'], ['thermostat:ACTUAL', 'isttemperatur istwert actual temperature'],
    ['temperature:ACTUAL', 'isttemperatur istwert actual temperature'], ['humidity:ACTUAL', 'luftfeuchte humidity'],
    ['level.blind', 'sollposition rollladenposition position setzen target position'], ['value.blind', 'istposition rollladenposition positionsstatus actual position'],
    ['level.temperature', 'solltemperatur sollwert setpoint target temperature'], ['value.temperature', 'isttemperatur istwert actual temperature'],
    ['value.humidity', 'luftfeuchte humidity'], ['sensor.window', 'fensterkontakt fenster window contact'], ['sensor.door', 'türkontakt tür door contact'],
    ['sensor.motion', 'bewegung bewegungsmelder motion occupancy'],
  ]);
  const filterText = (value: string): string => value.toLocaleLowerCase('de').replace(/ß/g, 'ss').normalize('NFKD').replace(/\p{M}/gu, '');
  function discoveryMembership(row: Record<string, unknown>): Set<DiscoveryFolder> {
    const supplied: unknown[] = Array.isArray(row.functionCategories) ? row.functionCategories : [];
    const categories = new Set<DiscoveryFolder>(['all']);
    for (const folder of discoveryFolders) {
      if (supplied.includes(folder.id)) categories.add(folder.id);
    }
    if (categories.size === 1) {
      // Older detection responses already carry a validated device profile.
      // Profile names here affect presentation only, never a data point mapping.
      const profile = text(row.detectorType).toLowerCase();
      const kind = text(row.targetType);
      if (['light', 'socket', 'switch'].includes(profile) || kind === 'switch') categories.add('switch');
      if (profile === 'dimmer' || kind === 'dimmer') categories.add('dimmer');
      if (['blind', 'blinds', 'blindbuttons'].includes(profile) || kind === 'blind') categories.add('blind');
      if (['temperature', 'humidity', 'thermostat'].includes(profile) || kind === 'rtr') categories.add('climate');
      if (kind === 'sensor' || rows(row.states).some(state => state.indicator === true || (state.read === true && state.write !== true))) categories.add('status');
      if (categories.size === 1) categories.add('other');
    }
    if (row.importable !== true || row.discoveryReview === true) categories.add('review');
    return categories;
  }
  function sourceInstance(value: unknown): string {
    const match = /^([a-z0-9_-]+\.\d+)(?:\.|$)/i.exec(text(value));
    return match?.[1] || '';
  }
  function discoveryItems(input: unknown): DetectionItem[] {
    const result = new Map<string, DetectionItem>();
    const candidates: unknown[] = Array.isArray(input) ? input.slice(0, 10000) : [];
    for (const candidate of candidates) {
      if (!record(candidate)) continue;
      const key = id(candidate.id);
      if (!key || result.has(key)) continue;
      const sources = [...new Set([sourceInstance(candidate.sourceId), sourceInstance(candidate.displaySourceId)].filter(Boolean))];
      const metadata = record(candidate.metadata) ? candidate.metadata : {};
      const roomOptions = rows(metadata.rooms).slice(0, 32).flatMap(room => {
        const value = id(room.enumId) || id(room.id);
        return value && value !== '__none__' ? [{ value, label: text(room.name, value) }] : [];
      });
      result.set(key, { row: candidate, id: key, folders: discoveryMembership(candidate), sources, roomOptions });
    }
    return [...result.values()];
  }
  function discoverySearchText(item: DetectionItem): string {
    const { row } = item;
    const detectedType = text(row.detectorType).toLowerCase();
    const profile = detectedType === 'blinds' || detectedType === 'blindbuttons' ? 'blind' : detectedType;
    return filterText([
      name(row), text(row.displayName), text(row.sourceName), id(row.sourceId).slice(0, searchMaxLength), id(row.displaySourceId).slice(0, searchMaxLength), detectedType, typeLabel(row.targetType),
      ...item.roomOptions.map(room => room.label),
      ...discoveryFolders.filter(folder => item.folders.has(folder.id)).map(folder => `${folder.label} ${folder.keywords}`),
      ...rows(row.states).slice(0, 128).map(state => {
        const key = text(state.key); const role = text(state.role);
        const words = fieldKeywords.get(`${profile}:${key}`) || fieldKeywords.get(key) || fieldKeywords.get(role) || '';
        return `${id(state.id).slice(0, searchMaxLength)} ${key} ${text(state.label)} ${role} ${words}`;
      }),
    ].join(' '));
  }
  function mountSetup(container: HTMLElement, options: NwSetupOptions): void {
    container.replaceChildren(); const config = record(options.config) ? options.config : {};
    const floors = rows(config.floors); const rooms = rows(config.rooms); const devices = rows(config.devices); const p = options.preferences;
    if (p.floorId && p.floorId !== '__none__' && !floors.some(row => row.id === p.floorId)) p.floorId = '';
    const roomSet = (): Record<string, unknown>[] => rooms.filter(room => !p.floorId || (p.floorId === '__none__' ? !room.floorId : room.floorId === p.floorId));
    if (p.roomId && p.roomId !== '__none__' && !roomSet().some(row => row.id === p.roomId)) p.roomId = '';
    const heading = el('div', 'nw-setup-heading'); heading.appendChild(el('div', '', 'In wenigen Schritten zum passenden Raum.')); heading.appendChild(button('Geräte automatisch erkennen', () => options.onDetect(), true)); container.appendChild(heading);
    const filters = el('div', 'nw-setup-selectors');
    const meta = record(config.meta) ? config.meta : {};
    const project = selectField('Gebäude / Projekt', [{ value: 'project', label: text(meta.projectName) || text(meta.name) || 'Dieses EOS-Projekt' }], 'project', () => {});
    project.querySelector('select')?.setAttribute('aria-describedby', 'nw-setup-project-note'); filters.appendChild(project);
    const floorRow = el('div', 'nw-setup-selection-row');
    floorRow.appendChild(selectField('Geschoss', [{ value: '', label: 'Alle Geschosse' }, { value: '__none__', label: 'Ohne Geschoss' }, ...floors.map(row => ({ value: id(row.id), label: name(row) }))], p.floorId || '', value => { p.floorId = value; p.roomId = ''; mountSetup(container, options); }));
    floorRow.appendChild(button('+ Geschoss', () => options.onAdd('floor')));
    if (p.floorId && p.floorId !== '__none__') floorRow.appendChild(button('Bearbeiten', () => options.onEdit('floor', p.floorId || '')));
    filters.appendChild(floorRow);
    const roomRow = el('div', 'nw-setup-selection-row');
    roomRow.appendChild(selectField('Raum', [{ value: '', label: 'Alle Räume' }, { value: '__none__', label: 'Ohne Raum' }, ...roomSet().map(row => ({ value: id(row.id), label: name(row) }))], p.roomId || '', value => { p.roomId = value; mountSetup(container, options); }));
    roomRow.appendChild(button('+ Raum', () => options.onAdd('room')));
    if (p.roomId && p.roomId !== '__none__') roomRow.appendChild(button('Bearbeiten', () => options.onEdit('room', p.roomId || '')));
    filters.appendChild(roomRow); container.appendChild(filters);
    const projectNote = el('p', 'nw-setup-project-note', 'Ein EOS-Projekt umfasst die hier angelegten Geschosse und Räume.'); projectNote.id = 'nw-setup-project-note'; container.appendChild(projectNote);
    const toolbar = el('div', 'nw-setup-list-toolbar'); const search = el('input', 'nw-config-input'); search.type = 'search'; search.placeholder = 'Gerät suchen …'; search.setAttribute('aria-label', 'Geräte suchen'); search.value = p.query || ''; toolbar.appendChild(search); toolbar.appendChild(button('+ Gerät manuell anlegen', () => options.onAdd('device'))); container.appendChild(toolbar);
    const list = el('div', 'nw-setup-device-list'); container.appendChild(list);
    const render = (): void => {
      list.replaceChildren(); const query = search.value.trim().toLocaleLowerCase('de');
      const filtered = devices.filter(device => {
        const room = rooms.find(row => row.id === device.roomId); const floor = room ? room.floorId : device.floorId;
        return (!p.floorId || (p.floorId === '__none__' ? !floor : floor === p.floorId)) && (!p.roomId || (p.roomId === '__none__' ? !device.roomId : device.roomId === p.roomId)) && (!query || `${name(device)} ${text(device.id)} ${typeLabel(device.type)}`.toLocaleLowerCase('de').includes(query));
      });
      list.appendChild(el('p', 'nw-setup-count', `${filtered.length} Gerät${filtered.length === 1 ? '' : 'e'} in dieser Auswahl`));
      for (const device of filtered) {
        const row = el('article', 'nw-setup-device-row'); row.dataset.setupDevice = id(device.id);
        const info = el('div', 'nw-setup-device-info'); info.appendChild(el('strong', '', name(device)));
        const room = rooms.find(item => item.id === device.roomId); info.appendChild(el('span', '', `${typeLabel(device.type)} · ${room ? name(room) : 'Ohne Raum'}`)); row.appendChild(info);
        row.appendChild(button('Bearbeiten', () => options.onEdit('device', id(device.id)))); list.appendChild(row);
      }
      if (!filtered.length) list.appendChild(el('p', 'nw-config-empty', 'Noch keine Geräte in dieser Auswahl. Mit „Geräte automatisch erkennen“ starten oder ein Gerät manuell anlegen.'));
    };
    search.addEventListener('input', () => { p.query = search.value; render(); }); render();
  }
  function mountDetection(container: HTMLElement, options: NwDetectionOptions): void {
    container.replaceChildren();
    const p = options.preferences;
    const suggestions = discoveryItems(options.suggestions);
    const rooms = rows(options.rooms);
    const eligible = (row: Record<string, unknown>): boolean => row.importable === true && row.imported !== true && row.alreadyConfigured !== true;
    const eligibleIds = new Set(suggestions.filter(item => eligible(item.row)).map(item => item.id));
    const selected = new Set((p.selected || []).filter(key => eligibleIds.has(key)).slice(0, 100));
    p.selected = [...selected];
    let folder = discoveryFolders.find(item => item.id === p.folder)?.id ?? 'all';
    let page = 0;
    const pageSize = 100;
    const searchIndex = new Map<string, string>();
    let visiblePage: DetectionItem[] = [];

    const toolbar = el('div', 'nw-setup-detection-toolbar');
    const search = el('input', 'nw-config-input');
    search.type = 'search';
    search.maxLength = searchMaxLength;
    search.value = p.query || '';
    search.placeholder = 'Gerät, Funktion oder Datenpunkt suchen …';
    search.setAttribute('aria-label', 'Erkannte Geräte suchen');
    toolbar.appendChild(search);
    const targetRooms = [{ value: '', label: 'Bitte Zielraum auswählen' }, { value: '__none__', label: 'Ohne Raum übernehmen' },
      ...rooms.map(room => ({ value: id(room.id), label: name(room) }))];
    if (!targetRooms.some(room => room.value === p.roomId)) p.roomId = '';
    toolbar.appendChild(selectField('Zielraum für die Auswahl', targetRooms, p.roomId || '', value => { p.roomId = value; refreshActions(); }));
    const aliases = el('label', 'nw-setup-check');
    const alias = el('input');
    alias.type = 'checkbox';
    alias.checked = options.canAlias && p.useAliases !== false;
    alias.disabled = !options.canAlias || !!options.busy;
    p.useAliases = alias.checked;
    alias.addEventListener('change', () => { p.useAliases = alias.checked; });
    aliases.append(alias, el('span', '', 'Alias-Datenpunkte verwenden/anlegen' + (options.canAlias ? '' : ' (Berechtigung zur Gerätezuordnung erforderlich)')));
    toolbar.appendChild(aliases);
    const configured = el('label', 'nw-setup-check');
    const show = el('input');
    show.type = 'checkbox';
    show.checked = !!p.showConfigured;
    configured.append(show, el('span', '', 'Bereits zugeordnete Geräte zeigen'));
    toolbar.appendChild(configured);
    container.appendChild(toolbar);

    const sources = new Set<string>();
    const detectedRooms = new Map<string, string>();
    for (const item of suggestions) {
      for (const source of item.sources) sources.add(source);
      for (const room of item.roomOptions) detectedRooms.set(room.value, room.label);
    }
    if (sources.size || detectedRooms.size) {
      const filters = el('details', 'nw-setup-detection-filters');
      filters.open = !!(p.filtersOpen || p.sourceFilter || p.roomFilter);
      filters.addEventListener('toggle', () => { p.filtersOpen = filters.open; });
      filters.appendChild(el('summary', '', 'Nach Raum oder Adapter filtern'));
      const fields = el('div', 'nw-setup-detection-toolbar');
      // Keep filter controls small even for very large object lists. Search can
      // still reach every room name and source outside the first 100 options.
      const sourceOptions = [...sources].sort((a, b) => a.localeCompare(b, 'de')).slice(0, 100).map(value => ({ value, label: value }));
      const roomOptions = [...detectedRooms].sort((a, b) => a[1].localeCompare(b[1], 'de')).slice(0, 100).map(([value, label]) => ({ value, label }));
      if (!sourceOptions.some(option => option.value === p.sourceFilter)) p.sourceFilter = '';
      if (p.roomFilter !== '__none__' && !roomOptions.some(option => option.value === p.roomFilter)) p.roomFilter = '';
      fields.appendChild(selectField('Adapter', [{ value: '', label: 'Alle Adapter' }, ...sourceOptions], p.sourceFilter || '', value => { p.sourceFilter = value; resetPage(); }));
      fields.appendChild(selectField('Erkannter Raum', [{ value: '', label: 'Alle erkannten Räume' }, { value: '__none__', label: 'Ohne erkannten Raum' }, ...roomOptions], p.roomFilter || '', value => { p.roomFilter = value; resetPage(); }));
      filters.appendChild(fields);
      container.appendChild(filters);
    } else {
      p.sourceFilter = '';
      p.roomFilter = '';
    }
    if (options.busy) for (const select of container.querySelectorAll('select')) select.disabled = true;

    const folders = el('div', 'nw-setup-detection-folders');
    folders.setAttribute('role', 'group');
    folders.setAttribute('aria-label', 'Funktionsordner');
    const folderControls = discoveryFolders.map(item => {
      const control = button(item.label, () => { folder = item.id; p.folder = folder; resetPage(); });
      control.classList.add('nw-setup-detection-folder');
      control.dataset.detectionFolder = item.id;
      const total = el('span', 'nw-setup-detection-folder-count');
      control.appendChild(total);
      folders.appendChild(control);
      return { id: item.id, control, total };
    });
    container.appendChild(folders);

    const actions = el('div', 'nw-setup-batch-actions');
    const count = el('span');
    const importButton = button('Auswahl übernehmen', () => options.onImport([...selected], p.roomId || ''), true);
    const selectAll = button('Diese Seite auswählen', () => {
      const candidates = visiblePage.filter(item => eligibleIds.has(item.id)).map(item => item.id);
      const union = new Set([...selected, ...candidates]);
      if (union.size > 100) { status.textContent = 'Maximal 100 Geräte je Übernahme auswählen.'; return; }
      for (const key of candidates) selected.add(key);
      p.selected = [...selected];
      render();
    });
    const clear = button('Auswahl aufheben', () => { selected.clear(); p.selected = []; render(); });
    actions.append(count, importButton, selectAll, clear);
    container.appendChild(actions);
    const status = el('p', 'nw-setup-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    container.appendChild(status);
    const list = el('div', 'nw-setup-detection-list'); container.appendChild(list);
    const pagination = el('div', 'nw-setup-pagination');
    const previous = button('Zurück', () => { page--; render(); });
    const pageStatus = el('span');
    const next = button('Weiter', () => { page++; render(); });
    pagination.append(previous, pageStatus, next);
    container.appendChild(pagination);

    function matching(): DetectionItem[] {
      const terms = filterText(search.value.slice(0, searchMaxLength)).trim().split(/\s+/).filter(Boolean);
      return suggestions.filter(item => {
        const row = item.row;
        if (!p.showConfigured && (row.imported === true || (row.alreadyConfigured === true && !(record(row.update) && row.update.sourceChanged === true)))) return false;
        if (p.sourceFilter && !item.sources.includes(p.sourceFilter)) return false;
        if (p.roomFilter === '__none__' && item.roomOptions.length) return false;
        if (p.roomFilter && p.roomFilter !== '__none__' && !item.roomOptions.some(room => room.value === p.roomFilter)) return false;
        if (!terms.length) return true;
        let index = searchIndex.get(item.id);
        if (index === undefined) { index = discoverySearchText(item); searchIndex.set(item.id, index); }
        return terms.every(term => index.includes(term));
      });
    }
    function resetPage(): void { page = 0; status.textContent = ''; render(); }
    function refreshActions(): void {
      count.textContent = `${selected.size} ausgewählt`;
      importButton.disabled = !selected.size || !p.roomId || !!options.busy;
      selectAll.disabled = !!options.busy || !visiblePage.some(item => eligibleIds.has(item.id) && !selected.has(item.id));
      clear.disabled = !selected.size || !!options.busy;
    }
    function render(): void {
      list.replaceChildren();
      const matches = matching();
      const totals = new Map<DiscoveryFolder, number>();
      for (const item of matches) for (const key of item.folders) totals.set(key, (totals.get(key) || 0) + 1);
      for (const entry of folderControls) {
        entry.control.setAttribute('aria-pressed', String(entry.id === folder));
        entry.total.textContent = ` ${totals.get(entry.id) || 0}`;
      }
      const activeItems = matches.filter(item => item.folders.has(folder));
      const pageCount = Math.max(1, Math.ceil(activeItems.length / pageSize));
      page = Math.min(Math.max(0, page), pageCount - 1);
      visiblePage = activeItems.slice(page * pageSize, (page + 1) * pageSize);
      refreshActions();
      previous.disabled = page === 0 || !!options.busy;
      next.disabled = page >= pageCount - 1 || !!options.busy;
      pageStatus.textContent = `${activeItems.length} Treffer · Seite ${page + 1} / ${pageCount}`;
      for (const item of visiblePage) {
        const entry = item.row;
        const row = el('article', 'nw-setup-detection-row');
        row.dataset.detectId = item.id;
        const displayName = text(entry.displayName, name(entry));
        const check = el('input');
        check.type = 'checkbox';
        check.checked = selected.has(item.id);
        check.disabled = !eligibleIds.has(item.id) || !!options.busy;
        check.setAttribute('aria-label', `${displayName} auswählen`);
        check.addEventListener('change', () => {
          if (check.checked && selected.size >= 100) { check.checked = false; status.textContent = 'Maximal 100 Geräte je Übernahme auswählen.'; return; }
          if (check.checked) selected.add(item.id); else selected.delete(item.id);
          p.selected = [...selected];
          refreshActions();
        });
        row.appendChild(check);
        const info = el('div', 'nw-setup-device-info');
        const location = [typeLabel(entry.targetType), item.roomOptions[0]?.label, item.sources[0]].filter(Boolean).join(' · ');
        info.append(el('strong', '', displayName), el('span', '', location));
        const sample = rows(entry.states).slice(0, 2).map(state => `${text(state.label) || text(state.key)} → ${text(state.id)}`).join(' · ');
        info.appendChild(el('small', '', sample || text(entry.sourceId)));
        row.appendChild(info);
        const state = entry.imported === true ? 'Übernommen' : record(entry.update) && entry.update.sourceChanged === true ? 'Änderungen prüfen' : entry.alreadyConfigured === true ? 'Bereits im Projekt' : item.folders.has('review') ? 'Manuell prüfen' : 'Bereit zur Übernahme';
        row.appendChild(el('span', 'nw-setup-detection-state', state));
        const detail = button('Details prüfen', () => options.onDetails(item.id));
        detail.disabled = !!options.busy;
        row.appendChild(detail);
        list.appendChild(row);
      }
      if (!activeItems.length) list.appendChild(el('p', 'nw-config-empty', 'Keine Vorschläge in diesem Ordner. Anderen Ordner wählen oder Filter anpassen.'));
    }
    show.addEventListener('change', () => { p.showConfigured = show.checked; resetPage(); });
    search.addEventListener('input', () => { p.query = search.value.slice(0, searchMaxLength); resetPage(); });
    render();
  }
  let active: NwSetupDialogHandle | null = null;
  function openDialog(options: NwSetupDialogOptions): NwSetupDialogHandle | null {
    if (active) return null;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = el('div', 'nw-setup-dialog-backdrop'); const dialog = el('section', 'nw-setup-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'nw-setup-dialog-title'); dialog.tabIndex = -1;
    const header = el('header', 'nw-setup-dialog-header'); const title = el('h2', '', options.title); title.id = 'nw-setup-dialog-title'; header.appendChild(title); dialog.appendChild(header);
    if (options.description) { const description = el('p', 'nw-setup-dialog-description', options.description); description.id = 'nw-setup-dialog-description'; dialog.setAttribute('aria-describedby', description.id); dialog.appendChild(description); }
    const body = el('div', 'nw-setup-dialog-body'); dialog.appendChild(body);
    const status = el('p', 'nw-setup-dialog-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); dialog.appendChild(status);
    const footer = el('footer', 'nw-setup-dialog-footer'); let pending = false; let opened = true;
    const nested = (): HTMLElement | null => Array.from(document.querySelectorAll<HTMLElement>('.nw-dp-dialog-backdrop')).find(node => node.style.display !== 'none' && !node.classList.contains('hidden')) || null;
    const visibleInputs = (root: HTMLElement): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,a[href],[tabindex]')).filter(node => {
      if (node.hasAttribute('disabled') || node.getAttribute('tabindex') === '-1') return false;
      for (let current: HTMLElement | null = node; current && current !== root; current = current.parentElement) {
        if (current.hidden || current.style.display === 'none' || current.getAttribute('aria-hidden') === 'true') return false;
        if (typeof getComputedStyle === 'function' && (getComputedStyle(current).display === 'none' || getComputedStyle(current).visibility === 'hidden')) return false;
        if (current.tagName === 'DETAILS' && !current.hasAttribute('open')) {
          const summary = current.querySelector('summary'); if (!summary || (summary !== node && !summary.contains(node))) return false;
        }
      }
      return true;
    });
    function cleanup(cancelled: boolean): boolean {
      if (!opened || pending || (options.beforeClose && !options.beforeClose())) return false;
      try { if (cancelled) options.onCancel?.(); }
      catch { status.textContent = 'Fenster geschlossen; Einrichtungsstand bitte prüfen.'; }
      finally {
        opened = false; active = null; document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin); overlay.remove(); document.body.style.overflow = oldOverflow;
        if (trigger?.isConnected) trigger.focus({ preventScroll: true }); else document.getElementById('nw-shcfg-step-building')?.focus({ preventScroll: true });
      }
      return true;
    }
    const cancel = button(options.onApply ? 'Abbrechen' : 'Schließen', () => { cleanup(true); }); footer.appendChild(cancel);
    if (options.onApply) {
      const apply = button(options.applyLabel || 'In Entwurf übernehmen', () => {
        if (pending) return; pending = true; apply.disabled = true; cancel.disabled = true; status.textContent = '';
        Promise.resolve().then(() => options.onApply?.()).then(result => { pending = false; apply.disabled = false; cancel.disabled = false; if (result === true) cleanup(false); else if (!status.textContent) status.textContent = 'Änderungen noch nicht übernommen. Bitte Eingaben prüfen.'; }).catch(() => { pending = false; apply.disabled = false; cancel.disabled = false; status.textContent = 'Änderungen konnten nicht übernommen werden. Bitte Eingaben prüfen.'; });
      }, true); footer.appendChild(apply);
    }
    dialog.appendChild(footer); overlay.appendChild(dialog); const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.body.appendChild(overlay);
    function keydown(event: KeyboardEvent): void {
      const child = nested(); const scope = child || dialog;
      if (event.key === 'Escape') { if (child) return; event.preventDefault(); event.stopPropagation(); cleanup(true); return; }
      if (event.key !== 'Tab') return; const nodes = visibleInputs(scope); const first = nodes[0]; const last = nodes.at(-1);
      if (!first || !last) { event.preventDefault(); scope.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    function focusin(event: FocusEvent): void { const child = nested(); const target = event.target; if (target instanceof Node && !dialog.contains(target) && !child?.contains(target)) dialog.focus({ preventScroll: true }); }
    const handle: NwSetupDialogHandle = { body, close: () => cleanup(true), isOpen: () => opened, setError: message => { status.textContent = message; }, refresh: () => { if (!opened) return; const fields = Array.from(body.querySelectorAll<HTMLElement>('input,select,textarea,button')); const index = fields.findIndex(field => field === document.activeElement); const scrollTop = body.scrollTop; try { options.render(body); } catch { cleanup(true); return; } body.scrollTop = scrollTop; if (index >= 0) body.querySelectorAll<HTMLElement>('input,select,textarea,button')[index]?.focus({ preventScroll: true }); } };
    active = handle; document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', focusin);
    try { options.render(body); dialog.focus({ preventScroll: true }); } catch (error) { cleanup(true); throw error; }
    return handle;
  }
  async function readDetection(force: boolean): Promise<Record<string, unknown>> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch('/api/smarthome/type-detect' + (force ? '?force=1' : ''), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      const limit = 16 * 1024 * 1024; const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > limit) throw new Error('Erkennungsantwort ist zu groß. Bitte Datenpunktumfang prüfen.');
      if (!response.body) throw new Error('Erkennung lieferte keine Antwort.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let length = 0; let body = '';
      try { for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > limit) throw new Error('Erkennungsantwort ist zu groß.'); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
      catch (error) { await reader.cancel().catch(() => {}); throw error; } finally { reader.releaseLock(); }
      const value: unknown = JSON.parse(body);
      if (!record(value)) throw new Error('Ungültige Erkennungsantwort.');
      if (!response.ok || value.ok !== true) throw new Error(text(value.message) || text(value.error) || 'Erkennung fehlgeschlagen.');
      if (!Array.isArray(value.suggestions) || value.suggestions.length > 10000) throw new Error('Ungültige Vorschlagsliste.');
      return value;
    } catch (error) { if (controller.signal.aborted) throw new Error('Erkennung hat innerhalb von 35 Sekunden nicht geantwortet. Bitte erneut versuchen.'); throw error; }
    finally { clearTimeout(timer); controller.abort(); }
  }
  host.NW_SH_SETUP = Object.freeze({ mountSetup, mountDetection, openDialog, cloneConfig, readDetection, hasDialog: () => active !== null });
  bindActionMenus();
})();
