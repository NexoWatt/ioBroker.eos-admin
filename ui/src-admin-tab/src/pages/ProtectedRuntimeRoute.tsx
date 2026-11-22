/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Rendert geschützte React-Inhalte erst nach erfolgreicher EOS-Sitzungs- und Rollenprüfung und sperrt sie bei Sitzungsverlust erneut.
 * Daten und Wirkung: Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/ProtectedRuntimeRoute.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Geschützte Admin-Route für NexoWatt EOS.
 *
 * Die Komponente rendert sensible Inhalte erst, nachdem die Adapter-eigene
 * EOS-Session die geforderte Capability bestätigt hat. Dadurch bleiben Lizenz,
 * EMS und Simulation auch bei direktem Deep-Link oder offenem Admin-Tab gesperrt.
 */
import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from './PageShell';
import EmbeddedEmsFrame from '../components/EmbeddedEmsFrame';
import {
  getInstance,
  getErrorMessage,
  type RuntimeAuthStatus,
  resolveRuntimeLoginUrl,
  logoutRuntimeAuth,
  readRuntimeAuthStatus,
} from '../lib/adminConnection';

/** Nur explizit konfigurierte relative oder HTTPS-Zentralziele; kein Rollen-/Tokenparameter. */
function checkedCentralUrl(value: string): string {
  if (!value || value.length > 4096 || /[\\\u0000-\u0020\u007f]/.test(value) || value.startsWith('//')) return '';
  try {
    const target = new URL(value, window.location.origin);
    if (target.username || target.password || !['http:', 'https:'].includes(target.protocol)
      || (target.origin !== window.location.origin && target.protocol !== 'https:')) return '';
    return target.href;
  } catch { return ''; }
}

const RuntimeAccessContext = createContext<RuntimeAuthStatus | null>(null);
export function useRuntimeAccess() { return useContext(RuntimeAccessContext); }

/**
 * Ablauf und Zusammenhang: Prüft neben der Capability für SMTP und Lizenz ausdrücklich die Admin-Rolle. Alte Installer-Sitzungen mit überbreiten Berechtigungen dürfen diese Bereiche nicht freigeben.
 */
function hasCapability(status: RuntimeAuthStatus | null, capability: string, allowedRoles: readonly string[] | null = null) {
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(status?.role || '')) return false;
  if (['license.manage', 'notifications.manage'].includes(String(capability || '')) && status?.role !== 'admin') return false;
  if (capability === 'mesh.configure' && !['admin', 'installer'].includes(status?.role || '')) return false;
  const capabilities = Array.isArray(status?.capabilities) ? status.capabilities.map(String) : [];
  return capabilities.includes('*') || capabilities.includes(String(capability || ''));
}

/**
 * Ablauf und Zusammenhang: Hält geschützte Inhalte während Anmeldung/Prüfung verborgen und kontrolliert den Sitzungsstatus regelmäßig neu. Die Prüfung ergänzt die Backend-Sperre und ersetzt sie nicht.
 */
type AccessCheckResult = 'authorized' | 'denied' | 'unavailable' | 'stale';

interface ProtectedRuntimeRouteProps { capability: string; title: string; requiredRole?: string; allowedRoles?: readonly string[] | null; embedded?: boolean; children?: React.ReactNode }

export default function ProtectedRuntimeRoute({
  capability,
  title,
  requiredRole = 'Installer oder Admin',
  allowedRoles = null,
  embedded = false,
  children,
}: ProtectedRuntimeRouteProps) {
  const instance = getInstance();
  const embeddedInEms = embedded && window.parent !== window && new URLSearchParams(window.location.search).get('embedded') === '1';
  const surface = (node: React.ReactNode) => embeddedInEms ? <EmbeddedEmsFrame>{node}</EmbeddedEmsFrame> : node;
  const [phase, setPhase] = useState('checking');
  const [status, setStatus] = useState<RuntimeAuthStatus | null>(null);
  const [loginHref, setLoginHref] = useState('');
  const [centralLogoutPending, setCentralLogoutPending] = useState(false);
  const [message, setMessage] = useState('Berechtigung wird geprüft…');
  const [busy, setBusy] = useState(false);

  // Jede Anmeldung, Abmeldung und Statusabfrage erhält eine Generation. Späte
  // Antworten älterer Aufrufe dürfen weder eine neue Sitzung sperren noch nach
  // Abmeldung/Unmount geschützte Inhalte erneut freigeben.
  const mounted = useRef(false);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const refreshTicket = useRef<number | null>(null);
  const pollingPaused = useRef(false);

  const authorized = useMemo(
    () => !!(status?.enabled !== false && status?.authed && hasCapability(status, capability, allowedRoles)),
    [status, capability, allowedRoles]
  );

  /** Nur der aktuelle Aufrufer darf diesen gemeinsamen Statusübergang anwenden. */
  const applyStatus = useCallback((next: RuntimeAuthStatus): AccessCheckResult => {
    setStatus(next);
    if (next.enabled === false || !next.configured) {
      setPhase('locked');
      setMessage('Die Anmeldung ist noch nicht korrekt eingerichtet. Der geschützte Bereich bleibt gesperrt.');
      return 'denied';
    }
    if (next.authed && hasCapability(next, capability, allowedRoles)) {
      setPhase('authorized');
      setMessage('Zugriff freigegeben.');
      return 'authorized';
    }
    setPhase('locked');
    setMessage(next.authed
      ? `Das angemeldete Konto besitzt nicht die erforderliche Rolle (${requiredRole}).`
      : next.mode === 'eos' ? `Bitte zentral im EOS mit der Rolle ${requiredRole} anmelden.` : `Bitte mit einem Benutzerkonto der Rolle ${requiredRole} anmelden.`);
    return 'denied';
  }, [capability, requiredRole, allowedRoles]);

  /** Statusfehler sind keine Aussage über das Passwort oder die Gruppenrolle. */
  const applyStatusError = useCallback((error: unknown): AccessCheckResult => {
    setStatus(null);
    setLoginHref('');
    setPhase('locked');
    setMessage(`Berechtigungsprüfung nicht erreichbar: ${getErrorMessage(error, 'Verbindung nicht verfügbar')}. Der Bereich bleibt gesperrt.`);
    return 'unavailable';
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}): Promise<AccessCheckResult> => {
    if (!mounted.current || busyRef.current || refreshTicket.current !== null || (silent && pollingPaused.current)) return 'stale';
    if (!silent) pollingPaused.current = false;
    const ticket = ++generation.current;
    refreshTicket.current = ticket;
    const current = () => mounted.current && generation.current === ticket;
    if (!silent) {
      setPhase('checking');
      setMessage('Berechtigung wird geprüft…');
    }
    try {
      const next = await readRuntimeAuthStatus(instance, null);
      if (!current()) return 'stale';
      const result = applyStatus(next);
      if (next.configured && (!next.authed || result === 'denied')) {
        const href = !next.authed && next.mode === 'eos' ? checkedCentralUrl(next.loginUrl) : await resolveRuntimeLoginUrl(instance, null);
        if (current()) setLoginHref(href);
      }
      return result;
    } catch (error) {
      return current() ? applyStatusError(error) : 'stale';
    } finally {
      if (refreshTicket.current === ticket) refreshTicket.current = null;
    }
  }, [applyStatus, applyStatusError, instance]);

  useEffect(() => {
    mounted.current = true;
    busyRef.current = false;
    setBusy(false);
    refresh().catch(() => {});
    const focus = () => { refresh({ silent: true }).catch(() => {}); };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(() => {
      refresh({ silent: true }).catch(() => {});
    }, 30000);
    return () => {
      mounted.current = false;
      generation.current += 1;
      refreshTicket.current = null;
      busyRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);

  const logout = async () => {
    if (!mounted.current || busyRef.current) return;
    const previous = status;
    const ticket = ++generation.current;
    const current = () => mounted.current && generation.current === ticket;
    refreshTicket.current = null;
    busyRef.current = true;
    pollingPaused.current = true;
    setBusy(true);
    setStatus(null);
    setPhase('locked');
    setMessage('Abmeldung läuft…');
    try {
      await logoutRuntimeAuth(instance, null);
      if (!current()) return;
      window.navigator.serviceWorker?.controller?.postMessage({ type: 'NW_AUTH_LOGOUT' });
      if (previous?.mode === 'eos') {
        setLoginHref(checkedCentralUrl(previous.logoutUrl));
        setCentralLogoutPending(true);
        setMessage('Die Ansicht ist gesperrt. Bitte die zentrale EOS-Abmeldung im eigenen Fenster abschließen.');
      } else {
        const destination = await resolveRuntimeLoginUrl(instance, null);
        if (!current()) return;
        setLoginHref(destination);
        setCentralLogoutPending(false);
        setMessage(`Abgemeldet. Bitte mit einem Benutzerkonto der Rolle ${requiredRole} anmelden.`);
      }
    } catch (error) {
      // Die lokale Ansicht bleibt gesperrt. Nach nicht bestätigter Abmeldung
      // darf der Hintergrundpoll nicht selbstständig die alte Sitzung öffnen.
      if (current()) setMessage(`Ansicht gesperrt. Die Abmeldung konnte nicht bestätigt werden: ${getErrorMessage(error, 'Verbindung nicht verfügbar')}. Bitte erneut prüfen.`);
    } finally {
      if (current()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  if (authorized && phase === 'authorized') {
    return surface(
      <RuntimeAccessContext.Provider value={status}><div className="nw-protected-route">
        {!embeddedInEms && <div className="nw-protected-route__session">
          <span>{status?.user ? `Angemeldet als ${status.user} (${status.role || 'berechtigt'})` : 'Geschützter Zugriff aktiv'}</span>
          <button className="nw-button" disabled={busy} onClick={logout} type="button">Abmelden</button>
        </div>}
        {children}
      </div></RuntimeAccessContext.Provider>
    );
  }

  return surface(
    <PageShell
      embedded={embeddedInEms}
      title={title}
      subtitle={`Dieser Bereich ist ausschließlich für ${requiredRole} freigegeben. Inhalte und Lizenzdaten werden erst nach erfolgreicher EOS-Anmeldung geladen.`}
      showBack={false}
      compact
    >
      <section className="nw-card nw-access-gate" aria-busy={phase === 'checking' || busy}>
        <h2>Zugriff geschützt</h2>
        <p className="nw-text-muted">Direkte Links, Browser-Lesezeichen und erneutes Laden umgehen diese Sperre nicht.</p>
        <p className="nw-text-muted" id="nwAuthHelp">{status?.mode === 'eos'
          ? 'Die zentrale EOS-Anmeldung bestätigt dein Konto und deine Rolle. Hier wird kein Passwort abgefragt.'
          : 'Die Anmeldung öffnet sich in einem eigenen Fenster. Verwende dort dein eigenes Benutzerkonto und kehre anschließend hierher zurück.'}</p>
        <div className="nw-actions-row">
          {loginHref && <a className="nw-button nw-button--primary" href={loginHref} target="_blank" rel="noopener noreferrer">
            {centralLogoutPending ? 'Zentral abmelden' : status?.authed ? 'Zur Bedienoberfläche' : status?.mode === 'eos' ? 'Zentral anmelden' : 'Anmeldung öffnen'}
          </a>}
          <button className="nw-button" disabled={busy || phase === 'checking'} onClick={() => { setCentralLogoutPending(false); void refresh(); }} type="button">Erneut prüfen</button>
        </div>
        <div className={`nw-status ${authorized ? 'nw-status--ok' : 'nw-status--bad'}`}>{message}</div>
      </section>
    </PageShell>
  );
}
