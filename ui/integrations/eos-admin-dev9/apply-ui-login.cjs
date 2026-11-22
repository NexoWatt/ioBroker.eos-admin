/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Eng begrenzte Offline-Quellintegration für den exakt belegten EOS-dev9-Stand.
 * Ohne --apply nur Prüfung. Keine Dienste, Installation oder Kontenänderung.
 * Eine Anwendung verlangt zusätzlich eine erreichbare, konfigurierte HTTPS-
 * UI-Proxyroute; beide Quelldateien werden vor Änderungen vollständig gesichert. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BASE_HASH = '0804f7a98c25bbddb588f84c9408a88be31687211afc84c68d705109d3303548';
const FILES = ['components/admin/src-admin/public/js/eos-role-bootstrap.js', 'components/admin/adminWww/js/eos-role-bootstrap.js'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function instanceId(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,5})$/.test(value)) throw new Error('instance_required: ganze Instanznummer 0 bis 999999 angeben');
  return value;
}

/** Patchpunkte werden einmalig exakt gebunden; kein heuristisches Suchen/Fuzzy-Patching. */
function replaceOnce(source, before, after) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) !== -1) throw new Error('patch_context_mismatch');
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchedSource(original, instance) {
  const id = instanceId(instance);
  if (sha256(original) !== BASE_HASH) throw new Error('unsupported_eos_source');
  let source = original.toString('utf8');
  source = replaceOnce(source, "const VERSION = 'v20261001-scoped-role-portal';", "const VERSION = 'v20261119-ui-1.0.37-role-entry';");
  const helper = `    // NexoWatt UI 1.0.37: ein HTTPS-Ursprung und die ausdrücklich gewählte Instanz.
    // Kein fester Zusatzport, fremder Host oder ungeprüfter Browser-Rücksprung.
    const eosUiTarget = base => {
        const target = new URL('proxy/nexowatt-ui.${id}/', base);
        if (target.origin !== window.location.origin || target.protocol !== 'https:') {
            throw new Error('Der gemeinsame HTTPS-Zugang zur NexoWatt UI ist erforderlich.');
        }
        return target;
    };

`;
  source = replaceOnce(source, '    const showProductPortal = (policy, base) => {', helper + '    const showProductPortal = (policy, base) => {');
  source = replaceOnce(source,
    "        const cockpit = new URL(window.location.href);\n        cockpit.protocol = 'https:'; cockpit.port = '8188'; cockpit.pathname = '/'; cockpit.search = ''; cockpit.hash = '';",
    '        const cockpit = eosUiTarget(base);');
  source = replaceOnce(source,
    "            if (!toolbar || document.getElementById('eos-service-own-password')) return;",
    `            if (!toolbar) return;
            if (!document.getElementById('eos-service-ui')) {
                const ui = document.createElement('a');
                ui.id = 'eos-service-ui'; ui.className = 'eos-service-own-password';
                ui.href = eosUiTarget(base).href; ui.textContent = 'NexoWatt UI';
                ui.target = '_blank'; ui.rel = 'noopener noreferrer';
                toolbar.appendChild(ui);
            }
            if (document.getElementById('eos-service-own-password')) return;`);
  source = replaceOnce(source,
    "            if (role === 'installer' || role === 'enduser') {\n                showProductPortal(resolved, base);\n                return resolved;\n            }",
    `            if (role === 'enduser') {
                // Erst eine explizit bestätigte zentrale Endkundensitzung darf
                // weiterleiten; der Erstpasswortdialog wurde oben abgeschlossen.
                if (policy.authenticated !== true || policy.role !== 'enduser'
                    || policy.mustChangePassword !== false || typeof policy.user !== 'string'
                    || !policy.user.startsWith('system.user.') || policy.user.length <= 12
                    || policy.user.length > 512) {
                    throw new Error('Die zentrale Endkundensitzung ist nicht bestätigt.');
                }
                window.location.replace(eosUiTarget(base).href);
                return resolved;
            }
            if (role === 'installer') {
                showProductPortal(resolved, base);
                return resolved;
            }`);
  return Buffer.from(source, 'utf8');
}

/** Nur reguläre Dateien unter dem angegebenen Checkout; Symlinks werden verweigert. */
function checkedFile(root, relative) {
  const realRoot = path.resolve(root);
  let current = realRoot;
  if (!fs.lstatSync(current).isDirectory() || fs.lstatSync(current).isSymbolicLink()) throw new Error('invalid_checkout_root');
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('symlink_not_allowed');
  }
  const stat = fs.lstatSync(current);
  if (!stat.isFile() || stat.size > 128 * 1024) throw new Error('invalid_source_file');
  return current;
}

/** Liest zuerst beide Originale; ein Versions-/Hashfehler erzeugt keinerlei Dateien. */
function createPlan(checkoutRoot, instance) {
  const id = instanceId(instance);
  return FILES.map(relative => {
    const absolute = checkedFile(checkoutRoot, relative);
    const before = fs.readFileSync(absolute);
    if (sha256(before) !== BASE_HASH) throw new Error('unsupported_eos_source: ' + relative);
    const after = patchedSource(before, id);
    return { relative, absolute, before, after, beforeHash: BASE_HASH, afterHash: sha256(after), mode: fs.statSync(absolute).mode & 0o777 };
  });
}

function publicTarget(publicAdminUrl, instance) {
  const url = new URL(publicAdminUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) throw new Error('invalid_public_admin_url');
  const target = new URL('proxy/nexowatt-ui.' + instanceId(instance) + '/api/auth/status', url);
  if (target.origin !== url.origin) throw new Error('proxy_origin_mismatch');
  return target;
}

/** Cookie-/passwortfreier HTTPS-Probeabruf; normale CA-/Hostnamenprüfung bleibt aktiv. */
async function verifyProxy(publicAdminUrl, instance) {
  const target = publicTarget(publicAdminUrl, instance);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(target, { redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('ui_proxy_unavailable');
    const reader = response.body?.getReader(); if (!reader) throw new Error('ui_proxy_empty');
    const parts = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 65536) { controller.abort(); throw new Error('ui_proxy_response_too_large'); }
        parts.push(Buffer.from(part.value));
      }
    } finally { reader.releaseLock(); }
    let status;
    try { status = JSON.parse(Buffer.concat(parts).toString('utf8')); }
    catch (_) { throw new Error('ui_proxy_invalid_json'); }
    if (!status || status.mode !== 'eos' || status.configured !== true || status.enabled !== true
      || status.protectWrites !== true || status.authenticated !== false || status.authed !== false) throw new Error('ui_proxy_profile_invalid');
    return { checked: true, uiPath: target.pathname, mode: 'eos', anonymousBlocked: true };
  } finally { clearTimeout(timer); }
}

function atomicWrite(file, bytes, mode) {
  const temporary = file + '.nexowatt-' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try { fs.writeFileSync(temporary, bytes, { flag: 'wx', mode }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

/** Sicherung beider Dateien vor dem ersten Austausch; nur eigene Änderungen zurückrollen. */
function applyPlan(checkoutRoot, plan, proxyEvidence) {
  if (!proxyEvidence || proxyEvidence.checked !== true || proxyEvidence.mode !== 'eos' || proxyEvidence.anonymousBlocked !== true) throw new Error('verified_proxy_required');
  for (const file of plan) {
    checkedFile(checkoutRoot, file.relative);
    if (sha256(fs.readFileSync(file.absolute)) !== file.beforeHash) throw new Error('source_changed_after_check');
  }
  const parent = path.join(path.resolve(checkoutRoot), 'nexowatt-integration-backups');
  if (fs.existsSync(parent) && (!fs.lstatSync(parent).isDirectory() || fs.lstatSync(parent).isSymbolicLink())) throw new Error('invalid_backup_directory');
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const backup = fs.mkdtempSync(path.join(parent, 'ui-1.0.37-'));
  const metadata = { createdAt: new Date().toISOString(), integration: 'eos-admin-dev9-ui-1.0.37', proxy: proxyEvidence,
    files: plan.map(file => ({ path: file.relative, beforeSha256: file.beforeHash, afterSha256: file.afterHash })) };
  for (const file of plan) {
    const destination = path.join(backup, file.relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.writeFileSync(destination, file.before, { flag: 'wx', mode: 0o600 });
  }
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const changed = [];
  try {
    for (const file of plan) {
      if (sha256(fs.readFileSync(file.absolute)) !== file.beforeHash) throw new Error('source_changed_before_write');
      atomicWrite(file.absolute, file.after, file.mode); changed.push(file);
    }
  } catch (error) {
    for (const file of changed.reverse()) {
      if (sha256(fs.readFileSync(file.absolute)) === file.afterHash) atomicWrite(file.absolute, file.before, file.mode);
    }
    throw error;
  }
  return backup;
}

async function main(args) {
  let checkoutRoot = ''; let instance = ''; let publicAdminUrl = ''; let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') apply = true;
    else if (argument === '--root') checkoutRoot = args[++index] || '';
    else if (argument === '--instance') instance = args[++index] || '';
    else if (argument === '--public-admin-url') publicAdminUrl = args[++index] || '';
    else throw new Error('unknown_argument');
  }
  if (!checkoutRoot) throw new Error('usage: node apply-ui-login.cjs --root <EOS-Checkout> --instance <Nummer> [--apply --public-admin-url https://host/admin-prefix/]');
  const plan = createPlan(checkoutRoot, instance);
  if (!apply) {
    console.log(JSON.stringify({ mode: 'check-only', files: plan.map(file => ({ path: file.relative, beforeSha256: file.beforeHash, afterSha256: file.afterHash })), next: 'Proxy bereitstellen, UI-Profil eos konfigurieren, danach explizit --apply mit --public-admin-url.' }, null, 2));
    return;
  }
  if (!publicAdminUrl) throw new Error('public_admin_url_required_before_apply');
  const evidence = await verifyProxy(publicAdminUrl, instance);
  const backup = applyPlan(checkoutRoot, plan, evidence);
  console.log(JSON.stringify({ mode: 'applied-to-checkout', backup, files: FILES, serviceRestarted: false, deployed: false }, null, 2));
}

module.exports = { BASE_HASH, FILES, instanceId, patchedSource, createPlan, publicTarget, verifyProxy, applyPlan };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : 'integration_failed'); process.exitCode = 1; });
