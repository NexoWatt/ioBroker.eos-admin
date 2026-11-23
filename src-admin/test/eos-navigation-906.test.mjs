import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installerModuleLinks, installerReturnLinks } from '../../ui/src-admin-tab/src/lib/installerNavigation.ts';

const shellSource = readFileSync(new URL('../public/js/nexowatt-native-shell.js', import.meta.url), 'utf8');

// Exercise the shipped shell and observer lifecycle, without replacing its functions.
function shellHarness() {
    const values = new Map();
    let writes = 0;
    const style = {
        getPropertyValue: key => values.get(key) || '',
        setProperty: (key, value) => { writes++; values.set(key, value); },
        removeProperty: key => values.delete(key),
    };
    const classList = () => ({ add() {}, remove() {}, toggle() {} });
    const observers = [];
    const raf = [];
    let login = false;
    const makeDrawer = (height = 140) => ({
        height, isConnected: true, classList: classList(),
        getBoundingClientRect() { return { height: this.height }; },
        querySelector(selector) {
            if (selector === '.MuiList-root') return { classList: classList() };
            if (selector === ':scope > .eos-standalone-nav-toggle') return { setAttribute() {} };
            return null;
        },
    });
    let drawer = makeDrawer();
    const document = {
        readyState: 'complete',
        currentScript: { src: 'https://nexowatt/system/js/nexowatt-native-shell.js' },
        documentElement: { style, classList: classList() },
        querySelector(selector) {
            if (selector === '.MuiDrawer-paper') return drawer;
            if (selector.includes('input#username')) return login ? {} : null;
            return null;
        },
        getElementById(id) { return id === 'app-paper' ? { removeAttribute() {} } : null; },
    };
    const window = {
        location: { href: 'https://nexowatt/system/', hash: '#tab-adapters', search: '' },
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe(element) { this.element = element; }
            disconnect() { this.disconnected = true; }
        },
        NEXOWATT_EOS_DOM_COORDINATOR: { subscribe() { return () => {}; } },
        addEventListener() {},
        requestAnimationFrame(callback) { raf.push(callback); },
        setTimeout() { return 1; },
    };
    const context = vm.createContext({
        window, document, URL, AbortController, localStorage: { getItem: () => null },
        requestAnimationFrame: window.requestAnimationFrame,
        clearTimeout() {}, setTimeout: window.setTimeout,
    });
    const flush = () => { while (raf.length) raf.shift()(); };
    vm.runInContext(shellSource, context);
    flush();
    return {
        values, observers, window, flush, makeDrawer,
        get writes() { return writes; },
        set drawer(value) { drawer = value; },
        set login(value) { login = value; },
    };
}

test('installer return links retain current hostname, TLS and port for IP and short-host entry', () => {
    const links = installerReturnLinks({ authed: true, role: 'admin' });
    assert.deepEqual(links.map(link => link.path), ['/system/', '/']);
    for (const origin of ['https://192.168.10.153:8188', 'https://nexowatt']) {
        for (const link of links) {
            const target = new URL(origin + link.path);
            assert.equal(target.origin, origin);
            assert.ok(!target.search && !target.hash);
        }
    }
});

test('unconfirmed and non-admin sessions do not receive module/admin links', () => {
    for (const access of [null, { authed: false, role: 'admin' }, { authed: true, role: 'unknown' }]) {
        assert.deepEqual(installerReturnLinks(access), []);
        assert.deepEqual(installerModuleLinks(access), []);
    }
    for (const role of ['installer', 'customer']) {
        assert.deepEqual(installerReturnLinks({ authed: true, role }).map(link => link.path), ['/']);
        assert.deepEqual(installerModuleLinks({ authed: true, role }), []);
    }
    assert.deepEqual(installerModuleLinks({ authed: true, role: 'admin' }).map(link => link.path),
        ['/modules/devices/', '/modules/eebus/']);
});

test('wrapped navigation updates content offset only when its measured height changes', () => {
    const harness = shellHarness();
    assert.equal(harness.values.get('--nx-nav-h'), '140px');
    assert.equal(harness.observers.length, 1);
    const observer = harness.observers[0];
    const initialWrites = harness.writes;
    observer.callback();
    assert.equal(harness.writes, initialWrites, 'unchanged size must not cause DOM mutation feedback');
    observer.element.height = 233.2;
    observer.callback();
    assert.equal(harness.values.get('--nx-nav-h'), '234px');
    observer.element.height = 0;
    observer.callback();
    assert.equal(harness.values.get('--nx-nav-h'), '234px', 'hidden/transient zero must not collapse the content offset');
});

test('drawer replacement, logout and shell destroy release observer and stale offset', () => {
    const harness = shellHarness();
    const first = harness.observers[0];
    const nextDrawer = harness.makeDrawer(198);
    harness.drawer = nextDrawer;
    harness.window.NEXOWATT_NATIVE_SHELL.refresh();
    harness.flush();
    assert.equal(first.disconnected, true);
    assert.equal(harness.observers.length, 2);
    assert.equal(harness.values.get('--nx-nav-h'), '198px');
    harness.login = true;
    harness.window.NEXOWATT_NATIVE_SHELL.refresh();
    harness.flush();
    assert.equal(harness.observers[1].disconnected, true);
    assert.equal(harness.values.has('--nx-nav-h'), false);
    harness.login = false;
    harness.window.NEXOWATT_NATIVE_SHELL.refresh();
    harness.flush();
    assert.equal(harness.observers.length, 3);
    harness.window.NEXOWATT_NATIVE_SHELL.destroy();
    assert.equal(harness.observers[2].disconnected, true);
    assert.equal(harness.values.has('--nx-nav-h'), false);
    harness.observers[2].callback();
    assert.equal(harness.values.has('--nx-nav-h'), false);
});
