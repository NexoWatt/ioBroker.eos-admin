/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Stellt den gemeinsamen Seitenrahmen und die Navigation für die React-Admin-Seiten bereit.
 * Daten und Wirkung: Zeigt Seitentitel, Navigation und das vorhandene NexoWatt-Markenzeichen. Vite bindet das Bild in den jeweiligen Admin-/mail-setup-Buildpfad ein; Rollen werden weiterhin im Backend geprüft.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/PageShell.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Datei: src-admin-tab/src/pages/PageShell.tsx
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

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getInstance } from '../lib/adminConnection';
// Als Build-Asset importieren: ../admin.png zeigt unter /mail-setup/ auf einen
// nicht vorhandenen Root-Endpunkt. Der Import funktioniert auch im Admin-Tab.
import nexowattLogo from '../../../www/assets/icons/nexowatt-192.png';

interface PageShellProps { title?: string; subtitle?: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; compact?: boolean; embedded?: boolean; showBack?: boolean; backLabel?: string }

export default function PageShell({
  title,
  subtitle,
  children,
  actions = null,
  compact = false,
  embedded = false,
  showBack = true,
  backLabel = 'Zurück zum Installer',
}: PageShellProps) {
  useEffect(() => {
    document.title = title ? `NexoWatt EOS – ${title}` : 'NexoWatt EOS Admin';
  }, [title]);

  const instance = getInstance();

  // Der EMS-AppCenter-Host besitzt bereits Titel, Instanz und Navigation.
  if (embedded) return <main className="nw-embedded-ems-page">{children}</main>;

  return (
    <div className="nw-page-shell">
      <div className="nw-page-gradient" />
      <div className={`nw-page-wrap ${compact ? 'nw-page-wrap--compact' : ''}`}>
        <header className="nw-hero">
          <div className="nw-brand">
            <img className="nw-brand__logo" src={nexowattLogo} alt="NexoWatt EOS" width={52} height={52} />
            <div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="nw-instance-badge">Instanz {instance}</div>
        </header>

        {(subtitle || showBack || actions) ? (
          <section className="nw-header-card">
            {subtitle ? <p className="nw-subtitle">{subtitle}</p> : null}
            <div className="nw-header-card__actions">
              {showBack ? (
                <Link className="nw-link-button" to="/installer">
                  {backLabel}
                </Link>
              ) : null}
              {actions}
            </div>
          </section>
        ) : null}

        {children}
      </div>
    </div>
  );
}
