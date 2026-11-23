/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Unterscheidet einen laufenden Start von einer Lizenz-, Übernahme- oder Schreibsperre.
 * Daten und Wirkung: Formt ausschließlich lesende Hoststatus-Snapshots zu begrenzten Diagnosewerten.
 * Bei Änderungen: Keine Freigabe aus Diagnosedaten ableiten; Authentifizierung, CSRF und Schreibschutz bleiben bei den Aufrufern.
 * Grenze: Keine Konfiguration, Gerätewerte, Geheimnisse oder beliebigen Fehlermeldungen veröffentlichen.
 */
'use strict';

type State = 'idle' | 'starting' | 'ready' | 'unlicensed' | 'blocked' | 'degraded' | 'stopped';
interface StartupStatus {
  state: State;
  code: string;
  message: string;
  phase: string;
  phaseLabel: string;
  migrationPhase: string;
  migrationCode: string;
  ownershipReason: string;
  blockingInstances: string[];
  recoveryPath: '' | '/migration/';
}
const STATES = new Set<State>(['idle', 'starting', 'ready', 'unlicensed', 'blocked', 'degraded', 'stopped']);
const PHASES = new Map<string, string>([
  ['configuration', 'Konfiguration laden'], ['states', 'Datenpunkte vorbereiten'],
  ['datapoints', 'Zuordnungen und Messwerte laden'], ['ems', 'EMS initialisieren'],
  ['services', 'Interne Dienste initialisieren'], ['history', 'Historienwerte laden'],
  ['smarthome', 'SmartHome und Logik laden'],
]);
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function code(value: unknown): string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/.test(value) ? value : '';
}
function state(value: unknown): State {
  if (typeof value !== 'string') return 'idle';
  for (const allowed of STATES) if (value === allowed) return allowed;
  return 'idle';
}

/** Liest nur bestätigte Statusformate; diese Ausgabe erteilt niemals eine Betriebsfreigabe. */
function describeHostedStartup(startup: unknown, readiness: unknown, currentPhase: unknown = ''): StartupStatus {
  const runtime = record(startup) ? startup : {};
  const host = record(readiness) ? readiness : {};
  const migration = record(host.migration) ? host.migration : {};
  const ownership = record(host.ownership) ? host.ownership : {};
  let current = state(runtime.state);
  let error = code(runtime.error);
  const migrationPhase = code(migration.phase);
  const migrationCode = code(migration.code);
  const ownershipReason = code(ownership.reason);
  const blockers: string[] = [];
  if (Array.isArray(ownership.blockers)) {
    for (const row of ownership.blockers.slice(0, 32)) {
      if (!record(row) || typeof row.instance !== 'string' || !/^system\.adapter\.(?:nexowatt-ui|eos-admin)\.\d{1,6}$/.test(row.instance)) continue;
      if (!blockers.includes(row.instance)) blockers.push(row.instance);
    }
  }
  let message = '';
  let recoveryPath: StartupStatus['recoveryPath'] = '';
  // A real failed/stopped startup remains a failure even if its original host grant has expired.
  if (current === 'degraded') {
    error ||= 'EOS_UI_STARTUP_FAILED';
    message = 'Der Betriebsstart ist fehlgeschlagen. Startprotokoll und Bestandsübernahme prüfen; es erfolgt kein automatischer Neustart der Regelung.';
    recoveryPath = '/migration/';
  } else if (current === 'stopped') {
    error ||= 'EOS_UI_STOPPED';
    message = 'Die EOS-Laufzeit wurde angehalten.';
  } else if (migrationPhase === 'LICENSE_REQUIRED' && migrationCode === 'EOS_MIGRATION_RESTART_REQUIRED') {
    current = 'blocked'; error = 'EOS_MIGRATION_RESTART_REQUIRED';
    message = 'Die Lizenz ist jetzt aktiv. Ein EOS-Administrator muss den EOS-Adapter einmal neu starten, damit die Bestandsübernahme vor dem Start der EMS-Regelung geprüft wird.';
    recoveryPath = '/migration/';
  } else if (current === 'unlicensed' || migrationPhase === 'LICENSE_REQUIRED') {
    current = 'unlicensed'; error = 'EOS_LICENSE_REQUIRED';
    message = 'Die zentrale EOS-Lizenz muss gültig aktiviert sein, bevor die Bestandsübernahme und Regelung starten können.';
  } else if (migration.allowsStartup === false) {
    current = 'blocked'; error = migrationCode || 'EOS_MIGRATION_OPERATIONAL_START_BLOCKED';
    message = 'Die Bestandsübernahme blockiert den Betriebsstart. Ein EOS-Administrator muss den Übernahmestatus prüfen und den angezeigten Grund beheben.';
    recoveryPath = '/migration/';
  } else if (current === 'blocked' || ownership.allowed === false) {
    current = 'blocked'; error = 'EOS_UI_OWNERSHIP_REQUIRED';
    message = 'Die eindeutige Steuerungsfreigabe fehlt. Alte oder parallele Regler und deren bestätigten Stopp in der Bestandsübernahme prüfen.';
    recoveryPath = '/migration/';
  } else if (current === 'starting') {
    error = 'EOS_UI_STARTING';
    message = 'EOS lädt die bestehende Konfiguration. Änderungen und Wiederherstellung sind bis zum abgeschlossenen Start gesperrt.';
  } else if (current === 'ready') {
    error = ''; message = 'Der EOS-Betriebsstart ist abgeschlossen.';
  } else {
    error = 'EOS_UI_NOT_STARTED';
    message = 'Der EOS-Betriebsstart wurde noch nicht freigegeben. Lizenz und Bestandsübernahme prüfen.';
    recoveryPath = '/migration/';
  }
  const phase = current !== 'ready' && typeof currentPhase === 'string' && PHASES.has(currentPhase) ? currentPhase : '';
  return { state: current, code: error, message, phase, phaseLabel: PHASES.get(phase) || '',
    migrationPhase, migrationCode, ownershipReason, blockingInstances: blockers, recoveryPath };
}

/** Ein fehlender oder fehlerhafter Diagnoseprovider ändert keine Freigabeentscheidung. */
function readHostedStartup(startup: unknown, bridge: unknown, currentPhase: unknown = ''): StartupStatus {
  let readiness: unknown = null;
  if (record(bridge)) {
    const getter = bridge.getRuntimeReadiness;
    if (typeof getter === 'function') {
      try { readiness = Reflect.apply(getter, bridge, []); } catch { /* Existing admission guards remain authoritative. */ }
    }
  }
  return describeHostedStartup(startup, readiness, currentPhase);
}

export { describeHostedStartup, readHostedStartup };
export type { StartupStatus };
