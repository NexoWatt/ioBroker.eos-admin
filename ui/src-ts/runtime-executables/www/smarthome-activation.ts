/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Zeigt und speichert die SmartHome-Aktivierung direkt im Installer.
 * Daten und Wirkung: Überträgt ausschließlich einen Boolean an die geschützte
 * Aktivierungs-API. Gebäudeentwürfe und gespeicherte Geräte-, Zeitprogramm-
 * und Szenenkonfigurationen bleiben erhalten. auth.ts übernimmt Sitzung und
 * CSRF; der Server prüft Rechte und aktiviert die passende Geräteansicht.
 * Bei Änderungen: Abgelaufene Sitzung, fehlende Lizenz, fehlgeschlagene
 * Speicherung und unveränderte Editorentwürfe mitprüfen. Kein automatisches
 * Wiederholen eines Schreibbefehls nach einem Fehler.
 */
(function () {
  'use strict';

  const endpoint = '/api/smarthome/activation';

  /** Die Serverantwort darf nur einen bestätigten Boolean zur Anzeige liefern. */
  function confirmedEnabled(value: unknown): boolean {
    if (!value || typeof value !== 'object' || !('ok' in value) || value.ok !== true
      || !('enabled' in value) || typeof value.enabled !== 'boolean') {
      throw new Error('Der gespeicherte Status wurde nicht bestätigt. Bitte Status neu laden.');
    }
    return value.enabled;
  }

  /** Verwendet den gemeinsamen Auth-/CSRF-Fetch und eine begrenzte Anfrage. */
  async function request(enabled?: boolean): Promise<boolean> {
    const options: RequestInit = { cache: 'no-store', signal: AbortSignal.timeout(5000) };
    if (enabled !== undefined) {
      options.method = 'POST';
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify({ enabled });
    }
    const response = await fetch(endpoint, options);
    if (response.status === 401) throw new Error('Sitzung abgelaufen. Bitte erneut bei EOS anmelden.');
    if (response.status === 403) throw new Error('Keine Freigabe. Bitte Rolle und EOS-Systemlizenz prüfen.');
    if (response.status === 409) throw new Error('Eine andere Konfiguration wird gerade gespeichert. Bitte anschließend erneut speichern.');
    if (!response.ok) throw new Error('Der gespeicherte Status wurde nicht bestätigt. Bitte Status neu laden.');
    const data: unknown = await response.json();
    return confirmedEnabled(data);
  }

  function initialize(): void {
    const checkbox = document.getElementById('nw-smarthome-enabled');
    const save = document.getElementById('nw-smarthome-activation-save');
    const reload = document.getElementById('nw-smarthome-activation-reload');
    const status = document.getElementById('nw-smarthome-activation-status');
    if (!(checkbox instanceof HTMLInputElement) || !(save instanceof HTMLButtonElement)
      || !(reload instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) return;
    bindControls(checkbox, save, reload, status);
  }

  function bindControls(checkbox: HTMLInputElement, save: HTMLButtonElement,
    reload: HTMLButtonElement, status: HTMLElement): void {
    let persisted: boolean | null = null;
    let busy = false;

    function renderControls(): void {
      checkbox.disabled = busy || persisted === null;
      save.disabled = busy || persisted === null || checkbox.checked === persisted;
      reload.disabled = busy;
    }

    function show(message: string, error = false): void {
      status.textContent = message;
      status.dataset.error = String(error);
    }

    /** Lädt nur den Schalter; ungespeicherte Gebäudedaten werden nicht neu geladen. */
    async function synchronize(saving: boolean): Promise<void> {
      if (busy || (saving && persisted === null)) return;
      busy = true;
      renderControls();
      show(saving ? 'SmartHome-Aktivierung wird gespeichert …' : 'SmartHome-Status wird geladen …');
      try {
        const enabled = await request(saving ? checkbox.checked : undefined);
        persisted = enabled;
        checkbox.checked = enabled;
        show(enabled ? 'SmartHome ist aktiviert und wird im Dashboard angezeigt.' : 'SmartHome ist deaktiviert. Die Konfiguration bleibt erhalten.');
      } catch (error: unknown) {
        show(error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'AbortError'
          ? error.message
          : 'Der gespeicherte Status ist nicht bestätigt. Bitte Verbindung prüfen und Status neu laden.', true);
      } finally {
        busy = false;
        renderControls();
      }
    }

    checkbox.addEventListener('change', () => {
      renderControls();
      show(checkbox.checked === persisted ? 'SmartHome-Aktivierung unverändert.' : 'SmartHome-Aktivierung geändert. Bitte separat speichern.');
    });
    // synchronize behandelt jeden Fehler und verändert ausschließlich diese Karte.
    save.addEventListener('click', () => { void synchronize(true); });
    reload.addEventListener('click', () => { void synchronize(false); });
    void synchronize(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
