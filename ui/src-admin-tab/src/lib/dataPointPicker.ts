/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Öffnet den vorhandenen AppCenter-Datenpunktdialog für React-Felder.
 * Daten und Wirkung: Nur Statekennungsauswahl; kein Geräteschreiben und kein Speichern.
 * Bei Änderungen: Origin, Fenster, Request-ID, Abbruch und verspätete Antworten zusammen prüfen.
 * Eingebettet dient der Elternrahmen als Host; standalone öffnet derselbe geschützte Dialog als Popup.
 */
import { isRecord, isSafeJson } from './adminContracts';
import { getRuntimeProxyBase } from './adminConnection';

export type DataPointMode = 'read' | 'write';
export type DataPointPickOptions = { currentId?: string; mode?: DataPointMode; signal?: AbortSignal };
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512 && value === value.trim() && !/[\x00-\x1f\x7f]/.test(value);

/** Ein Auftrag gehört genau einem Aufruferfenster; alle Listener/Timer werden beendet. */
export function chooseDataPoint({ currentId = '', mode = 'read', signal }: DataPointPickOptions = {}): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Auswahl abgebrochen.', 'AbortError')); return; }
    const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
    const origin = window.location.origin;
    const embedded = window.parent !== window && new URLSearchParams(window.location.search).get('embedded') === '1';
    let peer: Window | null = embedded ? window.parent : null;
    let popup: Window | null = null;
    let settled = false, sent = false;
    let closePoll: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const sendCancel = () => { try { peer?.postMessage({ type: 'nw:dp-picker-cancel', requestId }, origin); } catch {} };
    const finish = (id: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearInterval(closePoll);
      window.removeEventListener('message', receive);
      window.removeEventListener('pagehide', abort);
      signal?.removeEventListener('abort', abort);
      if (error || id === null) sendCancel();
      try { if (popup && !popup.closed) popup.close(); } catch {}
      if (error) reject(error); else resolve(id);
    };
    const abort = () => finish(null, new DOMException('Auswahl abgebrochen.', 'AbortError'));
    const open = () => {
      if (sent || !peer || settled) return;
      sent = true;
      try { peer.postMessage({ type: 'nw:dp-picker-open', requestId, currentId: currentId.slice(0, 512), mode }, origin); }
      catch { finish(null, new Error('Datenpunktauswahl konnte nicht geöffnet werden.')); }
    };
    function receive(event: MessageEvent<unknown>) {
      if (settled || event.origin !== origin || event.source !== peer || !isSafeJson(event.data) || !isRecord(event.data) || event.data.requestId !== requestId) return;
      if (event.data.type === 'nw:dp-picker-ready' && popup) { open(); return; }
      if (event.data.type === 'nw:dp-picker-opened' && sent) {
        clearTimeout(timer);
        timer = setTimeout(() => finish(null, new Error('Datenpunktauswahl beendet. Bitte erneut öffnen.')), 300000);
      }
      if (event.data.type === 'nw:dp-picker-result' && sent) {
        if (event.data.id === null) finish(null);
        else if (validId(event.data.id)) finish(event.data.id);
      }
    }
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', abort);
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(null, new Error('Datenpunktauswahl nicht erreichbar. Bitte Anmeldung prüfen und erneut öffnen.')), 15000);
    if (embedded) open();
    else {
      const url = new URL(`${getRuntimeProxyBase() ?? ''}/ems-apps.html`, origin);
      url.searchParams.set('nwAdmin', '1'); url.searchParams.set('dpPicker', '1'); url.searchParams.set('requestId', requestId);
      try { popup = window.open(url.toString(), `nw-dp-picker-${requestId}`, 'popup,width=1050,height=760'); }
      catch { finish(null, new Error('Bitte das Fenster zur Datenpunktauswahl im Browser zulassen.')); return; }
      peer = popup;
      if (!popup) { finish(null, new Error('Bitte das Fenster zur Datenpunktauswahl im Browser zulassen.')); return; }
      closePoll = setInterval(() => { if (popup?.closed) finish(null); }, 400);
    }
  });
}
