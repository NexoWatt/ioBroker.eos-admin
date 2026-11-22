/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Datei: src-ts/node-shims.d.ts
 *
 * Zweck:
 * Minimaler TypeScript-Shim für wenige Node-Module, die in den TS-Wartungsskripten
 * verwendet werden.
 *
 * Zusammenhang:
 * Die TypeScript-Verträge sollen browser-/adapterneutral bleiben und binden deshalb
 * bewusst nicht das komplette `@types/node`-Paket in alle Typchecks ein. Diese Datei
 * beschreibt die kleinen fs/path-Funktionen der Scaffold-Prüfregeln. Der binäre
 * Lesevertrag und die tatsächliche Dateigröße werden außerdem beim begrenzten
 * Einlesen der konfigurierten EOS-CA benötigt; keine untypisierte Dateifreigabe.
 */

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): import('node:buffer').Buffer;
  export function readFileSync(path: string, encoding: string): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { readonly size: number; isDirectory(): boolean; isFile(): boolean };
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}
