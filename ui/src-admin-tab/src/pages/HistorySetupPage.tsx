/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bietet die rollenbeschränkte Historie-Einrichtung über vorhandenen ioBroker-Adapter oder direkte InfluxDB-2-Verbindung.
 * Daten und Wirkung: Liest öffentliche Konfiguration, prüft den Entwurf ohne Speicherung und speichert nur nach Benutzeraktion mit Konfigurationsrevision. Token/CA verbleiben ausschließlich im lokalen Entwurf und werden nach erfolgreichem Speichern geleert.
 * Bei Änderungen: Geschützte Route, Backend-Installerrechte und CSRF bleiben maßgeblich. Veraltete Antworten, Fehler, parallele Entwürfe und getrennte Lese-/Schreibdiagnose testen; keine Datenbank erstellen/löschen.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/HistorySetupPage.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
import React, { useEffect, useRef, useState } from 'react';
import PageShell from './PageShell';
import { getRuntimeProxyBase, historySetupRequest } from '../lib/adminConnection';
import { historyDate, historyDraft, historyError, historyPayload, historyState, parseHistoryCheck, parseHistoryResponse,
  type HistoryCheck, type HistoryDraft, type HistoryResponse, type HistoryStatus } from '../lib/historySetup';

const initialDraft: HistoryDraft = { provider: 'adapter', instance: '', url: '', organization: '', bucket: '', token: '', caCertificate: '', clearCaCertificate: false };
export default function HistorySetupPage() {
  const [saved, setSaved] = useState<HistoryResponse | null>(null);
  const [draft, setDraft] = useState<HistoryDraft>(initialDraft);
  const [status, setStatus] = useState<HistoryStatus | null>(null);
  const [checked, setChecked] = useState<HistoryCheck | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Historie-Einstellungen werden geladen…');
  const [error, setError] = useState(false);
  const active = useRef(true);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const adopt = (response: HistoryResponse) => {
    setSaved(response); setDraft(historyDraft(response.config)); setStatus(response.status); setChecked(null);
  };
  useEffect(() => {
    active.current = true; inFlight.current = true;
    const request = ++generation.current;
    void historySetupRequest().then(value => {
      if (!active.current || request !== generation.current) return;
      adopt(parseHistoryResponse(value)); setMessage('Gespeicherter Stand geladen. Änderungen werden erst mit „Speichern“ übernommen.');
    }).catch((failure: unknown) => { if (active.current && request === generation.current) { setError(true); setMessage(historyError(failure)); } })
      .finally(() => { if (active.current && request === generation.current) { setBusy(false); inFlight.current = false; } });
    return () => { active.current = false; generation.current++; };
  }, []);
  const update = <K extends keyof HistoryDraft>(key: K, value: HistoryDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value })); setChecked(null);
  };
  /** Ein Auftrag gleichzeitig. Statuslesen ersetzt keinen Entwurf; Schreibfehler lösen keine Wiederholung aus. */
  const run = async (action: 'save' | 'check' | 'status' | 'reload') => {
    if (inFlight.current || (!saved && action !== 'reload')) return;
    inFlight.current = true; setBusy(true); setError(false);
    if (action === 'check') setChecked(null);
    try {
      if (action === 'save' || action === 'check') {
        if (!saved) return;
        const history = historyPayload(draft, saved.config);
        if (action === 'save') {
          const value = await historySetupRequest('', { history, expectedConfigurationRevision: saved.configurationRevision });
          if (active.current) { adopt(parseHistoryResponse(value)); setMessage('Historie-Einstellungen gespeichert. Der Betriebsstatus zeigt Lese- und Schreibvorgänge getrennt.'); }
        } else {
          const value = await historySetupRequest('/check', { history });
          if (active.current) { setChecked(parseHistoryCheck(value)); setMessage('Verbindungsprüfung abgeschlossen. Der Entwurf wurde nicht gespeichert; Schreibrechte wurden nicht geprüft.'); }
        }
      } else {
        const response = parseHistoryResponse(await historySetupRequest());
        if (active.current) {
          if (action === 'reload') { adopt(response); setMessage('Gespeicherter Stand neu geladen.'); }
          else { setStatus(response.status); setMessage('Betriebsstatus aktualisiert. Der Entwurf bleibt unverändert.'); }
        }
      }
    } catch (failure) { if (active.current) { setError(true); setMessage(historyError(failure)); } }
    finally { if (active.current) { inFlight.current = false; setBusy(false); } }
  };
  const direct = draft.provider === 'influxdb2';
  const base = getRuntimeProxyBase() ?? '';
  return <PageShell title="Historie einrichten" subtitle="Datenhaltung für EOS: vorhandenen ioBroker-Historieadapter weiterverwenden oder direkt mit InfluxDB 2 verbinden. Einrichtung durch Installer oder Admin.">
    <form className="nw-history-setup" onSubmit={event => { event.preventDefault(); void run('save'); }}>
      <section className="nw-card">
        <h2>Datenquelle</h2>
        <fieldset disabled={busy || !saved} className="nw-history-fields">
          <label className="nw-history-field" htmlFor="historyProvider">Historie-Anbindung
            <select id="historyProvider" className="nw-input" value={draft.provider} onChange={event => update('provider', event.target.value === 'influxdb2' ? 'influxdb2' : 'adapter')}>
              <option value="adapter">Vorhandener ioBroker-Historieadapter</option><option value="influxdb2">InfluxDB 2 direkt</option>
            </select>
          </label>
          {direct ? <>
            <p className="nw-history-note">EOS verbindet sich direkt mit einem bestehenden InfluxDB-2-Server. Die Einrichtung verändert keinen ioBroker-InfluxDB-Adapter und erstellt oder löscht keine Datenbank.</p>
            <div className="nw-history-grid">
              <label className="nw-history-field nw-history-wide" htmlFor="historyUrl">Serveradresse mit Port
                <input id="historyUrl" className="nw-input" type="url" required maxLength={2048} value={draft.url} onChange={event => update('url', event.target.value)} placeholder="https://influx.example:8086" autoComplete="off" />
              </label>
              <label className="nw-history-field" htmlFor="historyOrganization">Organisation
                <input id="historyOrganization" className="nw-input" required maxLength={256} value={draft.organization} onChange={event => update('organization', event.target.value)} autoComplete="off" />
              </label>
              <label className="nw-history-field" htmlFor="historyBucket">Bucket
                <input id="historyBucket" className="nw-input" required maxLength={256} value={draft.bucket} onChange={event => update('bucket', event.target.value)} autoComplete="off" />
              </label>
              <label className="nw-history-field nw-history-wide" htmlFor="historyToken">InfluxDB-Token
                <input id="historyToken" className="nw-input" type="password" autoComplete="new-password" maxLength={8192} value={draft.token} onChange={event => update('token', event.target.value)} placeholder={saved?.config.influxdb2.hasToken ? 'Token gespeichert – leer lassen zum Beibehalten' : 'Token mit Zugriff auf diesen Bucket eintragen'} />
                <small>Der gespeicherte Token wird nicht angezeigt. Bei einem anderen Server oder Port muss ein Token neu eingegeben werden.</small>
              </label>
            </div>
            <details className="nw-history-tls"><summary>Zertifikat und Verschlüsselung</summary>
              <p>Bei HTTPS wird das Serverzertifikat immer geprüft. Bei HTTP werden Token und Daten unverschlüsselt übertragen; dafür ein entsprechend geschütztes lokales Netz verwenden.</p>
              <label className="nw-history-field" htmlFor="historyCa">Eigenes CA-Zertifikat (optional, PEM)
                <textarea id="historyCa" className="nw-input" rows={5} maxLength={65536} spellCheck={false} value={draft.caCertificate} onChange={event => update('caCertificate', event.target.value)} placeholder={saved?.config.influxdb2.hasCaCertificate ? 'CA-Zertifikat gespeichert – leer lassen zum Beibehalten' : '-----BEGIN CERTIFICATE-----'} />
                <small>Nur das öffentliche CA-Zertifikat eintragen, keinen privaten Schlüssel. Ohne eigenes CA-Zertifikat gelten die vertrauenswürdigen Zertifikatsstellen des Systems.</small>
              </label>
              <label className="nw-history-checkbox"><input id="historyClearCa" type="checkbox" checked={draft.clearCaCertificate} onChange={event => update('clearCaCertificate', event.target.checked)} />Gespeichertes eigenes CA-Zertifikat entfernen</label>
            </details>
          </> : <label className="nw-history-field" htmlFor="historyInstance">ioBroker-Historieinstanz
            <input id="historyInstance" className="nw-input" value={draft.instance} maxLength={256} onChange={event => update('instance', event.target.value)} placeholder="Zum Beispiel influxdb.0" autoComplete="off" />
            <small>Die bestehende Historie-Anbindung bleibt bis zum ausdrücklichen Speichern erhalten. Die Konfiguration des anderen Adapters wird hier nicht geändert.</small>
          </label>}
        </fieldset>
        <div className="nw-actions-row">
          <button className="nw-button nw-button--primary" type="submit" disabled={busy || !saved}>Speichern</button>
          {direct ? <button className="nw-button" type="button" disabled={busy || !saved} onClick={() => { void run('check'); }}>Verbindung prüfen</button> : null}
          <button className="nw-button" type="button" disabled={busy} onClick={() => { void run('reload'); }}>{saved ? 'Entwurf verwerfen & neu laden' : 'Erneut laden'}</button>
        </div>
        <p role="status" aria-live="polite" className={`nw-status ${error ? 'nw-status--bad' : ''}`}>{busy ? 'Bitte warten…' : message}</p>
        {direct ? <section className="nw-history-check" aria-label="Verbindungsprüfung des Entwurfs">
          <h3>Verbindungsprüfung des Entwurfs</h3>
          <div className="nw-history-check-grid">
            <div><span>Erreichbarkeit</span><strong>{checked ? (checked.reachable ? 'Bestätigt' : 'Nicht bestätigt') : 'Noch nicht geprüft'}</strong></div>
            <div><span>Lesezugriff</span><strong>{checked ? (checked.readable ? 'Bestätigt' : 'Nicht bestätigt') : 'Noch nicht geprüft'}</strong></div>
            <div><span>Schreibzugriff</span><strong>Nicht durch diesen Test geprüft</strong></div>
          </div>
          <p className="nw-history-note">Die Prüfung liest ausschließlich. Ein erfolgreicher Test bestätigt weder Schreibrechte noch die Speicherung von Messwerten.</p>
        </section> : null}
      </section>
      <section className="nw-card" aria-label="Gespeicherte Historie im Betrieb">
        <div className="nw-history-heading"><h2>Gespeicherte Historie im Betrieb</h2><button className="nw-button" type="button" disabled={busy || !saved} onClick={() => { void run('status'); }}>Status aktualisieren</button></div>
        <dl className="nw-history-runtime">
          <div><dt>Aktive Anbindung</dt><dd>{status ? (status.provider === 'influxdb2' ? 'InfluxDB 2 direkt' : 'ioBroker-Historieadapter') : 'Unbekannt'}</dd></div>
          <div><dt>Verbindungszustand</dt><dd>{historyState(status)}</dd></div>
          <div><dt>Letzter bestätigter Lesezugriff</dt><dd>{historyDate(status?.lastReadAt ?? null)}{status?.readError ? <small className="nw-history-failure">{historyError({ code: status.readError })}</small> : null}</dd></div>
          <div><dt>Letzter bestätigter Schreibzugriff</dt><dd>{status?.writeVerified === true ? historyDate(status.lastWriteAt) : 'Noch nicht bestätigt'}{status?.writeError ? <small className="nw-history-failure">{historyError({ code: status.writeError })}</small> : null}</dd></div>
          <div><dt>Messwerte in Warteschlange</dt><dd>{status?.queueDepth ?? 'Unbekannt'}</dd></div>
          <div><dt>Verworfene Messwerte</dt><dd>{status?.droppedPoints ?? 'Unbekannt'}</dd></div>
        </dl>
        {status?.lastError && status.lastError !== status.readError && status.lastError !== status.writeError ? <p className="nw-status nw-status--bad">{historyError({ code: status.lastError })}</p> : null}
        {status?.provider === 'influxdb2' && (status.legacyRecordingCount ?? 0) > 0 ? <p className="nw-history-warning" role="status">Für {status.legacyRecordingCount} EOS-Datenpunkte ist im bisherigen ioBroker-InfluxDB-Adapter noch eine Aufzeichnung eingerichtet. Ziel-Bucket und Betriebsstatus dieses Adapters prüfen. Bei demselben Bucket die bisherige Aufzeichnung dieser Datenpunkte gezielt deaktivieren, damit Messwerte nicht doppelt geschrieben werden. EOS ändert diese Einstellungen nicht automatisch.</p> : null}
        <p className="nw-history-note">Der Status gehört zur gespeicherten Verbindung. „Eingerichtet“ bestätigt keine Schreibrechte. Reguläre EOS-Verlaufswerte werden standardmäßig im 10-Minuten-Raster geschrieben; ohne frische Messwerte entsteht kein bestätigter Schreibzugriff. Ein Wechsel kopiert keine alten Daten in den neuen Bucket und stellt gelöschte Daten nicht wieder her.</p>
        <div className="nw-actions-row"><a className="nw-button" href={`${base}/history.html`}>Historie öffnen</a><a className="nw-button" href={`${base}/ems-apps.html`}>EMS App-Center öffnen</a></div>
      </section>
    </form>
  </PageShell>;
}
