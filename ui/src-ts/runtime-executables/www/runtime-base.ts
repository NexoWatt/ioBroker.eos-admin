/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Hält lokale VIS-Ressourcen und API-Aufrufe im Instanzpfad des Admin-Proxys.
 * Daten und Wirkung: Liest ausschließlich den eigenen Browserpfad; erweitert im
 * Proxykontext gleichursprüngliche bekannte Runtime-URLs und den lokalen Fetch.
 * Keine Rollenfreigabe, Passwortablage, DOM-/Location-Prototypänderung oder fremde
 * Zieladresse. Ohne gültigen Proxykontext bleibt der direkte Betrieb unverändert.
 * Bei Änderungen: Request/Init, fremde Ursprünge, Präfixgrenzen, HTML-Bootreihenfolge,
 * EventSource und Navigation gemeinsam prüfen; der Server prüft Rechte weiterhin.
 */
interface NexoWattRuntimeBase {
  readonly isProxy: boolean;
  readonly instance: string | null;
  url(value: string): string;
  pathname(): string;
  adminBase(): string;
}
interface Window { NW_RUNTIME?: NexoWattRuntimeBase }

(function () {
  'use strict';
  if (window.NW_RUNTIME) return;
  const initialPath = window.location.pathname;
  // Keine Dekodierung oder Normalisierung fremder Präfixe: Prozentzeichen,
  // Punktsegmente, doppelte Slashes und Schemas sind keine Admin-Public-Paths.
  const proxyContext = (): { prefix: string; instance: string } | null => {
    if (initialPath.length > 4096 || !initialPath.startsWith('/')) return null;
    // Ein weiterer Instanzmarker wäre zwischen Public-Pfad und Runtimepfad
    // mehrdeutig; weder erste noch letzte Instanz stillschweigend auswählen.
    if ((initialPath.match(/\/proxy\/nexowatt-ui\.(?:0|[1-9][0-9]{0,5})(?=\/|$)/gu) || []).length > 1) return null;
    const segments = initialPath.split('/');
    for (let index = 1; index <= 17 && index < segments.length; index += 1) {
      const segment = segments.at(index);
      if (!segment || segment.length > 128 || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/u.test(segment)) return null;
      const instanceMatch = segment === 'proxy' ? /^nexowatt-ui\.(0|[1-9][0-9]{0,5})$/u.exec(segments.at(index + 1) || '') : null;
      if (instanceMatch?.[1] !== undefined) {
        const candidate = segments.slice(0, index + 2).join('/');
        return candidate.length <= 256 ? { prefix: candidate, instance: instanceMatch[1] } : null;
      }
    }
    return null;
  };
  const context = proxyContext();
  const prefix = context?.prefix || '';
  const isProxy = prefix !== '';
  const origin = window.location.origin;
  const publicPath = isProxy ? prefix.slice(0, prefix.lastIndexOf('/proxy/')) + '/' : '/';

  /** Nur eigene bekannte HTTP-Routen; Admin-, OAuth- und externe URLs bleiben unverändert. */
  const runtimePath = (path: string): boolean => path === '/' || /^\/(?:api(?:\/|$)|static(?:\/|$)|assets(?:\/|$)|ems(?:\/|$)|mail-setup(?:\/|$)|mesh-setup(?:\/|$)|ledger(?:\/|$)|mesh\/microgrid(?:\/|$)|events$|config$|netoperator(?:\/|$)|history(?:\/|$)|settings(?:\/|$)|evcs(?:\/|$)|storagefarm(?:\/|$)|speicherfarm(?:\/|$)|smarthome(?:\/|$)|para14a-report(?:\/|$)|evcs-report(?:\/|$)|rfid-report(?:\/|$)|tariff-report(?:\/|$)|year-report(?:\/|$)|manifest\.webmanifest$|favicon\.ico$|apple-touch-icon\.png$|(?:index|ems-apps|simulation|license|smarthome|smarthome-config|logic|settings|history|evcs|storagefarm|mesh-microgrid|energy-ledger|netoperator|dc-station-display|para14a-report|evcs-report|rfid-report|tariff-report|year-report)\.html$)/u.test(path);

  /** URL-Typ und Ursprung prüfen, niemals Zugangsdaten an einen fremden Host umleiten. */
  const url = (value: string): string => {
    if (!isProxy || typeof value !== 'string' || !value || value.length > 16384) return value;
    if (value.startsWith('#') || value.startsWith('//') || value.includes('\\')) return value;
    let parsed: URL;
    try { parsed = new URL(value, document.baseURI || window.location.href); } catch { return value; }
    if (parsed.origin !== origin || parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol)) return value;
    if (parsed.pathname === prefix || parsed.pathname.startsWith(prefix + '/')) return value;
    if (parsed.pathname === '/' && parsed.hash.startsWith('#tab-')) return origin + publicPath + parsed.search + parsed.hash;
    if (!runtimePath(parsed.pathname)) return value;
    const mapped = prefix + parsed.pathname + parsed.search + parsed.hash;
    return /^[a-z][a-z0-9+.-]*:/iu.test(value) ? origin + mapped : mapped;
  };
  const api: NexoWattRuntimeBase = Object.freeze({
    isProxy,
    instance: context?.instance ?? null,
    url,
    pathname: (): string => {
      const current = window.location.pathname;
      return isProxy && (current === prefix || current.startsWith(prefix + '/')) ? current.slice(prefix.length) || '/' : current;
    },
    adminBase: (): string => origin + publicPath,
  });
  Object.defineProperty(window, 'NW_RUNTIME', { value: api, writable: false, configurable: false });
  if (!isProxy || typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);
  // Der Wrapper wird vor Auth/App-Skripten geladen. Request-Körper, Header,
  // Signal und explizite Init-Optionen bleiben erhalten; externe Aufrufe ebenso.
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) {
      const mapped = url(input.url);
      return originalFetch(mapped === input.url ? input : new Request(new URL(mapped, origin).href, input), init);
    }
    const value = input instanceof URL ? input.href : input;
    const mapped = url(value);
    return originalFetch(mapped === value ? input : mapped, init);
  };
})();
