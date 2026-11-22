/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
/**
 * Datei: src-admin-tab/vite.config.ts
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

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Erfasst nur npm-Module mit tatsächlich gerendertem Code aus dem Rollup-Graphen.
 * Hashes binden den Bericht an Lockfile, Buildkonfiguration und erzeugte Assets.
 * Der Bericht bleibt außerhalb der Browserassets und verändert keinen UI-Code.
 */
function bundleComponentEvidence(): Plugin {
  const root = path.resolve(__dirname, '..');
  const sha256 = (value: string | Uint8Array) => crypto.createHash('sha256').update(value).digest('hex');
  return {
    name: 'nexowatt-bundle-component-evidence',
    writeBundle(_options, bundle) {
      const packages = new Map<string, { name: string; version: string; packageJsonSha256: string; modules: Array<{ path: string; sha256: string; renderedLength: number }> }>();
      const projectModules = new Map<string, { path: string; sha256: string }>();
      const artifacts: Array<{ path: string; sha256: string }> = [];
      for (const asset of Object.values(bundle)) {
        artifacts.push({ path: 'admin/react/' + asset.fileName, sha256: sha256(fs.readFileSync(path.join(root, 'admin/react', asset.fileName))) });
        if (asset.type !== 'chunk') continue;
        for (const [moduleId, info] of Object.entries(asset.modules)) {
          if (info.renderedLength <= 0) continue;
          const filename = moduleId.replace(/^\0/, '').split('?')[0].replace(/\\/g, '/');
          if (filename.startsWith(__dirname.replace(/\\/g, '/') + '/src/') && fs.existsSync(filename)) {
            const relative = path.relative(root, filename).replace(/\\/g, '/');
            projectModules.set(relative, { path: relative, sha256: sha256(fs.readFileSync(filename)) });
          }
          const index = filename.lastIndexOf('/node_modules/');
          if (index < 0 || !fs.existsSync(filename)) continue;
          const tail = filename.slice(index + '/node_modules/'.length);
          const packageName = tail.startsWith('@') ? tail.split('/').slice(0, 2).join('/') : tail.split('/')[0];
          const packageFile = filename.slice(0, index) + '/node_modules/' + packageName + '/package.json';
          const bytes = fs.readFileSync(packageFile);
          const pkg: unknown = JSON.parse(bytes.toString('utf8'));
          if (pkg === null || typeof pkg !== 'object' || !('name' in pkg) || typeof pkg.name !== 'string' || !('version' in pkg) || typeof pkg.version !== 'string') {
            throw new Error('Ungültige Paketmetadaten im Admin-Build.');
          }
          const key = `${pkg.name}@${pkg.version}`;
          if (!packages.has(key)) packages.set(key, { name: pkg.name, version: pkg.version, packageJsonSha256: sha256(bytes), modules: [] });
          const modules = packages.get(key)!.modules;
          const relative = path.relative(root, filename).replace(/\\/g, '/');
          if (!modules.some(module => module.path === relative)) modules.push({ path: relative, sha256: sha256(fs.readFileSync(filename)), renderedLength: info.renderedLength });
        }
      }
      for (const component of packages.values()) component.modules.sort((a, b) => a.path.localeCompare(b.path));
      const report = {
        schema: 'nexowatt.admin-bundle-components.v1',
        generatedAt: new Date().toISOString(),
        provenance: 'Rollup writeBundle module graph; npm modules with renderedLength > 0; hashes of final files',
        limitations: 'Lists npm packages contributing rendered JavaScript. Not a source code review, OS inventory or vulnerability clearance.',
        packageLockSha256: sha256(fs.readFileSync(path.join(__dirname, 'package-lock.json'))),
        viteConfigSha256: sha256(fs.readFileSync(path.join(__dirname, 'vite.config.ts'))),
        entryHtmlSha256: sha256(fs.readFileSync(path.join(__dirname, 'index.html'))),
        projectModules: [...projectModules.values()].sort((a, b) => a.path.localeCompare(b.path)),
        components: [...packages.values()].sort((a, b) => a.name.localeCompare(b.name)),
        artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)),
      };
      const output = path.join(root, 'release-manifests', 'admin-bundle-components.json');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleComponentEvidence()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../admin/react'),
    emptyOutDir: true,
  },
});
