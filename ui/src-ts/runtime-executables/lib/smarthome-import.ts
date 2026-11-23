/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ergänzt lokale Type-Detector-Vorschläge um Datentypen, Metadaten,
 * Aliasidentität und eine nachvollziehbare Importherkunft.
 * Daten und Wirkung: Liest ioBroker-Objekte und bestehende EOS-Konfiguration rein
 * synchron; erzeugt nur Vorschläge. Keine States, Konfigurationen oder Gerätewrites.
 * Alias-Ziele dienen ausschließlich dem Vergleich; IO-Zuordnungen behalten die
 * ursprünglichen Alias-IDs und damit deren Umrechnungs-/Schreibvertrag.
 * Bei Änderungen: Bool/Text, Aliaszyklen, getrennte Lese-/Schreibquellen,
 * manuelle Überschreibungen und wiederholte Imports gemeinsam prüfen.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/lib/smarthome-import.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md
 */
import { createHash } from 'node:crypto';
import { version as detectorVersion } from '@iobroker/type-detector/package.json';
import { getControlProfiles } from './smarthome-device-controls';

type Row = Record<string, unknown>;
type Objects = Record<string, unknown>;
type Scalar = string | number | boolean | null;
type SourceValues = Record<string, Scalar>;
type DetectedState = { id: string; key: string; type: string; role: string; unit: string; read: boolean; write: boolean };
type Assignment = { id: string; enumId: string; name: string; create: boolean };
export type ImportChange = { path: string; current: Scalar; proposed: Scalar; manualOverride: boolean };
export type SmartHomeImportProvenance = {
  provider: 'iobroker.type-detector';
  sourceId: string;
  controlId?: string;
  detectorType: string;
  detectorVersion: string;
  mappingVersion: number;
  signature: string;
  sourceStateIds: string[];
  semanticStateIds: string[];
  sourceValues: SourceValues;
};

export const SMART_HOME_DETECTOR_VERSION: string = detectorVersion;
export const SMART_HOME_IMPORT_VERSION = 2;
const MAX_SOURCE_FIELDS = 512;
const DIAGNOSTIC_KEYS = new Set(['BATTERY', 'RSSI', 'LOWBAT', 'UNREACH', 'UNREACH_STICKY', 'MAINTAIN', 'ERROR', 'CONNECTED', 'WORKING', 'DIRECTION', 'DIRECTION_ENUM']);
const PROFILE_FIELDS = new Map(getControlProfiles().map(profile => [profile.id, profile.fields]));
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ICON_NAMES = new Set(['toggle', 'bulb', 'plug', 'blinds', 'thermostat', 'thermometer', 'speaker', 'tv', 'camera', 'sensor', 'door', 'window', 'motion', 'alarm', 'smoke', 'water', 'fan', 'meter', 'scene', 'solar', 'battery', 'charger', 'car', 'grid', 'house', 'globe', 'fire', 'lock']);

function record(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function row(value: unknown): Row { return record(value) ? value : {}; }
function text(value: unknown, max = 512): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function scalar(value: unknown): Scalar | undefined {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.length <= 2048) return value;
  return undefined;
}
function name(value: unknown): string {
  if (typeof value === 'string') return text(value, 160);
  const names = row(value);
  return text(names.de || names.en || Object.values(names).find(v => typeof v === 'string'), 160);
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function common(objects: Objects, id: string): Row { return row(row(objects[id]).common); }

/** Nur lokale EOS-Iconnamen/kurze Symbole und feste Farbwerte übernehmen.
 * Externe Bildpfade bleiben Installer-Hinweise und lösen keinen Abruf aus. */
export function normalizeSmartHomeImportColor(value: unknown): string {
  const raw = text(value, 16);
  if (/^#[\da-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(raw)) return '#' + raw.slice(1).split('').map(c => c + c).join('').toLowerCase();
  return '';
}
function safeIcon(value: unknown): string {
  const raw = text(value, 80);
  const key = raw.toLowerCase().replace(/^3d-/, '');
  if (ICON_NAMES.has(key)) return raw.toLowerCase();
  if (raw.length <= 16 && /\p{Extended_Pictographic}/u.test(raw) && !/[<>\u0000-\u001f]/u.test(raw)) return raw;
  return '';
}

/** Kamera-State ist nur eine Browser-URL, niemals ein Serverfetch. Keine
 * eingebetteten Zugangsdaten, Skript-/Daten-URLs oder falschen Werttypen. */
export function normalizeSmartHomeCameraStateUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
    return parsed.href;
  } catch { return undefined; }
}

/** IO-Pfade sind feste, begrenzte Felder; Herkunft enthält keine freien Objekt-
 * Strukturen. Damit können spätere Änderungen feldweise geprüft werden. */
export function isSmartHomeImportField(path: unknown): path is string {
  if (typeof path !== 'string' || path.length > 160) return false;
  const keys = path.split('.');
  if (keys.some(k => BLOCKED_KEYS.has(k))) return false;
  return ['alias', 'icon', 'ui.unit', 'ui.color', 'ui.precision'].includes(path)
    || path === 'io.deviceControls.profile'
    || /^io\.deviceControls\.fields\.[A-Z][A-Z0-9_]{0,63}\.(readId|writeId)$/.test(path)
    || /^io\.(switch|level|color|white|colorTemperature|cover|climate|player|sensor|camera|indicators)\.[A-Za-z][A-Za-z0-9]{0,60}$/.test(path);
}
function sourceValues(proposal: Row): SourceValues {
  const out = Object.create(null) as SourceValues;
  const add = (path: string, value: unknown): void => {
    const val = scalar(value);
    if (isSmartHomeImportField(path) && val !== undefined && Object.keys(out).length < MAX_SOURCE_FIELDS) out[path] = val;
  };
  add('alias', proposal.alias); add('icon', proposal.icon);
  for (const [key, value] of Object.entries(row(proposal.ui))) add(`ui.${key}`, value);
  for (const [group, fields] of Object.entries(row(proposal.io))) {
    if (!record(fields)) continue;
    if (group === 'deviceControls') {
      add('io.deviceControls.profile', fields.profile);
      for (const field of list(fields.fields).map(row)) {
        const key = text(field.key, 64);
        add(`io.deviceControls.fields.${key}.readId`, field.readId ?? null);
        add(`io.deviceControls.fields.${key}.writeId`, field.writeId ?? null);
      }
      continue;
    }
    for (const [key, value] of Object.entries(fields)) add(`io.${group}.${key}`, value);
  }
  return out;
}

/** Alte manuelle Geräte bekommen keine künstliche Importherkunft. Ungültige
 * Herkunft wird verworfen; eine Herkunft verleiht niemals Schreibrechte. */
export function normalizeSmartHomeImportProvenance(value: unknown): SmartHomeImportProvenance | undefined {
  const raw = row(value);
  if (raw.provider !== 'iobroker.type-detector' || !text(raw.sourceId) || typeof raw.signature !== 'string' || !/^[a-f\d]{64}$/.test(raw.signature)) return undefined;
  const values = Object.create(null) as SourceValues;
  for (const [path, value] of Object.entries(row(raw.sourceValues)).slice(0, MAX_SOURCE_FIELDS)) {
    const val = scalar(value);
    if (isSmartHomeImportField(path) && val !== undefined) values[path] = val;
  }
  return {
    provider: 'iobroker.type-detector', sourceId: text(raw.sourceId), detectorType: text(raw.detectorType, 64),
    ...(/^[a-f\d]{64}$/.test(text(raw.controlId)) ? { controlId: text(raw.controlId) } : {}),
    detectorVersion: text(raw.detectorVersion, 32), mappingVersion: Number.isSafeInteger(raw.mappingVersion) && Number(raw.mappingVersion) > 0 ? Number(raw.mappingVersion) : 1,
    signature: text(raw.signature, 64), sourceStateIds: [...new Set(list(raw.sourceStateIds).map(v => text(v)).filter(Boolean))].slice(0, 128),
    semanticStateIds: [...new Set(list(raw.semanticStateIds).map(v => text(v)).filter(Boolean))].slice(0, 128),
    sourceValues: values,
  };
}

/** Endpunkte rekursiver ioBroker-Aliase nur für Identitätsvergleiche verfolgen.
 * Bei Zyklen, zu tiefer Kette oder ungültigen Zielen bleibt die Identität isoliert;
 * der Import wird später zur manuellen Prüfung gesperrt. Kein Write wird umgeleitet. */
export function resolveSmartHomeAliasIdentity(objects: Objects, id: string, direction: 'read' | 'write'): { id: string; alias: boolean; valid: boolean } {
  const seen = new Set<string>();
  let current = text(id);
  let alias = false;
  for (let depth = 0; depth < 16; depth += 1) {
    if (!current || seen.has(current)) return { id, alias, valid: false };
    seen.add(current);
    if (row(objects[current]).type !== 'state') return { id, alias, valid: false };
    const definition = common(objects, current).alias;
    if (!definition) return { id: current, alias, valid: true };
    alias = true;
    const target = typeof definition === 'string' ? definition : row(definition).id;
    if (typeof target === 'string') current = text(target);
    else {
      const pair = row(target);
      current = text(pair[direction] || pair[direction === 'read' ? 'write' : 'read']);
    }
  }
  return { id, alias, valid: false };
}

function bindingIds(device: Row): string[] {
  const ids = new Set<string>();
  for (const [group, fields] of Object.entries(row(device.io))) {
    if (group === 'indicators' || !record(fields)) continue;
    if (group === 'deviceControls') {
      const definitions = PROFILE_FIELDS.get(text(fields.profile)) || [];
      for (const field of list(fields.fields).map(row)) {
        const definition = definitions.find(item => item.key === field.key);
        if (definition?.indicator === true || DIAGNOSTIC_KEYS.has(text(field.key))) continue;
        if (text(field.readId)) ids.add(text(field.readId));
        if (text(field.writeId)) ids.add(text(field.writeId));
      }
      continue;
    }
    for (const [key, value] of Object.entries(fields)) if (/Id$/.test(key) && text(value)) ids.add(text(value));
  }
  return [...ids].sort();
}
function semanticIdentity(device: Row, objects: Objects): { ids: string[]; alias: boolean; valid: boolean } {
  const ids = new Set<string>(); let alias = false; let valid = true;
  const controls = list(row(row(device.io).deviceControls).fields).map(row);
  for (const id of bindingIds(device)) {
    for (const direction of ['read', 'write'] as const) {
      const controlMapping = controls.some(field => field.readId === id || field.writeId === id);
      if (controlMapping && !controls.some(field => field[`${direction}Id`] === id)) continue;
      const resolved = resolveSmartHomeAliasIdentity(objects, id, direction);
      ids.add(resolved.valid ? resolved.id : `unresolved:${id}`);
      alias ||= resolved.alias || id.startsWith('alias.'); valid &&= resolved.valid;
    }
  }
  return { ids: [...ids].sort(), alias, valid };
}

/** Zwei vorhandene Benutzer-Aliase dürfen unterschiedliche Umrechnungen oder
 * Einheiten abbilden. Gleiche physische Ziele allein machen sie nicht gleich. */
function aliasSemantics(device: Row, objects: Objects): string {
  const aliases = bindingIds(device).filter(id => !!common(objects, id).alias).map(id => {
    const meta = common(objects, id); const definition = row(meta.alias);
    return { read: resolveSmartHomeAliasIdentity(objects, id, 'read').id, write: resolveSmartHomeAliasIdentity(objects, id, 'write').id,
      readConversion: text(definition.read, 4096), writeConversion: text(definition.write, 4096),
      type: text(meta.type), role: text(meta.role), unit: text(meta.unit), min: scalar(meta.min), max: scalar(meta.max),
      states: record(meta.states) ? Object.entries(meta.states).sort(([a], [b]) => a.localeCompare(b)) : text(meta.states, 4096) };
  });
  return digest(aliases.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function memberships(objects: Objects, ids: string[], prefix: 'rooms' | 'functions'): { enumId: string; name: string }[] {
  const candidates = new Set<string>();
  for (const id of ids) {
    let current = id;
    for (let depth = 0; current && depth < 24; depth += 1) {
      candidates.add(current);
      const end = current.lastIndexOf('.'); current = end > 0 ? current.slice(0, end) : '';
    }
  }
  return Object.keys(objects).filter(id => id.startsWith(`enum.${prefix}.`)).sort().flatMap(enumId => {
    const object = row(objects[enumId]); const data = row(object.common);
    if (object.type !== 'enum' || !list(data.members).some(id => typeof id === 'string' && candidates.has(id))) return [];
    return [{ enumId, name: name(data.name) || enumId.split('.').pop() || enumId }];
  }).slice(0, 32);
}
function assignments(members: { enumId: string; name: string }[], existing: unknown[], kind: 'room' | 'function'): Assignment[] {
  return members.flatMap<Assignment>(member => {
    const rows = existing.map(row).filter(item => text(item.id, 80));
    const exact = rows.find(item => text(item.id) === member.enumId);
    if (exact) return [{ ...member, id: text(exact.id, 80), create: false }];
    const matched = rows.filter(item => name(item.name || item.alias).toLocaleLowerCase('de') === member.name.toLocaleLowerCase('de'));
    // Gleichnamige Bestandsräume sind mehrdeutig: alle zur Auswahl zeigen,
    // keinen dritten Raum und keine stillschweigende Erstzuordnung erzeugen.
    if (matched.length) return matched.map(item => ({ ...member, id: text(item.id, 80), create: false }));
    return [{ ...member, id: `${kind}_import_${digest(member.enumId).slice(0, 16)}`, create: true }];
  });
}

/** Reiner Vorschlagsausbau: Einheiten/Typen und Statusindikatoren stammen aus
 * den tatsächlichen common-Feldern. Fehlende Werte erhalten keine künstliche Null. */
export function enrichSmartHomeImportSuggestion(input: unknown, objects: Objects, config: unknown): Row {
  const original = row(input); const cfg = row(config);
  const proposal: Row = { ...row(original.proposal), io: { ...row(row(original.proposal).io) }, ui: { ...row(row(original.proposal).ui) } };
  const io = row(proposal.io); const ui = row(proposal.ui);
  const states: DetectedState[] = list(original.states).map(row).filter(s => text(s.id)).map(s => ({
    id: text(s.id), key: text(s.key).toUpperCase(), type: text(s.type), role: text(s.role), unit: text(s.unit, 32), read: s.read !== false, write: s.write === true,
  }));
  const notes = list(original.notes).filter((v): v is string => typeof v === 'string').slice();
  const sourceId = text(original.sourceId); const source = common(objects, text(original.displaySourceId) || sourceId);
  if (name(source.name)) proposal.alias = name(source.name);
  const icon = safeIcon(source.icon);
  if (icon) proposal.icon = icon;
  else if (text(source.icon)) notes.push('Quell-Icon ist ein Bildpfad oder ein nicht unterstütztes Symbol. Bitte bei Bedarf ein lokales EOS-Symbol wählen.');
  const color = normalizeSmartHomeImportColor(source.color);
  if (color) ui.color = color;

  if (proposal.type === 'sensor') {
    const sensor = { ...row(io.sensor) }; const meta = common(objects, text(sensor.readId));
    sensor.valueType = ['number', 'boolean', 'string'].includes(text(meta.type)) ? meta.type : 'number';
    io.sensor = sensor;
    if (typeof meta.unit === 'string') ui.unit = text(meta.unit, 32);
    if (sensor.valueType !== 'number') ui.precision = 0;
  }

  const indicators: Row = {};
  const battery = states.find(s => s.key === 'BATTERY' && s.read && s.type === 'number' && (s.unit === '%' || s.role === 'value.battery'));
  const low = states.find(s => s.key === 'LOWBAT' && s.read && s.type === 'boolean');
  if (battery) { indicators.batteryId = battery.id; indicators.batteryUnit = '%'; }
  else if (low) { indicators.batteryId = low.id; indicators.batteryUnit = 'low'; }
  const unreachable = states.find(s => s.key === 'UNREACH' && s.read && s.type === 'boolean');
  const error = states.find(s => s.key === 'ERROR' && s.read && ['number', 'boolean', 'string'].includes(s.type));
  if (unreachable) indicators.unreachableId = unreachable.id;
  if (error) indicators.errorId = error.id;
  if (Object.keys(indicators).length) io.indicators = indicators;

  const core = semanticIdentity(proposal, objects);
  const memberIds = [sourceId, text(original.displaySourceId), ...bindingIds(proposal), ...core.ids].filter(Boolean);
  const rooms = assignments(memberships(objects, memberIds, 'rooms'), list(cfg.rooms), 'room');
  const functions = assignments(memberships(objects, memberIds, 'functions'), list(cfg.functions), 'function');
  const values = sourceValues(proposal);
  const sourceStateIds = states.map(s => s.id).sort();
  const signature = digest({ sourceId, detectorType: original.detectorType, version: SMART_HOME_IMPORT_VERSION, values, semanticStateIds: core.ids,
    states, rooms: rooms.map(v => ({ enumId: v.enumId, name: v.name })), functions: functions.map(v => ({ enumId: v.enumId, name: v.name })) });
  const provenance: SmartHomeImportProvenance = {
    provider: 'iobroker.type-detector', sourceId, detectorType: text(original.detectorType, 64),
    ...(/^[a-f\d]{64}$/.test(text(original.controlId)) ? { controlId: text(original.controlId) } : {}),
    detectorVersion: SMART_HOME_DETECTOR_VERSION, mappingVersion: SMART_HOME_IMPORT_VERSION, signature, sourceStateIds, semanticStateIds: core.ids, sourceValues: values,
  };
  proposal.importProvenance = provenance;
  if (!core.valid) notes.push('Alias-Ziel ist zyklisch oder ungültig. Vor einer Übernahme die Datenpunktzuordnung prüfen.');
  return { ...original, proposal, notes, importable: original.importable === true && core.valid, metadata: { rooms, functions, color, icon: text(source.icon, 160) },
    semanticIds: core.ids, usesAlias: core.alias, aliasSemantics: aliasSemantics(proposal, objects), provenance,
    suggestedAssignment: { roomId: rooms.length === 1 ? rooms[0]!.id : '', functionId: functions.length === 1 ? functions[0]!.id : '' } };
}

export function smartHomeImportFieldValue(source: unknown, path: string): Scalar {
  if (!isSmartHomeImportField(path)) return null;
  const match = /^io\.deviceControls\.fields\.([A-Z][A-Z0-9_]{0,63})\.(readId|writeId)$/.exec(path);
  if (match) {
    const controls = row(row(row(source).io).deviceControls);
    const field = list(controls.fields).map(row).find(item => item.key === match[1]);
    return scalar(row(field)[match[2]!]) ?? null;
  }
  let value: unknown = source;
  for (const key of path.split('.')) value = row(value)[key];
  return scalar(value) ?? null;
}

/** Erst Aliaspräferenz innerhalb gleicher physischer Kernzuordnung, dann Abgleich
 * gegen vorhandene Geräte. Gemeinsame Batterie-/UNREACH-Punkte zählen nicht als
 * Geräteidentität. Bestehende Geräte werden nie mutiert oder automatisch ersetzt. */
export function reconcileSmartHomeImportSuggestions(inputs: unknown[], objects: Objects, config: unknown): Row[] {
  const cfg = row(config); const devices = list(cfg.devices).map(row);
  const ordered = inputs.map(row).slice().sort((a, b) => Number(b.managedAlias === true) - Number(a.managedAlias === true)
    || Number(b.usesAlias === true) - Number(a.usesAlias === true)
    || Number(b.matchCount || 0) - Number(a.matchCount || 0) || text(a.sourceId).localeCompare(text(b.sourceId)));
  const preferred: Row[] = [];
  for (const suggestion of ordered) {
    const ids = list(suggestion.semanticIds).filter((v): v is string => typeof v === 'string');
    const duplicate = preferred.find(other => other.targetType === suggestion.targetType && other.detectorType === suggestion.detectorType && other.usesAlias === true
      && (suggestion.usesAlias !== true || other.aliasSemantics === suggestion.aliasSemantics
        || (other.managedAlias === true && other.controlId === suggestion.controlId && other.sourceId === suggestion.sourceId))
      && ids.length > 0 && list(other.semanticIds).length > 0
      && (ids.every(id => list(other.semanticIds).includes(id)) || list(other.semanticIds).every(id => ids.includes(String(id)))));
    if (duplicate) {
      duplicate.aliasAlternatives = [...list(duplicate.aliasAlternatives), text(suggestion.sourceId)].slice(0, 32);
      duplicate.notes = [...new Set([...list(duplicate.notes), 'Passender Alias wird bevorzugt; die physische Quelle wird nicht zusätzlich importiert.'])];
    } else preferred.push({ ...suggestion });
  }
  const existing = devices.map(device => ({ device, ids: semanticIdentity(device, objects).ids }));
  return preferred.map(suggestion => {
    const ids = list(suggestion.semanticIds);
    const canonicalType = (value: unknown): string => {
      const type = text(value);
      const aliases = new Map([['mediaPlayer', 'media'], ['blinds', 'blind'], ['brightness', 'illuminance']]);
      return aliases.get(type) || type;
    };
    const sameSource = preferred.filter(other => other.sourceId === suggestion.sourceId && canonicalType(other.detectorType) === canonicalType(suggestion.detectorType));
    const matches = existing.filter(item => item.ids.some(id => ids.includes(id))
      || (row(item.device.importProvenance).sourceId === suggestion.sourceId && !!suggestion.sourceId
        && canonicalType(row(item.device.importProvenance).detectorType) === canonicalType(suggestion.detectorType)
        && (row(item.device.importProvenance).controlId === suggestion.controlId
          || (!row(item.device.importProvenance).controlId && sameSource.length === 1))));
    const exact = matches.filter(item => {
      const p = normalizeSmartHomeImportProvenance(item.device.importProvenance);
      return p && p.sourceId === suggestion.sourceId && canonicalType(p.detectorType) === canonicalType(suggestion.detectorType) && item.device.type === suggestion.targetType
        && (p.controlId === suggestion.controlId || (!p.controlId && sameSource.length === 1)
          || (sameSource.length === 1 && item.ids.some(id => ids.includes(id))));
    });
    let update: Row | null = null;
    if (exact.length === 1 && matches.length === 1) {
      const device = exact[0]!.device;
      const previous = normalizeSmartHomeImportProvenance(device.importProvenance)!;
      const next = normalizeSmartHomeImportProvenance(row(suggestion.proposal).importProvenance)!;
      const changes: ImportChange[] = [];
      if (previous.signature !== next.signature) {
        for (const path of [...new Set([...Object.keys(previous.sourceValues), ...Object.keys(next.sourceValues)])].sort()) {
          if (!isSmartHomeImportField(path)) continue;
          const before = previous.sourceValues[path] ?? null; const after = next.sourceValues[path] ?? null;
          if (before === after || smartHomeImportFieldValue(device, path) === after) continue;
          const current = smartHomeImportFieldValue(device, path);
          changes.push({ path, current, proposed: after, manualOverride: current !== before });
        }
      }
      update = { deviceId: text(device.id, 80), alias: text(device.alias, 160), changes, sourceChanged: previous.signature !== next.signature };
    }
    const notes = list(suggestion.notes).filter((v): v is string => typeof v === 'string');
    if (matches.length) notes.push(update ? 'Importherkunft gefunden. Änderungen lassen sich einzeln prüfen; bestehende Werte bleiben bis zur ausdrücklichen Übernahme erhalten.' : 'Physische Quelle oder Alias ist bereits zugeordnet. Bestehende manuelle Einrichtung bleibt unverändert.');
    return { ...suggestion, alreadyConfigured: matches.length > 0, configuredOverlap: matches.map(m => text(m.device.id, 80)), update, notes };
  });
}
