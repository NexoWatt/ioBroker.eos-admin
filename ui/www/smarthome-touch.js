/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/www/smarthome-touch.ts
 * Quell-Hash: sha256:83e085178d347ccf58b20fc9bc1befc777f0b552fa6d3277f2dea2dfcab467bf
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für www/smarthome-touch.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Trennt Touch-Bedienung eines nativen Bereichsreglers vom Scrollen.
 * Daten und Wirkung: Hält native Eingabe-/Commit-Ereignisse bis zur bewusst abgeschlossenen Touch-Geste zurück.
 * Bei Änderungen: Scrollen, Abbruch, Multitouch, Fokusverlust, native Folgeereignisse und genau einen Commit beim Loslassen prüfen.
 * Hält Eingabe-/Commit-Ereignisse bis zum abgeschlossenen Tippen oder
 * horizontalen Ziehen zurück. Abbruch, Scrollen, Fokusverlust und Mehrfingergesten
 * stellen den ursprünglichen Wert wieder her und schreiben keine Gerätebefehle.
 * Maus/Tastatur, min/max/step und die vorhandenen API-/Rechteprüfungen bleiben erhalten.
 * Keine Gerätekommunikation, kein automatisches Wiederholen, keine Fremdbibliothek.
 */
(function () {
    'use strict';
    const host = window;
    if (host.NW_SH_TOUCH)
        return;
    const bindings = new WeakMap();
    let active = null;
    let installed = false;
    let lastScrollAt = Number.NEGATIVE_INFINITY;
    function paint(input) {
        const min = input.min === '' ? 0 : Number(input.min);
        const max = input.max === '' ? 100 : Number(input.max);
        const value = Number(input.value);
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(value) || max <= min)
            return;
        const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
        input.style.setProperty('--nw-range-fill', `${percent.toFixed(2)}%`);
    }
    function restore(gesture) {
        gesture.binding.retainedValue = gesture.initialValue;
        gesture.binding.input.value = gesture.initialValue;
        paint(gesture.binding.input);
    }
    function cancel() {
        if (!active)
            return;
        const gesture = active;
        active = null;
        gesture.binding.suppressNative = true;
        delete gesture.binding.input.dataset.nwTouchPhase;
        restore(gesture);
    }
    function move(event) {
        if (!active || event.pointerId !== active.pointerId)
            return;
        const input = active.binding.input;
        if (!input.isConnected || input.disabled) {
            cancel();
            return;
        }
        if (active.phase !== 'pending')
            return;
        const dx = Math.abs(event.clientX - active.x);
        const dy = Math.abs(event.clientY - active.y);
        if (Math.hypot(dx, dy) <= 8)
            return;
        // A vertical/diagonal scroll cannot later turn into a hardware command.
        active.phase = dx > dy * 1.5 ? 'horizontal' : 'cancelled';
        input.dataset.nwTouchPhase = active.phase;
        if (active.phase === 'cancelled')
            restore(active);
    }
    function finish(event) {
        if (!active || event.pointerId !== active.pointerId)
            return;
        move(event);
        if (!active)
            return;
        const gesture = active;
        active = null;
        const binding = gesture.binding;
        const input = binding.input;
        delete input.dataset.nwTouchPhase;
        // Native touch input/change/click can follow pointerup. Keep them suppressed
        // until the next explicit keyboard or pointer interaction with this input.
        // Programmatic .value updates are unaffected and never create commands.
        binding.suppressNative = true;
        if (gesture.phase === 'cancelled' || input.disabled || !input.isConnected) {
            restore(gesture);
            return;
        }
        paint(input);
        if (input.value === gesture.initialValue)
            return;
        binding.retainedValue = input.value;
        binding.emitting = true;
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // An input listener may revoke write access or remove the control.
            if (!input.disabled && input.isConnected)
                input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        finally {
            binding.emitting = false;
        }
    }
    function install() {
        if (installed)
            return;
        installed = true;
        document.addEventListener('pointermove', move, { capture: true, passive: true });
        document.addEventListener('pointerup', finish, { capture: true, passive: true });
        document.addEventListener('pointercancel', event => {
            if (active && event.pointerId === active.pointerId)
                cancel();
        }, { capture: true, passive: true });
        document.addEventListener('lostpointercapture', event => {
            if (active && event.pointerId === active.pointerId)
                cancel();
        }, { capture: true, passive: true });
        document.addEventListener('pointerdown', event => {
            if (active && (event.pointerId !== active.pointerId || !active.binding.input.isConnected))
                cancel();
        }, { capture: true, passive: true });
        document.addEventListener('scroll', () => {
            lastScrollAt = performance.now();
            cancel();
        }, { capture: true, passive: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            cancel(); });
        window.addEventListener('blur', cancel);
        window.addEventListener('pagehide', cancel);
    }
    function bindRange(input) {
        if (input.type !== 'range' || bindings.has(input))
            return;
        install();
        const binding = { input, suppressNative: false, emitting: false, retainedValue: null };
        bindings.set(input, binding);
        input.style.touchAction = 'pan-y';
        input.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'touch') {
                cancel();
                binding.suppressNative = false;
                binding.retainedValue = null;
                return;
            }
            cancel();
            binding.suppressNative = true;
            binding.retainedValue = input.value;
            if (input.disabled || !event.isPrimary)
                return;
            active = {
                binding, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
                initialValue: input.value,
                phase: performance.now() - lastScrollAt < 400 ? 'cancelled' : 'pending',
            };
            input.dataset.nwTouchPhase = active.phase;
        }, { capture: true, passive: true });
        input.addEventListener('keydown', () => {
            cancel();
            binding.suppressNative = false;
            binding.retainedValue = null;
        }, { capture: true });
        const holdNative = (event) => {
            if (binding.emitting || !binding.suppressNative)
                return;
            event.stopImmediatePropagation();
            if (event.cancelable)
                event.preventDefault();
            if (active?.binding === binding && active.phase === 'cancelled')
                restore(active);
            else {
                if (!active && binding.retainedValue !== null)
                    input.value = binding.retainedValue;
                paint(input);
            }
        };
        input.addEventListener('input', holdNative, { capture: true });
        input.addEventListener('change', holdNative, { capture: true });
        // Prevent the compatibility click from opening the surrounding device panel
        // or making a second native range change after our accepted commit.
        input.addEventListener('click', holdNative, { capture: true });
    }
    function isInteracting() {
        if (active && (!active.binding.input.isConnected || active.binding.input.disabled))
            cancel();
        return active !== null;
    }
    host.NW_SH_TOUCH = Object.freeze({
        bindRange, cancel, isInteracting, isCommitting: (input) => bindings.get(input)?.emitting === true,
    });
})();
