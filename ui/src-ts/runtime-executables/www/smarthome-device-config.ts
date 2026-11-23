/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bearbeitet die vollständigen Bedienprofile samt manueller Datenpunktzuordnung.
 * Daten und Wirkung: Liest ausschließlich den geschützten lokalen Profilkatalog und
 * ändert nur den bestehenden Konfigurationsentwurf. Keine Geräteschreibbefehle.
 * Bei Änderungen: Profilwechsel, manuelle Zuordnungen, unbekannte Felder, getrennte
 * Lese-/Schreibrechte, begrenzte Antworten und fehlgeschlagene Katalogabfragen prüfen.
 * Zusammenhang: smarthome-config.ts speichert den Entwurf über seine bisherige Transaktion.
 */
interface NwDeviceControlMapping {
  profile: string;
  fields: { key: string; readId?: string; writeId?: string }[];
}
interface NwDeviceConfigOptions {
  expanded?: boolean;
  fixedProfile?: string;
  createDpInput(label: string, value: string, onChange: (value: string) => void): HTMLElement;
  onChange(mapping: NwDeviceControlMapping | null): void;
}
interface NwDeviceConfigApi {
  mount(container: HTMLElement, mapping: unknown, options: NwDeviceConfigOptions): void;
  validationError(mapping: unknown, required: boolean): string | null;
  loadCustomViews(): Promise<unknown>;
}

(function () {
  'use strict';
  const host: Window & { NW_SH_DEVICE_CONFIG?: NwDeviceConfigApi } = window;
  if (host.NW_SH_DEVICE_CONFIG) return;
  interface Field {
    key: string; label: string; type: string; read: boolean; write: boolean;
    unit: string; required: boolean;
  }
  interface Profile { id: string; label: string; fields: Field[] }
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  const maxFields = 128;
  const maxResponseBytes = 1024 * 1024;
  let catalog: Promise<Profile[]> | null = null;
  let customViews: unknown = [];
  const invalidEditors = new Set<HTMLElement>();

  function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function key(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value) && !forbidden.has(value);
  }
  function fieldKey(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 80 && /^[A-Z][A-Z0-9_]*(?:%d)?$/.test(value) && !forbidden.has(value);
  }
  function dpId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 512
      && value === value.trim() && !/[\u0000-\u0020\u007f*?\[\]{}]/.test(value)
      && !/^(?:system\.|admin\.\d+(?:\.|$))/i.test(value)
      && !/(?:^|\.)(?:__proto__|prototype|constructor|password|passwd|secret|token|credentials?|privatekey|private_key)(?:\.|$)/i.test(value);
  }
  function copyMapping(value: unknown): NwDeviceControlMapping | null {
    if (value === null || value === undefined) return null;
    if (!record(value) || !key(value.profile) || !Array.isArray(value.fields) || value.fields.length > maxFields) throw new Error('Ungültige gespeicherte Profilzuordnung. Die vorhandenen Daten bleiben erhalten.');
    const result: NwDeviceControlMapping = { profile: value.profile, fields: [] };
    const seen = new Set<string>();
    for (const field of value.fields) {
      if (!record(field) || !fieldKey(field.key) || seen.has(field.key)) throw new Error('Ungültige oder doppelte Profilfelder. Die vorhandenen Daten bleiben erhalten.');
      seen.add(field.key);
      const row: NwDeviceControlMapping['fields'][number] = { key: field.key };
      for (const direction of ['readId', 'writeId'] as const) {
        const value = field[direction];
        if (value !== null && value !== undefined && value !== '') {
          if (!dpId(value)) throw new Error('Ungültige Datenpunkt-ID im Bedienprofil. Die vorhandenen Daten bleiben erhalten.');
          row[direction] = value;
        }
      }
      result.fields.push(row);
    }
    return result;
  }
  function validationError(value: unknown, required: boolean): string | null {
    for (const editor of invalidEditors) { if (!editor.isConnected) invalidEditors.delete(editor); }
    if (invalidEditors.size) return 'Bitte die ungültigen Datenpunkt-Eingaben im Bedienprofil korrigieren; gespeichert wird erst nach der Korrektur.';
    try {
      const mapping = copyMapping(value);
      if (required && (!mapping || !mapping.fields.some(field => field.readId || field.writeId))) return 'Bitte ein Bedienprofil wählen und mindestens einen Datenpunkt zuordnen.';
      return null;
    } catch (error) { return error instanceof Error ? error.message : 'Ungültige Profilzuordnung.'; }
  }
  function profiles(value: unknown): Profile[] {
    if (!record(value) || value.ok !== true || !Array.isArray(value.profiles) || value.profiles.length > 128 || value.profiles.length === 0) throw new Error('Der Bedienprofil-Katalog ist ungültig.');
    const ids = new Set<string>();
    return value.profiles.map((profile: unknown) => {
      if (!record(profile) || !key(profile.id) || ids.has(profile.id) || typeof profile.label !== 'string' || profile.label.length > 240 || !Array.isArray(profile.fields) || profile.fields.length > maxFields) throw new Error('Der Bedienprofil-Katalog ist ungültig.');
      ids.add(profile.id);
      const seen = new Set<string>();
      const fields: Field[] = profile.fields.map((field: unknown) => {
        if (!record(field) || !fieldKey(field.key) || seen.has(field.key) || typeof field.label !== 'string' || field.label.length > 240 || typeof field.type !== 'string' || field.type.length > 32 || typeof field.read !== 'boolean' || typeof field.write !== 'boolean') throw new Error('Der Bedienprofil-Katalog enthält ungültige Felder.');
        seen.add(field.key);
        return { key: field.key, label: field.label, type: field.type, read: field.read, write: field.write,
          unit: typeof field.unit === 'string' ? field.unit.slice(0, 40) : '', required: field.required === true };
      });
      return { id: profile.id, label: profile.label, fields };
    });
  }
  function fieldFor(profile: Profile | undefined, name: string): Field | undefined {
    if (!profile) return undefined;
    const exact = profile.fields.find(field => field.key === name);
    if (exact) return exact;
    const template = profile.fields.find(field => field.key.endsWith('%d') && name.startsWith(field.key.slice(0, -2)) && /^\d{1,3}$/.test(name.slice(field.key.length - 2)));
    if (template) return { ...template, key: name, label: `${template.label} · ${name.slice(template.key.length - 2)}` };
    if (profile.id === 'universal' && fieldKey(name)) return { key: name, label: name, type: 'mixed', unit: '', read: true, write: true, required: false };
    return undefined;
  }
  async function readCatalog(): Promise<Profile[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/smarthome/control-profiles', { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sitzung abgelaufen. Bitte erneut bei EOS anmelden.' : response.status === 403 ? 'Keine Berechtigung für die SmartHome-Konfiguration.' : 'Bedienprofile sind derzeit nicht verfügbar.');
      if (!response.body) throw new Error('Der Bedienprofil-Katalog ist leer.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      let text = '';
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > maxResponseBytes) { controller.abort(); throw new Error('Der Bedienprofil-Katalog überschreitet die erlaubte Größe.'); }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      const parsed: unknown = JSON.parse(text);
      const result = profiles(parsed);
      customViews = record(parsed) && Array.isArray(parsed.customViews) ? parsed.customViews : [];
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Bedienprofile konnten nicht vollständig geladen werden. Bitte erneut versuchen.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function load(): Promise<Profile[]> {
    if (!catalog) catalog = readCatalog().catch((error: unknown) => { catalog = null; throw error; });
    return catalog;
  }
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label: string, callback: () => void): HTMLButtonElement {
    const node = element('button', 'nw-config-btn nw-sh-profile__button', label);
    node.type = 'button';
    node.addEventListener('click', callback);
    return node;
  }
  function mount(container: HTMLElement, initial: unknown, options: NwDeviceConfigOptions): void {
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
    let mapping: NwDeviceControlMapping | null;
    try { mapping = copyMapping(initial); }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Die vorhandene Zuordnung konnte nicht gelesen werden.'; status.dataset.state = 'error'; return; }

    const content = element('div', 'nw-sh-profile__content');
    root.appendChild(content);
    const invalidFields = new Set<string>();
    function commit(next: NwDeviceControlMapping | null): void {
      mapping = copyMapping(next);
      options.onChange(copyMapping(next));
      status.textContent = 'Zuordnung im Entwurf geändert. Oben „Speichern“ wählen, um sie zu übernehmen.';
      status.dataset.state = 'draft';
    }
    function render(all: Profile[]): void {
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
        if (select.value && !chosen) return;
        const proposed: NwDeviceControlMapping | null = chosen ? { profile: chosen.id, fields: [] } : null;
        const removed: string[] = [];
        for (const row of mapping?.fields || []) {
          const target = fieldFor(chosen, row.key);
          const kept: NwDeviceControlMapping['fields'][number] = { key: row.key };
          if (row.readId) { if (target?.read) kept.readId = row.readId; else removed.push(`${row.key} (Lesen)`); }
          if (row.writeId) { if (target?.write) kept.writeId = row.writeId; else removed.push(`${row.key} (Schreiben)`); }
          if (proposed && (kept.readId || kept.writeId)) proposed.fields.push(kept);
        }
        if (removed.length && !window.confirm(`Beim Profilwechsel entfallen folgende Zuordnungen im Entwurf:\n${removed.join(', ')}\n\nProfil trotzdem übernehmen? Gerätewerte werden dabei nicht geschrieben.`)) return;
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
      if (options.fixedProfile) content.appendChild(element('p', 'nw-sh-profile__hint', 'Das Bedienprofil gehört zur ausgewählten eigenen Ansicht. Den Ansichtstyp im Abschnitt „Eigene Ansicht“ ändern.'));
      if (!mapping) { content.appendChild(element('p', 'nw-sh-profile__hint', 'Die vorhandene Kachelbedienung bleibt erhalten. Ein Profil ergänzt weitere Bedien- und Anzeigefunktionen.')); return; }
      if (!current) { content.appendChild(element('p', 'nw-sh-profile__warning', 'Das gespeicherte Profil ist im aktuellen Katalog nicht verfügbar. Seine Zuordnungen bleiben erhalten. Ein anderes Profil nur nach Prüfung übernehmen.')); }
      const known = new Set((current?.fields || []).map(field => field.key));
      const extra = mapping.fields.filter(field => !known.has(field.key));
      const sourceFields: Field[] = [...(current?.fields || []), ...extra.map(row => fieldFor(current, row.key) || { key: row.key, label: row.key, type: 'unbekannt', unit: '', read: true, write: true, required: false })];
      function addField(name: string): void {
        if (!mapping || !fieldKey(name) || !fieldFor(current, name)) return;
        if (mapping.fields.some(field => field.key === name)) { status.textContent = 'Diese Funktion ist bereits angelegt.'; return; }
        if (mapping.fields.length >= maxFields) { status.textContent = 'Maximal 128 Profilfunktionen können zugeordnet werden.'; status.dataset.state = 'error'; return; }
        commit({ profile: mapping.profile, fields: [...mapping.fields, { key: name }] });
        render(all);
      }
      if (current?.id === 'universal') {
        const add = element('div', 'nw-sh-profile__selector');
        const name = element('input', 'nw-config-input');
        name.type = 'text'; name.maxLength = 64; name.placeholder = 'Funktionsschlüssel, z. B. CUSTOM_VALUE';
        name.setAttribute('aria-label', 'Universellen Funktionsschlüssel hinzufügen');
        add.appendChild(name);
        add.appendChild(button('Funktion hinzufügen', () => {
          const value = name.value.trim();
          if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(value)) { status.textContent = 'Funktionsschlüssel: Großbuchstaben, Ziffern und Unterstriche; maximal 64 Zeichen, beginnend mit einem Buchstaben.'; status.dataset.state = 'error'; return; }
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
      const filterRows: { node: HTMLElement; matches: () => string }[] = [];
      for (const field of sourceFields) {
        const unknown = !fieldFor(current, field.key);
        const row = element('section', 'nw-sh-profile__field');
        row.dataset.profileKey = field.key;
        row.appendChild(element('h5', 'nw-sh-profile__field-title', field.label || field.key));
        row.appendChild(element('p', 'nw-sh-profile__field-meta', `${field.key} · ${field.type}${field.unit ? ` · ${field.unit}` : ''}${field.required ? ' · Für Erkennung vorgesehen' : ' · Optional'}`));
        if (unknown) row.appendChild(element('p', 'nw-sh-profile__warning', 'Nicht im aktuellen Profilkatalog. Bestehende Zuordnung bleibt erhalten; bitte vor dem Speichern prüfen.'));
        if (field.key.endsWith('%d') && !mapping.fields.some(item => item.key === field.key && (item.readId || item.writeId))) {
          row.appendChild(element('p', 'nw-sh-profile__hint', 'Wettervorlage: Tagesindex auswählen, danach den konkreten Datenpunkt zuordnen.'));
          const day = element('input', 'nw-config-input');
          day.type = 'number'; day.min = '0'; day.max = '999'; day.step = '1'; day.value = '0';
          day.setAttribute('aria-label', `${field.label}: Tagesindex`);
          row.appendChild(day);
          row.appendChild(button('Tagesfunktion hinzufügen', () => {
            const index = Number(day.value);
            if (!/^\d{1,3}$/.test(day.value) || !Number.isInteger(index) || index < 0 || index > 999) { status.textContent = 'Tagesindex muss eine ganze Zahl zwischen 0 und 999 sein.'; status.dataset.state = 'error'; return; }
            addField(field.key.slice(0, -2) + String(index));
          }));
          fields.appendChild(row);
          filterRows.push({ node: row, matches: () => `${field.key} ${field.label}`.toLocaleLowerCase('de') });
          continue;
        }

        for (const direction of ['readId', 'writeId'] as const) {
          const enabled = direction === 'readId' ? field.read : field.write;
          const existing = mapping.fields.find(item => item.key === field.key)?.[direction];
          if (!enabled && !existing) continue;
          const label = direction === 'readId' ? 'Lesen (Rückmeldung)' : 'Schreiben (Befehl)';
          const picker = options.createDpInput(label, existing || '', value => {
            if (!mapping) return;
            const trimmed = value.trim();
            const editKey = `${field.key}.${direction}`;
            if (trimmed && !dpId(trimmed)) {
              invalidFields.add(editKey); invalidEditors.add(root);
              status.textContent = 'Konkrete Geräte-Datenpunkt-ID erforderlich: maximal 512 Zeichen, ohne Platzhalter, System- oder Geheimniszugriff.';
              status.dataset.state = 'error'; return;
            }
            invalidFields.delete(editKey);
            if (!invalidFields.size) invalidEditors.delete(root);
            const next = copyMapping(mapping);
            if (!next) return;
            let target = next.fields.find(item => item.key === field.key);
            if (!target && trimmed) {
              if (next.fields.length >= maxFields) { status.textContent = 'Maximal 128 Profilfunktionen können zugeordnet werden.'; status.dataset.state = 'error'; return; }
              target = { key: field.key }; next.fields.push(target);
            }
            if (target) {
              if (trimmed) target[direction] = trimmed; else delete target[direction];
              next.fields = next.fields.filter(item => item.readId || item.writeId);
            }
            commit(next);
          });
          if (!enabled || unknown) picker.appendChild(element('p', 'nw-sh-profile__warning', 'Diese Zuordnung wird vom aktuellen Profil nicht unterstützt. Entfernen oder ein passendes Profil auswählen.'));
          row.appendChild(picker);
        }
        if (unknown) row.appendChild(button('Unbekannte Zuordnung entfernen', () => {
          if (!mapping || !window.confirm(`Zuordnung „${field.key}“ aus dem Entwurf entfernen?`)) return;
          commit({ profile: mapping.profile, fields: mapping.fields.filter(item => item.key !== field.key) });
          render(all);
        }));
        filterRows.push({ node: row, matches: () => `${field.key} ${field.label} ${(mapping?.fields.find(item => item.key === field.key)?.readId) || ''} ${(mapping?.fields.find(item => item.key === field.key)?.writeId) || ''}`.toLocaleLowerCase('de') });
        fields.appendChild(row);
      }
      search.addEventListener('input', () => {
        const query = search.value.trim().toLocaleLowerCase('de');
        let visible = 0;
        for (const row of filterRows) { row.node.hidden = !!query && !row.matches().includes(query); if (!row.node.hidden) visible++; }
        summary.textContent = `${visible} von ${sourceFields.length} Funktionen angezeigt. Nicht benötigte Datenpunkte können leer bleiben.`;
      });
    }
    function start(): void {
      status.textContent = 'Bedienprofile werden geladen …';
      status.dataset.state = 'loading';
      void load().then(all => {
        if (!root.isConnected) return;
        status.textContent = 'Manuelle Zuordnung und Datenpunktauswahl ändern nur die Konfiguration, keine Gerätewerte.';
        status.dataset.state = 'ready';
        render(all);
      }).catch((error: unknown) => {
        if (!root.isConnected) return;
        status.textContent = error instanceof Error ? error.message : 'Bedienprofile konnten nicht geladen werden.';
        status.dataset.state = 'error';
        content.replaceChildren(button('Erneut laden', start));
      });
    }
    let started = false;
    const ensureLoaded = (): void => { if (root.open && !started) { started = true; start(); } };
    root.addEventListener('toggle', ensureLoaded);
    ensureLoaded();
  }
  async function loadCustomViews(): Promise<unknown> { await load(); return customViews; }
  host.NW_SH_DEVICE_CONFIG = Object.freeze({ mount, validationError, loadCustomViews });
})();
