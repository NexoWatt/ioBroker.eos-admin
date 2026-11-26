// @runtime-transpile
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { isPublicUiRequest, uiRequestPath } from './ui-access-policy';

const DATAPOINT_PICKER_ROUTES = new Set([
  '/api/smarthome/dpsearch', '/api/smarthome/object/tree', '/api/object/tree',
]);

export const PRESENTATION_FILES: ReadonlyMap<string, readonly [string, string]> = new Map([
  ['/manifest.webmanifest', ['www/manifest.webmanifest', 'application/manifest+json']],
  ['/sw.js', ['www/sw.js', 'application/javascript']],
  ['/apple-touch-icon.png', ['www/apple-touch-icon.png', 'image/png']],
  ['/apple-touch-icon-precomposed.png', ['www/assets/icons/nexowatt-180.png', 'image/png']],
  ['/apple-touch-icon-180x180.png', ['www/assets/icons/nexowatt-180.png', 'image/png']],
  ['/apple-touch-icon-180x180-precomposed.png', ['www/assets/icons/nexowatt-180.png', 'image/png']],
  ['/favicon.ico', ['www/assets/icons/nexowatt-32.png', 'image/x-icon']],
]);

export type PresentationRoute = 'dashboard' | 'file' | 'asset' | 'picker';

/** A raw HTTP path must match this allowlist before crossing into the read-only process. */
export function presentationRoute(method: unknown, url: unknown): PresentationRoute | null {
  if ((method !== 'GET' && method !== 'HEAD') || typeof url !== 'string') return null;
  const pathname = url.split(/[?#]/, 1)[0];
  if (!pathname) return null;
  const canonical = uiRequestPath({ path: pathname });
  // The three existing Express 4 picker routes also accept case variants and
  // one trailing slash. Never pass percent/decode or traversal aliases here.
  if ((canonical === pathname || canonical + '/' === pathname) && DATAPOINT_PICKER_ROUTES.has(canonical.toLowerCase())) return 'picker';
  if (canonical !== pathname) return null;
  if (pathname === '/') return 'dashboard';
  if (PRESENTATION_FILES.has(pathname)) return 'file';
  if (/^\/(?:assets|static)\//.test(pathname) && isPublicUiRequest({ method, path: pathname })) return 'asset';
  return null;
}

export function isPresentationRequest(method: unknown, url: unknown): boolean {
  return presentationRoute(method, url) !== null;
}
