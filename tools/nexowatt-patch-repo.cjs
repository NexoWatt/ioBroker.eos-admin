#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const { createHash, randomUUID } = require('node:crypto');
const packageName = 'iobroker.eos-admin';
const registry = 'https://registry.npmjs.org';

/**
 * @param {string} url
 * @param {number} maximum
 * @param {AbortSignal} signal
 * @param {typeof fetch} fetchResource
 * @param {(chunk: Uint8Array) => void} consume
 */
async function readRegistry(url, maximum, signal, fetchResource, consume) {
  const response = await fetchResource(url, { redirect: 'error', signal });
  if (!response.ok || !response.body) throw new Error(`EOS_REPOSITORY_NPM_HTTP_${response.status}`);
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > maximum) throw new Error('EOS_REPOSITORY_NPM_SIZE');
    consume(chunk);
  }
  if (bytes === 0) throw new Error('EOS_REPOSITORY_NPM_EMPTY');
}

// Distribution can expose a version before its tarball is readable. Check the
// exact artifact that ioBroker will install before advertising this version.
/** @param {string} version @param {typeof fetch} fetchResource */
async function verifyPublishedTarball(version, fetchResource) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('EOS_REPOSITORY_VERSION_INVALID');
  }
  const signal = AbortSignal.timeout(120000);
  /** @type {Uint8Array[]} */
  const chunks = [];
  await readRegistry(`${registry}/${packageName}/${version}`, 512 * 1024, signal, fetchResource, chunk => chunks.push(chunk));
  const metadata = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const tarball = `${registry}/${packageName}/-/${packageName}-${version}.tgz`;
  if (metadata.name !== packageName || metadata.version !== version || metadata.dist?.tarball !== tarball ||
      typeof metadata.dist.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(metadata.dist.integrity)) {
    throw new Error('EOS_REPOSITORY_NPM_METADATA');
  }
  const digest = createHash('sha512');
  await readRegistry(tarball, 64 * 1024 * 1024, signal, fetchResource, chunk => digest.update(chunk));
  if (`sha512-${digest.digest('base64')}` !== metadata.dist.integrity) throw new Error('EOS_REPOSITORY_NPM_INTEGRITY');
}

/**
 * @param {string | undefined} input
 * @param {string} [output]
 * @param {string} [version]
 * @param {string} [base]
 * @param {typeof fetch} [fetchResource]
 */
async function patchRepository(input, output = input, version = pkg.version, base, fetchResource = fetch) {
  if (!input || !output) throw new Error('Usage: node tools/nexowatt-patch-repo.cjs <repo-nexowatt.json> [output.json] [version] [base-url]');
  const baseUrl = (base || `https://unpkg.com/iobroker.eos-admin@${version}`).replace(/\/$/, '');
  const ioPath = path.join(__dirname, '..', 'io-package.json');
  const io = JSON.parse(fs.readFileSync(ioPath, 'utf8'));
  if (io.common?.stopBeforeUpdate !== true || !Array.isArray(io.common.dependencies) || !io.common.dependencies.length) {
    throw new Error('EOS_REPOSITORY_METADATA_INVALID');
  }
  await verifyPublishedTarball(version, fetchResource);
  // A new in-place repository starts empty. When a separate source is named,
  // it must exist so a misspelled input cannot replace an existing destination.
  const firstUse = path.resolve(input) === path.resolve(output) && !fs.existsSync(input);
  const repo = firstUse ? {} : JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
  if (!repo || typeof repo !== 'object' || Array.isArray(repo)) throw new Error('EOS_REPOSITORY_INPUT_INVALID');
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
  const temporary = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(repo, null, 2) + '\n', { flag: 'wx', mode: firstUse ? 0o666 : fs.statSync(input).mode & 0o777 });
    fs.renameSync(temporary, output);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return repo['eos-admin'];
}

module.exports = { patchRepository };
if (require.main === module) {
  const [input, output, version, base] = process.argv.slice(2);
  patchRepository(input, output, version, base).then(entry => {
    console.log(`Published npm tarball verified. repo["eos-admin"].version=${entry.version}, stopBeforeUpdate=${entry.stopBeforeUpdate}`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
