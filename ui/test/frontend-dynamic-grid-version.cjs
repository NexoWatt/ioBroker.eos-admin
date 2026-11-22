'use strict';
/**
 * Prüft den echten AppCenter-CAS-Schutz aus kanonischer Quelle und typisiertem
 * Mirror. TypeScript-AST übernimmt die Helfer, Zustandsinitialisierung sowie
 * die Versionsübernahme am Anfang von applyConfigToUI unverändert. Fremde
 * UI-Module und Transport sind isolierte Fixtures; Save-/Import-Handler bleiben
 * Produktcode. Kein Browser-, Backend-Persistenz- oder Hardware-Nachweis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function extractSubject(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const variables = ['partnerLoadedVersion', 'partnerObservedVersion', 'partnerReloadNotice', 'currentConfig', 'dynamicGridLoadedVersion', 'dynamicGridObservedVersion', 'dynamicGridReloadNotice', 'appCenterMutationBusy',
    'dpTargetInputId', 'treePrefix', 'dpModalGeneration', 'dpModalOpen', 'dpModalCallback', 'dpSelectableIds', 'validDpSelectionId'];
  const functions = ['partnerFrames', 'requirePartnerSaveVersion', 'dynamicGridVersion', 'requireDynamicGridSaveVersion', 'acceptDynamicGridChangeMessage', 'beginAppCenterMutation', 'applyConfigToUI', 'saveConfig', 'backupDoImportFromObj',
    'openDpModal', 'closeDpModal', 'setDpTargetValue'];
  const found = new Map();
  const partnerListeners = [];
  const visit = node => {
    // Auch der neue Partner-Listener bleibt echter Produktcode. Die VM ergänzt
    // nur DOM-Fenster und Registrierung, nicht die Origin-/Versionsentscheidung.
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.expression.getText(ast) === 'window'
      && node.expression.expression.name.text === 'addEventListener'
      && node.expression.arguments[0]?.text === 'message'
      && node.getText(ast).includes('nw:partner-integrations-saved')) partnerListeners.push(node);
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && variables.includes(declaration.name.text)) {
          assert.ok(!found.has(declaration.name.text), `Variable eindeutig: ${declaration.name.text}`);
          found.set(declaration.name.text, node);
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && functions.includes(node.name.text)) {
      assert.ok(!found.has(node.name.text), `Funktion eindeutig: ${node.name.text}`);
      found.set(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const name of [...variables, ...functions]) assert.ok(found.has(name), `${relative}: ${name} fehlt`);

  // Die Produktfunktion übernimmt Versionen vor der unabhängigen Lizenz-/DOM-
  // Befüllung. Nur dieser Originalpräfix wird ausgeführt; keine nachgebaute Logik.
  const apply = found.get('applyConfigToUI');
  const boundary = apply.body.statements.findIndex(statement => ts.isExpressionStatement(statement)
    && ts.isBinaryExpression(statement.expression)
    && ts.isIdentifier(statement.expression.left)
    && statement.expression.left.text === 'currentLicenseInfo');
  assert.ok(boundary > 0, 'Versionsübernahme muss vor der übrigen UI-Befüllung liegen');
  const applyPrefix = ts.factory.updateFunctionDeclaration(apply, apply.modifiers, apply.asteriskToken,
    apply.name, apply.typeParameters, apply.parameters, apply.type,
    ts.factory.createBlock(apply.body.statements.slice(0, boundary), true));
  const printer = ts.createPrinter();
  assert.equal(partnerListeners.length, 1, 'Partner-Versionslistener eindeutig');
  const nodes = [...variables.map(name => found.get(name)), ...functions.map(name => name === 'applyConfigToUI' ? applyPrefix : found.get(name)), ...partnerListeners];
  const isolated = nodes.map(node => printer.printNode(ts.EmitHint.Unspecified, node, ast)).join('\n')
    + '\nglobalThis.subject = { requirePartnerSaveVersion, partnerSnapshot: () => ({ loaded: partnerLoadedVersion, observed: partnerObservedVersion }), dynamicGridVersion, requireDynamicGridSaveVersion, acceptDynamicGridChangeMessage, beginAppCenterMutation, applyConfigToUI, saveConfig, backupDoImportFromObj, openDpModal, closeDpModal, setDpTargetValue, stageSelectableId: id => dpSelectableIds.add(id), dpSnapshot: () => ({ open: dpModalOpen, generation: dpModalGeneration, target: dpTargetInputId, callback: dpModalCallback !== null, selectableCount: dpSelectableIds.size }), snapshot: () => ({ loaded: dynamicGridLoadedVersion, observed: dynamicGridObservedVersion, config: currentConfig, busy: appCenterMutationBusy }) };';
  const result = ts.transpileModule(isolated, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
  assert.deepEqual((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
  return result.outputText;
}

function fixture(code) {
  const origin = 'http://eos.test:8188';
  const notices = []; const posts = []; const partnerPosts = []; const listeners = []; const requests = []; const sideEffects = [];
  const attributes = new Map();
  const main = { inert: false, setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
  const modalAttributes = new Map(); const modalClasses = new Set(['hidden']);
  const modalTitle = { textContent: '' };
  const dpModal = {
    setAttribute: (key, value) => modalAttributes.set(key, value),
    classList: { add: value => modalClasses.add(value), remove: value => modalClasses.delete(value) },
    querySelector: selector => { assert.equal(selector, '.nw-dp-dialog__title'); return modalTitle; },
  };
  const child = { postMessage: (message, targetOrigin) => posts.push({ message: plain(message), targetOrigin }) };
  let frame = { contentWindow: child };
  const partnerChild = { postMessage: (message, targetOrigin) => partnerPosts.push({ message: plain(message), targetOrigin }) };
  let partnerFrame = null;
  let transport = async payload => ({ ok: true, config: { dynamicGridConnection: { configVersion: payload.expectedDynamicGridConfigVersion + 1 } } });
  const context = vm.createContext({
    window: { location: { origin }, addEventListener: (type, callback) => { assert.equal(type, 'message'); listeners.push(callback); }, NexoWattEvcsElectricalLimits: { validateEvcsElectricalConfig: () => ({ valid: true }) } },
    document: {
      querySelector: selector => { assert.equal(selector, 'main'); return main; },
      getElementById: id => { assert.equal(id, 'fixture-target'); return { value: 'meter.previous' }; },
    },
    els: { arbitrageMount: { querySelector: selector => { assert.equal(selector, 'iframe'); return partnerFrame; } }, dynamicGridMount: { querySelector: selector => { assert.equal(selector, 'iframe'); return frame; } }, dpModal },
    setStatus: (message, kind) => notices.push({ message, kind }),
    setBackupStatus: (message, kind) => notices.push({ message, kind }),
    // Die Objektsuche ist hier keine Netzwerkabhängigkeit; die Dialogverwaltung
    // einschließlich Auswahlprüfung, Callback und Abbruch bleibt Originalcode.
    refreshTree: async () => {},
    flushDpInputsToConfig: () => sideEffects.push('flush'),
    collectPatchFromUI: () => ({ emsApps: { apps: { dynamicGrid: { installed: true, enabled: false } } } }),
    applyAppCenterRegressionSafetyGate: patch => patch,
    validateFeneconStorageConfiguration() {},
    applyReleaseRegressionSafetyGate: () => ({ changed: false }),
    _storageFarmStorageCount: () => 0,
    _maxStorageCount: () => 2,
    clearDirty: () => sideEffects.push('clearDirty'),
    loadConfig: async () => sideEffects.push('reload'),
    backupRefreshInfo: async () => sideEffects.push('backupInfo'),
    fetchJson: async (url, options) => {
      const payload = JSON.parse(options.body);
      requests.push({ url, payload });
      return transport(payload);
    },
  });
  vm.runInContext(code, context);
  return {
    ...context.subject,
    origin, child, notices, posts, partnerPosts, requests, sideEffects, main, attributes, modalAttributes, modalClasses,
    setTransport(next) { transport = next; },
    removeFrame() { frame = null; },
    attachPartnerFrame() { partnerFrame = { contentWindow: partnerChild }; },
    partnerEvent(version, overrides = {}) { for (const listener of listeners) listener({ origin, source: partnerChild, data: { type: 'nw:partner-integrations-saved', configVersion: version }, ...overrides }); },
    event(version, overrides = {}) { return { origin, source: child, data: { type: 'nw:dynamic-grid-saved', configVersion: version }, ...overrides }; },
  };
}

function pendingSelection(f) {
  const results = [];
  f.openDpModal('fixture-target', { currentId: 'meter.previous', mode: 'read', onSelect: id => results.push(id) });
  f.stageSelectableId('meter.next');
  const generation = f.dpSnapshot().generation;
  assert.equal(f.dpSnapshot().open, true); assert.equal(f.dpSnapshot().callback, true);
  assert.equal(f.modalAttributes.get('aria-hidden'), 'false');
  return { results, generation };
}

function assertSelectionCancelled(f, pending) {
  assert.deepEqual(pending.results, [null], 'Offene Auswahl endet genau einmal mit Abbruch');
  const state = f.dpSnapshot();
  assert.equal(state.open, false); assert.equal(state.callback, false); assert.equal(state.target, null);
  assert.equal(state.selectableCount, 0); assert.ok(state.generation > pending.generation);
  assert.equal(f.modalAttributes.get('aria-hidden'), 'true'); assert.equal(f.modalClasses.has('hidden'), true);
  f.setDpTargetValue('meter.next');
  f.closeDpModal('meter.next');
  assert.deepEqual(pending.results, [null], 'Verspäteter Treffer darf den abgebrochenen Auftrag nicht erfüllen');
}

function reactFixture() {
  const relative = 'src-admin-tab/src/pages/DynamicGridPage.tsx';
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['emptyMeasurement', 'emptyPoint', 'emptyTopology', 'observeVersion', 'acceptServer'];
  const nodes = new Map();
  const visit = node => {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)) nodes.set(declaration.name.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const name of names) assert.ok(nodes.has(name), `${relative}: ${name} fehlt`);
  const changes = [];
  const state = { config: null, savedConfig: null, storedVersion: 1, stale: false, app: null, status: null, rootSource: null, locked: false, dirty: false, preview: null, validation: null, draftRevision: 0 };
  const refs = { storedVersionRef: { current: null }, observedVersionRef: { current: 0 } };
  const context = { ...refs };
  for (const [setter, key] of Object.entries({ setConfig: 'config', setSavedConfig: 'savedConfig', setStoredVersion: 'storedVersion', setStaleConfig: 'stale', setApp: 'app', setStatus: 'status', setRootSource: 'rootSource', setLocked: 'locked', setDirty: 'dirty', setPreview: 'preview', setValidation: 'validation', setDraftRevision: 'draftRevision' })) {
    context[setter] = value => { state[key] = typeof value === 'function' ? value(state[key]) : value; changes.push(key); };
  }
  vm.createContext(context);
  const code = names.map(name => nodes.get(name).getText(ast)).join('\n') + '\nglobalThis.subject = { acceptServer, observeVersion };';
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return { ...context.subject, state, changes, ...refs };
}

function serverSnapshot(version, enabled) {
  return { config: { schemaVersion: 1, configVersion: version, maxSkewMs: 1000, points: [{ id: 'M0' }, { id: 'M1' }], storages: [], pvAssignments: [] }, app: { installed: true, enabled }, status: { configVersion: version }, rootSource: { reason: `measurement-${version}` }, validation: { valid: true } };
}

let checks = 0;
async function check(name, run) {
  await run(); checks++; console.log('PASS', name);
}

(async () => {
  for (const relative of ['src-ts/runtime-executables/www/ems-apps.ts', 'src-ts/runtime-mirrors/www/ems-apps.ts']) {
    const code = extractSubject(relative);
    const label = relative.includes('runtime-mirrors') ? 'Mirror' : 'Canonical';
    await check(`${label}: Version akzeptiert ausschließlich positive sichere Ganzzahlen`, () => {
      const f = fixture(code);
      for (const invalid of [undefined, null, false, true, '', '2', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, {}, []]) assert.equal(f.dynamicGridVersion(invalid), null);
      for (const valid of [1, 2, Number.MAX_SAFE_INTEGER]) assert.equal(f.dynamicGridVersion(valid), valid);
      assert.throws(() => f.requireDynamicGridSaveVersion(), /Version|version/);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: '2' } });
      assert.throws(() => f.requireDynamicGridSaveVersion(), /Version|version/);
    });
    await check(`${label}: Gesamtstand 2 liefert Save-Token 2 und informiert das bestehende iframe`, () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
      assert.equal(f.requireDynamicGridSaveVersion(), 2);
      assert.equal(f.snapshot().observed, 2);
      assert.deepEqual(f.posts, [{ message: { type: 'nw:dynamic-grid-parent-changed', configVersion: 2 }, targetOrigin: f.origin }]);
    });
    await check(`${label}: fremder Ursprung, anderes Fenster und unzulässige Nachricht werden ignoriert`, () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
      const rejected = [
        f.event(3, { origin: 'http://other.test:8188' }),
        f.event(3, { source: {} }),
        f.event(3, { data: { type: 'other', configVersion: 3 } }),
        f.event(3, { data: null }),
        ...['3', 0, -1, 2.5, Number.MAX_SAFE_INTEGER + 1].map(version => f.event(version)),
      ];
      for (const event of rejected) {
        f.acceptDynamicGridChangeMessage(event);
        assert.equal(f.requireDynamicGridSaveVersion(), 2);
        assert.equal(f.snapshot().observed, 2);
      }
      f.removeFrame(); f.acceptDynamicGridChangeMessage(f.event(3));
      assert.equal(f.requireDynamicGridSaveVersion(), 2);
      assert.deepEqual(f.notices, []);
    });
    await check(`${label}: Child 3 sperrt Token 2 bis zum vollständigen Laden von Stand 3`, () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
      f.acceptDynamicGridChangeMessage(f.event(3));
      assert.equal(f.snapshot().loaded, 2, 'Nachricht darf den Save-Token nicht erhöhen');
      assert.equal(f.snapshot().config.dynamicGridConnection.configVersion, 2, 'Nachricht darf den Vertragsstand nicht ersetzen');
      assert.equal(f.snapshot().observed, 3);
      assert.throws(() => f.requireDynamicGridSaveVersion(), /aktuellen Gesamtstand/);
      assert.equal(f.notices.at(-1).kind, 'warn');
      const beforeLate = plain(f.snapshot());
      assert.throws(() => f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } }), /aktuellen Gesamtstand/);
      assert.deepEqual(plain(f.snapshot()), beforeLate, 'Verspätete Antwort darf auch den Gesamtvertrag nicht ersetzen');
      assert.throws(() => f.requireDynamicGridSaveVersion(), /aktuellen Gesamtstand/, 'Späte Antwort 2 darf Sperre nicht löschen');
      assert.equal(f.snapshot().observed, 3);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 3 } });
      assert.equal(f.requireDynamicGridSaveVersion(), 3);
      f.acceptDynamicGridChangeMessage(f.event(2));
      assert.equal(f.snapshot().observed, 3, 'Verzögerte Meldungen senken das Maximum nicht');
      assert.equal(f.requireDynamicGridSaveVersion(), 3);
    });
    await check(`${label}: Child-Meldung vor dem ersten geladenen Gesamtstand bleibt wirksam`, () => {
      const f = fixture(code);
      f.acceptDynamicGridChangeMessage(f.event(3));
      assert.throws(() => f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } }), /aktuellen Gesamtstand/);
      assert.throws(() => f.requireDynamicGridSaveVersion(), /Version|version/);
      assert.equal(f.snapshot().observed, 3);
    });
    await check(`${label}: Partnerrevision benachrichtigt das konkrete iframe und bleibt vom Dynamic-Token getrennt`, () => {
      const f = fixture(code); f.attachPartnerFrame();
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 }, partnerIntegrations: { configVersion: 4 } });
      assert.deepEqual(plain(f.partnerSnapshot()), { loaded: 4, observed: 4 });
      assert.equal(f.requireDynamicGridSaveVersion(), 2);
      assert.deepEqual(f.partnerPosts, [{ message: { type: 'nw:partner-integrations-parent-changed', configVersion: 4 }, targetOrigin: f.origin }]);
      for (const overrides of [{ origin: 'http://other.test:8188' }, { source: {} }, { data: { type: 'other', configVersion: 5 } }]) f.partnerEvent(5, overrides);
      assert.deepEqual(plain(f.partnerSnapshot()), { loaded: 4, observed: 4 });
      assert.doesNotThrow(() => f.requirePartnerSaveVersion());
    });
    await check(`${label}: neue Partnerrevision sperrt echte Gesamt-Save-/Importwege und alte Antworten`, async () => {
      const f = fixture(code); f.attachPartnerFrame();
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 }, partnerIntegrations: { configVersion: 4 } });
      f.partnerEvent(5);
      assert.deepEqual(plain(f.partnerSnapshot()), { loaded: 4, observed: 5 });
      assert.equal(f.snapshot().config.partnerIntegrations.configVersion, 4, 'Partnernachricht darf Gesamtentwurf nicht verändern');
      assert.throws(() => f.requirePartnerSaveVersion(), /Partnerfreigaben/);
      await assert.rejects(() => f.saveConfig(), /Partnerfreigaben/);
      await assert.rejects(() => f.backupDoImportFromObj({}), /Partnerfreigaben/);
      assert.deepEqual(f.requests, []); assert.deepEqual(f.sideEffects, []);
      assert.throws(() => f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 }, partnerIntegrations: { configVersion: 4 } }), /Partnerfreigaben/);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 }, partnerIntegrations: { configVersion: 5 } });
      assert.doesNotThrow(() => f.requirePartnerSaveVersion());
      assert.deepEqual(plain(f.partnerSnapshot()), { loaded: 5, observed: 5 });
    });
    await check(`${label}: Gesamtstandübernahme bricht den echten offenen DP-Dialog ab`, () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
      const pending = pendingSelection(f);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 3 } });
      assertSelectionCancelled(f, pending);
      assert.equal(f.requireDynamicGridSaveVersion(), 3);
    });
    await check(`${label}: echter globaler Save sendet den geladenen CAS-Token`, async () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 7 } });
      await f.saveConfig();
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].url, '/api/installer/config');
      assert.equal(f.requests[0].payload.expectedDynamicGridConfigVersion, 7);
      assert.equal(f.requests[0].payload.restartEms, true);
      assert.equal(f.requireDynamicGridSaveVersion(), 8, 'Bestätigte vollständige Save-Antwort wird neuer Basisstand');
      assert.equal(f.main.inert, false); assert.equal(f.snapshot().busy, false);
    });
    await check(`${label}: veralteter globaler Save scheitert vor Formularübernahme und Netzwerk`, async () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
      f.acceptDynamicGridChangeMessage(f.event(3));
      await assert.rejects(() => f.saveConfig(), /aktuellen Gesamtstand/);
      assert.deepEqual(f.requests, []); assert.deepEqual(f.sideEffects, []);
    });
    await check(`${label}: Backupimport nutzt aktuellen Basis-Token statt historischer Backupversion`, async () => {
      const f = fixture(code);
      f.applyConfigToUI({ dynamicGridConnection: { configVersion: 7 } });
      const backup = { dynamicGridConnection: { configVersion: 1 } };
      await f.backupDoImportFromObj(backup);
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].url, '/api/installer/backup/import');
      assert.equal(f.requests[0].payload.expectedDynamicGridConfigVersion, 7);
      assert.deepEqual(f.requests[0].payload.backup, backup);
      const stale = fixture(code);
      stale.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
      stale.acceptDynamicGridChangeMessage(stale.event(3));
      await assert.rejects(() => stale.backupDoImportFromObj(backup), /aktuellen Gesamtstand/);
      assert.deepEqual(stale.requests, []);
    });
    for (const action of ['saveConfig', 'backupDoImportFromObj']) {
      await check(`${label}: ${action} bricht offene DP-Auswahl ab, sperrt parallele Mutationen und gibt nach Fehler wieder frei`, async () => {
        const f = fixture(code);
        f.applyConfigToUI({ dynamicGridConnection: { configVersion: 2 } });
        const selection = pendingSelection(f);
        let rejectRequest;
        f.setTransport(() => new Promise((_resolve, reject) => { rejectRequest = reject; }));
        const pending = f[action]({ dynamicGridConnection: { configVersion: 1 } });
        assertSelectionCancelled(f, selection);
        assert.equal(f.main.inert, true);
        assert.equal(f.attributes.get('aria-busy'), 'true');
        assert.equal(f.snapshot().busy, true);
        await assert.rejects(() => f.saveConfig(), /läuft bereits/);
        await assert.rejects(() => f.backupDoImportFromObj({}), /läuft bereits/);
        assert.equal(f.requests.length, 1, 'Doppelklick und paralleler Import senden nichts zusätzlich');
        rejectRequest(new Error('TEST_TRANSPORT_FAILURE'));
        await assert.rejects(() => pending, /TEST_TRANSPORT_FAILURE/);
        assert.equal(f.main.inert, false);
        assert.equal(f.attributes.has('aria-busy'), false);
        assert.equal(f.snapshot().busy, false);
        f.main.inert = true;
        const finish = f.beginAppCenterMutation(); finish();
        assert.equal(f.main.inert, true, 'Bereits bestehende inert-Sperre bleibt erhalten');
      });
    }
  }
  for (const replaceDraft of [false, true]) {
    await check(`React: verspäteter ${replaceDraft ? 'Reload' : 'Poll'} 2 verändert erfolgreichen aktiven Save 3 nicht`, () => {
      const f = reactFixture();
      assert.equal(f.acceptServer(serverSnapshot(3, true), true), true);
      const before = plain(f.state); const changeCount = f.changes.length;
      assert.equal(f.acceptServer(serverSnapshot(2, false), replaceDraft), false);
      assert.deepEqual(plain(f.state), before);
      assert.equal(f.changes.length, changeCount, 'Kein React-Setter darf den veralteten Snapshot übernehmen');
      assert.equal(f.state.app.enabled, true); assert.equal(f.state.storedVersion, 3); assert.equal(f.state.stale, false);
    });
  }
  await check('React: beobachtete Fremdversion sperrt den alten Entwurf ohne automatische Tokenübernahme', () => {
    const f = reactFixture();
    f.acceptServer(serverSnapshot(2, false), true);
    f.state.config.maxSkewMs = 777; f.state.dirty = true;
    f.observeVersion(4);
    assert.equal(f.state.stale, true);
    const before = plain(f.state); const count = f.changes.length;
    assert.equal(f.acceptServer(serverSnapshot(3, true), true), false);
    assert.deepEqual(plain(f.state), before); assert.equal(f.changes.length, count);
    assert.equal(f.acceptServer(serverSnapshot(4, true), false), true);
    assert.equal(f.state.config.maxSkewMs, 777); assert.equal(f.state.dirty, true);
    assert.equal(f.state.storedVersion, 2); assert.equal(f.storedVersionRef.current, 2); assert.equal(f.state.stale, true);
    assert.equal(f.acceptServer(serverSnapshot(4, true), true), true);
    assert.equal(f.state.storedVersion, 4); assert.equal(f.state.stale, false);
    assert.equal(f.state.dirty, false); assert.equal(f.state.config.maxSkewMs, 1000);
  });
  console.log(JSON.stringify({ result: 'PASS', checks, limitation: 'Originale AST-extrahierte Frontend-Helfer und Save-Handler; Backend-CAS und Browserinteraktion separat prüfen.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
