/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Konfiguriert die zehn eingebauten Zusatzansichten über den lokalen Katalog.
 * Daten und Wirkung: Ändert ausschließlich den SmartHome-Entwurf. Darstellung und
 * Datenpunktbindung bleiben getrennt; weder Befehle noch URL-Vorschauen werden ausgeführt.
 * Bei Änderungen: Ansichtswechsel, skalare Befehlstypen, Grenzwerte, sichere URLs,
 * strukturierte Energie-/Symbolzeilen und ungültige Eingaben vor Speicherung prüfen.
 */
type NwCustomSettingValue = string | number | boolean | null | NwCustomSettingValue[] | { [key: string]: NwCustomSettingValue };
interface NwCustomViewDraft { kind: string; settings: Record<string, NwCustomSettingValue> }
interface NwCustomControlsDraft { profile: string; fields: { key: string; readId?: string; writeId?: string }[] }
interface NwCustomConfigOptions {
  expanded?: boolean;
  getControls(): unknown;
  onChange(view: NwCustomViewDraft | null, controls: NwCustomControlsDraft | null | undefined, rebuild: boolean): void;
}
interface NwCustomConfigApi {
  mount(container: HTMLElement, initial: unknown, options: NwCustomConfigOptions): void;
  validationError(view: unknown, controls: unknown): string | null;
}

(function () {
  'use strict';
  interface Setting {
    key: string; label: string; type: string; default?: NwCustomSettingValue;
    min?: number; max?: number; step?: number; maxLength?: number;
    options?: { value: string; label: string }[];
  }
  interface CatalogItem {
    kind: string; label: string; profile: string; settings: Setting[];
    fields: { key: string; read: boolean; write: boolean }[];
  }
  const host: Window & { NW_SH_CUSTOM_CONFIG?: NwCustomConfigApi; NW_SH_DEVICE_CONFIG?: { loadCustomViews(): Promise<unknown> } } = window;
  if (host.NW_SH_CUSTOM_CONFIG) return;
  const kinds = new Set(['clock', 'gauge', 'wind', 'presence', 'markdown', 'iframe', 'universal', 'energyFlow', 'weather', 'newline']);
  const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
  const invalidEditors = new Set<HTMLElement>();
  let catalog: CatalogItem[] = [];
  function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function clone(value: unknown, depth = 0): NwCustomSettingValue {
    if (depth > 8) throw new Error('Die Ansichtseinstellungen sind zu tief verschachtelt.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length <= 32768) return value;
    if (Array.isArray(value) && value.length <= 128) return value.map((entry: unknown) => clone(entry, depth + 1));
    if (record(value) && Object.keys(value).length <= 64) {
      const result: Record<string, NwCustomSettingValue> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (forbidden.has(key)) throw new Error('Unzulässiger Einstellungsschlüssel.');
        result[key] = clone(entry, depth + 1);
      }
      return result;
    }
    throw new Error('Ungültige oder zu große Ansichtseinstellungen.');
  }
  function view(value: unknown): NwCustomViewDraft | null {
    if (value === undefined || value === null) return null;
    if (!record(value) || typeof value.kind !== 'string' || !kinds.has(value.kind) || !record(value.settings)) throw new Error('Ungültige gespeicherte Ansicht. Vorhandene Einstellungen bleiben erhalten.');
    const settings = clone(value.settings);
    if (!record(settings)) throw new Error('Ungültige Ansichtseinstellungen.');
    return { kind: value.kind, settings };
  }
  function controls(value: unknown): NwCustomControlsDraft | null {
    if (value === null || value === undefined) return null;
    if (!record(value) || typeof value.profile !== 'string' || !Array.isArray(value.fields) || value.fields.length > 128) throw new Error('Ungültige Profilzuordnung.');
    const fields: NwCustomControlsDraft['fields'] = [];
    const seen = new Set<string>();
    for (const raw of value.fields) {
      if (!record(raw) || typeof raw.key !== 'string' || raw.key.length > 80 || seen.has(raw.key) || forbidden.has(raw.key)) throw new Error('Ungültige Profilfelder.');
      seen.add(raw.key);
      const field: NwCustomControlsDraft['fields'][number] = { key: raw.key };
      for (const side of ['readId', 'writeId'] as const) {
        if (raw[side] !== undefined && raw[side] !== null && raw[side] !== '') {
          if (typeof raw[side] !== 'string' || raw[side].length > 512) throw new Error('Ungültige Datenpunktzuordnung.');
          field[side] = raw[side];
        }
      }
      fields.push(field);
    }
    return { profile: value.profile, fields };
  }
  function parseCatalog(value: unknown): CatalogItem[] {
    if (!Array.isArray(value) || value.length !== 10) throw new Error('Der Katalog der eigenen Ansichten ist nicht vollständig verfügbar.');
    const seen = new Set<string>();
    return value.map((raw: unknown) => {
      if (!record(raw) || typeof raw.kind !== 'string' || !kinds.has(raw.kind) || seen.has(raw.kind) || raw.profile !== `custom_${raw.kind}` || typeof raw.label !== 'string' || raw.label.length > 160 || !Array.isArray(raw.settings) || raw.settings.length > 64 || !Array.isArray(raw.fields) || raw.fields.length > 128) throw new Error('Ungültiger Ansichtskatalog.');
      seen.add(raw.kind);
      const settingKeys = new Set<string>();
      const settings: Setting[] = raw.settings.map((item: unknown) => {
        if (!record(item) || typeof item.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(item.key) || forbidden.has(item.key) || settingKeys.has(item.key) || typeof item.label !== 'string' || item.label.length > 160 || typeof item.type !== 'string' || item.type.length > 32) throw new Error('Ungültige Ansichtseinstellungen im Katalog.');
        settingKeys.add(item.key);
        const setting: Setting = { key: item.key, label: item.label, type: item.type };
        if (item.default !== undefined) setting.default = clone(item.default);
        for (const key of ['min', 'max', 'step', 'maxLength'] as const) {
          if (item[key] !== undefined) {
            if (typeof item[key] !== 'number' || !Number.isFinite(item[key])) throw new Error('Ungültiger Einstellungsbereich.');
            setting[key] = item[key];
          }
        }
        if (item.options !== undefined) {
          if (!Array.isArray(item.options) || item.options.length > 64) throw new Error('Ungültige Einstellungsoptionen.');
          setting.options = item.options.map((option: unknown) => {
            if (typeof option === 'string') return { value: option, label: option };
            if (!record(option) || typeof option.value !== 'string' || typeof option.label !== 'string') throw new Error('Ungültige Einstellungsoption.');
            return { value: option.value, label: option.label };
          });
        }
        return setting;
      });
      const fields = raw.fields.map((item: unknown) => {
        if (!record(item) || typeof item.key !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(item.key) || typeof item.read !== 'boolean' || typeof item.write !== 'boolean') throw new Error('Ungültige Ansichts-Datenfelder.');
        return { key: item.key, read: item.read, write: item.write };
      });
      return { kind: raw.kind, label: raw.label, profile: raw.profile, settings, fields };
    });
  }
  function validUrl(value: string): boolean {
    if (!value) return true;
    if (value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) return false;
    try { const target = new URL(value, 'https://eos.invalid'); return ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password && (value.startsWith('/') || /^https?:\/\//i.test(value)); }
    catch { return false; }
  }
  function validationError(input: unknown, binding: unknown): string | null {
    for (const editor of invalidEditors) if (!editor.isConnected) invalidEditors.delete(editor);
    if (invalidEditors.size) return 'Bitte die markierten Einstellungen der eigenen Ansicht korrigieren.';
    try {
      const current = view(input);
      if (!current) return null;
      const mapped = controls(binding);
      if (!mapped || mapped.profile !== `custom_${current.kind}`) return 'Ansicht und Bedienprofil passen nicht zusammen. Die Ansicht erneut übernehmen.';
      const settings = current.settings;
      const spec = catalog.find(item => item.kind === current.kind);
      if (spec && Object.keys(settings).some(key => !spec.settings.some(setting => setting.key === key) && !(current.kind === 'markdown' && key === 'markdown'))) return 'Die Ansicht enthält unbekannte Einstellungen. Bitte vor dem Speichern prüfen.';
      if (current.kind === 'iframe' && (typeof settings.url !== 'string' || !validUrl(settings.url))) return 'Webansicht: eine gültige HTTP-/HTTPS-Adresse oder einen lokalen Pfad verwenden.';
      if (current.kind === 'gauge' && typeof settings.minValue === 'number' && typeof settings.maxValue === 'number' && settings.maxValue <= settings.minValue) return 'Messinstrument: Der Höchstwert muss größer als der Mindestwert sein.';
      if (current.kind === 'clock' && typeof settings.timeZone === 'string' && settings.timeZone) { try { new Intl.DateTimeFormat('de', { timeZone: settings.timeZone }).format(0); } catch { return 'Die Zeitzone ist ungültig (Beispiel: Europe/Berlin).'; } }
      const bound = new Set(mapped.fields.filter(field => field.readId || field.writeId).map(field => field.key));
      for (const [name, prefix] of [['producers', 'PRODUCER'], ['consumers', 'CONSUMER']] as const) {
        const items = settings[name];
        if (Array.isArray(items)) for (const entry of items) {
          if (!record(entry) || typeof entry.index !== 'number') return 'Energiefluss: ungültiger Datenfeld-Index.';
          if (!bound.has(`${prefix}${entry.index}`)) return `Energiefluss: Für ${name === 'producers' ? 'Erzeuger' : 'Verbraucher'} ${entry.index} zuerst den Datenpunkt zuordnen.`;
        }
      }
      if (Array.isArray(settings.icons)) for (const icon of settings.icons) if (record(icon) && typeof icon.slot === 'string' && !bound.has(icon.slot)) return `Universalansicht: Datenpunkt für ${icon.slot} zuordnen.`;
      return null;
    } catch (error) { return error instanceof Error ? error.message : 'Ungültige Ansichtseinstellungen.'; }
  }
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node;
  }
  function button(text: string, callback: () => void): HTMLButtonElement {
    const node = element('button', 'nw-config-btn nw-sh-custom-config__button', text); node.type = 'button'; node.addEventListener('click', callback); return node;
  }
  function mount(container: HTMLElement, initial: unknown, options: NwCustomConfigOptions): void {
    const root = element('details', 'nw-sh-custom-config'); root.open = options.expanded === true;
    root.appendChild(element('summary', 'nw-sh-custom-config__heading', 'Eigene Ansicht'));
    root.appendChild(element('p', 'nw-sh-custom-config__intro', 'Uhr, Messinstrument, Wind, Anwesenheit, Notiz, Webansicht, Universalansicht, Energiefluss, Wetter oder Zeilenumbruch. Datenpunkte werden im zugehörigen Bedienprofil zugeordnet.'));
    const status = element('p', 'nw-sh-custom-config__status', 'Ansichtskatalog wird geladen …'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.appendChild(status);
    const content = element('div', 'nw-sh-custom-config__content'); root.appendChild(content); container.appendChild(root);
    let current: NwCustomViewDraft | null;
    try { current = view(initial); } catch (error) { status.textContent = error instanceof Error ? error.message : 'Ansicht nicht lesbar.'; status.dataset.state = 'error'; return; }
    const errors = new Set<string>();
    function error(key: string, message: string | null): void {
      if (message) { errors.add(key); invalidEditors.add(root); status.textContent = message; status.dataset.state = 'error'; }
      else { errors.delete(key); if (!errors.size) invalidEditors.delete(root); }
    }
    function update(key: string, value: NwCustomSettingValue | undefined): void {
      if (!current) return;
      const settings = { ...current.settings };
      if (value === undefined) delete settings[key]; else settings[key] = clone(value);
      current = { kind: current.kind, settings };
      options.onChange(view(current), undefined, false);
      if (!errors.size) { status.textContent = 'Ansicht im Entwurf geändert. Oben „Speichern“ wählen.'; status.dataset.state = 'draft'; }
    }
    function basicInput(setting: Setting, value: NwCustomSettingValue | undefined, change: (value: NwCustomSettingValue | undefined) => void, errorKey = setting.key): HTMLElement {
      const field = element('label', 'nw-sh-custom-config__field'); field.appendChild(element('span', 'nw-sh-custom-config__label', setting.label));
      const type = setting.type;
      if (type === 'boolean') {
        const input = element('input', 'nw-sh-custom-config__checkbox'); input.type = 'checkbox'; input.checked = value === true;
        input.addEventListener('change', () => { error(errorKey, null); change(input.checked); }); field.appendChild(input); return field;
      }
      if (setting.options?.length) {
        const input = element('select', 'nw-config-select');
        for (const option of setting.options) { const node = element('option', '', option.label); node.value = option.value; input.appendChild(node); }
        input.value = typeof value === 'string' ? value : typeof setting.default === 'string' ? setting.default : '';
        input.addEventListener('change', () => { error(errorKey, null); change(input.value); }); field.appendChild(input); return field;
      }
      const multiline = type === 'markdown' || type === 'textarea' || setting.key === 'text';
      const input = multiline ? element('textarea', 'nw-config-input nw-sh-custom-config__textarea') : element('input', 'nw-config-input');
      if (input instanceof HTMLInputElement) input.type = type === 'number' ? 'number' : 'text';
      input.value = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
      input.maxLength = setting.maxLength ?? (multiline ? 32768 : 8192);
      if (input instanceof HTMLInputElement && type === 'number') {
        if (setting.min !== undefined) input.min = String(setting.min);
        if (setting.max !== undefined) input.max = String(setting.max);
        input.step = setting.step !== undefined ? String(setting.step) : 'any';
      }
      input.addEventListener('input', () => {
        let next: NwCustomSettingValue = input.value;
        if (type === 'number') {
          if (!input.value.trim() && setting.default === undefined && ['latitude', 'longitude'].includes(setting.key)) { error(errorKey, null); change(undefined); return; }
          const number = Number(input.value);
          if (!input.value.trim() || !Number.isFinite(number) || (setting.min !== undefined && number < setting.min) || (setting.max !== undefined && number > setting.max) || (setting.step === 1 && !Number.isInteger(number))) { error(errorKey, `${setting.label}: einen gültigen Wert${setting.min !== undefined ? ` ab ${setting.min}` : ''}${setting.max !== undefined ? ` bis ${setting.max}` : ''} eingeben.`); return; }
          next = number;
        } else if (input.value.length > (setting.maxLength ?? (multiline ? 32768 : 8192))) { error(errorKey, `${setting.label}: Eingabe ist zu lang.`); return; }
        if ((type === 'url' || setting.key === 'url') && !validUrl(input.value)) { error(errorKey, 'Eine HTTP-/HTTPS-Adresse oder einen lokalen Pfad ohne Zugangsdaten verwenden.'); return; }
        if ((type === 'color' || /color$/i.test(setting.key)) && input.value && !/^#[a-f\d]{6}$/i.test(input.value)) { error(errorKey, `${setting.label}: Farbe im Format #12AB34 oder leer eingeben.`); return; }
        error(errorKey, null); change(next);
      });
      field.appendChild(input);
      if (type === 'markdown' || setting.key === 'text') field.appendChild(element('small', 'nw-sh-custom-config__hint', 'Markdown wird als sichere Notiz dargestellt; HTML und Skripte werden nicht ausgeführt.'));
      if (type === 'url' || setting.key === 'url') field.appendChild(element('small', 'nw-sh-custom-config__hint', 'Die Adresse wird hier nicht aufgerufen. Eine Webansicht kann nur Inhalte zeigen, deren Ziel das Einbetten erlaubt.'));
      return field;
    }
    function scalarInput(setting: Setting, value: NwCustomSettingValue | undefined): HTMLElement {
      const group = element('div', 'nw-sh-custom-config__scalar');
      const select = element('select', 'nw-config-select'); select.setAttribute('aria-label', `${setting.label}: Datentyp`);
      for (const [type, label] of [['boolean', 'Wahr/Falsch'], ['number', 'Zahl'], ['string', 'Text']]) { const item = element('option', '', label); item.value = type ?? ''; select.appendChild(item); }
      let data: NwCustomSettingValue = typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' ? value : true;
      select.value = typeof data;
      const editor = element('div', 'nw-sh-custom-config__scalar-editor');
      const rebuild = (): void => {
        const typed = { ...setting, type: typeof data }; delete typed.options;
        editor.replaceChildren(basicInput(typed, data, next => { if (next === undefined) return; data = next; update(setting.key, next); }));
      };
      select.addEventListener('change', () => { data = select.value === 'boolean' ? true : select.value === 'number' ? 0 : ''; error(setting.key, null); update(setting.key, data); rebuild(); });
      group.appendChild(select); group.appendChild(editor); rebuild(); return group;
    }
    function listInput(setting: Setting, value: NwCustomSettingValue | undefined): HTMLElement {
      const group = element('section', 'nw-sh-custom-config__list'); group.appendChild(element('h5', 'nw-sh-custom-config__label', setting.label));
      const entries: Record<string, NwCustomSettingValue>[] = Array.isArray(value) ? value.filter(record).map(row => clone(row) as Record<string, NwCustomSettingValue>) : [];
      const colorLevels = setting.key === 'colorLevels'; const icons = setting.key === 'icons'; const limit = colorLevels ? 32 : icons ? 3 : 31;
      const rows = element('div', 'nw-sh-custom-config__list-rows'); group.appendChild(rows);
      function commit(): void { update(setting.key, entries); }
      function renderRows(): void {
        for (const key of errors) if (key.startsWith(`${setting.key}.`)) errors.delete(key);
        if (!errors.size) invalidEditors.delete(root);
        rows.replaceChildren();
        entries.forEach((entry, index) => {
          const row = element('div', 'nw-sh-custom-config__list-row');
          const specs: Setting[] = colorLevels ? [
            { key: 'value', label: 'Grenzwert', type: 'number', min: -1e12, max: 1e12 }, { key: 'color', label: 'Farbe', type: 'color', maxLength: 7 },
          ] : icons ? [
            { key: 'slot', label: 'Indikator', type: 'select', options: ['ICON1', 'ICON2', 'ICON3'].map(value => ({ value, label: value })) },
            { key: 'name', label: 'Name', type: 'string', maxLength: 80 }, { key: 'icon', label: 'Symbol', type: 'string', maxLength: 48 },
            { key: 'color', label: 'Farbe', type: 'color', maxLength: 7 }, { key: 'invert', label: 'Anzeige invertieren', type: 'boolean' },
          ] : [
            { key: 'index', label: 'Datenfeld-Index', type: 'number', min: 1, max: 31, step: 1 }, { key: 'name', label: 'Name', type: 'string', maxLength: 120 },
            { key: 'color', label: 'Farbe', type: 'color', maxLength: 7 }, { key: 'icon', label: 'Symbol', type: 'string', maxLength: 48 },
            { key: 'unit', label: 'Einheit', type: 'string', maxLength: 32 }, { key: 'deviceType', label: 'Geräteart', type: 'string', maxLength: 48 },
          ];
          for (const spec of specs) row.appendChild(basicInput(spec, entry[spec.key], next => {
            if (next === undefined) return;
            if (['index', 'slot', 'value'].includes(spec.key) && entries.some((other, otherIndex) => otherIndex !== index && other[spec.key] === next)) { error(`${setting.key}.${index}.${spec.key}`, `${setting.label}: ${spec.label} muss eindeutig sein.`); return; }
            entry[spec.key] = next; commit();
          }, `${setting.key}.${index}.${spec.key}`));
          row.appendChild(button('Zeile entfernen', () => { entries.splice(index, 1); for (const key of errors) if (key.startsWith(`${setting.key}.`)) errors.delete(key); if (!errors.size) invalidEditors.delete(root); commit(); renderRows(); }));
          rows.appendChild(row);
        });
      }
      const add = button('Zeile hinzufügen', () => {
        if (entries.length >= limit) { status.textContent = `Maximal ${limit} Zeilen möglich.`; return; }
        let unused = 1;
        if (colorLevels) { unused = 0; while (entries.some(entry => entry.value === unused)) unused++; }
        else while (entries.some(entry => icons ? entry.slot === `ICON${unused}` : entry.index === unused)) unused++;
        entries.push(colorLevels ? { value: unused, color: '#00cfa2' } : icons ? { slot: `ICON${unused}`, name: '', icon: '', color: '', invert: false } : { index: unused, name: '', color: '', icon: '', unit: '', deviceType: '' });
        commit(); renderRows();
      });
      group.appendChild(add);
      if (!colorLevels) group.appendChild(element('p', 'nw-sh-custom-config__hint', icons ? 'Zu jedem Indikator den gleichnamigen Datenpunkt im Bedienprofil zuordnen.' : `Index 1 gehört zu ${setting.key === 'producers' ? 'PRODUCER1' : 'CONSUMER1'}; weitere Indizes entsprechend. Leistungs-Datenpunkt vor dem Speichern zuordnen.`));
      renderRows(); return group;
    }
    function render(all: CatalogItem[]): void {
      content.replaceChildren(); errors.clear(); invalidEditors.delete(root);
      const selector = element('div', 'nw-sh-custom-config__selector'); const select = element('select', 'nw-config-select'); select.setAttribute('aria-label', 'Eigene Ansicht auswählen');
      const empty = element('option', '', 'Keine eigene Ansicht'); empty.value = ''; select.appendChild(empty);
      for (const item of all) { const option = element('option', '', item.label); option.value = item.kind; select.appendChild(option); }
      select.value = current?.kind || '';
      const apply = button('Ansicht übernehmen', () => {
        const chosen = all.find(item => item.kind === select.value);
        if (select.value && !chosen) return;
        let prior: NwCustomControlsDraft | null;
        try { prior = controls(options.getControls()); } catch (caught) { status.textContent = caught instanceof Error ? caught.message : 'Profilzuordnung nicht lesbar.'; status.dataset.state = 'error'; return; }
        const next: NwCustomControlsDraft | null = chosen ? { profile: chosen.profile, fields: [] } : null;
        const removed: string[] = [];
        for (const field of prior?.fields || []) {
          const target = chosen?.fields.find(item => item.key === field.key); const preserved: NwCustomControlsDraft['fields'][number] = { key: field.key };
          if (field.readId) { if (target?.read) preserved.readId = field.readId; else removed.push(`${field.key} (Lesen)`); }
          if (field.writeId) { if (target?.write) preserved.writeId = field.writeId; else removed.push(`${field.key} (Schreiben)`); }
          if (next && (preserved.readId || preserved.writeId)) next.fields.push(preserved);
        }
        if ((current || removed.length) && !window.confirm(`Ansicht im Entwurf ${chosen ? 'ändern' : 'entfernen'}?${current && current.kind !== chosen?.kind ? '\nDie Einstellungen der bisherigen Ansicht werden ersetzt.' : ''}${removed.length ? `\nFolgende Datenpunktzuordnungen entfallen: ${removed.join(', ')}` : ''}\nEs werden keine Gerätewerte geschrieben.`)) return;
        const settings: Record<string, NwCustomSettingValue> = current?.kind === chosen?.kind && current ? { ...current.settings } : {};
        if (chosen) for (const setting of chosen.settings) if (settings[setting.key] === undefined && setting.default !== undefined) settings[setting.key] = clone(setting.default);
        current = chosen ? { kind: chosen.kind, settings } : null;
        options.onChange(view(current), next, true);
        if (root.isConnected) render(all);
      });
      const matches = (): boolean => { try { const mapping = controls(options.getControls()); return mapping?.profile === `custom_${current?.kind || ''}`; } catch { return false; } };
      apply.disabled = !current || matches();
      select.addEventListener('change', () => { apply.disabled = select.value === (current?.kind || '') && (!current || matches()); });
      selector.appendChild(select); selector.appendChild(apply); content.appendChild(selector);
      if (!current) return;
      const item = all.find(candidate => candidate.kind === current?.kind);
      if (!item) return;
      if (current.kind === 'newline') content.appendChild(element('p', 'nw-sh-custom-config__hint', 'Diese Kachel beginnt eine neue Zeile in der Raumansicht. Sie benötigt keinen Datenpunkt.'));
      if (current.kind === 'weather') content.appendChild(element('p', 'nw-sh-custom-config__hint', 'Wetterwerte kommen aus den zugeordneten Adapter-Datenpunkten. Der Editor ruft keinen Wetterdienst auf.'));
      const settings = element('div', 'nw-sh-custom-config__settings'); content.appendChild(settings);
      for (const setting of item.settings) {
        const value = current.settings[setting.key] ?? setting.default;
        if (['colorLevels', 'icons', 'producers', 'consumers'].includes(setting.key)) settings.appendChild(listInput(setting, value));
        else if (setting.key === 'actionValue' || setting.type === 'scalar') settings.appendChild(scalarInput(setting, value));
        else settings.appendChild(basicInput(setting, value, next => update(setting.key, next)));
      }
    }
    function start(): void {
      status.textContent = 'Ansichtskatalog wird geladen …';
      if (!host.NW_SH_DEVICE_CONFIG) { status.textContent = 'Profilkatalog nicht verfügbar. Bitte Seite neu laden.'; status.dataset.state = 'error'; return; }
      void host.NW_SH_DEVICE_CONFIG.loadCustomViews().then(value => {
        if (!root.isConnected) return;
        const all = parseCatalog(value); catalog = all;
        status.textContent = 'Änderungen bleiben im Entwurf, bis die SmartHome-Konfiguration gespeichert wird.'; status.dataset.state = 'ready'; render(all);
      }).catch((caught: unknown) => {
        if (!root.isConnected) return;
        status.textContent = caught instanceof Error ? caught.message : 'Ansichtskatalog konnte nicht geladen werden.'; status.dataset.state = 'error'; content.replaceChildren(button('Erneut laden', start));
      });
    }
    let started = false;
    const ensureLoaded = (): void => { if (root.open && !started) { started = true; start(); } };
    root.addEventListener('toggle', ensureLoaded); ensureLoaded();
  }
  host.NW_SH_CUSTOM_CONFIG = Object.freeze({ mount, validationError });
})();
