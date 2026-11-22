/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Gemeinsame sichere Partner-Einrichtung in Arbitrage, Bilanz und Direktvermarktung.
 * Daten und Wirkung: Bearbeitet explizite Daten-/Steuerfreigaben, Speichergrenzen in W/%
 * und WSS-Verbindungsreferenzen über die geschützte API. Keine direkten Gerätebefehle.
 * Bei Änderungen: Serververtrag, Versionskonflikte, Entwurferhalt und Widerruf mitprüfen.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/PartnerIntegrationsPage.md
 */
import React, { useEffect, useRef, useState } from 'react';
import PageShell from './PageShell';
import { getErrorMessage, getErrorStatus, partnerIntegrationsRequest, RuntimeRequestError } from '../lib/adminConnection';
import { parsePartnerConfig, parsePartnerResponse, parsePartnerValidation, type PartnerPreviewResponse, type PartnerAppId, type PartnerDraft, type PartnerDraftResource, type PartnerGrant, type PartnerPermission, type PartnerResponse } from '../lib/partnerContracts';

const names: Record<PartnerAppId, string> = { arbitrage: 'Arbitrage · Speicherhandel', energyLedger: 'Bilanz · Partnerfreigaben', directMarketing: 'Direktvermarktung · Partnerfreigaben' };
const permissions: Record<PartnerPermission, string> = {
  'balance.read': 'Bilanzdaten lesen', 'telemetry.read': 'Messwerte lesen', 'capabilities.read': 'Verfügbare Funktionen lesen',
  'curtailment.request': 'Begrenzung anfragen', 'storage.charge.request': 'Laden anfragen', 'storage.discharge.request': 'Entladen anfragen',
  'dispatch.status.read': 'Auftragsstatus lesen', 'dispatch.cancel': 'Eigene Aufträge zurücknehmen',
};
const allowed: Record<PartnerAppId, PartnerPermission[]> = {
  energyLedger: ['balance.read'],
  directMarketing: ['telemetry.read', 'capabilities.read', 'curtailment.request', 'dispatch.status.read', 'dispatch.cancel'],
  arbitrage: ['telemetry.read', 'capabilities.read', 'storage.charge.request', 'storage.discharge.request', 'dispatch.status.read', 'dispatch.cancel'],
};
const connectionNames = { disabled: 'Verbindung ausgeschaltet', blocked: 'Verbindung gesperrt', disconnected: 'Nicht verbunden', connected: 'Verbunden' };
const reasonNames: Readonly<Record<string, string>> = Object.freeze({ DISABLED: 'Partnerverbindung ausgeschaltet.', NOT_CONNECTED: 'Noch keine bestätigte Partnerverbindung.', CONTROL_UNAVAILABLE: 'Die sichere Speichersteuerung ist noch nicht freigegeben.', INVALID_CONFIG: 'Die gespeicherte Konfiguration ist unvollständig oder ungültig.', APP_INACTIVE: 'Die zugehörige App ist nicht aktiv.' });
function reasonLabel(code: string): string { return Object.hasOwn(reasonNames, code) ? reasonNames[code] : `Statushinweis: ${code}`; }
function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number | ''; onChange: (next: number | '') => void; min?: number; max?: number }) {
  return <label className="nw-nvp-field nw-config-field"><span className="nw-config-label">{label}</span><input className="nw-input nw-config-input" type="number" required min={min} max={max} step="any" value={value} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} /></label>;
}
function TextField({ label, value, onChange, help = '', maxLength = 128 }: { label: string; value: string; onChange: (next: string) => void; help?: string; maxLength?: number }) {
  return <label className="nw-nvp-field nw-config-field"><span className="nw-config-label">{label}</span><input className="nw-input nw-config-input" value={value} maxLength={maxLength} autoComplete="off" onChange={event => onChange(event.target.value)} />{help && <small>{help}</small>}</label>;
}
/** Fachliche Freigaben sind je App/Ressource getrennt. Die API prüft jede Berechtigung erneut. */
function GrantEditor({ grant, resourceIds, onChange, onRemove }: { grant: PartnerGrant; resourceIds: string[]; onChange: (next: PartnerGrant) => void; onRemove: () => void }) {
  return <article className="nw-nvp-device"><div className="nw-nvp-section-heading"><h3>Ressourcenfreigabe</h3><button className="nw-button nw-config-btn" type="button" onClick={onRemove}>Freigabe entfernen</button></div>
    <label className="nw-nvp-field nw-config-field"><span className="nw-config-label">Freigegebene Ressource</span><select className="nw-input nw-config-select" required value={grant.resourceId} onChange={event => onChange({ ...grant, resourceId: event.target.value })}><option value="">Ressource ausdrücklich auswählen</option>{grant.resourceId && !resourceIds.includes(grant.resourceId) && <option value={grant.resourceId}>Nicht zugeordnet: {grant.resourceId}</option>}{resourceIds.map(id => <option key={id} value={id}>{id === 'site' ? 'Anlage (site)' : id === 'single' ? 'Einzelspeicher (single)' : `Dynamische Gruppe: ${id}`}</option>)}</select><small>Nur lokal eingerichtete Ressourcen freigeben. Rohdatenpunktpfade sind nicht zulässig.</small></label>
    <div className="nw-partner-permissions">{allowed[grant.appId].map(permission => <label className="nw-dynamic-checkbox" key={permission}><input type="checkbox" checked={grant.permissions.includes(permission)} onChange={event => onChange({ ...grant, permissions: event.target.checked ? [...grant.permissions, permission] : grant.permissions.filter(p => p !== permission) })} />{permissions[permission]}</label>)}</div>
  </article>;
}
/** Reserven gelten pro Speicher und begrenzen Händleranforderungen; sie ersetzen keine Netz-/Geräteschutzprüfung. */
function ResourceEditor({ resource, onChange, onRemove }: { resource: PartnerDraftResource; onChange: (next: PartnerDraftResource) => void; onRemove: () => void }) {
  const set = <K extends keyof PartnerDraftResource>(key: K, value: PartnerDraftResource[K]) => onChange({ ...resource, [key]: value });
  return <article className="nw-nvp-device"><div className="nw-nvp-section-heading"><h3>{resource.id || 'Neuer Handelsspeicher'}</h3><button className="nw-button nw-config-btn" type="button" onClick={onRemove}>Speicher entfernen</button></div><label className="nw-nvp-field nw-config-field"><span className="nw-config-label">Lokaler Regelpfad</span><select className="nw-input nw-config-select" value={resource.id === 'single' ? 'single' : resource.id === 'farm' ? 'unsupported' : 'group'} onChange={event => onChange({ ...resource, id: event.target.value === 'single' ? 'single' : '', commissioned: false })}><option value="single">Vorhandene Einzelspeicher-Regelung (single)</option><option value="group">Konfigurierte dynamische Speichergruppe</option>{resource.id === 'farm' && <option value="unsupported">Speicherfarm: in dieser Version nicht freigegeben</option>}</select></label>
    {resource.id !== 'single' && resource.id !== 'farm' && <TextField label="Kennung der konfigurierten dynamischen Speichergruppe" maxLength={64} value={resource.id} onChange={id => onChange({ ...resource, id, commissioned: false })} help="Exakte Gruppenkennung aus dem dynamischen Netzanschluss; keine Datenpunktadresse." />}
    {resource.id === 'single' && <p>Die vorhandene lokale Speicherregelung muss eingerichtet und aktiv sein. Arbitrage ergänzt ihre Handelsanforderungen; PV und dynamischer Netzanschluss sind dafür nicht erforderlich.</p>}
    {resource.id === 'farm' && <p className="nw-nvp-notice">Die bestehende Speicherfarm ist für Partnersteuerung in dieser Version nicht freigegeben. Diese Ressource entfernen oder einen unterstützten Regelpfad einrichten.</p>}
    <div className="nw-nvp-grid"><NumberField label="Maximale Ladeleistung (W)" value={resource.maxChargeW} onChange={value => set('maxChargeW', value)} /><NumberField label="Maximale Entladeleistung (W)" value={resource.maxDischargeW} onChange={value => set('maxDischargeW', value)} /><NumberField label="Reserve · Mindest-SoC (%)" value={resource.minSocPct} max={100} onChange={value => set('minSocPct', value)} /><NumberField label="Höchster SoC (%)" value={resource.maxSocPct} max={100} onChange={value => set('maxSocPct', value)} /><NumberField label="Zulässiger Netzbezug (W)" value={resource.maxImportW} onChange={value => set('maxImportW', value)} /><NumberField label="Zulässige Netzeinspeisung (W)" value={resource.maxExportW} onChange={value => set('maxExportW', value)} /></div>
    <label className="nw-dynamic-checkbox"><input type="checkbox" checked={resource.allowGridCharge} onChange={event => set('allowGridCharge', event.target.checked)} />Netzladung für diesen Speicher erlauben</label><label className="nw-dynamic-checkbox"><input type="checkbox" checked={resource.allowGridExport} onChange={event => set('allowGridExport', event.target.checked)} />Einspeisung aus diesem Speicher erlauben</label><label className="nw-dynamic-checkbox"><input type="checkbox" checked={resource.id !== 'farm' && resource.commissioned} disabled={resource.id === 'farm'} onChange={event => set('commissioned', event.target.checked)} />Installateurfreigabe: Messung, Grenzen und sicherer Regelpfad wurden an dieser Anlage geprüft</label>
  </article>;
}

/**
 * Konfigurationsversionen schützen vor konkurrierenden Änderungen aus anderen Apps.
 * Polling ersetzt niemals den Entwurf; verspätete Antworten und Antworten während
 * einer Mutation können keinen älteren Stand wiederherstellen. Widerruf verwirft
 * alle Partnerfreigaben erst nach bestätigtem Serverergebnis.
 */
export default function PartnerIntegrationsPage({ appId = 'arbitrage' }: { appId?: PartnerAppId }) {
  const [draft, setDraft] = useState<PartnerDraft | null>(null);
  const [server, setServer] = useState<PartnerResponse | null>(null);
  const [preview, setPreview] = useState<PartnerPreviewResponse | null>(null);
  const [validation, setValidation] = useState<PartnerResponse['validation'] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('Partnerfreigaben werden geladen…');
  const [lastReadAt, setLastReadAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const loadedVersion = useRef<number | null>(null);
  const observedVersion = useRef(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const staleNotice = 'Der gespeicherte Stand wurde geändert. Ihr Entwurf bleibt erhalten. Vor dem nächsten Speichern bitte neu laden.';
  const embedded = window.parent !== window && new URLSearchParams(window.location.search).get('embedded') === '1';
  const stale = lastReadAt === 0 || clock - lastReadAt > 15000;
  const safeStatus = !stale && !uncertain && !conflict;
  const activeControl = safeStatus && server?.app.active === true && server.status.controlAvailable && server.status.connection === 'connected';
  const locked = busy || conflict || uncertain;

  const accept = (next: PartnerResponse, replaceDraft: boolean) => {
    if (!mounted.current || next.config.configVersion < observedVersion.current) return;
    observedVersion.current = next.config.configVersion;
    setServer(next); setLastReadAt(Date.now());
    if (replaceDraft) {
      loadedVersion.current = next.config.configVersion;
      setDraft(next.config); setDirty(false); setConflict(false); setUncertain(false); setPreview(null); setValidation(null);
    } else if (loadedVersion.current !== null && next.config.configVersion > loadedVersion.current) setConflict(true);
  };
  const read = async (replaceDraft = false) => {
    if (busyRef.current) return;
    if (replaceDraft) { busyRef.current = true; setBusy(true); }
    try {
      const next = parsePartnerResponse(await partnerIntegrationsRequest());
      if (!replaceDraft && busyRef.current) return;
      accept(next, replaceDraft);
      if (mounted.current && replaceDraft) { setMessage('Gespeicherter Stand geladen.'); setError(false); }
    } catch (err) {
      if (!mounted.current) return;
      setLastReadAt(0); setError(true); setMessage(getErrorMessage(err, 'Der Betriebsstatus ist nicht erreichbar.'));
    } finally { if (replaceDraft) { busyRef.current = false; if (mounted.current) setBusy(false); } }
  };
  useEffect(() => {
    mounted.current = true;
    void read(true);
    const parentChanged = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || !event.data || typeof event.data !== 'object' || !('type' in event.data) || event.data.type !== 'nw:partner-integrations-parent-changed' || !('configVersion' in event.data)) return;
      const version = event.data.configVersion;
      if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) return;
      observedVersion.current = Math.max(observedVersion.current, version);
      if (loadedVersion.current !== null && version > loadedVersion.current) setConflict(true);
    };
    window.addEventListener('message', parentChanged);
    const poll = window.setInterval(() => { void read(); }, 5000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { mounted.current = false; window.clearInterval(poll); window.clearInterval(tick); window.removeEventListener('message', parentChanged); };
  }, []);
  const update = (next: PartnerDraft) => { setDraft(next); setDirty(true); setPreview(null); setValidation(null); };

  /** Keine Wiederholung bei 409 oder unklarem Transportergebnis; erfolgreiche Antwort allein bestätigt Speicherung. */
  const perform = async (action: 'save' | 'preview' | 'revoke', enabled?: boolean) => {
    if (busyRef.current || !draft || loadedVersion.current === null || (action !== 'preview' && (conflict || uncertain))) return;
    busyRef.current = true; setBusy(true); setError(false);
    let submitted = false;
    try {
      const body = action === 'revoke' ? { expectedConfigVersion: loadedVersion.current }
        : action === 'preview' ? { config: parsePartnerConfig(draft) }
          : { config: parsePartnerConfig(draft), expectedConfigVersion: loadedVersion.current, ...(enabled === undefined ? {} : { app: { installed: true, enabled } }) };
      submitted = true;
      const raw = await partnerIntegrationsRequest(action === 'save' ? '/config' : `/${action}`, body);
      if (!mounted.current) return;
      if (action === 'preview') { const next = parsePartnerResponse(raw, true); setPreview(next); setValidation(next.validation); setMessage(next.validation.valid ? 'Einrichtung geprüft. Die Vorschau sendet keine Gerätebefehle.' : 'Die Einrichtung enthält Prüfhinweise.'); }
      else {
        const next = parsePartnerResponse(raw);
        accept(next, true);
        setMessage(action === 'revoke' ? 'Partnerverbindung und alle Daten-/Steuerfreigaben wurden widerrufen.' : 'Konfiguration gespeichert. Der aktuelle Betriebsstatus entscheidet über die Verfügbarkeit.');
        if (embedded) window.parent.postMessage({ type: 'nw:partner-integrations-saved', configVersion: next.config.configVersion }, window.location.origin);
      }
    } catch (err) {
      if (!mounted.current) return;
      const status = getErrorStatus(err);
      if (status === 409) setConflict(true);
      // Nicht eindeutig bestätigte Mutationen werden bis zum erneuten Lesen gesperrt.
      if (submitted && action !== 'preview' && status !== 400 && status !== 422 && status !== 409) setUncertain(true);
      if (err instanceof RuntimeRequestError && err.payload.validation) {
        try { setValidation(parsePartnerValidation(err.payload.validation)); } catch { /* Ungeprüfte Fehlerdaten werden nicht gerendert. */ }
      }
      setError(true); setMessage(status === 409 ? staleNotice : getErrorMessage(err, 'Der Auftrag konnte nicht bestätigt werden. Bitte den Serverstand neu laden.'));
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const displayedGrants = draft?.grants.map((grant, index) => ({ grant, index })).filter(row => row.grant.appId === appId) || [];
  const issues = validation || preview?.validation || server?.validation;
  return <PageShell title={names[appId]} embedded={embedded} subtitle="Partnerverbindung, ausdrücklich freigegebene Daten und sicher begrenzte Anforderungen.">
    <section className="nw-card nw-config-card"><div className="nw-nvp-section-heading"><h2 className="nw-config-card__title">{names[appId]}</h2><span className="nw-nvp-tag">{safeStatus && server ? connectionNames[server.status.connection] : 'Betriebsstatus unbestätigt'}</span></div>
      <div className={`nw-status ${error ? 'nw-status--bad' : ''}`} role={error ? 'alert' : 'status'}>{message}</div>
      {appId === 'arbitrage' ? <><p>Eigenständiger Speicherhandel für Haushalte oder Anlagen, in denen EOS ausschließlich Speicher für den Handel regelt. PV, Wallbox, Bilanz und dynamischer Netzanschluss sind dafür keine Voraussetzung.</p><p><strong>{activeControl ? 'Partnerkanal bereit · jede Steueranforderung wird einzeln geprüft' : 'Diagnose / Steuerung gesperrt'}</strong> · {server ? reasonLabel(server.status.reason) : 'Status wird geprüft.'}</p><p>Lokale Netzgrenzen, Speicherreserve und Geräteschutz haben Vorrang vor Händleranforderungen. Eine Verbindung oder Auftragsannahme bestätigt noch keine Wirkung am Speicher.</p></> : <p>{appId === 'energyLedger' ? 'Bilanzdaten dürfen nur für die hier benannten Ressourcen gelesen werden. Diese App erteilt keine Speichersteuerrechte.' : 'Messwerte und Begrenzungsanfragen werden separat freigegeben. Speicherhandel erhält seine Freigaben ausschließlich in der App Arbitrage.'}</p>}
      {stale && <p className="nw-nvp-notice" role="alert">Keine frische Betriebsbestätigung. Aktive Steuerung kann nicht bestätigt werden.</p>}
      {conflict && <p className="nw-nvp-notice" role="alert">{staleNotice}</p>}
      {uncertain && <p className="nw-nvp-notice" role="alert">Das Ergebnis der letzten Änderung ist unklar. Vor weiteren Änderungen den Serverstand neu laden.</p>}
      {dirty && <p className="nw-nvp-notice">Ungespeicherter Entwurf. Die Betriebsanzeige zeigt den gespeicherten Stand.</p>}
      <div className="nw-actions-row"><button type="button" className="nw-button nw-config-btn" disabled={busy} onClick={() => void read(true)}>{dirty ? 'Entwurf verwerfen und neu laden' : 'Neu laden'}</button>{appId === 'arbitrage' && server && <button type="button" className="nw-button nw-config-btn" disabled={locked || dirty} onClick={() => void perform('save', !server.app.enabled)}>{server.app.enabled ? 'Arbitrage-App ausschalten' : 'Arbitrage-App einschalten'}</button>}</div>
      {appId === 'arbitrage' && server && <p>App: {server.app.installed ? server.app.enabled ? 'Installiert · eingeschaltet' : 'Installiert · ausgeschaltet' : 'Nicht installiert'}. Ohne bestätigte Steuerfreigabe bleibt der Betrieb in Diagnose.</p>}
    </section>
    {draft && <form onSubmit={event => { event.preventDefault(); void perform('save'); }} aria-busy={busy}><fieldset className="nw-nvp-fieldset" disabled={busy}>
      <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Gemeinsame Partnerverbindung</h2><p>Ein Partnerprofil wird von den Fach-Apps gemeinsam genutzt. Die folgenden Verbindungsdaten gelten auch für die anderen Partnerfreigaben.</p>
        <label className="nw-dynamic-checkbox"><input type="checkbox" checked={draft.enabled} onChange={event => update({ ...draft, enabled: event.target.checked })} />Partnerverbindung einschalten</label>
        <div className="nw-nvp-grid"><TextField label="Partnerkennung" value={draft.partnerId} onChange={partnerId => update({ ...draft, partnerId })} /><TextField label="Geschützte WebSocket-Adresse (wss://)" maxLength={2048} value={draft.endpoint} onChange={endpoint => update({ ...draft, endpoint })} help="Adresse ohne Zugangsdaten, Token, URL-Parameter oder Fragment." /><TextField label="Referenz auf das geschützte Zugangstoken" value={draft.credentialRef} onChange={credentialRef => update({ ...draft, credentialRef })} help="Name der auf dem EOS-System bereitgestellten Umgebungsvariable mit Präfix NEXOWATT_PARTNER_. Hier keinen Tokenwert eingeben." /></div>
      </section>
      {appId === 'arbitrage' && <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Speicherhandel und Reserve</h2><div className="nw-nvp-grid"><label className="nw-nvp-field nw-config-field"><span className="nw-config-label">Betriebsprofil</span><select className="nw-input nw-config-select" value={draft.arbitrage.profile} onChange={event => update({ ...draft, arbitrage: { ...draft.arbitrage, profile: event.target.value === 'tradingOnly' ? 'tradingOnly' : 'household' } })}><option value="household">Haushalt mit Speicherhandel</option><option value="tradingOnly">Nur Speicherhandel</option></select></label><NumberField label="Maximale Gültigkeit einer Anforderung (s)" value={draft.arbitrage.maxCommandSeconds} min={1} max={60} onChange={maxCommandSeconds => update({ ...draft, arbitrage: { ...draft.arbitrage, maxCommandSeconds } })} /></div><p>Die Speicherkennung verweist auf die lokale Gerätezuordnung. Die Einzelspeicher-Regelung muss lokal eingerichtet und aktiv sein. Alternativ kann eine bestehende dynamische Speichergruppe verwendet werden. Vor einer Steuerfreigabe müssen aktuelle Messwerte, Anschlussgrenzen und der sichere Regelpfad an der Anlage geprüft sein; diese Maske ersetzt keine Inbetriebnahmeprüfung.</p>
        {draft.arbitrage.resources.map((resource, index) => <ResourceEditor key={index} resource={resource} onChange={next => update({ ...draft, arbitrage: { ...draft.arbitrage, resources: draft.arbitrage.resources.map((row, i) => i === index ? next : row) } })} onRemove={() => update({ ...draft, arbitrage: { ...draft.arbitrage, resources: draft.arbitrage.resources.filter((_, i) => i !== index) }, grants: draft.grants.filter(grant => !(grant.appId === 'arbitrage' && grant.resourceId === resource.id)) })} />)}
        <button className="nw-button nw-config-btn" type="button" disabled={draft.arbitrage.resources.length >= 32} onClick={() => update({ ...draft, arbitrage: { ...draft.arbitrage, resources: [...draft.arbitrage.resources, { id: 'single', maxChargeW: '', maxDischargeW: '', minSocPct: 20, maxSocPct: 90, maxImportW: '', maxExportW: '', allowGridCharge: false, allowGridExport: false, commissioned: false }] } })}>Handelsspeicher hinzufügen</button>
      </section>}
      <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Freigaben für {appId === 'arbitrage' ? 'Arbitrage' : appId === 'energyLedger' ? 'Bilanz' : 'Direktvermarktung'}</h2><p>Nur ausdrücklich ausgewählte Daten und Anforderungen dürfen genutzt werden. Neue Freigaben beginnen ohne Rechte.</p>
        {displayedGrants.length === 0 && <p>Noch keine Ressource freigegeben.</p>}{displayedGrants.map(({ grant, index }) => <GrantEditor key={index} grant={grant} resourceIds={appId === 'arbitrage' ? [...new Set(draft.arbitrage.resources.map(resource => resource.id).filter(id => id && id !== 'farm'))] : ['site']} onChange={next => update({ ...draft, grants: draft.grants.map((row, i) => i === index ? next : row) })} onRemove={() => update({ ...draft, grants: draft.grants.filter((_, i) => i !== index) })} />)}
        <button className="nw-button nw-config-btn" type="button" disabled={draft.grants.length >= 64} onClick={() => update({ ...draft, grants: [...draft.grants, { appId, resourceId: '', permissions: [] }] })}>Ressource freigeben</button>
        {draft.grants.length > displayedGrants.length && <p className="nw-text-muted">{draft.grants.length - displayedGrants.length} weitere Ressourcenfreigabe(n) werden in den anderen Fach-Apps verwaltet und beim Speichern erhalten.</p>}
      </section>
      <section className="nw-card nw-config-card"><h2 className="nw-config-card__title">Prüfen und übernehmen</h2><div className="nw-actions-row"><button className="nw-button nw-config-btn" type="button" onClick={() => void perform('preview')}>Freigaben prüfen</button><button className="nw-button nw-config-btn nw-button--primary nw-config-btn--primary" type="submit" disabled={locked}>Konfiguration speichern</button></div>
        {issues && <div className="nw-dynamic-validation"><p>{issues.valid ? 'Einrichtung formal gültig. Die Betriebsfreigabe wird zusätzlich geprüft.' : 'Einrichtung prüfen:'}</p>{issues.errors.length > 0 && <ul>{issues.errors.map((issue, index) => <li key={index}>{issue.message} <small>({issue.path})</small></li>)}</ul>}</div>}
        {preview && <div className="nw-partner-preview"><h3>Vorschau der Daten- und Steuerfreigaben</h3><p>Geprüfter Entwurf; keine Messwertübertragung und keine Gerätebefehle durch diese Vorschau.</p><div className="nw-nvp-table-wrap"><table className="nw-nvp-table"><thead><tr><th>App</th><th>Ressource</th><th>Erlaubte Nutzung</th></tr></thead><tbody>{(preview.config?.grants || []).filter(grant => grant.appId === appId).map((grant, index) => <tr key={index}><td>{names[grant.appId]}</td><td>{grant.resourceId}</td><td>{grant.permissions.map(permission => permissions[permission]).join(', ') || 'Keine Rechte'}</td></tr>)}</tbody></table></div></div>}
      </section>
    </fieldset></form>}
    {server && <section className="nw-card nw-config-card nw-partner-revoke"><h2 className="nw-config-card__title">Partnerzugriff widerrufen</h2><p>Schaltet die gemeinsame Partnerverbindung aus und entfernt sämtliche Daten- und Steuerfreigaben für Arbitrage, Bilanz und Direktvermarktung. Lokale Schutzfunktionen bleiben zuständig.</p><button className="nw-button nw-config-btn" type="button" disabled={locked} onClick={() => void perform('revoke')}>Alle Partnerfreigaben jetzt widerrufen</button><p className="nw-text-muted">Gespeicherte Konfiguration: {server.config.configVersion}. Letzte Statusabfrage: {lastReadAt ? new Date(lastReadAt).toLocaleTimeString('de-DE') : 'Nicht bestätigt'}.</p></section>}
  </PageShell>;
}
