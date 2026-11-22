#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * Heizstab-Nachtanzeige: führt den echten Readback-Renderer mit kontrollierten
 * API-Antworten und kleinen DOM-Knoten aus. Keine Browserzeit oder Gerätezugriffe.
 * Prüft den ausgelieferten Renderer sowie kanonische Quelle und TS-Spiegel.
 * --source-only dient der Entwicklung vor dem zentralen Runtime-Build.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sourceOnly = process.argv.includes('--source-only');
const files = [
  'src-ts/runtime-executables/www/app.ts',
  'src-ts/runtime-mirrors/www/app.ts',
  ...(sourceOnly ? [] : ['www/app.js']),
];
let count = 0;

function extractRenderer(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const parsed = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
  let helper;
  let readback;
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'nwHeatingRodNightStatus') helper = node.getText(parsed);
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'readback'
        && node.initializer?.getText(parsed).includes("fetch('/api/flow/qc/read?'")) readback = node.initializer.getText(parsed);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(helper && readback, `${relative}: echter Nacht-Helfer und Readback fehlen`);
  return `${helper}\nthis.runReadback = ${readback};`;
}

async function render(code, patch = {}, thermal = false) {
  const ctl = {
    available: true, cfgEnabled: true, userEnabled: true, cfgMode: 'pvAuto',
    userMode: 'pvAuto', effectiveMode: 'pvAuto', autoMode: 'zeroExportForecast',
    autoModeLabel: '0-W-Einspeisung / Forecast', zeroExportReason: 'pv_or_forecast_signal_too_low',
    wiredStages: 3, stageCount: 3, currentStage: 0, appliedW: 0, measuredW: 0,
    nightPvAutoBlocked: true, nightWindowActive: true, nightStartTime: '20:00', nightEndTime: '06:30',
    status: 'night_pv_auto_blocked_confirmed', modes: [], ...patch,
  };
  const node = () => ({ textContent: '', style: {}, checked: false });
  const context = {
    URLSearchParams, ctx: { kind: 'consumer', idx: 1, qc: {} },
    fetch: async () => ({ json: async () => ({ ok: true, [thermal ? 'thermal' : 'heatingRod']: ctl }) }),
    updatePower() {}, window: {}, pendingMode: null, pendingReg: null,
    regWrap: node(), regEnable: node(), regStatus: node(), regHint: node(), modeWrap: node(), modeHint: node(),
    renderModeButtons(_modes, mode) { context.buttonMode = mode; },
    formatPower: value => `${value} W`, modeLabel: value => String(value),
  };
  vm.runInNewContext(code, context, { timeout: 1000 });
  await context.runReadback();
  return context;
}

async function check(name, fn) {
  await fn();
  count += 1;
  console.log(`  PASS ${name}`);
}

(async () => {
  for (const file of files) {
    const code = extractRenderer(file);
    await check(`${file}: Nachtstatus überlagert den Forecastcode`, async () => {
      const ui = await render(code);
      assert.equal(ui.regStatus.textContent, 'Nachtpause');
      assert.match(ui.modeHint.textContent, /^Nachts gesperrt · Automatik ab 06:30/);
      assert.doesNotMatch(ui.modeHint.textContent, /Forecast|pv_or_forecast_signal_too_low/);
      assert.match(ui.regHint.textContent, /Stufen 1–3 und Boost bleiben manuell verfügbar/);
      assert.equal(ui.buttonMode, 'pvAuto', 'Nachtpause darf gewählten Auto-Modus nicht überschreiben');
    });
    await check(`${file}: Morgen gibt die aktuelle Reglerantwort wieder`, async () => {
      const ui = await render(code, { nightPvAutoBlocked: false, nightWindowActive: false });
      assert.equal(ui.regStatus.textContent, 'Aktiv');
      assert.match(ui.modeHint.textContent, /PV-Leistung\/Prognose noch zu gering/);
      assert.doesNotMatch(ui.modeHint.textContent, /Nachts gesperrt/);
    });
    for (const mode of ['manual1', 'manual2', 'manual3', 'off']) {
      await check(`${file}: expliziter Modus ${mode} überstimmt alten Nacht-State`, async () => {
        const ui = await render(code, { userMode: mode, effectiveMode: mode });
        assert.doesNotMatch(ui.modeHint.textContent, /Nachts gesperrt/);
        assert.equal(ui.buttonMode, mode);
      });
    }
    await check(`${file}: Boost bleibt sichtbar`, async () => {
      const ui = await render(code, { boostActive: true, boostRemainingMin: 10, effectiveMode: 'boost' });
      assert.match(ui.modeHint.textContent, /^Boost aktiv \(10 min\)/);
      assert.doesNotMatch(ui.regHint.textContent, /Nachts gesperrt/);
    });
    await check(`${file}: AUS oder nur Nachtfenster ist kein aktiver Automatikblock`, async () => {
      for (const patch of [{ userEnabled: false }, { cfgEnabled: false }, { nightPvAutoBlocked: false }, { nightPvAutoBlocked: 'true' }]) {
        const ui = await render(code, patch);
        assert.doesNotMatch(ui.modeHint.textContent, /Nachts gesperrt/);
      }
    });
    await check(`${file}: ganztägige Sperre verspricht keinen Morgenstart`, async () => {
      const ui = await render(code, { nightStartTime: '00:00', nightEndTime: '00:00' });
      assert.match(ui.modeHint.textContent, /Ganztägige Automatik-Sperre/);
      assert.doesNotMatch(ui.modeHint.textContent, /Automatik ab/);
    });
    await check(`${file}: ungültige Uhrzeit bleibt neutral`, async () => {
      for (const nightEndTime of ['', '25:99', '<img src=x>']) {
        const ui = await render(code, { nightEndTime });
        assert.match(ui.modeHint.textContent, /Automatik nach dem Nachtfenster/);
        assert.doesNotMatch(ui.modeHint.textContent, /25:99|<img/);
      }
    });
    await check(`${file}: laufende Stufen und Fehlerrückmeldung werden nicht als AUS behauptet`, async () => {
      for (const patch of [{ currentStage: 1 }, { appliedW: 2000 }, { measuredW: 2000 }, { status: 'night_pv_auto_blocked_write_failed' }]) {
        const ui = await render(code, patch);
        assert.match(ui.modeHint.textContent, /Abschaltung noch nicht bestätigt/);
      }
    });
    await check(`${file}: Thermik erhält keinen Heizstab-Nachttext`, async () => {
      const ui = await render(code, {}, true);
      assert.equal(ui.regStatus.textContent, 'Aktiv');
      assert.doesNotMatch(ui.modeHint.textContent, /Nachts gesperrt/);
    });
  }
  for (const file of ['src-ts/runtime-executables/main.ts', 'src-ts/runtime-mirrors/main.ts', ...(sourceOnly ? [] : ['main.js'])]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const begin = source.indexOf('// Read-only diagnosis from the server');
    const end = source.indexOf('const stages = Array.isArray(dev.stages)', begin);
    assert.ok(begin > 0 && end > begin, `${file}: Nacht-API fehlt`);
    const block = source.slice(begin, end);
    const code = `(async function() { let nightPvAutoBlocked = false, nightWindowActive = false, nightStartTime = '', nightEndTime = '', heatingRodStatus = ''; const idx = 1; ${block}\nreturn { nightPvAutoBlocked, nightWindowActive, nightStartTime, nightEndTime, heatingRodStatus }; })`;
    const run = vm.runInNewContext(code);
    const fields = { 'heatingRod.devices.c1.nightPvAutoBlocked': true, 'heatingRod.summary.nightWindowActive': true, 'heatingRod.summary.nightStartTime': '20:00', 'heatingRod.summary.nightEndTime': '06:30', 'heatingRod.devices.c1.status': 'night_pv_auto_blocked_confirmed' };
    await check(`${file}: API liefert typisierte Controller-Nachtwerte`, async () => {
      const value = await run.call({ getStateAsync: async id => ({ val: fields[id] }) });
      assert.equal(value.nightPvAutoBlocked, true);
      assert.equal(value.nightWindowActive, true);
      assert.equal(value.nightEndTime, '06:30');
      assert.equal(value.nightStartTime, '20:00');
      assert.equal(value.heatingRodStatus, 'night_pv_auto_blocked_confirmed');
      for (const field of ['nightPvAutoBlocked', 'nightWindowActive', 'nightEndTime', 'nightStartTime', 'status: heatingRodStatus']) {
        const response = source.slice(source.indexOf('out.heatingRod = {', end), source.indexOf('modes: [', end));
        assert.ok(response.includes(field), `${file}: Antwortfeld ${field} fehlt`);
      }
    });
    await check(`${file}: API verwirft falsche Typen und begrenzt Diagnosen`, async () => {
      const corrupt = Object.fromEntries(Object.keys(fields).map(id => [id, id.endsWith('.status') ? 'x'.repeat(1000) : 'true']));
      const value = await run.call({ getStateAsync: async id => ({ val: corrupt[id] }) });
      assert.equal(value.nightPvAutoBlocked, false);
      assert.equal(value.nightWindowActive, false);
      assert.equal(value.nightStartTime, '');
      assert.equal(value.nightEndTime, '');
      assert.equal(value.heatingRodStatus.length, 160);
    });
  }
  console.log(`[heating-rod-night-ui] PASS: ${count} Prüfgruppen; ${sourceOnly ? 'Quellen/Spiegel' : 'Quellen/Spiegel/ausgelieferte Runtime'}, DOM- und API-Fixtures, keine Hardware.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
