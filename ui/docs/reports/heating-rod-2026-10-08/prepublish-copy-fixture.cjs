'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../../..'));
const base = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'nw-heater-delivery-')); 
const report = path.join(root, 'docs/reports/heating-rod-2026-10-08');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const excluded = new Set(['node_modules', 'build-ts', '.git']);
function copy(target) {
  fs.cpSync(root, target, { recursive: true, filter: source =>
    !path.relative(root, source).split(path.sep).some(part => excluded.has(part)) });
}
function execute(command, args, cwd, env, log) {
  return new Promise((resolve, reject) => {
    const out = fs.openSync(log, 'w');
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', out, out] });
    child.on('error', error => { fs.closeSync(out); reject(error); });
    child.on('exit', code => { fs.closeSync(out); resolve(code); });
  });
}
(async () => {
  const server = http.createServer((_req, res) => { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"local test registry"}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, NEXOWATT_NPM_REGISTRY: `http://127.0.0.1:${server.address().port}` };
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/release-artifact-manifest.json')));
  const results = [];
  try {
    for (const mode of ['fresh', 'overlay']) {
      const target = path.join(base, `${mode} Projekt ä`);
      fs.rmSync(target, { recursive: true, force: true });
      copy(target);
      const oldFile = path.join(target, 'admin/react/assets/index-previous-heater.js');
      if (mode === 'overlay') fs.writeFileSync(oldFile, 'window.previousHeatingReview = true;\n');
      const logName = `prepublish-${mode}.log`;
      const start = Date.now();
      const code = await execute('npm', ['run', 'prepublishOnly'], target, env, path.join(report, logName));
      const preserved = manifest.files.every(entry => hash(fs.readFileSync(path.join(target, entry.path))) === entry.sha256);
      const result = { mode, command: ['npm', 'run', 'prepublishOnly'], exitCode: code,
        durationSeconds: (Date.now() - start) / 1000, sealedFilesPreserved: preserved,
        oldAssetRemoved: mode === 'overlay' ? !fs.existsSync(oldFile) : null, log: logName };
      results.push(result);
      console.log(JSON.stringify(result));
      if (code !== 0 || !preserved || result.oldAssetRemoved === false) throw new Error(`${mode} delivery validation failed`);
    }
  } finally {
    server.close();
    fs.writeFileSync(path.join(report, 'prepublish-copies.json'), JSON.stringify({
      timestamp: new Date().toISOString(), registry: 'isolated local HTTP fixture returning 404',
      publicationPerformed: false, realNpmVersionAvailabilityChecked: false, results }, null, 2)+'\n');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
