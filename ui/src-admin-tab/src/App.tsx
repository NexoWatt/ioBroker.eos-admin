/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Ordnet die React-Routen ihren Seiten und der jeweils erforderlichen Rollen-/Sitzungsprüfung zu.
 * Daten und Wirkung: Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.
 * Bei Änderungen: DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/App.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
/**
 * Datei: src-admin-tab/src/App.tsx
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

import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import InstallerPage from './pages/InstallerPage';
import MeshCoordinatorPage from './pages/MeshCoordinatorPage';
import NotificationMailPage from './pages/NotificationMailPage';
import DynamicGridPage from './pages/DynamicGridPage';
import ArbitragePage from './pages/ArbitragePage';
import PartnerIntegrationsPage from './pages/PartnerIntegrationsPage';
import LicensePage from './pages/LicensePage';
import RedirectPage from './pages/RedirectPage';
import ProtectedRuntimeRoute from './pages/ProtectedRuntimeRoute';
import { getRuntimeProxyBase } from './lib/adminConnection';

const DYNAMIC_GRID_ROLES = ['admin', 'installer'];

export default function App() {
  const proxyBase = getRuntimeProxyBase();
  const proxyPath = proxyBase ? new URL(proxyBase).pathname : '';
  const pathname = window.location.pathname;
  // Nur den validierten Instanzpfad entfernen; Admin-Tab-Routen bleiben unverändert.
  const runtimePath = proxyPath && pathname.startsWith(`${proxyPath}/`) ? pathname.slice(proxyPath.length) : pathname;
  return (
    <Routes>
      <Route path="/arbitrage" element={<ProtectedRuntimeRoute embedded capability="appcenter.open" requiredRole="Installer oder Admin" title="Arbitrage" allowedRoles={DYNAMIC_GRID_ROLES}><ArbitragePage /></ProtectedRuntimeRoute>} />
      <Route path="/partner-integrations/energyLedger" element={<ProtectedRuntimeRoute embedded capability="appcenter.open" requiredRole="Installer oder Admin" title="Bilanz · Partnerfreigaben" allowedRoles={DYNAMIC_GRID_ROLES}><PartnerIntegrationsPage appId="energyLedger" /></ProtectedRuntimeRoute>} />
      <Route path="/partner-integrations/directMarketing" element={<ProtectedRuntimeRoute embedded capability="appcenter.open" requiredRole="Installer oder Admin" title="Direktvermarktung · Partnerfreigaben" allowedRoles={DYNAMIC_GRID_ROLES}><PartnerIntegrationsPage appId="directMarketing" /></ProtectedRuntimeRoute>} />
      <Route path="/dynamic-grid" element={<ProtectedRuntimeRoute embedded capability="appcenter.open" requiredRole="Installer oder Admin" title="Dynamischer Netzanschluss" allowedRoles={DYNAMIC_GRID_ROLES}><DynamicGridPage /></ProtectedRuntimeRoute>} />
      <Route path="/nvp-topology" element={<Navigate replace to="/dynamic-grid" />} />
      <Route path="/mesh-coordinator" element={<ProtectedRuntimeRoute capability="mesh.configure" requiredRole="Installer oder Admin" title="Microgrid">{runtimePath.startsWith('/ems/microgrid') ? <MeshCoordinatorPage /> : <RedirectPage targetKey="appcenter" />}</ProtectedRuntimeRoute>} />
      <Route path="/notification-mail" element={<ProtectedRuntimeRoute capability="notifications.manage" requiredRole="Admin" title="E-Mail-Versand"><NotificationMailPage /></ProtectedRuntimeRoute>} />
      <Route
        element={<ProtectedRuntimeRoute capability="appcenter.open" title="Installer"><InstallerPage /></ProtectedRuntimeRoute>}
        path="/"
      />
      <Route
        element={<ProtectedRuntimeRoute capability="appcenter.open" title="Installer"><InstallerPage /></ProtectedRuntimeRoute>}
        path="/installer"
      />
      <Route
        element={<ProtectedRuntimeRoute capability="license.manage" requiredRole="Admin" title="Lizenz"><LicensePage /></ProtectedRuntimeRoute>}
        path="/license"
      />
      <Route
        element={<ProtectedRuntimeRoute capability="appcenter.open" title="EMS App-Center"><RedirectPage targetKey="appcenter" /></ProtectedRuntimeRoute>}
        path="/redirect/appcenter"
      />
      <Route
        element={<ProtectedRuntimeRoute capability="simulation.open" title="Simulation"><RedirectPage targetKey="simulation" /></ProtectedRuntimeRoute>}
        path="/redirect/simulation"
      />
      <Route element={<RedirectPage targetKey="smarthome-config" />} path="/redirect/smarthome-config" />
      <Route element={<RedirectPage targetKey="smarthome-vis" />} path="/redirect/smarthome-vis" />
      <Route element={<Navigate replace to="/installer" />} path="*" />
    </Routes>
  );
}
