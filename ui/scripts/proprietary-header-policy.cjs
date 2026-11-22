/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Gemeinsamer Lizenzkopf für eigene TS-/JS-Quellen und deren Generatoren.
 * Daten und Wirkung: Reine Textfunktionen; keine Dateizugriffe, Laufzeitkonfiguration
 * oder Netzwerkzugriffe. Ein vorhandener Fremdlizenzhinweis wird nicht überklebt.
 * Grenze: Dieser Helfer entscheidet nicht über Rechte an unbekannten Quellen.
 */
const HEADER = [
  '/**',
  ' * Copyright (c) 2026 NexoWatt. All rights reserved.',
  ' * Confidential and Proprietary.',
  ' * Use, modification or distribution without express written permission is prohibited.',
  ' */', '',
].join('\n');

const OWN_HEADER = /^\/\*\*\r?\n \* Copyright \(c\) \d{4} NexoWatt\. All rights reserved\.\r?\n \* Confidential and Proprietary\.\r?\n \* Use, modification or distribution without express written permission is prohibited\.\r?\n \*\/\r?\n/;

/** Code-Teil: splitProprietaryHeader – trennt nur BOM, Shebang und den exakten eigenen Kopf. */
function splitProprietaryHeader(text) {
  if (typeof text !== 'string') throw new TypeError('Header input must be text.');
  let prefix = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  let body = text.slice(prefix.length);
  const shebang = body.match(/^#![^\r\n]*(?:\r?\n|$)/);
  if (shebang) {
    prefix += shebang[0];
    body = body.slice(shebang[0].length);
  }
  const own = body.match(OWN_HEADER);
  const header = own ? own[0] : '';
  return Object.freeze({ prefix, header, body: body.slice(header.length) });
}

/**
 * Code-Teil: leadingComments
 * Liest ausschließlich den Kommentar-/Strict-Prolog. Lizenzwörter in Strings,
 * Tests oder der eigentlichen Programmlogik gelten nicht als Dateilizenz.
 */
function leadingComments(text) {
  let remaining = splitProprietaryHeader(text).body;
  let result = '';
  for (;;) {
    remaining = remaining.trimStart();
    const strict = remaining.match(/^(?:'use strict'|"use strict");(?:\r?\n|\s|$)/);
    if (strict) {
      remaining = remaining.slice(strict[0].length);
      continue;
    }
    const comment = remaining.match(/^(?:\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/);
    if (!comment) break;
    result += comment[0] + '\n';
    remaining = remaining.slice(comment[0].length);
  }
  return result;
}

/** Code-Teil: hasForeignLeadingNotice – sperrt fremde/unklare Rechtehinweise im Prolog. */
function hasForeignLeadingNotice(text) {
  const comments = leadingComments(text);
  const copyrights = comments.match(/copyright[^\r\n]*/gi) || [];
  return copyrights.some((line) => !/\bNexoWatt\b/i.test(line))
    || /SPDX-License-Identifier\s*:|permission is hereby granted|licensed under|@license|MIT License|Apache License|GNU (?:General|Lesser|Affero)/i.test(comments);
}

/**
 * Code-Teil: withProprietaryHeader
 * Fügt genau einen führenden eigenen Kommentar ein; der restliche Quelltext bleibt
 * bytegleich. Shebang bleibt ausführbar an erster Stelle, Strict-Direktiven und
 * TypeScript-Migrationsmarker behalten ihre Stellung vor dem Programmcode.
 */
function withProprietaryHeader(text) {
  if (hasForeignLeadingNotice(text)) throw new Error('Foreign or ambiguous leading license notice; review ownership.');
  const parts = splitProprietaryHeader(text);
  if (parts.header) return text;
  const prefix = parts.prefix.endsWith('\n') || !parts.prefix || parts.prefix === '\uFEFF'
    ? parts.prefix : parts.prefix + '\n';
  return prefix + HEADER + parts.body;
}

/**
 * Code-Teil: leadingCheckDirectives
 * Erfasst TS-Check-Pragmas ausschließlich in führenden Zeilenkommentaren, auch
 * nach @runtime-transpile oder anderen Kommentarblöcken. Ein späteres @ts-check
 * gewinnt wie beim Compiler. Dateiinhalte nach dem ersten Code-Token sind tabu.
 */
function leadingCheckDirectives(text) {
  const parts = splitProprietaryHeader(text);
  let offset = parts.prefix.length + parts.header.length;
  const result = [];
  for (;;) {
    const remainder = text.slice(offset);
    const trimmed = remainder.trimStart();
    offset += remainder.length - trimmed.length;
    const comment = trimmed.match(/^(?:\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/);
    if (!comment) break;
    const pragma = comment[0].match(/^\/\/\/?\s*@(ts-check|ts-nocheck)(?=[:\s]|$)/i);
    if (pragma) result.push({ start: offset, end: offset + comment[0].length, enabled: pragma[1].toLowerCase() === 'ts-check' });
    offset += comment[0].length;
  }
  return result;
}

/** Code-Teil: hasLeadingNoCheck – berücksichtigt alle führenden Kommentar-Pragmas. */
function hasLeadingNoCheck(text) {
  const directives = leadingCheckDirectives(text);
  return directives.length > 0 && !directives[directives.length - 1].enabled;
}

/**
 * Code-Teil: withoutLeadingNoCheck
 * Entfernt tatsächliche No-Check-Pragmas für gezielte Typprüfungen. So verstecken
 * weder ein Lizenzkopf noch ein Transpilierungsmarker die deaktivierte Prüfung.
 * Andere Kommentare, Zeilenzahlen und Zeichenfolgen im Programm bleiben erhalten.
 */
function withoutLeadingNoCheck(text) {
  let result = text;
  for (const directive of leadingCheckDirectives(text).reverse()) {
    if (!directive.enabled) result = result.slice(0, directive.start) + result.slice(directive.end);
  }
  return result;
}

module.exports = Object.freeze({ HEADER, splitProprietaryHeader, hasForeignLeadingNotice, withProprietaryHeader, hasLeadingNoCheck, withoutLeadingNoCheck });
