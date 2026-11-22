/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Eingebettete EMS-Detailansicht mit dem gemeinsamen AppCenter-Stylesheet.
 * Daten und Wirkung: Meldet nur die Inhaltshöhe; keine Navigation, Berechtigungs-
 * freigabe oder Konfigurationsmutation. Der Host prüft Ursprung und iframe-Fenster.
 * Bei Änderungen: Höhenmessung, Listener-Abbau und auf Einbettung beschränkte Styles prüfen.
 */
import React, { useEffect, useRef } from 'react';
import { getRuntimeProxyBase } from '../lib/adminConnection';

export default function EmbeddedEmsFrame({ children }: React.PropsWithChildren) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = content.current;
    if (!node) return;
    const html = document.documentElement;
    const body = document.body;
    const hadHtmlClass = html.classList.contains('nw-ems-embedded');
    const hadBodyClass = body.classList.contains('nw-ems-embedded');
    const hadThemeClass = body.classList.contains('nw-cockpit-page');
    html.classList.add('nw-ems-embedded');
    body.classList.add('nw-ems-embedded', 'nw-cockpit-page');
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = `${getRuntimeProxyBase() ?? ''}/static/styles.css`;
    css.dataset.nwEmbeddedEms = 'true';
    document.head.appendChild(css);
    let active = true;
    let scheduled = 0;
    let lastHeight = 0;
    const report = () => {
      if (!active || scheduled) return;
      scheduled = window.requestAnimationFrame(() => {
        scheduled = 0;
        const height = Math.max(1, Math.ceil(node.getBoundingClientRect().height) + 1);
        if (height === lastHeight) return;
        lastHeight = height;
        window.parent.postMessage({ type: 'nw:dynamic-grid-height', height }, window.location.origin);
      });
    };
    const observer = new ResizeObserver(report);
    observer.observe(node);
    css.addEventListener('load', report);
    window.addEventListener('resize', report);
    document.fonts?.ready.then(report).catch(() => {});
    report();
    return () => {
      active = false; observer.disconnect();
      window.cancelAnimationFrame(scheduled);
      window.removeEventListener('resize', report);
      css.removeEventListener('load', report); css.remove();
      if (!hadHtmlClass) html.classList.remove('nw-ems-embedded');
      if (!hadBodyClass) body.classList.remove('nw-ems-embedded');
      if (!hadThemeClass) body.classList.remove('nw-cockpit-page');
    };
  }, []);
  return <div className="nw-embedded-ems-content" ref={content}>{children}</div>;
}
