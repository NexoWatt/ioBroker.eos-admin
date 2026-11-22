/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Liefert eigene HTML-Seiten unter dem instanzgebundenen Admin-Proxy-Pfad aus.
 * Daten und Wirkung: Der streng geprüfte X-Forwarded-Prefix dient ausschließlich
 * der URL-Darstellung. HTML-URL-Attribute werden angepasst und der lokale frühe
 * runtime-base-Bootstrap geladen; JavaScript-/CSS-Inhalte werden nicht verändert.
 * Sicherheitsgrenze: Keine Identität, Rolle oder Client-IP aus Proxy-Headern;
 * vorhandene Routenschutzprüfungen bleiben vor diesem reinen Dateisender bestehen.
 * Nur eigene HTML-Dateien unter www/admin/react, maximal 2 MiB und 16 parallele
 * Lesevorgänge. Skript-/Style-Inhalte bleiben bytegleich; unbekannte Pfade sperren.
 * Bei Änderungen: Prefix-Injektion, Assetpfade, ursprüngliche Zugriffsprüfung,
 * Ressourcenlimits und direkte Auslieferung gemeinsam prüfen und dokumentieren.
 */
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import * as path from 'node:path';

export interface ProxyHtmlRequest {
  headers: Record<string, string | string[] | undefined>;
}
export interface ProxyHtmlResponse {
  headersSent?: boolean;
  writableEnded?: boolean;
  sendFile(filePath: string): unknown;
  status(code: number): ProxyHtmlResponse;
  type(contentType: string): ProxyHtmlResponse;
  setHeader(name: string, value: string): unknown;
  send(body: string): unknown;
}
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_ACTIVE_READS = 16;

/** Darstellungs-Prefix, niemals eine Authentifizierung des absendenden Proxy. */
export function runtimeProxyPrefix(req: ProxyHtmlRequest, namespace: string): string | null {
  if (!/^nexowatt-ui\.(?:0|[1-9][0-9]{0,5})$/.test(namespace)) return null;
  const value = req.headers['x-forwarded-prefix'];
  if (typeof value !== 'string' || value.length > 256 || !value.startsWith('/')) return null;
  const suffix = '/proxy/' + namespace;
  if (!value.endsWith(suffix)) return null;
  const publicPath = value.slice(0, -suffix.length);
  if (publicPath) {
    const segments = publicPath.slice(1).split('/');
    if (segments.length > 16 || segments.some(segment => segment.length > 128 || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/.test(segment))) return null;
    if (segments.some((segment, index) => segment === 'proxy' && /^nexowatt-ui\.(?:0|[1-9][0-9]{0,5})$/.test(segments.at(index + 1) || ''))) return null;
  }
  return value;
}

/** Der HTTPS-Hinweis kann ausschließlich das Secure-Attribut zusätzlich setzen. */
export function isHttpsRuntimeProxy(req: ProxyHtmlRequest, namespace: string): boolean {
  return runtimeProxyPrefix(req, namespace) !== null && req.headers['x-forwarded-proto'] === 'https';
}

function rewriteUrl(value: string, prefix: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value === prefix || value.startsWith(prefix + '/')) return value;
  if (value.startsWith('/#tab-nexowatt-ui-')) return prefix.slice(0, prefix.lastIndexOf('/proxy/')) + value;
  return prefix + value;
}

function rewriteTag(tag: string, prefix: string): string {
  return tag.replace(/(\s(?:src|href|action|xlink:href)\s*=\s*)(["'])([^"']*)\2/gi,
    (_all: string, lead: string, quote: string, value: string) => lead + quote + rewriteUrl(value, prefix) + quote);
}

/** Nur Tags/URL-Attribute bearbeiten; Inhalt von script/style und Kommentaren erhalten. */
export function rewriteRuntimeProxyHtml(html: string, prefix: string, wwwBase = true): string {
  // Selbstständige Aufrufer müssen denselben Headervertrag erfüllen.
  const namespace = prefix.slice(prefix.lastIndexOf('/') + 1);
  if (runtimeProxyPrefix({ headers: { 'x-forwarded-prefix': prefix } }, namespace) !== prefix) throw new Error('invalid_proxy_prefix');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('proxy_html_too_large');
  const lower = html.toLowerCase();
  const bootstrap = (wwwBase ? `<base href="${prefix}/">` : '') + `<script src="${prefix}/static/runtime-base.js"></script>`;
  const chunks: string[] = [];
  let cursor = 0;
  let headSeen = false;
  let htmlInsert = -1;
  let inserted = false;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) { chunks.push(html.slice(cursor)); break; }
    chunks.push(html.slice(cursor, start));
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) { chunks.push(html.slice(start)); break; }
      chunks.push(html.slice(start, end + 3)); cursor = end + 3; continue;
    }
    let end = start + 1;
    let quote = '';
    for (; end < html.length; end += 1) {
      const ch = html.charAt(end);
      if (quote) { if (ch === quote) quote = ''; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') break;
    }
    if (end >= html.length) { chunks.push(html.slice(start)); break; }
    const originalTag = html.slice(start, end + 1);
    const match = /^<([A-Za-z][A-Za-z0-9:-]*)\b/.exec(originalTag);
    const name = match?.[1]?.toLowerCase() || '';
    chunks.push(rewriteTag(originalTag, prefix));
    cursor = end + 1;
    if (name === 'html' && htmlInsert < 0) htmlInsert = chunks.length;
    if (name === 'head' && !inserted) { chunks.push(bootstrap); inserted = true; headSeen = true; }
    if (name === 'script' || name === 'style') {
      let rawEnd = lower.indexOf('</' + name, cursor);
      while (rawEnd >= 0 && !/[\s>]/.test(lower.charAt(rawEnd + name.length + 2))) rawEnd = lower.indexOf('</' + name, rawEnd + name.length + 2);
      if (rawEnd < 0) { chunks.push(html.slice(cursor)); cursor = html.length; }
      else { chunks.push(html.slice(cursor, rawEnd)); cursor = rawEnd; }
    }
  }
  // Das bestehende index.html besitzt kein öffnendes head; vor dessen erstem Asset einfügen.
  if (!headSeen && !inserted) chunks.splice(htmlInsert < 0 ? 0 : htmlInsert, 0, bootstrap);
  return chunks.join('');
}

/** Reiner HTML-Sender hinter den bestehenden Auth-/Lizenz-Gates. */
export function createRuntimeFileSender(root: string, namespace: string) {
  const www = path.resolve(root, 'www');
  const react = path.resolve(root, 'admin', 'react');
  let activeReads = 0;
  const contained = (file: string, directory: string): boolean => file.startsWith(directory + path.sep);
  return (req: ProxyHtmlRequest, res: ProxyHtmlResponse, filePath: string): void => {
    const prefix = runtimeProxyPrefix(req, namespace);
    if (!prefix || path.extname(filePath).toLowerCase() !== '.html') { res.sendFile(filePath); return; }
    const candidate = path.resolve(filePath);
    if (!contained(candidate, www) && !contained(candidate, react)) { res.status(500).type('text/plain').send('HTML-Auslieferung nicht verfügbar.'); return; }
    if (activeReads >= MAX_ACTIVE_READS) { res.status(503).type('text/plain').send('HTML-Auslieferung vorübergehend ausgelastet.'); return; }
    activeReads += 1;
    void (async () => {
      try {
        const resolved = await realpath(candidate);
        const wwwRoot = await realpath(www);
        const reactRoot = await realpath(react);
        if (!contained(resolved, wwwRoot) && !contained(resolved, reactRoot)) throw new Error('proxy_html_path_rejected');
        if (!(await lstat(resolved)).isFile()) throw new Error('proxy_html_not_regular');
        // Nonblocking/no-follow flags additionally close FIFO/final-symlink races
        // where the operating system supports them. Deployment directories are trusted.
        const file = await open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
        let html: string;
        try {
          if (!(await file.stat()).isFile()) throw new Error('proxy_html_not_regular');
          const bytes = Buffer.alloc(MAX_HTML_BYTES + 1);
          let used = 0;
          while (used <= MAX_HTML_BYTES) {
            const part = await file.read(bytes, used, bytes.length - used, used);
            if (!part.bytesRead) break;
            used += part.bytesRead;
          }
          if (used > MAX_HTML_BYTES) throw new Error('proxy_html_too_large');
          html = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used));
        } finally { await file.close(); }
        if (res.writableEnded) return;
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Vary', 'X-Forwarded-Prefix');
        res.type('html').send(rewriteRuntimeProxyHtml(html, prefix, contained(resolved, wwwRoot)));
      } catch (_error: unknown) {
        if (!res.headersSent && !res.writableEnded) res.status(500).type('text/plain').send('HTML-Auslieferung nicht verfügbar.');
      } finally { activeReads -= 1; }
    })();
  };
}
