/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/runtime-proxy-html.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/runtime-proxy-html.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: ed94eaae05e7731145ffcf8b60c3d667a4395867789244eea767f550d17a558e
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/runtime-proxy-html.ts
 * Quell-Hash: sha256:b32c28ba952ef6f065216cb3d556f42c8ab5332a7f7de042edf5fc37d235b524
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/runtime-proxy-html.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeProxyPrefix = runtimeProxyPrefix;
exports.isHttpsRuntimeProxy = isHttpsRuntimeProxy;
exports.rewriteRuntimeProxyHtml = rewriteRuntimeProxyHtml;
exports.createRuntimeFileSender = createRuntimeFileSender;
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
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_ACTIVE_READS = 16;
/** Darstellungs-Prefix, niemals eine Authentifizierung des absendenden Proxy. */
function runtimeProxyPrefix(req, namespace) {
    if (!/^nexowatt-ui\.(?:0|[1-9][0-9]{0,5})$/.test(namespace))
        return null;
    const value = req.headers['x-forwarded-prefix'];
    if (typeof value !== 'string' || value.length > 256 || !value.startsWith('/'))
        return null;
    const suffix = '/proxy/' + namespace;
    if (!value.endsWith(suffix))
        return null;
    const publicPath = value.slice(0, -suffix.length);
    if (publicPath) {
        const segments = publicPath.slice(1).split('/');
        if (segments.length > 16 || segments.some(segment => segment.length > 128 || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/.test(segment)))
            return null;
        if (segments.some((segment, index) => segment === 'proxy' && /^nexowatt-ui\.(?:0|[1-9][0-9]{0,5})$/.test(segments.at(index + 1) || '')))
            return null;
    }
    return value;
}
/** Der HTTPS-Hinweis kann ausschließlich das Secure-Attribut zusätzlich setzen. */
function isHttpsRuntimeProxy(req, namespace) {
    return runtimeProxyPrefix(req, namespace) !== null && req.headers['x-forwarded-proto'] === 'https';
}
/**
 * Code-Teil: rewriteUrl
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function rewriteUrl(value, prefix) {
    if (!value.startsWith('/') || value.startsWith('//') || value === prefix || value.startsWith(prefix + '/'))
        return value;
    if (value.startsWith('/#tab-nexowatt-ui-'))
        return prefix.slice(0, prefix.lastIndexOf('/proxy/')) + value;
    return prefix + value;
}
/**
 * Code-Teil: rewriteTag
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function rewriteTag(tag, prefix) {
    return tag.replace(/(\s(?:src|href|action|xlink:href)\s*=\s*)(["'])([^"']*)\2/gi, (_all, lead, quote, value) => lead + quote + rewriteUrl(value, prefix) + quote);
}
/** Nur Tags/URL-Attribute bearbeiten; Inhalt von script/style und Kommentaren erhalten. */
function rewriteRuntimeProxyHtml(html, prefix, wwwBase = true) {
    // Selbstständige Aufrufer müssen denselben Headervertrag erfüllen.
    const namespace = prefix.slice(prefix.lastIndexOf('/') + 1);
    if (runtimeProxyPrefix({ headers: { 'x-forwarded-prefix': prefix } }, namespace) !== prefix)
        throw new Error('invalid_proxy_prefix');
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES)
        throw new Error('proxy_html_too_large');
    const lower = html.toLowerCase();
    const bootstrap = (wwwBase ? `<base href="${prefix}/">` : '') + `<script src="${prefix}/static/runtime-base.js"></script>`;
    const chunks = [];
    let cursor = 0;
    let headSeen = false;
    let htmlInsert = -1;
    let inserted = false;
    while (cursor < html.length) {
        const start = html.indexOf('<', cursor);
        if (start < 0) {
            chunks.push(html.slice(cursor));
            break;
        }
        chunks.push(html.slice(cursor, start));
        if (html.startsWith('<!--', start)) {
            const end = html.indexOf('-->', start + 4);
            if (end < 0) {
                chunks.push(html.slice(start));
                break;
            }
            chunks.push(html.slice(start, end + 3));
            cursor = end + 3;
            continue;
        }
        let end = start + 1;
        let quote = '';
        for (; end < html.length; end += 1) {
            const ch = html.charAt(end);
            if (quote) {
                if (ch === quote)
                    quote = '';
            }
            else if (ch === '"' || ch === "'")
                quote = ch;
            else if (ch === '>')
                break;
        }
        if (end >= html.length) {
            chunks.push(html.slice(start));
            break;
        }
        const originalTag = html.slice(start, end + 1);
        const match = /^<([A-Za-z][A-Za-z0-9:-]*)\b/.exec(originalTag);
        const name = match?.[1]?.toLowerCase() || '';
        chunks.push(rewriteTag(originalTag, prefix));
        cursor = end + 1;
        if (name === 'html' && htmlInsert < 0)
            htmlInsert = chunks.length;
        if (name === 'head' && !inserted) {
            chunks.push(bootstrap);
            inserted = true;
            headSeen = true;
        }
        if (name === 'script' || name === 'style') {
            let rawEnd = lower.indexOf('</' + name, cursor);
            while (rawEnd >= 0 && !/[\s>]/.test(lower.charAt(rawEnd + name.length + 2)))
                rawEnd = lower.indexOf('</' + name, rawEnd + name.length + 2);
            if (rawEnd < 0) {
                chunks.push(html.slice(cursor));
                cursor = html.length;
            }
            else {
                chunks.push(html.slice(cursor, rawEnd));
                cursor = rawEnd;
            }
        }
    }
    // Das bestehende index.html besitzt kein öffnendes head; vor dessen erstem Asset einfügen.
    if (!headSeen && !inserted)
        chunks.splice(htmlInsert < 0 ? 0 : htmlInsert, 0, bootstrap);
    return chunks.join('');
}
/** Reiner HTML-Sender hinter den bestehenden Auth-/Lizenz-Gates. */
function createRuntimeFileSender(root, namespace) {
    const www = path.resolve(root, 'www');
    const react = path.resolve(root, 'admin', 'react');
    let activeReads = 0;
/**
 * Code-Teil: contained
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const contained = (file, directory) => file.startsWith(directory + path.sep);
    return (req, res, filePath) => {
        const prefix = runtimeProxyPrefix(req, namespace);
        if (!prefix || path.extname(filePath).toLowerCase() !== '.html') {
            res.sendFile(filePath);
            return;
        }
        const candidate = path.resolve(filePath);
        if (!contained(candidate, www) && !contained(candidate, react)) {
            res.status(500).type('text/plain').send('HTML-Auslieferung nicht verfügbar.');
            return;
        }
        if (activeReads >= MAX_ACTIVE_READS) {
            res.status(503).type('text/plain').send('HTML-Auslieferung vorübergehend ausgelastet.');
            return;
        }
        activeReads += 1;
        void (async () => {
            try {
                const resolved = await (0, promises_1.realpath)(candidate);
                const wwwRoot = await (0, promises_1.realpath)(www);
                const reactRoot = await (0, promises_1.realpath)(react);
                if (!contained(resolved, wwwRoot) && !contained(resolved, reactRoot))
                    throw new Error('proxy_html_path_rejected');
                if (!(await (0, promises_1.lstat)(resolved)).isFile())
                    throw new Error('proxy_html_not_regular');
                // Nonblocking/no-follow flags additionally close FIFO/final-symlink races
                // where the operating system supports them. Deployment directories are trusted.
                const file = await (0, promises_1.open)(resolved, node_fs_1.constants.O_RDONLY | (node_fs_1.constants.O_NOFOLLOW || 0) | (node_fs_1.constants.O_NONBLOCK || 0));
                let html;
                try {
                    if (!(await file.stat()).isFile())
                        throw new Error('proxy_html_not_regular');
                    const bytes = Buffer.alloc(MAX_HTML_BYTES + 1);
                    let used = 0;
                    while (used <= MAX_HTML_BYTES) {
                        const part = await file.read(bytes, used, bytes.length - used, used);
                        if (!part.bytesRead)
                            break;
                        used += part.bytesRead;
                    }
                    if (used > MAX_HTML_BYTES)
                        throw new Error('proxy_html_too_large');
                    html = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used));
                }
                finally {
                    await file.close();
                }
                if (res.writableEnded)
                    return;
                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('Vary', 'X-Forwarded-Prefix');
                res.type('html').send(rewriteRuntimeProxyHtml(html, prefix, contained(resolved, wwwRoot)));
            }
            catch (_error) {
                if (!res.headersSent && !res.writableEnded)
                    res.status(500).type('text/plain').send('HTML-Auslieferung nicht verfügbar.');
            }
            finally {
                activeReads -= 1;
            }
        })();
    };
}
