/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Eigenständiger React-Einstieg für Speicherhandel im EMS App-Center.
 * Daten und Wirkung: Verwendet gemeinsame Partnerrechte mit eigenen Speichergrenzen;
 * benötigt keine aktivierte PV-, Bilanz-, Lade- oder Dynamischer-Netzanschluss-App.
 * Bei Änderungen: App-Lifecycle und Backend-Freigaben getrennt von Gerätewirkung halten.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/pages/ArbitragePage.md
 */
import React from 'react';
import PartnerIntegrationsPage from './PartnerIntegrationsPage';
export default function ArbitragePage() { return <PartnerIntegrationsPage appId="arbitrage" />; }
