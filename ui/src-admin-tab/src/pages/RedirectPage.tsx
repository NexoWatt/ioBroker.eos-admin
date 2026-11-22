/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ermittelt die passende Adapter-URL und leitet in den vorgesehenen Runtime-Bereich weiter.
 * Daten und Wirkung: Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/RedirectPage.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * NexoWatt Detail-Kommentar (DE)
 * Zweck dieser Ergänzung:
 * - Jede relevante Funktion, Methode, Route und UI-Ereignisbindung erhält einen eigenen Erklärungskommentar.
 * - Die Kommentare beschreiben Aufgabe, Daten-/API-Zusammenhang und TypeScript-Migrationshinweise.
 * - Es wurde keine Programmlogik geändert; diese Datei wurde nur für Wartbarkeit und spätere Typisierung dokumentiert.
 */

/**
 * Datei: src-admin-tab/src/pages/RedirectPage.tsx
 * Rolle im Projekt: Admin-React-Quelle.
 * Zweck: React-Quellcode für ioBroker-Admin-Tab und Installer-Einstiegsseiten.
 * Wartung: Die folgenden Abschnitts-Kommentare erklären die einzelnen Code-Teile.
 * TypeScript-Status: Diese Admin-Quelle ist auf .ts/.tsx umgestellt; der Browser erhält weiterhin ein gebautes JS-Bundle.
 */
/**
 * NexoWatt Code-Kommentar (DE)
 * Zweck: Quellcode der React-Admin-Tab-Oberfläche.
 * Zusammenhänge:
 * - Baut nach admin/react/ und öffnet Installer-/Lizenz-/Redirect-Seiten.
 * - Kommuniziert über AdminConnection/ioBroker Admin APIs.
 * Wartungshinweise:
 * - Bei UI-Änderungen anschließend admin:build ausführen.
 */

import React, { useEffect, useState } from 'react';
import PageShell from './PageShell';
import {
  getInstance,
  openExternal,
  resolveRuntimeBaseUrl,
} from '../lib/adminConnection';

const TARGETS = {
  appcenter: {
    title: 'EMS App-Center',
    path: '/ems-apps.html',
    needsAdminBackQuery: true,
  },
  simulation: {
    title: 'Simulation',
    path: '/simulation.html',
    needsAdminBackQuery: true,
  },
  license: {
    title: 'Lizenz',
    path: '/license.html',
    needsAdminBackQuery: true,
  },
  'smarthome-config': {
    title: 'SmartHome Config',
    path: '/smarthome-config.html',
    needsAdminBackQuery: true,
  },
  'smarthome-vis': {
    title: 'SmartHome VIS',
    path: '/smarthome.html',
    needsAdminBackQuery: false,
  },
};

/**
 * Code-Teil: appendAdminBackQuery
 * Zweck: Externe Runtime-Seiten bekommen den Admin-Port und die Adapterinstanz,
 * damit ihr „Zurück zum Installer“-Button nicht auf dem Runtime-Port nach
 * `tab.html` sucht, sondern sicher zu `/#tab-nexowatt-ui-<instanz>` springt.
 */
function appendAdminBackQuery(path: string, instance: string | number) {
  if (!path || !path.includes('.html')) return path;
  const sep = path.includes('?') ? '&' : '?';
  const adminPort = window.location.port || '8081';
  return `${path}${sep}nwAdmin=1&instance=${encodeURIComponent(String(instance))}&adminPort=${encodeURIComponent(adminPort)}`;
}

export default function RedirectPage({ targetKey }: { targetKey: keyof typeof TARGETS }) {
  const target = TARGETS[targetKey];
  const instance = getInstance();
  const [destination, setDestination] = useState<{ instance: string; key: keyof typeof TARGETS; url: string } | null>(null);
  const [status, setStatus] = useState('Weiterleitung wird vorbereitet…');

  useEffect(() => {
    let active = true;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    setDestination(null);
    setStatus('Weiterleitung wird vorbereitet…');

    (async () => {
      try {
        const baseUrl = await resolveRuntimeBaseUrl(instance);
        if (!active) return;
        const url = `${baseUrl}${target.needsAdminBackQuery ? appendAdminBackQuery(target.path, instance) : target.path}`;
        setDestination({ instance, key: targetKey, url });
        setStatus('Öffne Seite…');
        openTimer = setTimeout(() => { if (active) openExternal(url); }, 50);
      } catch {
        if (!active) return;
        setDestination(null);
        setStatus('Die Adresse der Oberfläche konnte nicht ermittelt werden. Bitte die Adapterverbindung prüfen.');
      }
    })();

    return () => {
      active = false;
      if (openTimer !== undefined) clearTimeout(openTimer);
    };
  }, [instance, targetKey, target.path, target.needsAdminBackQuery]);
  const targetUrl = destination?.instance === instance && destination.key === targetKey ? destination.url : null;

  return (
    <PageShell title={target.title} subtitle="Weiterleitung wird vorbereitet…">
      <section className="nw-card nw-card--centered">
        <div className={`nw-status${targetUrl ? ' nw-status--ok' : ''}`} role="status">{status}</div>
        <div className="nw-actions-row nw-actions-row--centered">
          <button className="nw-button nw-button--primary" onClick={() => { if (targetUrl) openExternal(targetUrl); }} disabled={!targetUrl} type="button">
            Jetzt öffnen
          </button>
        </div>
      </section>
    </PageShell>
  );
}
