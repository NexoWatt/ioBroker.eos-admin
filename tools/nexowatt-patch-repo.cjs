#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const input = process.argv[2];
const output = process.argv[3] || input;
const version = process.argv[4] || pkg.version;
const baseUrl = (process.argv[5] || `https://unpkg.com/iobroker.eos-admin@${version}`).replace(/\/$/, '');
if (!input) {
  console.error('Usage: node tools/nexowatt-patch-repo.cjs <repo-nexowatt.json> [output.json] [version] [base-url]');
  process.exit(2);
}
const repo = JSON.parse(fs.readFileSync(input, 'utf8'));
const ioPath = path.join(__dirname, '..', 'io-package.json');
const io = JSON.parse(fs.readFileSync(ioPath, 'utf8'));
if (io.common?.stopBeforeUpdate !== true || !Array.isArray(io.common.dependencies) || !io.common.dependencies.length) {
  throw new Error('EOS_REPOSITORY_METADATA_INVALID');
}
repo['eos-admin'] = {
  ...(repo['eos-admin'] || {}),
  name: 'eos-admin',
  version,
  title: 'NexoWatt EOS Admin',
  titleLang: io.common.titleLang,
  desc: io.common.desc,
  news: io.common.news,
  meta: `${baseUrl}/io-package.json`,
  icon: `${baseUrl}/admin/admin.png`,
  extIcon: `${baseUrl}/admin/admin.svg`,
  type: io.common.type,
  mode: io.common.mode,
  platform: io.common.platform,
  connectionType: io.common.connectionType,
  dataSource: io.common.dataSource,
  adminUI: io.common.adminUI,
  license: pkg.license,
  licenseInformation: io.common.licenseInformation,
  dependencies: io.common.dependencies,
  stopBeforeUpdate: io.common.stopBeforeUpdate,
  dontDelete: false,
  nondeletable: false,
  readme: `${baseUrl}/README.md`,
  packetName: 'iobroker.eos-admin',
  npmPackage: 'iobroker.eos-admin',
  allowAdapterUpdate: true,
  allowAdapterDelete: false,
};
fs.writeFileSync(output, JSON.stringify(repo, null, 2) + '\n');
console.log(`Patched ${input} -> ${output}`);
console.log(`repo["eos-admin"].version=${version}`);
console.log(`repo["eos-admin"].meta=${repo['eos-admin'].meta}`);
console.log(`repo["eos-admin"].stopBeforeUpdate=${io.common.stopBeforeUpdate}`);
console.log('repo["eos-admin"].dontDelete=false');
console.log('repo["eos-admin"].nondeletable=false');
