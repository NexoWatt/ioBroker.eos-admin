/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
/** Builds the already installed Admin GFM parser for the local SmartHome page.
 * No packages are downloaded and no product code executes dynamic scripts. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const digest = value => createHash('sha256').update(value).digest('hex');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../..');
const adminRequire = createRequire(path.join(repo, 'src-admin/package.json'));
const esbuild = require('esbuild');
const source = `import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
window.NW_SH_MARKDOWN = Object.freeze({parse(text) {
if (typeof text !== 'string' || text.length > 32768) throw new Error('EOS_MARKDOWN_LIMIT');
return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}});`;
(async () => {
  for (const name of ['mdast-util-from-markdown', 'micromark-extension-gfm', 'mdast-util-gfm']) adminRequire.resolve(name);
  const result = await esbuild.build({ absWorkingDir: repo, stdin: { contents: source, resolveDir: path.join(repo, 'src-admin'), sourcefile: 'nexowatt-smarthome-markdown-entry.js' },
    bundle: true, format: 'iife', platform: 'browser', target: ['es2022'], minify: true, legalComments: 'inline', metafile: true,
    outfile: path.join(repo, 'ui/www/smarthome-markdown-parser.js'), banner: { js: '/* Local GFM parser. Third-party licenses: licenses/smarthome-markdown-LICENSES.txt */' } });
  const packages = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    const resolved = path.resolve(repo, input); if (!resolved.includes('node_modules')) continue;
    let dir = path.dirname(resolved);
    while (dir !== path.dirname(dir) && !fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
    if (!dir.includes('node_modules') || !fs.existsSync(path.join(dir, 'package.json'))) continue;
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const licenseName = fs.readdirSync(dir).find(name => /^licen[cs]e(?:\.md|\.txt)?$/i.test(name));
    if (!licenseName) throw new Error('Missing bundled package license: ' + pkg.name);
    packages.set(pkg.name, { name: pkg.name, version: pkg.version, license: pkg.license, text: fs.readFileSync(path.join(dir, licenseName), 'utf8') });
  }
  const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
  const licenseDir = path.join(repo, 'ui/www/licenses'); fs.mkdirSync(licenseDir, { recursive: true });
  fs.writeFileSync(path.join(licenseDir, 'smarthome-markdown-LICENSES.txt'), sorted.map(pkg => `${pkg.name}@${pkg.version} (${pkg.license})\n${pkg.text}`).join('\n\n--------------------\n\n'));
  fs.writeFileSync(path.join(licenseDir, 'smarthome-markdown-components.json'), JSON.stringify({ generatedBy: 'ui/scripts/build-smarthome-markdown.cjs', origin: 'Existing locked src-admin build dependencies; locally bundled without network or runtime loader', bundle: { path: 'ui/www/smarthome-markdown-parser.js', sha256: digest(fs.readFileSync(path.join(repo, 'ui/www/smarthome-markdown-parser.js'))) }, compiler: { name: 'esbuild', version: esbuild.version, target: 'es2022' }, entrySha256: digest(source), inputs: Object.keys(result.metafile.inputs).filter(input => fs.existsSync(path.resolve(repo, input))).sort().map(input => ({ path: path.relative(repo, path.resolve(repo, input)), sha256: digest(fs.readFileSync(path.resolve(repo, input))) })), packages: sorted.map(({ name, version, license }) => ({ name, version, license })) }, null, 2) + '\n');
  console.log(`SmartHome GFM parser: ${sorted.length} existing dependency licenses retained.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
