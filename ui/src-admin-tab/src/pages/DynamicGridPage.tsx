/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Vollständige, herstellerunabhängige Einrichtung der App Dynamischer Netzanschluss.
 * Bei Änderungen: UI-Felder, generisches Backend-Schema und atomare App-Aktivierung gemeinsam prüfen; M0 nicht erneut zuordnen.
 * Daten und Wirkung: M0-Messung stammt schreibgeschützt aus Allgemein. M1, Speicher, PV,
 * Betriebsaufgaben und generische Geräteschnittstellen werden ausschließlich hier bearbeitet.
 * Installation/Aktivierung und Konfiguration werden atomar mit Versionsprüfung gespeichert.
 * Sicherheit: Installer/Admin im Routen- und API-Guard; keine direkten Geräteschreibzugriffe,
 * keine automatischen Zuordnungen, keine Wiederholung fehlgeschlagener Mutationen.
 * Verknüpfungen: docs/dev/DYNAMIC_GRID_CONTRACT.md; docs/quellcode/src-admin-tab/src/pages/DynamicGridPage.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from './PageShell';
import DpField, { DpFieldContext } from '../components/DpField';
import { isRecord, isSafeJson, parseDynamicGridResponse, parseValidation, parseValidationDetails, type DraftNumber, type Scalar, type Measurement, type RootSource, type Point, type Output, type SwitchOutput, type Command, type Strategy, type Storage, type Pv, type Topology, type AppState, type Reason, type Validation, type LiveState, type StorageResult, type PendingInterval, type DynamicGridResponse } from '../lib/adminContracts';
import { getRuntimeProxyBase, dynamicGridRequest, getErrorMessage, getErrorStatus, RuntimeRequestError } from '../lib/adminConnection';

/** Anzeigenamen sind interne, unveränderliche Dictionaries ohne geerbte Schlüssel. */
const textLabels = (labels: Record<string, string>): Readonly<Record<string, string>> => {
  const values: Record<string, string> = Object.create(null);
  for (const [key, label] of Object.entries(labels)) values[key] = label;
  return Object.freeze(values);
};

const purposes: Readonly<Record<string, string>> = textLabels({ selfConsumption: 'Eigenverbrauchsoptimierung (EVO)', zeroExport: 'Nulleinspeisung', peakShaving: 'Lastspitzenkappung', arbitrage: 'Arbitrage', tariff: 'Tarifgeführter Betrieb' });
const pointNames: Readonly<Record<string, string>> = textLabels({ M0: 'M0 · Gesamtanschluss', M1: 'M1 · lokaler Bereich' });
const emptyMeasurement = (): Measurement => ({ stateId: '', unit: 'W', sign: 1, maxAgeMs: 5000 });
const emptyPoint = (id: string): Point => ({ id, source: id === 'M0' ? 'general' : 'mapped', ...(id === 'M1' ? { measurement: emptyMeasurement() } : {}), importLimitW: null, exportLimitW: null, importReserveW: 0, exportReserveW: 0 });
const emptyTopology = (): Topology => ({ schemaVersion: 1, configVersion: 1, maxSkewMs: 1000, points: [emptyPoint('M0'), emptyPoint('M1')], storages: [], pvAssignments: [] });
const emptyOutput = (): Output => ({ stateId: '', scale: 1, sign: 1 });
const emptyStorage = (): Storage => ({ id: '', name: '', connectionPointId: '', controlPointId: '', dispatchGroupId: '', primaryPurpose: 'selfConsumption', authority: 'eos', powerMeasurement: emptyMeasurement(), socMeasurement: { stateId: '', scale: 1, maxAgeMs: 5000 }, maxChargeW: '', maxDischargeW: '', minSoc: 10, maxSoc: 90, maxDeltaWPerSec: '', configuredToleranceW: 100, commandTimeoutMs: 5000, strategy: { targetGridImportW: 50, importThresholdW: 20 }, command: { mode: 'signedTarget', signedTarget: emptyOutput() } });
const emptyPv = (): Pv => ({ id: '', connectionPointId: '', referencePowerW: '', powerMeasurement: emptyMeasurement(), command: { stateId: '', unit: 'W', scale: 1 } });
const watts = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `${(value / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kW` : '—';
const reasonText = (reason: Reason) => typeof reason === 'string' ? reason : reason?.message || reason?.reason || reason?.code || 'Unbekannter Prüfhinweis';
const optionalText = <T extends { readbackStateId?: string }>(value: T, key: 'readbackStateId', text: string): T => { const next = { ...value }; if (text) next[key] = text; else delete next[key]; return next; };

/** Leere Zahlen bleiben leer; eine echte Null wird niemals aus einem fehlenden Wert abgeleitet. */
function NumericField({ label, value, onChange, min = 0, max, required = true, unit = '', help = '' }: { label: string; value?: DraftNumber | null; onChange: (value: DraftNumber) => void; min?: number; max?: number; required?: boolean; unit?: string; help?: string }) {
  return <label className="nw-nvp-field nw-config-field"><span className="nw-config-label">{label}{unit ? ` (${unit})` : ''}</span>
    <input className="nw-input nw-config-input" type="number" min={min} max={max} step="any" required={required}
      value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
    {help && <small>{help}</small>}
  </label>;
}
function TextField({ label, value, onChange, required = false, help = '', maxLength = 256 }: { label: string; value?: string; onChange: (value: string) => void; required?: boolean; help?: string; maxLength?: number }) {
  return <label className="nw-nvp-field nw-config-field"><span className="nw-config-label">{label}</span>
    <input className="nw-input nw-config-input" value={value ?? ''} required={required} maxLength={maxLength} onChange={e => onChange(e.target.value)} />
    {help && <small>{help}</small>}
  </label>;
}
function SelectField({ label, value, onChange, options, required = true, placeholder = false }: { label: string; value?: string | number | null; onChange: (value: string) => void; options: Readonly<Record<string, string>>; required?: boolean; placeholder?: boolean }) {
  return <label className="nw-nvp-field nw-config-field"><span className="nw-config-label">{label}</span>
    <select className="nw-input nw-config-select" value={value ?? ''} required={required} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">Bitte ausdrücklich zuordnen</option>}
      {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{String(text)}</option>)}
    </select>
  </label>;
}
/** Messleistung in W/kW mit ausdrücklich konfigurierter Richtung und Altersgrenze. */
function MeasurementEditor({ value, onChange, label = 'Istleistung · Datenpunkt', storage = false, positiveOnly = false }: { value?: Measurement; onChange: (value: Measurement) => void; label?: string; storage?: boolean; positiveOnly?: boolean }) {
  const v = value || emptyMeasurement();
  const set = <K extends keyof Measurement>(key: K, next: Measurement[K]) => onChange({ ...v, [key]: next });
  return <div className="nw-nvp-grid">
    <DpField label={label} value={v.stateId} onChange={n => set('stateId', n)} required help={storage ? 'AC-Wirkung der Batterie. PV und Batterie benötigen getrennte Istwerte.' : 'Vollständige Datenpunktkennung.'} />
    <SelectField label="Einheit des Messwerts" value={v.unit} onChange={n => set('unit', n)} options={{ W: 'Watt (W)', kW: 'Kilowatt (kW)' }} />
    <SelectField label="Vorzeichen der Messung" value={v.sign} onChange={n => set('sign', Number(n))} options={positiveOnly ? { 1: 'Positiver Betrag' } : storage ? { 1: 'Positiv = Entladen', '-1': 'Positiv = Laden' } : { 1: 'Rohwert unverändert', '-1': 'Rohwert umkehren' }} />
    <NumericField label="Höchstens zulässiges Messwertalter" unit="ms" min={1} value={v.maxAgeMs} onChange={n => set('maxAgeMs', n)} />
  </div>;
}
/** M0 kann hier nicht umverdrahtet werden. Auch getrennte Bezugs-/Einspeisesignale bleiben als Paar erkennbar. */
function GeneralMeasurement({ rootSource }: { rootSource: RootSource | null }) {
  const source = rootSource?.measurement;
  const rows: Array<[string, Measurement | null | undefined]> = source?.kind === 'split'
    ? [['Netzbezug', source.importMeasurement], ['Netzeinspeisung', source.exportMeasurement]]
    : [['Signierte Netzleistung', source]];
  return <div className="nw-dynamic-root-source">
    <h3>M0-Messung aus Allgemein</h3>
    <p>Verknüpfte Quelle, hier schreibgeschützt. M0 erfasst den Gesamtanschluss einschließlich M1.</p>
    <dl className="nw-dynamic-readout">{rows.map(([label, measurement]) => <React.Fragment key={label}><dt>{label}</dt><dd><code>{measurement?.stateId || 'Noch nicht zugeordnet'}</code>{measurement?.stateId && <small>{measurement.unit || 'Einheit nicht bestätigt'} · Vorzeichen {measurement.sign === -1 ? 'umgekehrt' : 'unverändert'} · Alter maximal {measurement.maxAgeMs ?? source?.maxAgeMs ?? '—'} ms</small>}</dd></React.Fragment>)}</dl>
    {rootSource?.valid === false && <p className="nw-nvp-notice">{rootSource.reason || 'M0 muss zuerst unter Allgemein vollständig zugeordnet werden.'}</p>}
    {source?.kind === 'split' && <p>Gemeinsames Vorzeichen: {source.sign === -1 ? 'Bezug minus Einspeisung wird umgekehrt' : 'Bezug minus Einspeisung'}.</p>}
    <a className="nw-link-button nw-config-btn" href={`${getRuntimeProxyBase() ?? ''}/ems-apps.html?nwAdmin=1&tab=mapping`} target={typeof window !== 'undefined' && window.parent !== window ? '_parent' : '_self'}>Zuordnung → Allgemein öffnen</a>
  </div>;
}
/** Null ist bei M1 die bewusste Abwesenheit einer lokalen Vertragsgrenze; 0 W bleibt wirksam. */
function PointEditor({ value, onChange, rootSource = null }: { value: Point; onChange: (value: Point) => void; rootSource?: RootSource | null }) {
  const set = <K extends keyof Point>(key: K, next: Point[K]) => onChange({ ...value, [key]: next });
  const optional = value.id === 'M1';
  return <section className="nw-card nw-config-card nw-nvp-point" aria-label={`${value.id} einrichten`}>
    <div className="nw-nvp-section-heading"><h2 className="nw-config-card__title">{pointNames[value.id]}</h2><span className="nw-nvp-tag">{optional ? 'Innerhalb von M0' : 'Gesamtanschluss'}</span></div>
    {optional ? <><p>M1 misst ausschließlich den lokalen Bereich. Netzbezug ist positiv, Einspeisung negativ.</p><MeasurementEditor label="M1-Nettoleistung · Datenpunkt" value={value.measurement} onChange={n => set('measurement', n)} /></> : <GeneralMeasurement rootSource={rootSource} />}
    <h3>Anschlussgrenzen und feste Reserven</h3>
    <p>Die Betriebsgrenze ergibt sich aus Anschlussgrenze minus Reserve. 0 W ist eine wirksame Grenze.</p>
    <div className="nw-nvp-grid">{(['import', 'export'] as const).map(direction => {
      const key = `${direction}LimitW` as const; const reserveKey = `${direction}ReserveW` as const; const title = direction === 'import' ? 'Bezug' : 'Einspeisung';
      const unconfigured = optional && value[key] === null;
      const limit = value[key], reserve = value[reserveKey];
      return <div className="nw-nvp-limit" key={direction}>
        {optional && <label><input type="checkbox" checked={!unconfigured} onChange={e => onChange({ ...value, [key]: e.target.checked ? '' : null, [reserveKey]: e.target.checked ? value[reserveKey] : 0 })} /> {title} lokal begrenzen</label>}
        {unconfigured ? <p>{title}: ausdrücklich keine lokale Vertragsgrenze. M0 bleibt wirksam.</p> : <>
          <NumericField label={`${title} · Anschlussgrenze`} unit="W" value={value[key]} onChange={n => set(key, n)} />
          <NumericField label={`${title} · feste Reserve`} unit="W" value={value[reserveKey]} onChange={n => set(reserveKey, n)} />
          <p className="nw-text-muted">Betriebsgrenze: {typeof limit === 'number' && typeof reserve === 'number' ? `${limit - reserve} W` : 'noch nicht festgelegt'}</p>
        </>}
      </div>;
    })}</div>
  </section>;
}
/** Boolean-/Zahlwerte werden typisiert bearbeitet, damit false, 0 und der Text "0" nicht verwechselt werden. */
function ScalarField({ label, value, onChange }: { label: string; value?: Scalar; onChange: (value: Scalar) => void }) {
  const numeric = typeof value === 'number' || value === '';
  return <div className="nw-dynamic-scalar">
    <SelectField label={`${label} · Datentyp`} value={numeric ? 'number' : 'boolean'} onChange={type => onChange(type === 'number' ? 0 : false)} options={{ boolean: 'Boolean', number: 'Zahl' }} />
    {numeric ? <NumericField label={label} min={-Number.MAX_SAFE_INTEGER} value={typeof value === 'number' || value === '' ? value : undefined} onChange={onChange} /> : <SelectField label={label} value={String(value === true)} onChange={n => onChange(n === 'true')} options={{ true: 'true', false: 'false' }} />}
  </div>;
}
function OutputEditor({ label, value, onChange, signed = false }: { label: string; value?: Output; onChange: (value: Output) => void; signed?: boolean }) {
  const v = value || emptyOutput();
  const set = <K extends keyof Output>(key: K, next: Output[K]) => onChange({ ...v, [key]: next });
  return <div className="nw-dynamic-subsection"><h4>{label}</h4><div className="nw-nvp-grid">
    <DpField mode="write" label={`${label} · Schreib-Datenpunkt`} value={v.stateId} onChange={n => set('stateId', n)} required />
    <NumericField label={`${label} · W je Rohwert`} min={0.000001} value={v.scale} onChange={n => set('scale', n)} help="1 für W; 1000 für kW. Der Sollwert in W wird durch diesen Faktor geteilt." />
    {signed && <SelectField label="Vorzeichen des Sollwerts" value={v.sign} onChange={n => set('sign', Number(n))} options={{ 1: 'Positiv = Entladen', '-1': 'Positiv = Laden' }} />}
    <DpField label={`${label} · Rücklese-Datenpunkt (optional)`} value={v.readbackStateId} onChange={n => onChange(optionalText(v, 'readbackStateId', n))} help="Rückgelesener Sollwert ist getrennt von der gemessenen Leistung." />
  </div></div>;
}
function SwitchOutputEditor({ label, value, onChange }: { label: string; value: SwitchOutput; onChange: (value: SwitchOutput) => void }) {
  const set = <K extends keyof SwitchOutput>(key: K, next: SwitchOutput[K]) => onChange({ ...value, [key]: next });
  return <div className="nw-dynamic-subsection"><h4>{label}</h4><div className="nw-nvp-grid">
    <DpField mode="write" label={`${label} · Schreib-Datenpunkt`} value={value.stateId} onChange={n => set('stateId', n)} required />
    <DpField label={`${label} · Rücklese-Datenpunkt (optional)`} value={value.readbackStateId} onChange={n => onChange(optionalText(value, 'readbackStateId', n))} />
    <ScalarField label={`${label} · Ein-Wert`} value={value.onValue} onChange={n => set('onValue', n)} />
    <ScalarField label={`${label} · Aus-Wert`} value={value.offValue} onChange={n => set('offValue', n)} />
  </div></div>;
}
/** Betriebsaufgabe, Hoheit und Schnittstellentyp sind ausdrückliche getrennte Entscheidungen. */
function StorageEditor({ value, onChange, onRemove }: { value: Storage; onChange: (value: Storage) => void; onRemove: () => void }) {
  const set = <K extends keyof Storage>(key: K, next: Storage[K]) => onChange({ ...value, [key]: next });
  const command: Command = value.command || { mode: 'signedTarget', signedTarget: emptyOutput() };
  const setCommand = <K extends keyof Command>(key: K, next: Command[K]) => set('command', { ...command, [key]: next });
  const setStrategy = <K extends keyof Strategy>(key: K, next: Strategy[K]) => set('strategy', { ...value.strategy, [key]: next });
  const changeCommandMode = (mode: string) => {
    const next = { ...command, mode };
    (['signedTarget', 'chargeTarget', 'dischargeTarget', 'maxCharge', 'maxDischarge', 'appliedMaxCharge', 'appliedMaxDischarge', 'watchdog'] as const).forEach(key => delete next[key]);
    const keys: Array<'signedTarget' | 'chargeTarget' | 'dischargeTarget' | 'maxCharge' | 'maxDischarge'> = mode === 'signedTarget' ? ['signedTarget'] : mode === 'splitTarget' ? ['chargeTarget', 'dischargeTarget'] : ['maxCharge', 'maxDischarge'];
    keys.forEach(key => { next[key] = command[key] || emptyOutput(); });
    if (mode === 'externalLimits') {
      next.appliedMaxCharge = command.appliedMaxCharge || emptyMeasurement(); next.appliedMaxDischarge = command.appliedMaxDischarge || emptyMeasurement();
      next.watchdog = command.watchdog || { stateId: '', ttlMs: 5000, writeValue: true, readbackStateId: '', expiryBehavior: 'zeroLimits' };
    }
    set('command', next);
  };
  return <article className="nw-nvp-device">
    <div className="nw-nvp-section-heading"><h3>{value.name || value.id || 'Neuer Speicher'}</h3><button type="button" className="nw-button nw-config-btn" onClick={onRemove}>Speicher entfernen</button></div>
    <div className="nw-nvp-grid">
      <TextField label="Speicherkennung" value={value.id} onChange={n => set('id', n)} required help="Eindeutige freie Kennung dieser App; keine bestehende Farm-Zuordnung erforderlich." />
      <TextField label="Speichername" value={value.name} onChange={n => set('name', n)} />
      <SelectField label="Physischer Anschlussbereich" value={value.connectionPointId} onChange={n => set('connectionPointId', n)} options={pointNames} placeholder />
      <SelectField label="Regelmesspunkt" value={value.controlPointId} onChange={n => set('controlPointId', n)} options={pointNames} placeholder />
      <TextField label="Regel-/Dispatchgruppe" value={value.dispatchGroupId} onChange={n => set('dispatchGroupId', n)} required help="Gemeinsame Gruppe nur bei gleichem Bereich, gleicher Aufgabe, Strategie und Hoheit." />
      <SelectField label="Betriebsaufgabe" value={value.primaryPurpose} onChange={n => set('primaryPurpose', n)} options={purposes} />
      <SelectField label="Stellhoheit" value={value.authority} onChange={n => set('authority', n)} options={{ eos: 'EOS gibt Leistungsziele vor', external: 'Externer Regler innerhalb EOS-Grenzen' }} />
    </div>
    <p className="nw-nvp-info">Wirksame Anschlussgrenzen: {value.connectionPointId === 'M1' ? 'M1 und M0' : value.connectionPointId === 'M0' ? 'M0' : 'noch nicht zugeordnet'}.</p>
    <h4>Istwerte und Verfügbarkeit</h4>
    <MeasurementEditor storage label="Batterie-Istleistung · Datenpunkt" value={value.powerMeasurement} onChange={n => set('powerMeasurement', n)} />
    <div className="nw-nvp-grid">
      <DpField label="SoC · Datenpunkt" value={value.socMeasurement?.stateId} onChange={n => set('socMeasurement', { ...value.socMeasurement, stateId: n })} required />
      <NumericField label="SoC · Prozentpunkte je Rohwert" min={0.000001} value={value.socMeasurement?.scale} onChange={n => set('socMeasurement', { ...value.socMeasurement, scale: n })} />
      <NumericField label="SoC · Höchstalter" unit="ms" min={1} value={value.socMeasurement?.maxAgeMs} onChange={n => set('socMeasurement', { ...value.socMeasurement, maxAgeMs: n })} />
    </div>
    <label className="nw-dynamic-checkbox"><input type="checkbox" checked={!!value.availability} onChange={e => { const next = { ...value }; if (e.target.checked) next.availability = { stateId: '', availableValue: true, maxAgeMs: 5000 }; else delete next.availability; onChange(next); }} /> Zusätzliches Verfügbarkeitssignal verwenden</label>
    {value.availability && <div className="nw-nvp-grid">
      <DpField label="Verfügbarkeit · Datenpunkt" value={value.availability.stateId} onChange={n => set('availability', { ...value.availability, stateId: n })} required />
      <ScalarField label="Verfügbar-Wert" value={value.availability.availableValue} onChange={n => set('availability', { ...value.availability, availableValue: n })} />
      <NumericField label="Verfügbarkeit · Höchstalter" unit="ms" min={1} value={value.availability.maxAgeMs} onChange={n => set('availability', { ...value.availability, maxAgeMs: n })} />
    </div>}
    <h4>Leistungs-, SoC- und Änderungsgrenzen</h4>
    <div className="nw-nvp-grid">
      <NumericField label="Maximale Ladeleistung" unit="W" value={value.maxChargeW} onChange={n => set('maxChargeW', n)} />
      <NumericField label="Maximale Entladeleistung" unit="W" value={value.maxDischargeW} onChange={n => set('maxDischargeW', n)} />
      <NumericField label="Untergrenze SoC" unit="%" max={100} value={value.minSoc} onChange={n => set('minSoc', n)} />
      <NumericField label="Obergrenze SoC" unit="%" max={100} value={value.maxSoc} onChange={n => set('maxSoc', n)} />
      <NumericField label="Höchste Leistungsänderung" unit="W/s" min={1} value={value.maxDeltaWPerSec} onChange={n => set('maxDeltaWPerSec', n)} />
      <NumericField label="Bestätigungstoleranz" unit="W" value={value.configuredToleranceW} onChange={n => set('configuredToleranceW', n)} />
      <NumericField label="Bestätigungsfrist" unit="ms" min={1} value={value.commandTimeoutMs} onChange={n => set('commandTimeoutMs', n)} />
    </div>
    <h4>Strategie für {purposes[value.primaryPurpose || '']}</h4>
    <div className="nw-nvp-grid">
      <NumericField label="Ziel-Netzbezug" unit="W" value={value.strategy?.targetGridImportW} onChange={n => setStrategy('targetGridImportW', n)} />
      <NumericField label="Bezugsschwelle / Toleranz" unit="W" value={value.strategy?.importThresholdW} onChange={n => setStrategy('importThresholdW', n)} />
      {value.primaryPurpose === 'peakShaving' && <NumericField label="Lastspitzengrenze" unit="W" value={value.strategy?.peakLimitW} onChange={n => setStrategy('peakLimitW', n)} />}
    </div>
    {value.primaryPurpose === 'arbitrage' && value.authority === 'eos' && <><p>Ein extern berechneter Leistungswunsch wird von EOS innerhalb der Anschluss- und Speichergrenzen umgesetzt.</p><MeasurementEditor storage label="Arbitrage-Leistungswunsch · Datenpunkt" value={value.requestPowerMeasurement} onChange={n => set('requestPowerMeasurement', n)} /></>}
    {value.primaryPurpose === 'tariff' && <p className="nw-nvp-info">Der aktive Tarifbetrieb nutzt das zentrale Preissignal. Anschluss- und SoC-Grenzen gelten auch bei günstigen Preisen.</p>}
    <h4>Generische Geräteschnittstelle</h4>
    <SelectField label="Befehlsschnittstelle" value={command.mode} onChange={changeCommandMode} options={{ signedTarget: 'Signierter Leistungs-Sollwert', splitTarget: 'Getrennte Lade-/Entlade-Sollwerte', externalLimits: 'Maximale Lade-/Entladefreigaben für externen Regler' }} />
    {command.mode === 'signedTarget' && <OutputEditor signed label="Leistungssollwert" value={command.signedTarget} onChange={n => setCommand('signedTarget', n)} />}
    {command.mode === 'splitTarget' && <><OutputEditor label="Ladesollwert" value={command.chargeTarget} onChange={n => setCommand('chargeTarget', n)} /><OutputEditor label="Entladesollwert" value={command.dischargeTarget} onChange={n => setCommand('dischargeTarget', n)} /><p>Richtungswechsel erfolgen erst nach bestätigter Neutralisierung des bisherigen Sollwerts.</p></>}
    {command.mode === 'externalLimits' && <>
      <p className="nw-nvp-notice">Externe Stellhoheit ist für Arbitrage vorgesehen. EOS erteilt maximale Lade-/Entladefreigaben, keine Leistungsziele. Wirksame Grenzrücklesung und geräteseitiger Ablauf sind erforderlich.</p>
      <OutputEditor label="Maximale Ladefreigabe" value={command.maxCharge} onChange={n => setCommand('maxCharge', n)} />
      <OutputEditor label="Maximale Entladefreigabe" value={command.maxDischarge} onChange={n => setCommand('maxDischarge', n)} />
      <MeasurementEditor positiveOnly label="Angewandte Ladegrenze · Datenpunkt" value={command.appliedMaxCharge} onChange={n => setCommand('appliedMaxCharge', n)} />
      <MeasurementEditor positiveOnly label="Angewandte Entladegrenze · Datenpunkt" value={command.appliedMaxDischarge} onChange={n => setCommand('appliedMaxDischarge', n)} />
      <div className="nw-nvp-grid">
        <DpField mode="write" label="Watchdog · Schreib-Datenpunkt" value={command.watchdog?.stateId} onChange={n => setCommand('watchdog', { ...command.watchdog, stateId: n })} required />
        <DpField label="Watchdog · Rücklese-Datenpunkt" value={command.watchdog?.readbackStateId} onChange={n => setCommand('watchdog', { ...command.watchdog, readbackStateId: n })} required />
        <NumericField label="Geräteseitige Ablaufzeit" unit="ms" min={1} value={command.watchdog?.ttlMs} onChange={n => setCommand('watchdog', { ...command.watchdog, ttlMs: n })} />
        <ScalarField label="Watchdog · Schreibwert" value={command.watchdog?.writeValue} onChange={n => setCommand('watchdog', { ...command.watchdog, writeValue: n })} />
      </div><p>Konfigurierter Gerätevertrag: Nach Ablauf setzt das Gerät seine externen Maximalfreigaben auf 0. Diese Funktion muss im Gerät eingerichtet sein.</p>
    </>}
    <details><summary>Optionale Betriebs- und Richtungsfreigaben</summary>{([['run', 'Betriebsfreigabe'], ['chargeEnable', 'Ladefreigabe'], ['dischargeEnable', 'Entladefreigabe']] as const).map(([key, label]) => <div key={key}>
      <label className="nw-dynamic-checkbox"><input type="checkbox" checked={!!command[key]} onChange={e => { const next = { ...command }; if (e.target.checked) next[key] = { stateId: '', onValue: true, offValue: false }; else delete next[key]; set('command', next); }} /> {label} zuordnen</label>
      {command[key] && <SwitchOutputEditor label={label} value={command[key]} onChange={n => setCommand(key, n)} />}
    </div>)}</details>
  </article>;
}
/** PV-Erzeugungsgrenzen sind generische W-/Prozentvorgaben, keine Netz-Einspeisesollwerte. */
function PvEditor({ value, onChange, onRemove }: { value: Pv; onChange: (value: Pv) => void; onRemove: () => void }) {
  const set = <K extends keyof Pv>(key: K, next: Pv[K]) => onChange({ ...value, [key]: next });
  return <article className="nw-nvp-device">
    <div className="nw-nvp-section-heading"><h3>{value.id || 'Neuer PV-Wechselrichter'}</h3><button type="button" className="nw-button nw-config-btn" onClick={onRemove}>PV entfernen</button></div>
    <div className="nw-nvp-grid">
      <TextField label="PV-Kennung" value={value.id} onChange={n => set('id', n)} required />
      <SelectField label="PV-Anschlussbereich" value={value.connectionPointId} onChange={n => set('connectionPointId', n)} options={pointNames} placeholder />
      <NumericField label="AC-Bezugsleistung" unit="W" min={1} value={value.referencePowerW} onChange={n => set('referencePowerW', n)} help="Bezugsleistung der Wirkleistungsregelung, keine ungeprüfte DC-Modulleistung." />
    </div>
    <MeasurementEditor label="PV-Istleistung · Datenpunkt" value={value.powerMeasurement} onChange={n => set('powerMeasurement', n)} />
    <div className="nw-nvp-grid">
      <DpField mode="write" label="PV-Erzeugungsgrenze · Schreib-Datenpunkt" value={value.command?.stateId} onChange={n => set('command', { ...value.command, stateId: n })} required />
      <SelectField label="Einheit der PV-Vorgabe" value={value.command?.unit} onChange={n => set('command', { ...value.command, unit: n })} options={{ W: 'Watt (W)', '%': 'Prozent der AC-Bezugsleistung' }} />
      <NumericField label={value.command?.unit === '%' ? 'Prozentpunkte je Rohwert' : 'PV-Vorgabe · W je Rohwert'} min={0.000001} value={value.command?.scale} onChange={n => set('command', { ...value.command, scale: n })} />
      <DpField label="PV-Erzeugungsgrenze · Rücklese-Datenpunkt (optional)" value={value.command?.readbackStateId} onChange={n => set('command', optionalText(value.command || {}, 'readbackStateId', n))} />
    </div>
    <label className="nw-dynamic-checkbox"><input type="checkbox" checked={value.evuControl === true} onChange={e => set('evuControl', e.target.checked)} /> Vorhandene EVU-Stufen auf diesen Wechselrichter anwenden</label>
    {value.evuControl && <p>Verwendet die bestehende EVU-Anlagenzuordnung. EVU-Stufe und dynamische Anschlussgrenze werden zu einer gemeinsamen Erzeugungsvorgabe zusammengeführt.</p>}
  </article>;
}

/** Laufzeitwerte bleiben von Entwurf/Vorschau getrennt. Fehlende Bestätigung wird niemals als angewandte Leistung angezeigt. */
function LiveStatus({ status, preview = false }: { status: LiveState | null; preview?: boolean }) {
  if (!status) return <p>{preview ? 'Noch keine Messwertvorschau verfügbar.' : 'Noch kein Betriebsstatus verfügbar.'}</p>;
  const timestamp = status.ts;
  const stale = typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp > Date.now() || Date.now() - timestamp > 15000;
  const snapshot = status.snapshot || {};
  const points = Object.entries(snapshot.points || {}).map(([id, row]) => ({ id, ...row }));
  const measured = snapshot.storages || {};
  const results = Array.isArray(status.storageResults) ? status.storageResults : [];
  const pending = Array.isArray(status.pendingIntervals) ? status.pendingIntervals : [];
  const ids = [...new Set([...Object.keys(measured), ...results.map(r => r.id), ...pending.map(p => p.id)])].filter((id): id is string => typeof id === 'string');
  const errors = [...(Array.isArray(status.errors) ? status.errors : []), ...(Array.isArray(status.activationErrors) ? status.activationErrors : []), ...(Array.isArray(snapshot.errors) ? snapshot.errors : [])];
  const names: Readonly<Record<string, string>> = textLabels({ active: 'Aktiv', limited: 'Durch Grenzen beschränkt', recovering: 'Anschlussgrenze wiederherstellen', handover_pending: 'Stellübergabe läuft', handover_confirmed: 'Stellübergabe bestätigt', config_invalid: 'Konfiguration unvollständig oder ungültig', runtime_error: 'Laufzeitfehler', 'root-measurement-unavailable': 'M0-Messung nicht verfügbar', 'other-actuator-transition-unconfirmed': 'Weitere Aktorwirkung noch unbestätigt', inactive: 'Inaktiv' });
  return <div className="nw-dynamic-live">
    <p><strong>{preview ? 'Vorschau – keine Geräteschreibzugriffe' : names[status.status || ''] || status.status || 'Laufender Betrieb'}</strong>{status.configVersion ? ` · Konfiguration ${status.configVersion}` : ''}</p>
    {status.reason || status.budget?.reason ? <p>{status.reason || status.budget?.reason}</p> : null}
    {stale && <p role="alert">Betriebsanzeige veraltet. Aktuelle Stellwerte können nicht bestätigt werden.</p>}
    {errors.length > 0 && <ul>{errors.map((error, i) => <li key={i}>{reasonText(error)}</li>)}</ul>}
    {points.length > 0 && <div className="nw-nvp-table-wrap"><table className="nw-nvp-table"><thead><tr><th>Messpunkt</th><th>Netzleistung</th><th>Qualität</th><th>Messwertalter</th></tr></thead><tbody>{points.map(p => <tr key={p.id}><th>{p.id}</th><td>{watts(p.valueW)}</td><td>{stale ? 'Anzeige veraltet' : p.valid ? 'Gültig' : p.reason || 'Ungültig'}</td><td>{typeof p.ageMs === 'number' ? `${Math.round(p.ageMs)} ms` : '—'}</td></tr>)}</tbody></table></div>}
    {Array.isArray(status.groups) && status.groups.length > 0 && <div className="nw-nvp-table-wrap"><table className="nw-nvp-table"><thead><tr><th>Regelgruppe</th><th>Bereich / Aufgabe</th><th>Bedarf</th><th>Begründung</th></tr></thead><tbody>{status.groups.map(group => <tr key={group.id}><th>{group.id}</th><td>{group.connectionPointId} · {purposes[group.primaryPurpose || ''] || group.primaryPurpose}<small>{group.authority === 'external' ? 'Externe Stellhoheit' : 'EOS-Stellhoheit'}</small></td><td>{stale ? '—' : watts(group.requestedW)}</td><td>{group.reason || group.status || '—'}</td></tr>)}</tbody></table></div>}
    {ids.length > 0 && <div className="nw-nvp-table-wrap"><table className="nw-nvp-table" aria-label="Sollwerte, Bestätigung und Messung"><thead><tr><th>Speicher</th><th>Anforderung</th><th>Ziel / Freigabe</th><th>Befehl</th><th>Anwendung</th><th>Gemessen</th></tr></thead><tbody>{ids.map(id => {
      const sample = measured[id] || {}, telemetry = snapshot.storageTelemetry?.[id] || {};
      const result: StorageResult = results.find(row => row.id === id) || {}; const interval: PendingInterval = pending.find(row => row.id === id) || {};
      const confirmed = interval.appliedConfirmed === true && (!Number.isFinite(result.targetW) || interval.targetW === result.targetW);
      const target = typeof result.targetW === 'number' ? watts(result.targetW) : typeof result.minPowerW === 'number' && typeof result.maxPowerW === 'number' ? `${watts(result.minPowerW)} bis ${watts(result.maxPowerW)}` : '—';
      return <tr key={id}><th>{id}</th><td>{stale ? '—' : watts(result.requestedW)}</td><td>{stale ? '—' : target}</td><td>{preview ? 'Vorschau' : stale ? 'Unbekannt' : result.commandConfirmed ? 'Rücklesung bestätigt' : result.accepted ? 'Gesendet · unbestätigt' : 'Keine bestätigte Ausgabe'}<small>{result.reason || ''}</small></td><td>{preview ? 'Keine Anwendung' : stale ? 'Unbekannt' : confirmed ? 'Wirkung / Grenze bestätigt' : 'Noch nicht bestätigt'}</td><td>{watts(sample.valueW)}<small>{typeof telemetry.socPct === 'number' ? `${telemetry.socPct} % SoC` : 'SoC unbekannt'} · {telemetry.available === true && sample.valid ? 'verfügbar' : 'Verfügbarkeit unbestätigt'}</small></td></tr>;
    })}</tbody></table></div>}
    {typeof status.writesPerformed === 'number' && <p>Angenommene Schreibvorgänge im letzten Zyklus: {status.writesPerformed}.</p>}
    <p className="nw-text-muted">Netzbezug positiv; Speicherentladung positiv. Gesendete Sollwerte, bestätigte Gerätegrenzen und gemessene Wirkung sind unterschiedliche Zustände.</p>
  </div>;
}
function ValidationMessages({ validation }: { validation: Validation | null }) {
  if (!validation) return null;
  const errors = [...(validation.errors || []), ...(validation.activationErrors || [])];
  return <div className="nw-dynamic-validation"><p><strong>{validation.valid === false ? 'Einrichtung prüfen' : validation.activeEligible === false ? 'Einrichtung noch nicht vollständig aktivierbar' : 'Einrichtung geprüft'}</strong></p>
    {errors.length > 0 && <ul>{errors.map((issue, i) => <li key={i}>{typeof issue !== 'string' && issue.path && <code>{issue.path}: </code>}{reasonText(issue)}</li>)}</ul>}
    {Array.isArray(validation.warnings) && validation.warnings.length > 0 && <ul>{validation.warnings.map((issue, i) => <li key={i}>{reasonText(issue)}</li>)}</ul>}
  </div>;
}

/** CAS schützt den gespeicherten Stand. Polling überschreibt nie den bearbeiteten Entwurf. */
export default function DynamicGridPage() {
  const [config, setConfig] = useState<Topology | null>(null);
  const [savedConfig, setSavedConfig] = useState<Topology | null>(null);
  const [storedVersion, setStoredVersion] = useState(1);
  const storedVersionRef = useRef<number | null>(null);
  const observedVersionRef = useRef(0);
  const [staleConfig, setStaleConfig] = useState(false);
  const staleNotice = 'Der gespeicherte Stand wurde außerhalb dieses Formulars geändert. Bitte neu laden. Ihr Entwurf bleibt bis dahin erhalten; Speichern und App-Schalter sind gesperrt.';
  const observeVersion = (version: unknown) => {
    if (typeof version !== 'number') return;
    if (!Number.isSafeInteger(version) || version < 1) return;
    observedVersionRef.current = Math.max(observedVersionRef.current, version);
    setStaleConfig(storedVersionRef.current !== null && observedVersionRef.current > storedVersionRef.current);
  };
  const [app, setApp] = useState<AppState>({ installed: false, enabled: false });
  const [rootSource, setRootSource] = useState<RootSource | null>(null);
  const [status, setStatus] = useState<LiveState | null>(null);
  const [preview, setPreview] = useState<LiveState | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const [message, setMessage] = useState('Dynamischer Netzanschluss wird geladen…');
  const [error, setError] = useState(false);
  const active = app.installed && app.enabled;
  const dpFieldContext = useMemo(() => ({ revision: draftRevision, blocked: busy || staleConfig }), [draftRevision, busy, staleConfig]);
  const acceptServer = (data: DynamicGridResponse, replaceDraft = false, acceptedMutation = false) => {
    // Ein verspäteter Poll darf weder App-Lifecycle noch Entwurf auf einen älteren
    // Stand zurücksetzen, während der bereits bestätigte CAS-Token neuer bleibt.
    const incomingVersion = data.config?.configVersion;
    if (typeof incomingVersion === 'number' && Number.isSafeInteger(incomingVersion) && incomingVersion < Math.max(observedVersionRef.current, storedVersionRef.current || 0)) return false;
    observeVersion(data.config?.configVersion);
    setStatus(data.status || null); setRootSource(data.rootSource || null);
    if (data.app) setApp(data.app);
    setLocked(data.locked === true);
    if (replaceDraft || acceptedMutation) {
      setDraftRevision(revision => revision + 1);
      const next = { ...emptyTopology(), ...data.config };
      if (!Array.isArray(next.points) || next.points.length !== 2) next.points = emptyTopology().points;
      if (!Array.isArray(next.storages)) next.storages = [];
      if (!Array.isArray(next.pvAssignments)) next.pvAssignments = [];
      setSavedConfig(next); setStoredVersion(next.configVersion || 1);
      storedVersionRef.current = next.configVersion || 1;
      setStaleConfig(observedVersionRef.current > storedVersionRef.current);
      if (replaceDraft) { setConfig(next); setDirty(false); setPreview(null); setValidation(data.validation || null); }
      else setConfig(previous => previous ? { ...previous, configVersion: next.configVersion } : next);
    }
    return true;
  };
  useEffect(() => {
    const onParentChange = (event: MessageEvent<unknown>) => {
      if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin || !isSafeJson(event.data) || !isRecord(event.data) || event.data.type !== 'nw:dynamic-grid-parent-changed') return;
      observeVersion(event.data.configVersion);
    };
    window.addEventListener('message', onParentChange);
    return () => window.removeEventListener('message', onParentChange);
  }, []);
  // Nur nach bestätigter Mutation informieren; der Parent übernimmt keine Daten
  // aus der Nachricht und lädt seinen Gesamtstand ausschließlich auf Nutzerwunsch.
  const notifyParentSaved = (data: DynamicGridResponse) => {
    if (window.parent !== window && data.config && Number.isSafeInteger(data.config.configVersion)) window.parent.postMessage({ type: 'nw:dynamic-grid-saved', configVersion: data.config.configVersion }, window.location.origin);
  };
  useEffect(() => {
    let mounted = true; let timer: number | undefined;
    const poll = async (first = false) => {
      try {
        const data = parseDynamicGridResponse(await dynamicGridRequest());
        if (!mounted) return;
        const accepted = acceptServer(data, first);
        if (first && accepted) { setError(false); setMessage('Alle Zuordnungen dieser App werden hier eingerichtet.'); }
      } catch (e) {
        if (mounted) { setError(true); setMessage(getErrorMessage(e, 'App nicht erreichbar.')); if ([401, 403].includes(getErrorStatus(e))) { setConfig(null); setStatus(null); } }
      } finally { if (mounted) timer = window.setTimeout(() => poll(false), 3000); }
    };
    poll(true);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, []);
  const change = (next: Topology) => { setDraftRevision(revision => revision + 1); setConfig(next); setDirty(true); setPreview(null); setValidation(null); };
  const update = <K extends keyof Topology>(key: K, value: Topology[K]) => { if (config) change({ ...config, [key]: value }); };
  const replaceRow = <T,>(rows: T[], index: number, value: T): T[] => rows.map((row, i) => i === index ? value : row);
  const removeRow = (key: 'points' | 'storages' | 'pvAssignments', index: number) => { if (config) change({ ...config, [key]: config[key].filter((_, i) => i !== index) }); };
  const showFailure = (e: unknown) => {
    setError(true); setMessage(getErrorStatus(e) === 409 ? 'Der gespeicherte Stand wurde geändert oder eine Stellübergabe ist offen. Bitte Betriebsstatus prüfen und neu laden. Ihr Entwurf bleibt erhalten.' : getErrorMessage(e, 'Speichern fehlgeschlagen.'));
    if (e instanceof RuntimeRequestError && isRecord(e.payload)) {
      const validated = parseValidation(e.payload.validation) || parseValidationDetails(e.payload.details);
      if (validated) setValidation(validated);
    }
  };
  const reload = async () => {
    setBusy(true);
    try { const data = parseDynamicGridResponse(await dynamicGridRequest()); if (acceptServer(data, true)) { setError(false); setMessage('Gespeicherten Stand geladen.'); } }
    catch (e) { showFailure(e); } finally { setBusy(false); }
  };
  const save = async (activate = false) => {
    if (staleConfig) { setError(true); setMessage(staleNotice); return; }
    setBusy(true); setError(false);
    try {
      const appState = activate ? { installed: true, enabled: true } : { installed: !!app.installed, enabled: !!app.enabled };
      const data = parseDynamicGridResponse(await dynamicGridRequest('/config', { config, expectedConfigVersion: storedVersion, app: appState }));
      if (!acceptServer(data, true)) { setMessage(staleNotice); return; }
      notifyParentSaved(data);
      setMessage(data.app?.installed && data.app?.enabled ? 'Dynamischer Netzanschluss aktiviert. Die Laufzeit prüft Messqualität und Bestätigungen vor der Stellwertausgabe.' : 'Einrichtung als inaktiver Entwurf gespeichert.');
    } catch (e) { showFailure(e); } finally { setBusy(false); }
  };
  const lifecycle = async (nextApp: AppState) => {
    if (staleConfig) { setError(true); setMessage(staleNotice); return; }
    setBusy(true); setError(false);
    try {
      const data = parseDynamicGridResponse(await dynamicGridRequest('/config', { config: savedConfig, expectedConfigVersion: storedVersion, app: nextApp }));
      if (!acceptServer(data, !dirty, true)) { setMessage(staleNotice); return; }
      notifyParentSaved(data);
      setMessage(nextApp.installed ? 'App installiert und inaktiv. Die Einrichtung bleibt erhalten.' : 'App deinstalliert. Die gespeicherte Einrichtung bleibt erhalten.');
    } catch (e) { showFailure(e); } finally { setBusy(false); }
  };
  const checkPreview = async () => {
    setBusy(true); setError(false);
    try {
      const data = parseDynamicGridResponse(await dynamicGridRequest('/preview', { config }), false);
      setValidation(data.validation || null); setPreview(data.status || null);
      setMessage('Entwurf geprüft. Die Vorschau schreibt keine Gerätesollwerte.');
    } catch (e) { showFailure(e); } finally { setBusy(false); }
  };
  const embedded = window.parent !== window && new URLSearchParams(window.location.search).get('embedded') === '1';
  return <DpFieldContext.Provider value={dpFieldContext}><PageShell embedded={embedded} title="Dynamischer Netzanschluss" subtitle="M0 und M1 gemeinsam begrenzen. Speicher und PV vollständig in dieser App zuordnen und betreiben." showBack={false} actions={<a className="nw-link-button nw-config-btn" href={`${getRuntimeProxyBase() ?? ''}/ems-apps.html?nwAdmin=1`} target={embedded ? '_parent' : '_self'}>Zu EMS Apps</a>}>
    <section className="nw-card nw-config-card nw-dynamic-lifecycle">
      <div className="nw-nvp-section-heading"><h2 className="nw-config-card__title">App und Betrieb</h2><span className={`nw-nvp-tag ${active ? 'nw-dynamic-active' : ''}`}>{status?.status === 'handover_pending' ? 'Stellübergabe läuft' : active ? 'Dynamisch aktiv' : app.installed ? 'Installiert · inaktiv' : 'Nicht installiert'}</span></div>
      <div role={error ? 'alert' : 'status'} className={`nw-status ${error ? 'nw-status--bad' : ''}`}>{message}</div>
      <p>Installiert und aktiviert schaltet diese App auf dynamischen Betrieb. Inaktive Entwürfe erzeugen keine Stellwerte.</p>
      <div className="nw-actions-row">
        {!app.installed && <button type="button" className="nw-button nw-config-btn" disabled={busy || staleConfig || !config} onClick={() => lifecycle({ installed: true, enabled: false })}>App installieren</button>}
        {active && <button type="button" className="nw-button nw-config-btn" disabled={busy || staleConfig} onClick={() => lifecycle({ installed: true, enabled: false })}>App deaktivieren</button>}
        {app.installed && !active && <button type="button" className="nw-button nw-config-btn" disabled={busy || staleConfig} onClick={() => lifecycle({ installed: false, enabled: false })}>App deinstallieren</button>}
        <button type="button" className="nw-button nw-config-btn" disabled={busy} onClick={reload}>{dirty ? 'Entwurf verwerfen und neu laden' : 'Neu laden'}</button>
      </div>
      {staleConfig && <p role="alert" className="nw-nvp-notice">{staleNotice}</p>}
      {dirty && <p className="nw-nvp-notice">Ungespeicherte Änderungen. Der Betriebsstatus gehört zum gespeicherten Stand.</p>}
      {locked && <p className="nw-nvp-notice">Eine Stellübergabe ist noch offen. Der Server prüft, wann Änderungen sicher übernommen werden können.</p>}
    </section>
    {config && <form noValidate onSubmit={event => { event.preventDefault(); save(true); }} aria-busy={busy}>
      <fieldset disabled={busy} className="nw-nvp-fieldset">
        <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Messstruktur und gemeinsame Grenzen</h2><p>M0 umfasst den gesamten Anschluss einschließlich M1. Ein Speicher außerhalb von M1 kann keine lokale M1-Nulleinspeisung herstellen.</p><NumericField label="Höchste zeitliche Abweichung zusammengehöriger Messungen" unit="ms" value={config.maxSkewMs} onChange={n => update('maxSkewMs', n)} /></section>
        {config.points.map((point, i) => <PointEditor key={point.id} value={point} rootSource={rootSource} onChange={next => update('points', replaceRow(config.points, i, next))} />)}
        <section className="nw-card nw-config-card"><div className="nw-nvp-section-heading"><h2 className="nw-config-card__title">Speicher und Betriebsaufgaben</h2><button className="nw-button nw-config-btn" type="button" onClick={() => update('storages', [...config.storages, emptyStorage()])}>Speicher hinzufügen</button></div><p>Jeder Speicher erhält hier seine eigenen Datenpunkte, Grenzen und Betriebsaufgaben. Die Einrichtung in einer anderen App ist nicht erforderlich.</p>
          {!config.storages.length && <p>Noch kein Speicher eingerichtet.</p>}
          {config.storages.map((storage, i) => <StorageEditor key={i} value={storage} onChange={next => update('storages', replaceRow(config.storages, i, next))} onRemove={() => removeRow('storages', i)} />)}
        </section>
        <section className="nw-card nw-config-card"><div className="nw-nvp-section-heading"><h2 className="nw-config-card__title">PV-Wechselrichter</h2><button className="nw-button nw-config-btn" type="button" onClick={() => update('pvAssignments', [...config.pvAssignments, emptyPv()])}>PV hinzufügen</button></div><p>Eine lokale Nulleinspeisung benötigt wirksame Stellmöglichkeiten im lokalen Bereich. PV wird nach gemessener Leistung und verbleibendem Anschlussbudget begrenzt.</p>
          {config.pvAssignments.map((pv, i) => <PvEditor key={i} value={pv} onChange={next => update('pvAssignments', replaceRow(config.pvAssignments, i, next))} onRemove={() => removeRow('pvAssignments', i)} />)}
        </section>
        <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Einrichtung übernehmen</h2><div className="nw-actions-row"><button type="button" className="nw-button nw-config-btn" onClick={checkPreview}>Einrichtung prüfen</button><button type="button" className="nw-button nw-config-btn" disabled={staleConfig} onClick={() => save(false)}>{active ? 'Änderungen speichern' : 'Entwurf speichern'}</button><button type="submit" className="nw-button nw-config-btn nw-button--primary nw-config-btn--primary" disabled={staleConfig}>{active ? 'Speichern und aktiv halten' : 'Speichern und aktivieren'}</button></div><p>Aktivieren übernimmt Konfiguration und App-Zustand gemeinsam. Unvollständige Zuordnungen werden mit konkreten Gründen abgewiesen. Empfang eines Befehls ersetzt keine bestätigte Gerätewirkung.</p><ValidationMessages validation={validation} /></section>
      </fieldset>
    </form>}
    {preview && <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Vorschau der Einrichtung</h2><LiveStatus preview status={preview} /></section>}
    <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Betriebsstatus</h2><LiveStatus status={status} /></section>
  </PageShell></DpFieldContext.Provider>;
}
