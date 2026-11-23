/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Rendert lokale Zusatzansichten und begrenzte, ausdrücklich geöffnete Verläufe.
 * Daten und Wirkung: Liest ausschließlich freigegebene Geräteslots; schreibt nur über
 * den vorhandenen Geräte-/Aktionsvertrag. Kein freier Datenpunktzugriff, keine Wetter-
 * oder Kartenabfrage. Markdown wird aus einem lokalen GFM-AST als sichere DOM-Knoten aufgebaut.
 * Bei Änderungen: Null-/Qualitätswerte, Bounds, optionale Slots, Bestätigung, Abbruch,
 * URL-Grenze, Parser-Budget und vollständige Bereinigung beim Entfernen prüfen.
 */
(function () {
  'use strict';
  type Scalar = string | number | boolean;
  type Row = Record<string, unknown>;
  interface Field { key: string; label: string; value: Scalar | null; valid: boolean; readable: boolean; writable: boolean;
    type: string; unit: string; min: number | undefined; max: number | undefined; step: number | undefined; options: { value: Scalar; label: string }[]; confirm: boolean; pending: boolean }
  interface Model { id: string; name: string; kind: string; settings: Row; fields: Map<string, Field>; readOnly: boolean }
  interface View { update(device: unknown): void; destroy(): void }
  interface API {
    render(container: HTMLElement, device: unknown): View | null;
    renderTile(device: unknown): HTMLElement | null;
    renderDetails(container: HTMLElement, device: unknown): View | null;
    update(container: HTMLElement, device: unknown): void;
    destroy(container: HTMLElement): void;
    isInteracting(container?: HTMLElement): boolean;
    renderForecast(container: HTMLElement, device: unknown): void;
    renderHistory(container: HTMLElement, device: unknown, key: string): View;
  }
  interface Feedback { post(endpoint: string, payload: unknown, id: string): Promise<Row | null>; attachStatus(root: HTMLElement, id: string): void }
  const host: Window & { NW_SH_CUSTOM_VIEWS?: API; NW_SH_FEEDBACK?: Feedback;
    NW_SH_MARKDOWN?: { parse(text: string): unknown }; NW_RUNTIME?: { url(url: string): string } } = window;
  if (host.NW_SH_CUSTOM_VIEWS) return;
  const kinds = new Set(['clock', 'gauge', 'wind', 'presence', 'markdown', 'iframe', 'universal', 'energyFlow', 'weather', 'newline']);
  const views = new WeakMap<HTMLElement, View>();
  const clockSubscribers = new Map<HTMLElement, { tick: () => void; detach: () => void }>();
  let clockTimer: ReturnType<typeof setTimeout> | undefined;
  const SVG = 'http://www.w3.org/2000/svg';
  function record(value: unknown): Row { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
  function text(value: unknown, fallback = '', limit = 256): string { return typeof value === 'string' ? value.slice(0, limit) : fallback; }
  function finite(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
  function scalar(value: unknown): value is Scalar { return typeof value === 'boolean' || typeof value === 'string' || finite(value) !== undefined; }
  function bounded(value: unknown, fallback: number, min: number, max: number): number { return Math.min(max, Math.max(min, finite(value) ?? fallback)); }
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', value = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag); node.className = cls; node.textContent = value; return node;
  }
  function svg(tag: string, attributes: Record<string, string>): SVGElement {
    const node = document.createElementNS(SVG, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); return node;
  }
  function color(value: unknown, fallback = '#00d7a0'): string { return typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? value : fallback; }
  function safeUrl(value: unknown): string {
    if (typeof value !== 'string' || value.length > 2048 || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return '';
    try { const url = new URL(value, window.location.href); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function model(value: unknown, forceKind?: string): Model | null {
    const input = record(value); const custom = record(input.customView); const controls = record(input.deviceControls);
    const kind = forceKind ?? text(custom.kind); if (!kinds.has(kind) || !text(input.id)) return null;
    const fields = new Map<string, Field>();
    for (const raw of (Array.isArray(controls.fields) ? controls.fields : []).slice(0, 128)) {
      const field = record(raw); const key = text(field.key, '', 128); if (!key || fields.has(key)) continue;
      const valueType = text(field.type); const valid = field.valid === true && scalar(field.value);
      const options = (Array.isArray(field.options) ? field.options : []).slice(0, 512).flatMap(option => {
        const item = record(option); return scalar(item.value) ? [{ value: item.value, label: text(item.label, String(item.value)) }] : [];
      });
      fields.set(key, { key, label: text(field.label, key), type: valueType, value: valid && scalar(field.value) ? field.value : null,
        valid, readable: field.readable === true, writable: field.writable === true, unit: text(field.unit, '', 32),
        min: finite(field.min), max: finite(field.max), step: finite(field.step), options, confirm: field.confirm === true, pending: field.ack === false || field.pending === true });
    }
    return { id: text(input.id, '', 512), name: text(input.alias ?? input.name, 'NexoWatt'), kind, settings: record(custom.settings), fields,
      readOnly: record(input.behavior).readOnly === true };
  }
  function value(m: Model, key: string): Scalar | null { const f = m.fields.get(key); return f?.valid && f.readable && !f.pending ? f.value : null; }
  function number(m: Model, key: string): number | null { const v = value(m, key); return typeof v === 'number' && Number.isFinite(v) ? v : null; }
  function display(m: Model, key: string, decimals?: number, unitOverride?: string): string {
    const f = m.fields.get(key); if (f?.pending) return 'Nicht bestätigt'; const v = value(m, key); if (v === null) return '—';
    const label = f?.options.find(option => option.value === v)?.label;
    const formatted = label ?? (typeof v === 'number' ? v.toLocaleString('de-DE', { maximumFractionDigits: decimals ?? 2 }) : typeof v === 'boolean' ? (v ? 'Ja' : 'Nein') : v);
    const unit = unitOverride || f?.unit; return formatted + (unit ? ` ${unit}` : '');
  }
  function row(root: HTMLElement, label: string, val: string, cls = ''): HTMLElement {
    const item = element('div', 'nw-sh-cv-row ' + cls); item.append(element('span', 'nw-sh-cv-label', label), element('strong', '', val)); root.append(item); return item;
  }
  function button(label: string, callback: () => void): HTMLButtonElement {
    const b = element('button', 'nw-sh-btn', label); b.type = 'button'; b.addEventListener('click', event => { event.stopPropagation(); if (!b.disabled) callback(); }); return b;
  }
  function scheduleClock(): void {
    if (clockTimer !== undefined || !clockSubscribers.size) return;
    clockTimer = setTimeout(() => { clockTimer = undefined;
      for (const [node, entry] of clockSubscribers) { if (!node.isConnected) { clockSubscribers.delete(node); entry.detach(); } else entry.tick(); }
      scheduleClock();
    }, 1000 - Date.now() % 1000);
  }
  function unregisterClock(node: HTMLElement): void { clockSubscribers.delete(node); if (!clockSubscribers.size && clockTimer !== undefined) { clearTimeout(clockTimer); clockTimer = undefined; } }
  /** Approximate solar horizon times; polar days/nights have no fabricated crossing. */
  function solar(date: Date, latitude: number, longitude: number, rise: boolean): Date | null {
    const rad = Math.PI / 180; const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
    const hour = longitude / 15; const t = day + ((rise ? 6 : 18) - hour) / 24; const mean = 0.9856 * t - 3.289;
    const norm = (v: number, n: number): number => (v % n + n) % n;
    const lon = norm(mean + 1.916 * Math.sin(mean * rad) + 0.020 * Math.sin(2 * mean * rad) + 282.634, 360);
    let ascension = norm(Math.atan(0.91764 * Math.tan(lon * rad)) / rad, 360);
    ascension = (ascension + Math.floor(lon / 90) * 90 - Math.floor(ascension / 90) * 90) / 15;
    const sinDecl = 0.39782 * Math.sin(lon * rad); const cosDecl = Math.cos(Math.asin(sinDecl));
    const cosHour = (Math.cos(90.833 * rad) - sinDecl * Math.sin(latitude * rad)) / (cosDecl * Math.cos(latitude * rad));
    if (!Number.isFinite(cosHour) || Math.abs(cosHour) > 1) return null;
    const angle = Math.acos(cosHour) / rad; const h = (rise ? 360 - angle : angle) / 15;
    const utc = norm(h + ascension - 0.06571 * t - 6.622 - hour, 24);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + utc * 3600000);
  }
  function renderClock(root: HTMLElement, m: Model): void {
    const s = m.settings; const clock = element('div', 'nw-sh-cv-clock'); root.append(clock);
    const tick = (): void => {
      const date = new Date(); const tz = text(s.timeZone, '', 80); let options: Intl.DateTimeFormatOptions = {};
      try { if (tz) { new Intl.DateTimeFormat('de-DE', { timeZone: tz }).format(date); options = { timeZone: tz }; } } catch { /* Invalid zone uses local device time. */ }
      clock.replaceChildren();
      const time = new Intl.DateTimeFormat('de-DE', { ...options, hour: '2-digit', minute: '2-digit', ...(s.showSeconds !== false ? { second: '2-digit' as const } : {}) });
      const timeText = time.format(date);
      if (s.style === 'analog') {
        const parts = new Intl.DateTimeFormat('en-GB', { ...options, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date);
        const part = (key: string): number => Number(parts.find(p => p.type === key)?.value ?? 0);
        const face = svg('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': timeText });
        face.append(svg('circle', { cx: '50', cy: '50', r: '46', class: 'nw-sh-cv-clock-face' }));
        for (let i = 0; i < 12; i++) face.append(svg('line', { x1: '50', y1: '8', x2: '50', y2: '12', transform: `rotate(${i * 30} 50 50)`, class: 'nw-sh-cv-clock-tick' }));
        for (const [angle, length, cls] of [[(part('hour') % 12 + part('minute') / 60) * 30, 25, 'hour'], [(part('minute') + part('second') / 60) * 6, 36, 'minute']] as const) face.append(svg('line', { x1: '50', y1: '50', x2: '50', y2: String(50 - length), transform: `rotate(${angle} 50 50)`, class: 'nw-sh-cv-clock-' + cls }));
        if (s.showSeconds !== false) face.append(svg('line', { x1: '50', y1: '55', x2: '50', y2: '10', transform: `rotate(${part('second') * 6} 50 50)`, class: 'nw-sh-cv-clock-second' }));
        clock.append(face);
      } else clock.append(element('time', 'nw-sh-cv-clock-time', timeText));
      if (s.showDate !== false || s.showDow !== false) clock.append(element('div', '', new Intl.DateTimeFormat('de-DE', { ...options, ...(s.showDate !== false ? { day: 'numeric' as const, month: 'long' as const } : {}), ...(s.showDow !== false ? { weekday: 'long' as const } : {}) }).format(date)));
      const lat = finite(s.latitude); const lng = finite(s.longitude);
      if (s.showSun === true && lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        const rise = solar(date, lat, lng, true); const set = solar(date, lat, lng, false);
        const fmt = new Intl.DateTimeFormat('de-DE', { ...options, hour: '2-digit', minute: '2-digit' });
        clock.append(element('small', 'nw-sh-cv-sun', rise && set ? `↑ ca. ${fmt.format(rise)} · ↓ ca. ${fmt.format(set)}` : 'Kein Sonnenauf-/untergang an diesem Tag'));
      }
    };
    tick(); if (clockSubscribers.size < 128) { clockSubscribers.set(root, { tick, detach: () => {} }); scheduleClock(); }
  }
  function icon(name: unknown): HTMLElement {
    const label = text(name, '', 48); const key = label.toLowerCase().replace(/^mdi[:-]/, '');
    const glyphs = new Map([['solar-power', '☀'], ['solar', '☀'], ['sun', '☀'], ['battery', '▰'], ['battery-charging', 'ϟ'], ['home', '⌂'], ['house', '⌂'], ['car', '▣'], ['car-electric', 'ϟ'], ['wind', '≋'], ['weather-windy', '≋'], ['account', '●'], ['person', '●'], ['power', '⏻'], ['lightbulb', '☼'], ['lightbulb-on', '☼'], ['thermometer', '♨'], ['water', '≈']]);
    const node = element('span', 'nw-sh-cv-icon', glyphs.get(key) ?? '◇'); node.title = label; node.setAttribute('aria-label', label); return node;
  }
  function thresholdColor(levelInput: unknown, raw: number, min?: number, max?: number, percentage = false, smooth = false): string {
    const levels = (Array.isArray(levelInput) ? levelInput : []).slice(0, 32).map(record).flatMap(level => { const v = finite(level.value); return v === undefined ? [] : [{ value: v, color: color(level.color) }]; }).sort((a, b) => a.value - b.value);
    if (!levels.length) return '#00d7a0';
    const fraction = min !== undefined && max !== undefined && max > min ? Math.max(0, Math.min(1, (raw - min) / (max - min))) : null;
    const cmp = percentage && fraction !== null ? fraction * 100 : raw;
    if (smooth && fraction !== null) {
      const stops = levels.map(level => ({ fraction: percentage ? Math.max(0, Math.min(1, level.value / 100)) : Math.max(0, Math.min(1, (level.value - min!) / (max! - min!))), color: level.color }));
      if (fraction <= stops[0]!.fraction) return stops[0]!.color;
      for (let i = 1; i < stops.length; i++) { const left = stops[i - 1]!; const right = stops[i]!; if (fraction <= right.fraction) { const blend = right.fraction > left.fraction ? (fraction - left.fraction) / (right.fraction - left.fraction) : 1;
        return '#' + [1, 3, 5].map(offset => Math.round(parseInt(left.color.slice(offset, offset + 2), 16) * (1 - blend) + parseInt(right.color.slice(offset, offset + 2), 16) * blend).toString(16).padStart(2, '0')).join(''); } }
    }
    return (levels.find(level => cmp <= level.value) ?? levels[levels.length - 1])!.color;
  }
  function renderGauge(root: HTMLElement, m: Model): void {
    for (const key of ['VALUE', 'SECOND']) {
      const f = m.fields.get(key); if (!f) continue;
      const v = number(m, key); const min = finite(m.settings.minValue) ?? f.min; const max = finite(m.settings.maxValue) ?? f.max;
      const percent = v !== null && min !== undefined && max !== undefined && max > min ? Math.max(0, Math.min(100, (v - min) * 100 / (max - min))) : null;
      const gauge = element('div', 'nw-sh-cv-gauge'); gauge.append(element('span', 'nw-sh-cv-label', key === 'VALUE' ? text(m.settings.gaugeName, f.label) : f.label));
      const visual = element('div', 'nw-sh-cv-gauge-ring'); const gaugeColor = v === null ? color(m.settings.color) : thresholdColor(m.settings.colorLevels, v, min, max, m.settings.usePercentage === true, m.settings.smoothGradient === true);
      visual.style.setProperty('--nw-cv-progress', `${percent ?? 0}%`); visual.style.setProperty('--nw-cv-color', gaugeColor);
      visual.dataset.known = String(percent !== null); visual.append(element('strong', '', display(m, key, bounded(m.settings.decimals, 1, 0, 6), text(m.settings.gaugeUnit, '', 32))));
      gauge.append(visual); if (min !== undefined && max !== undefined) gauge.append(element('small', '', `${min} — ${max} ${text(m.settings.gaugeUnit, f.unit, 32)}`));
      root.append(gauge);
    }
    if (!m.fields.has('VALUE')) root.append(element('p', '', 'Messwert noch nicht zugeordnet.'));
  }
  function renderWind(root: HTMLElement, m: Model): void {
    const rawDirection = value(m, 'WIND_DIRECTION'); const headings = new Map([['N', 0], ['NNE', 22.5], ['NE', 45], ['ENE', 67.5], ['E', 90], ['ESE', 112.5], ['SE', 135], ['SSE', 157.5], ['S', 180], ['SSW', 202.5], ['SW', 225], ['WSW', 247.5], ['W', 270], ['WNW', 292.5], ['NW', 315], ['NNW', 337.5], ['NO', 45], ['O', 90], ['SO', 135]]); const direction = typeof rawDirection === 'number' ? rawDirection : typeof rawDirection === 'string' ? headings.get(rawDirection.trim().toUpperCase()) ?? null : null; const compass = element('div', 'nw-sh-cv-compass'); compass.setAttribute('aria-label', direction === null ? 'Windrichtung unbekannt' : `Windrichtung ${direction} Grad`);
    compass.append(element('span', 'nw-sh-cv-compass-north', 'N'));
    const arrow = element('span', 'nw-sh-cv-compass-arrow', direction === null ? '—' : '↑'); if (direction !== null) arrow.style.transform = `rotate(${((direction % 360) + 360) % 360}deg)`;
    compass.append(arrow); root.append(compass); row(root, 'Windrichtung', typeof rawDirection === 'string' ? rawDirection : direction === null ? '—' : `${direction}°`); row(root, 'Wind', display(m, 'WIND_SPEED')); row(root, 'Böen', display(m, 'WIND_GUST'));
  }
  function renderPresence(root: HTMLElement, m: Model): void {
    const raw = value(m, 'PRESENCE'); const known = typeof raw === 'boolean'; const present = known ? (m.settings.invert === true ? !raw : raw) : null;
    root.dataset.present = present === null ? 'unknown' : String(present);
    root.append(element('div', 'nw-sh-cv-presence-icon', present === null ? '?' : present ? '●' : '○'), element('strong', '', present === null ? 'Keine Rückmeldung' : present ? 'Anwesend' : 'Abwesend'));
    root.classList.toggle('nw-sh-cv-absent', present === false && m.settings.absentMode === 'dim');
    // Expose explicit hide intent to host layout without hiding an unknown value.
    root.dataset.hideWhenAbsent = String(present === false && m.settings.absentMode === 'hide');
  }
  function renderMarkdown(root: HTMLElement, settings: Row): void {
    const source = text(settings.text ?? settings.markdown, '', 32768); root.classList.add('nw-sh-cv-markdown');
    root.dataset.fontSize = ['s', 'm', 'l', 'xl'].includes(text(settings.fontSize)) ? text(settings.fontSize) : 'm'; root.style.textAlign = settings.align === 'center' ? 'center' : 'left';
    if (!host.NW_SH_MARKDOWN) { root.append(element('pre', '', source)); return; }
    let ast: unknown; try { ast = host.NW_SH_MARKDOWN.parse(source); } catch { root.append(element('pre', '', source)); return; }
    let count = 0; const definitions = new Map<string, Row>();
    for (const n of (Array.isArray(record(ast).children) ? record(ast).children as unknown[] : []).slice(0, 2000)) { const r = record(n); if (r.type === 'definition' && typeof r.identifier === 'string') definitions.set(r.identifier.toLowerCase(), r); }
    const visit = (raw: unknown, parent: HTMLElement, depth: number): void => {
      if (++count > 4000 || depth > 24) return;
      const n = record(raw); const type = text(n.type); const children = Array.isArray(n.children) ? n.children : [];
      if (type === 'html' || type === 'definition') return;
      if (type === 'text') { parent.append(document.createTextNode(text(n.value, '', 32768))); return; }
      let node: HTMLElement;
      if (type === 'root') node = parent;
      else if (type === 'heading') node = document.createElement(`h${bounded(n.depth, 2, 1, 6)}`);
      else if (type === 'paragraph') node = element('p');
      else if (type === 'strong') node = element('strong');
      else if (type === 'emphasis') node = element('em');
      else if (type === 'delete') node = element('del');
      else if (type === 'blockquote') node = element('blockquote');
      else if (type === 'list') { node = n.ordered === true ? element('ol') : element('ul'); if (node instanceof HTMLOListElement && finite(n.start) !== undefined) node.start = Math.round(bounded(n.start, 1, 1, 100000)); }
      else if (type === 'listItem') { node = element('li'); if (typeof n.checked === 'boolean') { const check = element('input'); check.type = 'checkbox'; check.checked = n.checked; check.disabled = true; node.append(check); } }
      else if (type === 'code' || type === 'inlineCode') { node = type === 'code' ? element('pre') : element('code'); node.textContent = text(n.value, '', 32768); }
      else if (type === 'break') node = element('br');
      else if (type === 'thematicBreak') node = element('hr');
      else if (type === 'table') node = element('table');
      else if (type === 'tableRow') node = element('tr');
      else if (type === 'tableCell') node = element('td');
      else if (type === 'link' || type === 'linkReference' || type === 'image' || type === 'imageReference') {
        const definition = type.endsWith('Reference') ? definitions.get(text(n.identifier).toLowerCase()) : n; const url = safeUrl(definition?.url);
        if (type.startsWith('image')) { if (!url) { parent.append(document.createTextNode(text(n.alt))); return; } const image = element('img'); image.src = url; image.alt = text(n.alt); image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; node = image; }
        else { const link = element('a'); if (url) { link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; } link.addEventListener('click', event => event.stopPropagation()); node = link; }
      } else if (type === 'footnoteDefinition') { node = element('aside'); node.append(element('strong', '', text(n.identifier))); }
      else if (type === 'footnoteReference') node = element('sup', '', text(n.label ?? n.identifier));
      else node = element('span');
      if (node !== parent) parent.append(node); for (const child of children.slice(0, 2000)) visit(child, node, depth + 1);
    };
    visit(ast, root, 0);
  }
  function renderIframe(root: HTMLElement, m: Model, cleanup: (() => void)[]): void {
    const url = safeUrl(m.settings.url); if (!url) { root.append(element('p', '', 'Keine gültige Webadresse konfiguriert.')); return; }
    const frame = element('iframe', 'nw-sh-cv-iframe'); frame.title = m.name; frame.loading = 'lazy'; frame.referrerPolicy = 'no-referrer'; frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
    const assign = (): void => { const target = new URL(url); if (m.settings.appendTimestamp === true) target.searchParams.set('_nwts', String(Date.now())); frame.src = host.NW_RUNTIME?.url(target.href) ?? target.href; };
    assign(); root.append(frame);
    root.append(button('Ansicht öffnen', () => {
      const mode = text(m.settings.clickAction, 'dialog');
      if (mode === 'sameTab') window.location.assign(url);
      else if (mode === 'newTab') window.open(url, '_blank', 'noopener,noreferrer');
      else { const dialog = element('dialog', 'nw-sh-cv-iframe-dialog'); const large = element('iframe', 'nw-sh-cv-iframe'); large.title = m.name; large.referrerPolicy = 'no-referrer'; large.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups'); large.src = frame.src;
        const close = (): void => { dialog.close(); dialog.remove(); }; dialog.append(button('Schließen', close), large); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove(), { once: true }); cleanup.push(() => dialog.remove()); dialog.showModal(); }
    }));
    const refresh = bounded(m.settings.refreshInterval, 0, 0, 86400);
    let next = Date.now() + Math.max(10, refresh) * 1000;
    if (clockSubscribers.size < 128) { clockSubscribers.set(root, { tick: () => { if (refresh > 0 && !document.hidden && Date.now() >= next) { next = Date.now() + Math.max(10, refresh) * 1000; assign(); } }, detach: () => { for (const dispose of cleanup) dispose(); } }); scheduleClock(); }
  }
  function legal(f: Field, val: Scalar): boolean {
    if (!f.writable || typeof val !== f.type) return false;
    if (typeof val === 'number') { if (!Number.isFinite(val) || (f.min !== undefined && val < f.min) || (f.max !== undefined && val > f.max)) return false;
      if (f.step !== undefined && f.step > 0) { const steps = (val - (f.min ?? 0)) / f.step; if (Math.abs(steps - Math.round(steps)) > 1e-7) return false; } }
    if (typeof val === 'string' && val.length > 8192) return false;
    return !f.options.length || f.options.some(option => option.value === val);
  }
  function renderUniversal(root: HTMLElement, m: Model): void {
    for (const key of ['VALUE', 'SECOND']) if (m.fields.has(key)) row(root, key === 'SECOND' ? text(m.settings.secondaryName) || m.fields.get(key)?.label || key : m.fields.get(key)?.label ?? key, display(m, key, bounded(m.settings.digits, 1, 0, 6)));
    for (const key of ['ICON1', 'ICON2', 'ICON3']) if (m.fields.has(key)) { const configured = (Array.isArray(m.settings.icons) ? m.settings.icons : []).map(record).find(icon => icon.slot === key); const indicator = row(root, text(configured?.name, m.fields.get(key)?.label ?? key), display(m, key), 'nw-sh-cv-indicator'); const actual = value(m, key); const active = typeof actual === 'boolean' ? (configured?.invert === true ? !actual : actual) : null; if (active === true) indicator.style.color = color(configured?.color); if (text(configured?.icon)) indicator.prepend(icon(configured?.icon)); }
    const numeric = number(m, 'VALUE'); if (numeric !== null) root.style.borderColor = thresholdColor(m.settings.colorLevels, numeric);
    const opacity = value(m, 'OPACITY'); const opacityField = m.fields.get('OPACITY');
    if (typeof opacity === 'boolean') root.style.opacity = String(bounded(opacity ? m.settings.opacityTrue : m.settings.opacityFalse, opacity ? 1 : 0, 0, 1));
    else if (typeof opacity === 'number') { const low = opacityField?.min ?? 0; const high = opacityField?.max ?? 100; if (high > low) root.style.opacity = String(Math.max(0, Math.min(1, (opacity - low) / (high - low)))); }
    const actualAction = value(m, 'ACTION'); const activeIcon = (actualAction === true || (typeof actualAction === 'number' && actualAction !== 0)) && text(m.settings.widgetIconActive); if (activeIcon) root.prepend(icon(activeIcon));
    const f = m.fields.get('ACTION'); if (!f) return;
    let target: Scalar | null = null;
    if (m.settings.actionType === 'toggle') { const actual = value(m, 'ACTION'); if (typeof actual === 'boolean') target = !actual; else if (typeof actual === 'number' && f.min !== undefined && f.max !== undefined) target = actual === f.min ? f.max : f.min; }
    else if (scalar(m.settings.actionValue)) target = m.settings.actionValue;
    const status = element('div', 'nw-sh-cv-action-status'); status.setAttribute('role', 'status');
    const send = async (confirmed: boolean): Promise<void> => {
      if (target === null || m.readOnly || !legal(f, target) || !root.isConnected || !host.NW_SH_FEEDBACK) return;
      try { const result = await host.NW_SH_FEEDBACK.post('/api/smarthome/control', { id: m.id, key: 'ACTION', value: target, ...(confirmed ? { confirmed: true } : {}) }, m.id);
        if (result?.ok === true) window.dispatchEvent(new CustomEvent('nw-smarthome-refresh', { detail: { id: m.id } }));
        else status.textContent = 'Befehl nicht bestätigt. Gerätestatus prüfen.';
      } catch { status.textContent = 'Befehl nicht bestätigt. Gerätestatus prüfen.'; }
    };
    const action = button('Aktion ausführen', () => {
      const scope = text(m.settings.actionConfirmScope, 'both'); const wantsConfirm = m.settings.actionConfirm === 'dialog' && (scope === 'both' || (scope === 'on' && !!target) || (scope === 'off' && !target));
      if (f.confirm || wantsConfirm) { root.dataset.confirming = 'true'; status.replaceChildren(element('p', '', text(m.settings.actionConfirmText, 'Diese Aktion ausführen?')),
        button('Bestätigen', () => { delete root.dataset.confirming; status.replaceChildren(); void send(true); }), button('Abbrechen', () => { delete root.dataset.confirming; status.replaceChildren(); })); }
      else void send(false);
    });
    action.disabled = m.readOnly || target === null || !legal(f, target) || !host.NW_SH_FEEDBACK;
    root.append(action, status); host.NW_SH_FEEDBACK?.attachStatus(root, m.id);
  }
  function renderEnergy(root: HTMLElement, m: Model): void {
    for (const [setting, prefix, label] of [['producers', 'PRODUCER', 'Erzeuger'], ['consumers', 'CONSUMER', 'Verbraucher']] as const) {
      const configured = Array.isArray(m.settings[setting]) ? m.settings[setting] as unknown[] : [];
      const rows = configured.slice(0, 31).map(record); const section = element('section', 'nw-sh-cv-energy-group'); section.append(element('h3', '', label));
      for (const [index, item] of rows.entries()) {
        const slot = `${prefix}${Math.round(bounded(item.index, index + 1, 1, 31))}`; const v = number(m, slot); const card = element('div', 'nw-sh-cv-energy-item'); card.style.setProperty('--nw-cv-color', color(item.color));
        card.dataset.direction = v === null ? 'unknown' : v === 0 ? 'idle' : v > 0 ? 'forward' : 'reverse';
        if (text(item.icon)) card.append(icon(item.icon)); if (text(item.deviceType)) card.append(element('small', '', text(item.deviceType))); row(card, text(item.name, `${label} ${index + 1}`), display(m, slot, undefined, text(item.unit, '', 32))); if (m.fields.has(slot + '_TODAY')) row(card, 'Heute', display(m, slot + '_TODAY'));
        section.append(card);
      }
      if (!rows.length) section.append(element('p', '', 'Noch keine Zuordnung.')); root.append(section);
    }
    const battery = element('section', 'nw-sh-cv-energy-battery'); battery.style.borderColor = color(m.settings.batteryColor); if (text(m.settings.batteryIcon)) battery.append(icon(m.settings.batteryIcon));
    for (const [key, label] of [['BATTERY_SOC', 'Ladezustand'], ['BATTERY_POWER', 'Batterieleistung'], ['BATTERY_VOLTAGE', 'Spannung'], ['BATTERY_CURRENT', 'Strom']]) if (key && label && m.fields.has(key)) row(battery, label, display(m, key));
    if (battery.childNodes.length) { battery.prepend(element('h3', '', text(m.settings.batteryName, 'Batterie'))); root.append(battery); }
  }
  function renderForecast(container: HTMLElement, device: unknown): void {
    const m = model(device, 'weather'); if (!m) return;
    const city = text(m.settings.cityName) || (value(m, 'LOCATION') === null ? '' : display(m, 'LOCATION')); if (city) container.append(element('h3', '', city));
    const current = element('section', 'nw-sh-cv-weather-current');
    const names = new Map([['ACTUAL', 'Temperatur'], ['WEATHER', 'Wetter'], ['HUMIDITY', 'Luftfeuchte'], ['WIND_SPEED', 'Wind'], ['WIND_DIRECTION', 'Windrichtung'], ['PRESSURE', 'Luftdruck'], ['PRECIPITATION_CHANCE', 'Regenwahrscheinlichkeit'], ['REAL_FEEL_TEMPERATURE', 'Gefühlt'], ['UV', 'UV-Index'], ['ICON', 'Wettersymbol']]);
    for (const [key, label] of names) if (m.fields.has(key)) row(current, label, display(m, key));
    if (current.childNodes.length) container.append(current);
    const forecast = element('div', 'nw-sh-cv-forecast');
    for (let i = 0; i <= bounded(m.settings.forecastDays, 7, 0, 7); i++) {
      const suffix = i === 0 ? '' : String(i); const slots = ['TEMP_MIN', 'TEMP_MAX', 'TEMP', 'DOW', 'STATE', 'ICON'].map(k => k + suffix);
      if (!slots.some(key => m.fields.has(key))) continue;
      const day = element('section', 'nw-sh-cv-forecast-day'); day.append(element('h4', '', value(m, 'DOW' + suffix) === null ? (i === 0 ? 'Heute' : `Tag ${i}`) : display(m, 'DOW' + suffix)));
      for (const [key, label] of [['TEMP_MIN', 'Minimum'], ['TEMP_MAX', 'Maximum'], ['TEMP', 'Temperatur'], ['STATE', 'Wetter'], ['PRECIPITATION_CHANCE', 'Regen'], ['ICON', 'Wettersymbol']]) if (key && label && m.fields.has(key + suffix)) row(day, label, display(m, key + suffix));
      forecast.append(day);
    }
    if (forecast.childNodes.length) container.append(forecast);
    if (!current.childNodes.length && !forecast.childNodes.length) container.append(element('p', '', 'Wetterdaten noch nicht zugeordnet.'));
  }
  async function historyJson(response: Response): Promise<unknown> {
    const limit = 512 * 1024; const reader = response.body?.getReader();
    if (!reader) { const body = await response.text(); if (body.length > limit) throw new Error('limit'); return JSON.parse(body) as unknown; }
    let size = 0; let body = ''; const decoder = new TextDecoder();
    try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > limit) { await reader.cancel(); throw new Error('limit'); } body += decoder.decode(next.value, { stream: true }); } body += decoder.decode(); return JSON.parse(body) as unknown; }
    finally { reader.releaseLock(); }
  }
  function renderHistory(container: HTMLElement, device: unknown, key: string): View {
    let m = model(device, 'universal'); let f = m?.fields.get(key); const panel = element('section', 'nw-sh-cv-history'); container.append(panel);
    let controller: AbortController | null = null; let dead = false; let points: { ts: number; value: number }[] = []; let from = 0; let until = 0; let truncated = false;
    const status = element('p', '', 'Verlauf erst nach Auswahl laden.'); status.setAttribute('role', 'status'); const chart = element('div', 'nw-sh-cv-chart');
    const actions = element('div', 'nw-sh-cv-history-actions'); const settings = element('div', 'nw-sh-cv-history-actions'); const heading = element('h3', '', f?.label ?? 'Verlauf');
    function select(label: string, options: [string, string][]): HTMLSelectElement { const control = element('select', 'nw-input'); control.setAttribute('aria-label', label); for (const [val, name] of options) { const option = element('option', '', name); option.value = val; control.append(option); } const wrapper = element('label', '', label + ' '); wrapper.append(control); settings.append(wrapper); return control; }
    const line = select('Darstellung', [['line', 'Linie'], ['step-start', 'Stufe am Anfang'], ['step-end', 'Stufe am Ende']]);
    const smoothing = select('Glättung', [['0', 'Keine'], ['30', '30 Sekunden'], ['60', '1 Minute'], ['300', '5 Minuten'], ['600', '10 Minuten']]);
    const method = select('Berechnung', [['average', 'Mittelwert'], ['min', 'Minimum'], ['max', 'Maximum'], ['median', 'Median']]);
    const start = element('input', 'nw-input'); start.type = 'datetime-local'; start.setAttribute('aria-label', 'Verlauf von');
    const end = element('input', 'nw-input'); end.type = 'datetime-local'; end.setAttribute('aria-label', 'Verlauf bis');
    const readable = (): boolean => !!f?.readable && ['number', 'boolean', 'mixed'].includes(f.type);
    function plot(): void {
      chart.replaceChildren(); if (!points.length || !f) return;
      let low = Infinity; let high = -Infinity; for (const p of points) { low = Math.min(low, p.value); high = Math.max(high, p.value); }
      let shown = points; const bucketMs = f.type === 'boolean' ? 0 : bounded(Number(smoothing.value), 0, 0, 600) * 1000;
      if (bucketMs > 0) { const buckets = new Map<number, { ts: number; values: number[] }>();
        for (const p of points) { const bucket = Math.floor((p.ts - from) / bucketMs); const item = buckets.get(bucket) ?? { ts: p.ts, values: [] }; item.values.push(p.value); buckets.set(bucket, item); }
        shown = [...buckets.values()].map(item => { const sorted = [...item.values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); const val = method.value === 'min' ? sorted[0]! : method.value === 'max' ? sorted[sorted.length - 1]! : method.value === 'median' ? (sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2) : item.values.reduce((sum, v) => sum + v, 0) / item.values.length; return { ts: item.ts, value: val }; });
      }
      const range = high - low || 1; const xy = shown.map(p => ({ x: 10 + (p.ts - from) * 580 / (until - from), y: 180 - (p.value - low) * 160 / range }));
      const type = f.type === 'boolean' ? 'step-end' : line.value; const segments: string[] = [];
      for (let i = 0; i < xy.length; i++) { const p = xy[i]!; const prev = xy[i - 1]; if (prev && type === 'step-start') segments.push(`${prev.x.toFixed(2)},${p.y.toFixed(2)}`); else if (prev && type === 'step-end') segments.push(`${p.x.toFixed(2)},${prev.y.toFixed(2)}`); segments.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`); }
      const graph = svg('svg', { viewBox: '0 0 600 200', role: 'img', 'aria-label': `${f.label}: ${points.length} Messwerte, Minimum ${low}, Maximum ${high}` });
      graph.append(svg('polyline', { points: segments.join(' '), fill: 'none', class: 'nw-sh-cv-chart-line' }));
      for (let i = 0; i < xy.length; i++) { const p = xy[i]!; const val = shown[i]!; const marker = svg('circle', { cx: p.x.toFixed(2), cy: p.y.toFixed(2), r: '3', class: 'nw-sh-cv-chart-point' }); const tip = svg('title', {}); tip.textContent = `${new Date(val.ts).toLocaleString('de-DE')} · ${val.value.toLocaleString('de-DE')} ${f.unit}`; marker.append(tip); graph.append(marker); }
      chart.append(graph, element('small', '', `${new Date(from).toLocaleString('de-DE')} — ${new Date(until).toLocaleString('de-DE')}`));
      status.textContent = `Minimum ${low.toLocaleString('de-DE')} · Maximum ${high.toLocaleString('de-DE')} ${f.unit} · ${points.length} Messwerte${bucketMs ? ' · geglättete Anzeige' : ''}${truncated ? ' · gekürzt' : ''}`;
    }
    for (const control of [line, smoothing, method]) control.addEventListener('change', plot);
    function controls(): void { for (const control of [...actions.querySelectorAll('button'), ...settings.querySelectorAll('input'), ...settings.querySelectorAll('select'), ...settings.querySelectorAll('button')]) control.disabled = !readable(); if (f?.type === 'boolean') { line.disabled = true; smoothing.disabled = true; method.disabled = true; } }
    async function loadRange(since: number, to: number): Promise<void> {
      if (dead || !m || !readable()) return;
      if (!Number.isFinite(since) || !Number.isFinite(to) || since >= to || to - since > 366 * 86400000 || since < 0 || to > Date.now() + 60000) { status.textContent = 'Gültigen Zeitraum bis heute wählen (höchstens ein Jahr).'; return; }
      controller?.abort(); controller = new AbortController(); const active = controller;
      const query = new URLSearchParams({ id: m.id, key, from: String(since), to: String(to), maxPoints: '1000' });
      let abort: (() => void) | undefined; const aborted = new Promise<never>((_resolve, reject) => { abort = () => reject(new Error('aborted')); active.signal.addEventListener('abort', abort, { once: true }); });
      const timer = setTimeout(() => active.abort(), 5500); status.textContent = 'Verlauf wird geladen …'; chart.replaceChildren(); points = [];
      try {
        const operation = (async (): Promise<unknown> => { const response = await fetch('/api/smarthome/control-history?' + query.toString(), { cache: 'no-store', signal: active.signal }); if (!response.ok) { await response.body?.cancel(); throw new Error('unavailable'); } return historyJson(response); })();
        const data = record(await Promise.race([operation, aborted])); if (dead || active !== controller || active.signal.aborted) return;
        if (data.ok !== true || !Array.isArray(data.points)) throw new Error('invalid');
        points = data.points.slice(0, 1000).flatMap(raw => { const p = record(raw); const ts = finite(p.ts); const v = typeof p.value === 'boolean' ? Number(p.value) : finite(p.value); return ts !== undefined && v !== undefined && ts >= since && ts <= to ? [{ ts, value: v }] : []; }).sort((a, b) => a.ts - b.ts);
        from = since; until = to; truncated = data.truncated === true;
        if (!points.length) { status.textContent = 'Keine Verlaufsdaten verfügbar.'; return; } plot();
      } catch { if (!dead && active === controller) status.textContent = active.signal.aborted ? 'Verlaufsabfrage abgebrochen.' : 'Verlauf nicht verfügbar.'; }
      finally { clearTimeout(timer); if (abort) active.signal.removeEventListener('abort', abort); }
    }
    for (const [label, hours] of [['1 Stunde', 1], ['6 Stunden', 6], ['12 Stunden', 12], ['24 Stunden', 24], ['3 Tage', 72], ['7 Tage', 168], ['30 Tage', 720]] as const) actions.append(button(label, () => { const to = Date.now(); void loadRange(to - hours * 3600000, to); }));
    settings.append(start, end, button('Zeitraum laden', () => { void loadRange(new Date(start.value).getTime(), new Date(end.value).getTime()); }),
      button('Vergrößern', () => { if (until > from) void loadRange(until - Math.max(60000, (until - from) / 2), until); }),
      button('Verkleinern', () => { if (until > from) void loadRange(Math.max(0, until - Math.min(366 * 86400000, (until - from) * 2)), until); }),
      button('Früher', () => { const span = until - from; if (span > 0) void loadRange(from - span / 2, until - span / 2); }),
      button('Später', () => { const span = until - from; if (span > 0) { const to = Math.min(Date.now(), until + span / 2); void loadRange(to - span, to); } }));
    panel.append(heading, actions, settings, status, chart); controls();
    return { update(next) { const normalized = model(next, 'universal'); if (normalized?.id !== m?.id) { controller?.abort(); points = []; chart.replaceChildren(); } m = normalized; f = m?.fields.get(key); heading.textContent = f?.label ?? 'Verlauf'; controls(); if (!readable()) { controller?.abort(); points = []; chart.replaceChildren(); status.textContent = 'Verlauf nicht freigegeben.'; } }, destroy() { dead = true; controller?.abort(); points = []; panel.remove(); } };
  }
  function render(container: HTMLElement, device: unknown): View | null {
    const initial = model(device); if (!initial) return null;
    views.get(container)?.destroy(); const content = element('div', 'nw-sh-custom-view'); content.dataset.kind = initial.kind; const history = element('div'); container.append(content, history);
    let current = initial; const samples: { ts: number; value: number }[] = []; let signature = ''; let dead = false; let disposers: (() => void)[] = []; let historyView: View | null = null;
    const cleanup = (): void => { unregisterClock(content); for (const dispose of disposers) dispose(); disposers = []; };
    const paint = (m: Model): void => {
      const next = JSON.stringify([m.kind, m.settings, [...m.fields.values()], m.readOnly]); if (next === signature) return; signature = next; cleanup(); content.replaceChildren(); content.className = 'nw-sh-custom-view'; content.style.opacity = ''; content.style.borderColor = ''; content.style.textAlign = ''; content.removeAttribute('aria-hidden'); delete content.dataset.hideWhenAbsent; delete content.dataset.present; delete content.dataset.fontSize; delete content.dataset.confirming; content.dataset.kind = m.kind; container.hidden = false; container.style.gridColumn = m.kind === 'newline' ? '1 / -1' : '';
      if (text(m.settings.title)) content.append(element('h3', '', text(m.settings.title))); if (text(m.settings.color)) content.style.borderColor = color(m.settings.color); if (text(m.settings.widgetIcon)) content.append(icon(m.settings.widgetIcon));
      if (m.kind === 'clock') renderClock(content, m);
      else if (m.kind === 'gauge') renderGauge(content, m);
      else if (m.kind === 'wind') renderWind(content, m);
      else if (m.kind === 'presence') { renderPresence(content, m); container.hidden = content.dataset.hideWhenAbsent === 'true'; }
      else if (m.kind === 'markdown') renderMarkdown(content, m.settings);
      else if (m.kind === 'iframe') renderIframe(content, m, disposers);
      else if (m.kind === 'universal') renderUniversal(content, m);
      else if (m.kind === 'energyFlow') renderEnergy(content, m);
      else if (m.kind === 'weather') renderForecast(content, { id: m.id, customView: { kind: 'weather', settings: m.settings }, deviceControls: { fields: [...m.fields.values()] } });
      else if (m.kind === 'newline') { content.classList.add('nw-sh-cv-newline'); content.setAttribute('aria-hidden', 'true'); }
      if (m.kind === 'universal' && m.settings.quickChart === true) {
        const currentValue = number(m, 'VALUE'); const now = Date.now(); const span = bounded(m.settings.quickChartInterval, 300, 10, 86400) * 1000;
        if (currentValue !== null) samples.push({ ts: now, value: currentValue }); while (samples.length > 512 || (samples.length && samples[0]!.ts < now - span)) samples.shift();
        const box = element('div', 'nw-sh-cv-chart'); box.append(element('small', '', 'Live-Verlauf seit Öffnen'));
        if (samples.length) { let min = Infinity; let max = -Infinity; for (const sample of samples) { min = Math.min(min, sample.value); max = Math.max(max, sample.value); } const graph = svg('svg', { viewBox: '0 0 600 200', role: 'img', 'aria-label': `Live-Verlauf, ${samples.length} empfangene Werte` }); graph.append(svg('polyline', { points: samples.map(sample => `${(10 + (sample.ts - now + span) * 580 / span).toFixed(2)},${(180 - (sample.value - min) * 160 / (max - min || 1)).toFixed(2)}`).join(' '), fill: 'none', class: 'nw-sh-cv-chart-line' })); box.append(graph); } else box.append(element('p', '', 'Noch keine Messwerte.')); content.append(box);
      }
      if (!['newline', 'clock', 'markdown', 'iframe'].includes(m.kind)) {
        const numeric = [...m.fields.values()].filter(f => f.readable && ['number', 'boolean'].includes(f.type));
        if (numeric.length) { const choices = element('select', 'nw-input'); choices.setAttribute('aria-label', 'Messwert für Verlauf'); for (const f of numeric) { const option = element('option', '', f.label); option.value = f.key; choices.append(option); }
          const open = button('Verlauf öffnen', () => { historyView?.destroy(); historyView = renderHistory(history, { id: current.id, deviceControls: { fields: [...current.fields.values()] } }, choices.value); }); content.append(choices, open); }
      }
    };
    const view: View = { update(next) { if (dead) return; const m = model(next); if (m) { current = m; paint(m); } }, destroy() { if (dead) return; dead = true; cleanup(); historyView?.destroy(); content.remove(); history.remove(); views.delete(container); } };
    views.set(container, view); paint(initial); return view;
  }
  const api: API = { render, renderDetails: render, renderTile(device) { if (!model(device)) return null; const root = element('div', 'nw-sh-cv-tile'); render(root, device); return root; },
    update(root, device) { views.get(root)?.update(device); }, destroy(root) { views.get(root)?.destroy(); },
    isInteracting(root = document.body) { const confirming = [...root.querySelectorAll<HTMLElement>('.nw-sh-custom-view')].some(content => content.dataset.confirming === 'true'); const focused = document.activeElement; return confirming || (focused instanceof HTMLElement && root.contains(focused) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName)); }, renderForecast, renderHistory };
  host.NW_SH_CUSTOM_VIEWS = Object.freeze(api);
})();
