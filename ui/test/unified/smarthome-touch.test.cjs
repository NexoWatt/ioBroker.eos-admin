/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-touch.ts'), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function harness() {
  class Event {
    constructor(type, options = {}) { Object.assign(this, { type, bubbles: false, cancelable: true, stopped: false, immediate: false, defaultPrevented: false }, options); }
    stopImmediatePropagation() { this.stopped = true; this.immediate = true; }
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  }
  class Target {
    constructor(parent = null) { this.listeners = new Map(); this.parent = parent; }
    addEventListener(type, handler, options = {}) {
      const entries = this.listeners.get(type) || [];
      entries.push({ handler, capture: options === true || !!options.capture });
      this.listeners.set(type, entries);
    }
    dispatchEvent(event) {
      event.target = this;
      const ancestors = []; let p = this.parent;
      while (p) { ancestors.unshift(p); p = p.parent; }
      const invoke = (target, capture) => {
        event.currentTarget = target;
        for (const entry of target.listeners.get(event.type) || []) {
          if (entry.capture === capture) entry.handler(event);
          if (event.immediate) break;
        }
      };
      for (const target of [...ancestors, this]) { invoke(target, true); if (event.stopped) return !event.defaultPrevented; }
      invoke(this, false);
      if (event.bubbles && !event.stopped) for (const target of ancestors.reverse()) { invoke(target, false); if (event.stopped) break; }
      return !event.defaultPrevented;
    }
    fire(type, options = {}) { const event = new Event(type, { bubbles: true, ...options }); this.dispatchEvent(event); return event; }
  }
  const window = new Target();
  const document = new Target(window); document.hidden = false;
  let now = 1000;
  const context = vm.createContext({ window, document, Event, performance: { now: () => now }, WeakMap, Object, Number, Math });
  vm.runInContext(javascript, context);
  const api = window.NW_SH_TOUCH;
  const createRange = () => {
    const input = new Target(document);
    Object.assign(input, { type: 'range', min: '0', max: '100', step: '5', value: '40', disabled: false, isConnected: true, dataset: {}, style: { setProperty(key, value) { this[key] = value; } } });
    const observed = [];
    // Existing handlers are registered before binding, as in the real renderer.
    for (const type of ['input', 'change', 'click']) input.addEventListener(type, () => observed.push([type, input.value, api.isCommitting(input)]));
    api.bindRange(input);
    return { input, observed,
      down: (options = {}) => input.fire('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 20, clientY: 20, ...options }),
      native: (value, type = 'input') => { input.value = value; return input.fire(type); },
      move: (x, y, pointerId = 1) => document.fire('pointermove', { pointerId, pointerType: 'touch', clientX: x, clientY: y }),
      up: (x = 20, y = 20, pointerId = 1) => document.fire('pointerup', { pointerId, pointerType: 'touch', clientX: x, clientY: y }),
    };
  };
  return { api, window, document, context, createRange, advance: delta => { now += delta; } };
}

test('touch tap holds native writes until release and emits exactly one final input/change', () => {
  const h = harness(); const r = h.createRange();
  r.down(); assert.equal(h.api.isInteracting(), true);
  r.native('65'); r.native('65', 'change');
  assert.deepEqual(r.observed, []);
  r.up();
  assert.deepEqual(r.observed, [['input', '65', true], ['change', '65', true]]);
  assert.equal(h.api.isInteracting(), false);
  r.native('70', 'change'); const click = r.input.fire('click');
  assert.equal(r.input.value, '65', 'trailing native events cannot replace the accepted value');
  assert.equal(click.defaultPrevented, true);
  assert.equal(r.observed.length, 2);
});

test('horizontal drag previews the native thumb but writes only the final value', () => {
  const h = harness(); const r = h.createRange();
  r.down(); r.native('50'); r.move(60, 22); r.native('80');
  assert.deepEqual(r.observed, []);
  assert.equal(r.input.dataset.nwTouchPhase, 'horizontal');
  r.up(60, 22);
  assert.deepEqual(r.observed, [['input', '80', true], ['change', '80', true]]);
  assert.equal(r.input.style['--nw-range-fill'], '80.00%');
});

test('vertical/diagonal scroll, recent scrolling and pointer cancellation never dispatch commands', () => {
  for (const action of ['vertical', 'diagonal', 'recent-scroll', 'cancel-pending', 'cancel-drag', 'scroll']) {
    const h = harness(); const r = h.createRange();
    if (action === 'recent-scroll') h.document.fire('scroll');
    r.down(); r.native('70');
    if (action === 'vertical') r.move(21, 50);
    if (action === 'diagonal') r.move(40, 40);
    if (action === 'cancel-drag') r.move(50, 21);
    if (action.startsWith('cancel')) h.document.fire('pointercancel', { pointerId: 1 });
    if (action === 'scroll') h.document.fire('scroll');
    r.up(action === 'vertical' ? 21 : 40, action === 'vertical' ? 50 : action === 'diagonal' ? 40 : 20);
    r.native('90', 'change'); r.input.fire('click');
    assert.equal(r.input.value, '40', action);
    assert.deepEqual(r.observed, [], action);
    assert.equal(h.api.isInteracting(), false, action);
  }
});

test('mouse, pen and keyboard regain their native event contracts after touch cancellation', () => {
  for (const mode of ['mouse', 'pen', 'keyboard']) {
    const h = harness(); const r = h.createRange();
    r.down(); r.native('80'); h.api.cancel();
    if (mode === 'keyboard') r.input.fire('keydown', { key: 'ArrowRight' });
    else r.down({ pointerType: mode });
    r.native('45'); r.native('45', 'change');
    assert.deepEqual(r.observed, [['input', '45', false], ['change', '45', false]], mode);
    assert.equal(r.input.min, '0'); assert.equal(r.input.max, '100'); assert.equal(r.input.step, '5');
  }
});

test('wrong pointer and multi-touch cannot complete or transfer another gesture', () => {
  const h = harness(); const first = h.createRange(); const second = h.createRange();
  first.down(); first.native('60'); first.up(50, 20, 99);
  assert.equal(h.api.isInteracting(), true); assert.equal(first.observed.length, 0);
  second.down({ pointerId: 2, isPrimary: false }); second.native('90');
  first.up(); second.up(20, 20, 2); second.native('90', 'change');
  assert.equal(first.input.value, '40'); assert.equal(second.input.value, '40');
  assert.equal(first.observed.length + second.observed.length, 0);
});

test('removed/disabled controls, blur, page hide, visibility and capture loss cancel the pending value', () => {
  for (const mode of ['removed', 'disabled', 'blur', 'pagehide', 'hidden', 'lostcapture']) {
    const h = harness(); const r = h.createRange(); r.down(); r.native('60');
    if (mode === 'removed') r.input.isConnected = false;
    if (mode === 'disabled') r.input.disabled = true;
    if (mode === 'blur' || mode === 'pagehide') h.window.fire(mode);
    if (mode === 'hidden') { h.document.hidden = true; h.document.fire('visibilitychange'); }
    if (mode === 'lostcapture') h.document.fire('lostpointercapture', { pointerId: 1 });
    r.up(); assert.equal(r.input.value, '40', mode); assert.equal(r.observed.length, 0, mode);
    assert.equal(h.api.isInteracting(), false);
  }
});

test('binding is idempotent, uses one shared lifecycle listener set and has no timers', () => {
  const h = harness(); const r = h.createRange();
  const listenerCount = () => [...h.document.listeners.values()].reduce((sum, entries) => sum + entries.length, 0);
  const count = listenerCount(); const targetCount = r.input.listeners.get('input').length;
  for (let i = 0; i < 100; i++) { h.api.bindRange(r.input); h.createRange(); }
  assert.equal(listenerCount(), count);
  assert.equal(r.input.listeners.get('input').length, targetCount);
  assert.equal(r.input.style.touchAction, 'pan-y');
  r.down(); r.up(); assert.deepEqual(r.observed, [], 'unchanged value does not write');
  h.advance(1000); r.down(); r.native('55'); r.up(); assert.equal(r.observed.length, 2);
});

test('input listener revoking access prevents the final change handler from writing', () => {
  const h = harness(); const r = h.createRange();
  r.input.addEventListener('input', () => { r.input.disabled = true; });
  r.down(); r.native('70'); r.up();
  assert.deepEqual(r.observed, [['input', '70', true]]);
});

test('poll-side interaction check releases a removed control without requiring another pointer event', () => {
  const h = harness(); const r = h.createRange();
  r.down(); r.native('75'); r.input.isConnected = false;
  assert.equal(h.api.isInteracting(), false);
  assert.equal(r.input.value, '40');
  assert.deepEqual(r.observed, []);
});
