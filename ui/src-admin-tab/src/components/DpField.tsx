/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Wiederverwendbares ID-Eingabefeld mit dem bestehenden EMS-Datenpunktdialog.
 * Daten und Wirkung: Auswahl und manuelle Eingabe rufen denselben onChange-/Dirty-Pfad auf.
 * Bei Änderungen: Abbruch bei Zeilenwechsel, Entwurfsänderung, Speichersperre und Unmount erhalten.
 * M0 verwendet dieses Feld ausdrücklich nicht; seine Quelle bleibt Allgemein vorbehalten.
 */
import React, { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { chooseDataPoint, type DataPointMode } from '../lib/dataPointPicker';

/** Fachliche Entwurfsrevision/Sperre, unabhängig von regelmäßigem Statuspolling. */
export const DpFieldContext = createContext<{ revision: number; blocked: boolean }>({ revision: 0, blocked: false });
type Props = { label: string; value?: string; onChange: (id: string) => void; required?: boolean; help?: string; maxLength?: number; mode?: DataPointMode; disabled?: boolean };
export default function DpField({ label, value = '', onChange, required = false, help = '', maxLength = 512, mode = 'read', disabled = false }: Props) {
  const id = useId();
  const context = useContext(DpFieldContext);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const latest = useRef({ context, value, onChange, disabled });
  latest.current = { context, value, onChange, disabled };
  useLayoutEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setPending(false);
    return () => { controller.current?.abort(); controller.current = null; };
  }, [context.revision, context.blocked, value, disabled]);
  async function pick() {
    if (disabled || context.blocked) return;
    controller.current?.abort();
    const request = new AbortController();
    const started = { context, value };
    controller.current = request;
    setPending(true); setError('');
    try {
      const selected = await chooseDataPoint({ currentId: typeof value === 'string' ? value : '', mode, signal: request.signal });
      if (selected !== null && !request.signal.aborted && controller.current === request && latest.current.context.revision === started.context.revision && !latest.current.context.blocked && latest.current.value === started.value && !latest.current.disabled) latest.current.onChange(selected);
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError') && !request.signal.aborted) setError(e instanceof Error ? e.message : 'Datenpunkt konnte nicht gewählt werden.');
    } finally {
      if (controller.current === request) { controller.current = null; setPending(false); }
    }
  }
  return <div className="nw-nvp-field nw-config-field" data-dp-field="true">
    <label htmlFor={id} className="nw-config-label">{label}</label>
    <div className="nw-dp-field-controls" style={{ display: 'flex', gap: 8, alignItems: 'stretch', minWidth: 0 }}>
      <input id={id} className="nw-input nw-config-input" style={{ minWidth: 0, flex: 1 }} value={value ?? ''} required={required} maxLength={maxLength} disabled={disabled || context.blocked} onChange={event => onChange(event.target.value)} />
      <button type="button" className="nw-button nw-config-btn nw-config-btn--ghost" data-dp-pick="true" aria-label={`Datenpunkt auswählen: ${label}`} disabled={disabled || context.blocked || pending} onClick={pick}>{pending ? 'Auswahl offen…' : 'DP wählen'}</button>
    </div>
    {help && <small>{help}</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
