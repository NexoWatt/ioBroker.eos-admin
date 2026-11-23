/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ergänzt bestehende SmartHome-Kacheln um einheitliche Typ- und Zustandsanzeigen.
 * Daten und Wirkung: Liest den vorhandenen Gerätevertrag und ergänzt ausschließlich lokale DOM-Texte und sichere Stilwerte.
 * Bei Änderungen: Fehlende und veraltete Werte, vorhandene Bedienelemente und idempotente Dekoration ohne Gerätebefehle prüfen.
 */
/**
 * SmartHome-Gerätekacheln: reine Darstellungsanpassung an den EOS-Gerätevertrag.
 * Die bestehenden Bedienelemente und ihre Ereignisse bleiben erhalten. Werte
 * stammen ausschließlich aus vorhandenen Rückmeldungen. Dieses Modul liest
 * keine Datenpunkte, lädt keine Medien nach und sendet keine Gerätebefehle.
 */
interface Window {
  NW_SH_PRESENTATION?: { decorate(tile: HTMLElement, device: unknown): void };
}

(function (browser: Window) {
  'use strict';

  const kinds = new Map([
    ['switch', 'Schalter'], ['dimmer', 'Dimmer'], ['color', 'Farblicht'],
    ['blind', 'Beschattung'], ['rtr', 'Raumklima'], ['scene', 'Szene'],
    ['sensor', 'Sensor'], ['player', 'Musik'], ['camera', 'Kamera'], ['widget', 'Widget'],
  ]);
  const unusable = new Set(['offline', 'stale', 'error', 'invalid', 'unknown']);
  type StateField = 'on' | 'level' | 'position' | 'currentTemp' | 'setpoint'
    | 'title' | 'artist' | 'playing' | 'power' | 'source' | 'muted';

  function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function record(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
  }

  function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function fieldUsable(device: Record<string, unknown>, field: StateField): boolean {
    const quality = record(device.quality);
    if (quality.valid === false || unusable.has(text(quality.status))) return false;
    const fields = record(device.fieldQuality);
    // Only fixed field names in this module call this read-only accessor.
    const fieldQuality = record(fields[field]);
    return fieldQuality.valid !== false
      && !unusable.has(text(fieldQuality.status))
      && fieldQuality.status !== 'unknown';
  }

  function element(className: string, value?: string): HTMLDivElement {
    const node = document.createElement('div');
    node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function labelToggle(tile: HTMLElement, device: Record<string, unknown>, type: string): void {
    const toggle = tile.querySelector<HTMLButtonElement>('.nw-sh-mini-toggle');
    if (!toggle) return;
    const state = record(device.state);
    const behavior = record(device.behavior);
    const momentary = type === 'scene' || behavior.commandMode === 'momentary';
    const levelKnown = (type === 'dimmer' || type === 'color')
      && finite(state.level) && fieldUsable(device, 'level');
    const onKnown = typeof state.on === 'boolean' && fieldUsable(device, 'on');
    let label = toggle.querySelector<HTMLElement>('.nw-sh-mini-toggle__label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'nw-sh-mini-toggle__label';
      toggle.appendChild(label);
    }
    label.textContent = momentary ? 'Auslösen'
      : onKnown || levelKnown ? (toggle.getAttribute('aria-pressed') === 'true' ? 'Ein' : 'Aus')
        : 'Keine Rückmeldung';
    // The existing aria-label describes the action, aria-pressed the real state.
    // No optimistic switch, write permission or event handler is introduced here.
  }

  function decorateBlind(tile: HTMLElement, device: Record<string, unknown>): void {
    const dial = tile.querySelector<HTMLElement>('.nw-sh-tile-dial');
    const arc = dial?.querySelector<HTMLElement>('.nw-sh-tile-dial__arc');
    if (!dial || !arc) return;
    const state = record(device.state);
    const raw = finite(state.position) && fieldUsable(device, 'position') ? state.position
      : finite(state.level) && fieldUsable(device, 'level') ? state.level : null;
    const known = raw !== null && raw >= 0 && raw <= 100;
    const visual = element('nw-sh-control-visual');
    visual.setAttribute('aria-hidden', 'true');
    const preview = element('nw-sh-blind-preview' + (known ? '' : ' nw-sh-blind-preview--unknown'));
    preview.style.setProperty('--nw-sh-cover-position', known ? `${raw}%` : '0%');
    const slats = element('nw-sh-blind-preview__slats');
    const value = element('nw-sh-blind-preview__value', known ? `${Math.round(raw)} %` : '—');
    preview.appendChild(slats);
    preview.appendChild(value);
    visual.appendChild(preview);
    arc.replaceWith(visual);
    dial.classList.add('nw-sh-tile-dial--blind');
    // It is a neutral position meter. The mapping does not promise that 0 means
    // open or closed; neither a polarity nor a moving state is invented.
  }

  function decorateClimate(tile: HTMLElement, device: Record<string, unknown>): void {
    const big = tile.querySelector<HTMLElement>('.nw-sh-tile__big');
    if (!big) return;
    const state = record(device.state);
    big.classList.add('nw-sh-climate-summary');
    big.dataset.temperatureSource = finite(state.currentTemp) && fieldUsable(device, 'currentTemp')
      ? 'current' : finite(state.setpoint) && fieldUsable(device, 'setpoint') ? 'setpoint' : 'unknown';
    // Existing Ist/Soll values and humidity keep their original rendering and
    // configured units. No second numeric display or fallback temperature.
  }

  function decoratePlayer(tile: HTMLElement, device: Record<string, unknown>): void {
    if (tile.querySelector('.nw-sh-player-summary')) return;
    const state = record(device.state);
    const quality = record(device.quality);
    if (unusable.has(text(quality.status))) return;
    const title = fieldUsable(device, 'title') ? text(state.title) : '';
    const artist = fieldUsable(device, 'artist') ? text(state.artist) : '';
    if (!title && !artist) return;
    const summary = element('nw-sh-player-summary');
    if (title) summary.appendChild(element('nw-sh-player-summary__title', title));
    if (artist) summary.appendChild(element('nw-sh-player-summary__artist', artist));
    const stateNode = tile.querySelector<HTMLElement>('.nw-sh-tile__state');
    if (stateNode) {
      const room = text(device.room);
      const showRoom = room && stateNode.textContent?.startsWith(`${room} · `);
      const playback = typeof state.playing === 'boolean' && fieldUsable(device, 'playing')
        ? state.playing ? 'Spielt' : 'Pausiert'
        : typeof state.power === 'boolean' && fieldUsable(device, 'power')
          ? state.power ? 'Ein' : 'Aus' : '';
      const source = fieldUsable(device, 'source') ? text(state.source) : '';
      const muted = state.muted === true && fieldUsable(device, 'muted') ? 'Stumm' : '';
      stateNode.textContent = [showRoom ? room : '', playback, source, muted].filter(Boolean).join(' · ')
        || 'Medieninformationen';
    }
    const footer = tile.querySelector<HTMLElement>('.nw-sh-tile__footer');
    if (footer) tile.insertBefore(summary, footer);
    else tile.appendChild(summary);
    // Cover URLs remain the responsibility of the existing detail view. Merely
    // displaying a tile never adds external image requests or credential URLs.
  }

  function decorate(tile: HTMLElement, rawDevice: unknown): void {
    const device = record(rawDevice);
    const type = text(device.type).toLowerCase();
    const title = tile.querySelector<HTMLElement>('.nw-sh-tile__title');
    if (title && !title.querySelector('.nw-sh-tile__kind')) {
      const readOnly = tile.classList.contains('nw-sh-tile--readonly');
      const kind = element('nw-sh-tile__kind', (kinds.get(type) || 'Gerät') + (readOnly ? ' · Nur Anzeige' : ''));
      title.insertBefore(kind, title.firstChild);
    }
    tile.querySelector('.nw-sh-tile__state')?.classList.add('nw-sh-tile__state--pill');
    labelToggle(tile, device, type);
    if (type === 'blind') decorateBlind(tile, device);
    if (type === 'rtr') decorateClimate(tile, device);
    if (type === 'player') decoratePlayer(tile, device);
    if (type === 'scene') {
      const trigger = tile.querySelector<HTMLButtonElement>('.nw-sh-mini-btn');
      if (trigger && !trigger.querySelector('.nw-sh-scene-trigger__label')) {
        const label = document.createElement('span');
        label.className = 'nw-sh-scene-trigger__label';
        label.textContent = 'Szene ausführen';
        trigger.appendChild(label);
      }
    }
  }

  browser.NW_SH_PRESENTATION = Object.freeze({ decorate });
})(window);
