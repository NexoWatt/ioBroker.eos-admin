/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Zeigt die zur angemeldeten Rolle passenden Einstiege in App-Center, Simulation, SmartHome, Devices und EEBus sowie den direkten Rückweg zur EOS-Administration und zum Dashboard.
 * Daten und Wirkung: Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/InstallerPage.md
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
 * Datei: src-admin-tab/src/pages/InstallerPage.tsx
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

import React, { useEffect, useMemo, useState } from 'react';
import PageShell from './PageShell';
import { useRuntimeAccess } from './ProtectedRuntimeRoute';
import { installerModuleLinks, installerReturnLinks } from '../lib/installerNavigation';
import {
  getInstance,
  openExternal,
  resolveRuntimeBaseUrl,
} from '../lib/adminConnection';

export default function InstallerPage() {
  const access = useRuntimeAccess();
  const isAdmin = access?.authed === true && access?.role === 'admin';
  const instance = getInstance();
  const [runtime, setRuntime] = useState<{ instance: string; url: string } | null>(null);
  const [hint, setHint] = useState('Verbindung wird geprüft…');

  useEffect(() => {
    let active = true;
    setRuntime(null);
    setHint('Verbindung wird geprüft…');

    (async () => {
      try {
        const url = await resolveRuntimeBaseUrl(instance);
        if (!active) return;
        setRuntime({ instance, url });
        setHint('Bereit.');
      } catch {
        if (!active) return;
        setRuntime(null);
        setHint('Die Adresse der Oberfläche konnte nicht ermittelt werden. Bitte die Adapterverbindung prüfen.');
      }
    })();

    return () => {
      active = false;
    };
  }, [instance]);
  // Der gemeinsame Resolver erhält Port und TLS zusammen und bevorzugt den
  // bestätigten eigenen Runtime-/Proxy-Origin. Ohne Ziel bleibt die Navigation gesperrt.
  const baseUrl = runtime?.instance === instance ? runtime.url : null;
  /**
   * Code-Teil: adminBackQuery
   * Zweck: Übergibt dem extern geöffneten App-Center den echten Admin-Port und die
   * Adapterinstanz. Das App-Center läuft auf dem Runtime-Port, der Rückweg zum
   * Installer muss aber zum ioBroker-/EOS-Admin-Hash `/#tab-nexowatt-ui-<instanz>`
   * führen. Ohne diese Information fällt das App-Center auf Port 8081 zurück.
   */
  const adminBackQuery = useMemo(() => {
    const adminPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    return `nwAdmin=1&instance=${encodeURIComponent(String(instance))}&adminPort=${encodeURIComponent(adminPort)}`;
  }, [instance]);

  // EMS-Regelungsapps werden ausschließlich über EMS Apps geöffnet; diese
  // Startseite enthält nur die übergeordneten Bereiche und Nicht-EMS-Werkzeuge.
  const actions: { label: string; adminOnly?: boolean; variant?: 'primary'; onClick: () => void }[] = [
    ...installerModuleLinks(access).map(link => ({
      label: link.label,
      adminOnly: true,
      onClick: () => openExternal(`${baseUrl}${link.path}`),
    })),
    { label: 'E-Mail-Versand', adminOnly: true, onClick: () => openExternal(`${baseUrl}/mail-setup/?instance=${instance}#/notification-mail`) },
    {
      label: 'VIS öffnen',
      variant: 'primary',
      onClick: () => openExternal(`${baseUrl}/`),
    },
    {
      label: 'EMS Apps öffnen',
      onClick: () => openExternal(`${baseUrl}/ems-apps.html?${adminBackQuery}`),
    },
    ...(access?.role === 'admin' || access?.role === 'installer' ? [{
      label: 'Historie einrichten',
      onClick: () => openExternal(`${baseUrl}/installer/?instance=${instance}#/history-setup`),
    }] : []),
    {
      label: 'Simulation',
      onClick: () => openExternal(`${baseUrl}/simulation.html?${adminBackQuery}`),
    },
    {
      label: 'Lizenz',
      adminOnly: true,
      onClick: () => openExternal(`${baseUrl}/nexowatt/license`),
    },
    {
      label: 'SmartHome VIS',
      onClick: () => openExternal(`${baseUrl}/smarthome.html`),
    },
    {
      label: 'SmartHome Config',
      onClick: () => openExternal(`${baseUrl}/smarthome-config.html?${adminBackQuery}`),
    },
  ];

  return (
    <PageShell
      title="Installer"
      subtitle="Wähle, was geöffnet werden soll. Die Verbindung wird aus der Adapter-Instanz ermittelt. Die Installer-Seite ist für Konfiguration und Mapping gedacht."
      showBack={false}
      actions={baseUrl ? installerReturnLinks(access).map(link => (
        <a key={link.path} className="nw-link-button" href={`${baseUrl}${link.path}`} target="_top">
          {link.label}
        </a>
      )) : null}
    >
      <section className="nw-card nw-card--centered">
        <div className="nw-button-grid">
          {actions.filter(action => !action.adminOnly || isAdmin).map(action => (
            <button
              key={action.label}
              className={`nw-button ${action.variant === 'primary' ? 'nw-button--primary' : ''}`}
              onClick={() => { if (baseUrl) action.onClick(); }}
              disabled={!baseUrl}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="nw-install-hint" role="status">{hint}</div>
      </section>
    </PageShell>
  );
}
