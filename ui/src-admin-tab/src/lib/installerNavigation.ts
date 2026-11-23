/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Rückwege des Installers bleiben im bestätigten Runtime-Origin. Die Backend-
 * Rollenprüfung bleibt maßgeblich; eine nicht bestätigte Sitzung erhält keine Links.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bestimmt die rollenabhängigen Rückwege und Moduleinstiege des Installers.
 * Daten und Wirkung: Liest ausschließlich den bestätigten Sitzungsstatus; liefert feste interne Pfade ohne Netzwerkaufrufe oder Zustandsänderungen. InstallerPage setzt davor den bestätigten Runtime-Origin.
 * Bei Änderungen: Rollenvertrag und Backend-Zugriffsschutz gemeinsam prüfen; keine frei vorgegebenen Redirect-Ziele übernehmen.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/lib/installerNavigation.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
interface InstallerAccess { readonly authed: boolean; readonly role: string }
interface InstallerReturnLink { readonly label: string; readonly path: '/' | '/system/' }

/** Feste interne Ziele, ohne Hostname, Port oder Redirect aus Browser-Eingaben. */
export function installerReturnLinks(access: InstallerAccess | null): readonly InstallerReturnLink[] {
  if (access?.authed !== true || !['admin', 'installer', 'customer'].includes(access.role)) return [];
  const links: InstallerReturnLink[] = [{ label: 'Zum EOS-Dashboard', path: '/' }];
  if (access.role === 'admin') links.unshift({ label: 'Zur EOS-Administration', path: '/system/' });
  return links;
}

/** Tatsächlich bereitgestellte, zentral geschützte Module ohne eigene Lizenzanmeldung. */
export function installerModuleLinks(access: InstallerAccess | null): readonly { label: string; path: string }[] {
  if (access?.authed !== true || access.role !== 'admin') return [];
  return [
    { label: 'Devices', path: '/modules/devices/' },
    { label: 'EEBus', path: '/modules/eebus/' },
  ];
}
