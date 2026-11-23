/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { render, writeOutput } = require('../deploy/render-ingress.cjs');

let directory;
let value;
before(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-ingress-test-'));
    fs.chmodSync(directory, 0o700);
    value = { ip: '192.168.10.192', certificate: path.join(directory, 'device.pem'),
        privateKey: path.join(directory, 'device-key.pem'), upstreamName: 'nexowatteos',
        upstreamCa: path.join(directory, 'test-ca.pem') };
    // Ephemeral test key, never a literal/shipped private key or production CA.
    const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
        '-subj', '/CN=nexowatteos', '-addext', 'subjectAltName=IP:192.168.10.192,DNS:nexowatteos,DNS:nexowatteos.local,DNS:nexowatt,DNS:nexowatt.local',
        '-keyout', value.privateKey, '-out', value.certificate], { encoding: 'utf8', timeout: 10000 });
    assert.equal(generated.status, 0, 'OpenSSL must generate the ephemeral certificate fixture');
    fs.chmodSync(value.privateKey, 0o600);
    fs.copyFileSync(value.certificate, value.upstreamCa);
});
after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });

test('default uses verified TLS upstream, explicit SNI and exact unchanged Browser Host', () => {
    const output = render(value);
    assert.match(output, /proxy_pass https:\/\/127\.0\.0\.1:8188;/);
    assert.match(output, /proxy_ssl_verify on;/);
    assert.ok(output.includes(`proxy_ssl_trusted_certificate ${value.upstreamCa};`));
    assert.match(output, /proxy_ssl_server_name on;/);
    assert.match(output, /proxy_ssl_name nexowatteos;/);
    assert.match(output, /proxy_ssl_protocols TLSv1\.2 TLSv1\.3;/);
    assert.match(output, /proxy_set_header Host \$http_host;/);
    assert.match(output, /server_name 192\.168\.10\.192 nexowatteos;/);
    assert.match(output, /"nexowatteos:443" 1;/);
    assert.match(output, /if \(\$eos_allowed_host = 0\) \{ return 421; \}/);
    assert.equal(output.includes('nexowatteos.local'), false);
    assert.match(output, /proxy_pass_request_headers off;/);
    // Cross-entry document navigation from Admin:8081 requires all three values.
    for (const [header, variable] of [['Sec-Fetch-Site', 'sec_fetch_site'], ['Sec-Fetch-Mode', 'sec_fetch_mode'], ['Sec-Fetch-Dest', 'sec_fetch_dest']]) {
        assert.ok(output.includes(`proxy_set_header ${header} $http_${variable};`));
    }
    assert.match(output, /proxy_buffering off;/);
    assert.equal(output.includes('@@'), false);
    assert.equal(output.includes('proxy_ssl_verify off'), false);
    assert.equal(output.includes('proxy_set_header X-User'), false);
});

test('local alias is explicit and HTTP loopback is an explicit incompatible legacy profile', () => {
    assert.match(render({ ...value, includeLocalName: true }), /server_name 192\.168\.10\.192 nexowatteos nexowatteos\.local;/);
    const legacy = { ...value };
    delete legacy.upstreamName;
    delete legacy.upstreamCa;
    const output = render({ ...legacy, upstreamProtocol: 'http' });
    assert.match(output, /proxy_pass http:\/\/127\.0\.0\.1:8188;/);
    assert.match(output, /server_name 192\.168\.10\.192;/);
    assert.equal(output.includes('"nexowatteos" 1;'), false);
    assert.equal(output.includes('proxy_ssl_verify'), false);
    assert.throws(() => render({ ...value, upstreamProtocol: 'http' }), /HTTP_PROFILE_TLS_OPTIONS_FORBIDDEN/);
    assert.throws(() => render({ ...value, upstreamProtocol: 'https; include evil' }), /UPSTREAM_PROTOCOL_INVALID/);
    assert.throws(() => render({ ...value, includeLocalName: 'true' }), /LOCAL_NAME_OPTION_INVALID/);
    assert.throws(() => render({ ...legacy, upstreamProtocol: 'http', hostname: 'nexowatt' }), /HTTP_PROFILE_TLS_OPTIONS_FORBIDDEN/);
});

test('nexowatt is an explicit exact public host while upstream identity and existing defaults stay separate', () => {
    const output = render({ ...value, hostname: 'nexowatt' });
    assert.match(output, /server_name 192\.168\.10\.192 nexowatt;/);
    assert.match(output, /"nexowatt" 1;/);
    assert.match(output, /"nexowatt:443" 1;/);
    assert.equal(output.includes('"nexowatteos" 1;'), false);
    assert.match(output, /proxy_ssl_name nexowatteos;/);
    assert.match(output, /proxy_set_header Host \$http_host;/);
    assert.match(output, /proxy_ssl_verify on;/);
    assert.match(render({ ...value, hostname: 'nexowatt', includeLocalName: true }),
        /server_name 192\.168\.10\.192 nexowatt nexowatt\.local;/);
    assert.match(render(value), /server_name 192\.168\.10\.192 nexowatteos;/);
});

test('public host validation rejects unsafe authorities and does not silently repair them', () => {
    for (const hostname of [null, '', 'NexoWatt', '*.local', '127.0.0.1', 'nexowatt:443',
        'https://nexowatt', 'a..b', '-bad', 'bad-', 'name.', '$host', 'name; deny all;', 'name\n', 'a'.repeat(64)]) {
        assert.throws(() => render({ ...value, hostname }), /HOSTNAME_INVALID/);
    }
    const maximumName = [63, 63, 63, 61].map(length => 'a'.repeat(length)).join('.');
    assert.throws(() => render({ ...value, hostname: maximumName, includeLocalName: true }), /HOSTNAME_INVALID/);
});

test('TLS requires an explicit CA file and strictly validated DNS certificate identity', () => {
    assert.throws(() => render({ ...value, upstreamCa: undefined }), /UPSTREAM_CA_REQUIRED/);
    for (const upstreamName of [undefined, '', 'NexoWattEOS', '*.local', '127.0.0.1', 'a..b', '-bad', 'bad-', 'name.', '$host', 'name; deny all;', 'name\n', 'a'.repeat(64)]) {
        assert.throws(() => render({ ...value, upstreamName }), /UPSTREAM_NAME_INVALID/);
    }
    assert.match(render({ ...value, upstreamName: 'eos.internal.example' }), /proxy_ssl_name eos\.internal\.example;/);
});

test('host and every certificate-path interpolation reject injection and ambiguous paths', () => {
    for (const ip of ['example.com', '127.0.0.1; deny all;', '192.168.1.1\nallow all;', '::1']) {
        assert.throws(() => render({ ...value, ip }), /DEVICE_IPV4_REQUIRED/);
    }
    for (const field of ['certificate', 'privateKey', 'upstreamCa']) {
        for (const bad of ['relative.pem', '/etc/../key.pem', '/etc//key.pem', '/etc/key.pem; include /tmp/evil;', '/etc/key.pem\n', '/etc/$host.pem']) {
            assert.throws(() => render({ ...value, [field]: bad }), /CERTIFICATE_PATH_INVALID/);
        }
    }
});

test('files and complete parent chains reject symlinks, insecure permissions and absent inputs', () => {
    const link = path.join(directory, 'link.pem'); fs.symlinkSync(value.certificate, link);
    for (const field of ['certificate', 'privateKey', 'upstreamCa']) {
        assert.throws(() => render({ ...value, [field]: link }), /PATH_UNSAFE/);
    }
    const subdir = path.join(directory, 'certs'); fs.mkdirSync(subdir, { mode: 0o700 });
    const nested = path.join(subdir, 'ca.pem'); fs.copyFileSync(value.upstreamCa, nested);
    const linkdir = path.join(directory, 'linked-directory'); fs.symlinkSync(subdir, linkdir);
    assert.throws(() => render({ ...value, upstreamCa: path.join(linkdir, 'ca.pem') }), /PATH_UNSAFE/);
    fs.chmodSync(subdir, 0o777);
    assert.throws(() => render({ ...value, upstreamCa: nested }), /PATH_UNSAFE/);
    fs.chmodSync(subdir, 0o700);
    fs.chmodSync(value.privateKey, 0o644);
    assert.throws(() => render(value), /PATH_UNSAFE/);
    fs.chmodSync(value.privateKey, 0o600);
    assert.throws(() => render({ ...value, upstreamCa: path.join(directory, 'absent.pem') }), { code: 'ENOENT' });
    assert.throws(() => render({ ...value, upstreamCa: subdir }), /PATH_UNSAFE/);
    const hardlink = path.join(directory, 'hardlink.pem'); fs.linkSync(value.certificate, hardlink);
    fs.chmodSync(hardlink, 0o600);
    assert.throws(() => render({ ...value, privateKey: hardlink }), /CERTIFICATE_AND_KEY_MUST_DIFFER/);
});

test('output is private and exclusive, including symlink and parent-directory attacks', () => {
    const output = path.join(directory, 'eos.conf'); writeOutput(output, render(value));
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    const before = fs.readFileSync(output, 'utf8');
    assert.throws(() => writeOutput(output, 'replacement'), { code: 'EEXIST' });
    assert.equal(fs.readFileSync(output, 'utf8'), before);
    const link = path.join(directory, 'output-link.conf'); fs.symlinkSync(output, link);
    assert.throws(() => writeOutput(link, 'replacement'), { code: 'EEXIST' });
    assert.throws(() => writeOutput(path.join(directory, 'linked-directory', 'new.conf'), 'replacement'), /PATH_UNSAFE/);
    assert.throws(() => writeOutput('relative.conf', 'replacement'), /OUTPUT_PATH_INVALID/);
});

test('CLI rejects duplicate/unknown parameters and never replaces an existing file', () => {
    const script = path.resolve(__dirname, '../deploy/render-ingress.cjs');
    const output = path.join(directory, 'cli.conf');
    const args = ['--ip', value.ip, '--certificate', value.certificate, '--private-key', value.privateKey,
        '--upstream-name', value.upstreamName, '--upstream-ca', value.upstreamCa, '--output', output];
    const run = extra => spawnSync(process.execPath, [script, ...args, ...extra], { encoding: 'utf8', timeout: 10000 });
    assert.equal(run([]).status, 0);
    assert.match(run([]).stderr, /OUTPUT_EXISTS/);
    assert.match(run(['--ip', '127.0.0.1']).stderr, /ARGUMENTS_INVALID/);
    assert.match(run(['--upstream-host', 'evil.example']).stderr, /ARGUMENTS_INVALID/);
    assert.match(run(['--include-local-name', 'maybe']).stderr, /LOCAL_NAME_OPTION_INVALID/);
    const namedOutput = path.join(directory, 'cli-nexowatt.conf');
    const named = spawnSync(process.execPath, [script, ...args.slice(0, -2), '--hostname', 'nexowatt', '--output', namedOutput],
        { encoding: 'utf8', timeout: 10000 });
    assert.equal(named.status, 0);
    assert.match(fs.readFileSync(namedOutput, 'utf8'), /server_name 192\.168\.10\.192 nexowatt;/);
    assert.match(run(['--hostname', 'nexowatt;']).stderr, /HOSTNAME_INVALID/);
});

test('nginx -t validates the generated TLS fragment when the binary is available', t => {
    const available = spawnSync('nginx', ['-v'], { encoding: 'utf8' });
    if (available.error?.code === 'ENOENT') return t.skip('nginx not installed; no nginx syntax or real TLS handshake claim');
    assert.equal(available.status, 0);
    const fragment = render(value).replace('/var/log/nginx/nexowatt-eos-error.log', path.join(directory, 'error.log'));
    const config = path.join(directory, 'nginx-test.conf');
    fs.writeFileSync(config, `pid ${directory}/nginx.pid;\nevents {}\nhttp {\n${fragment}\n}\n`);
    const checked = spawnSync('nginx', ['-t', '-p', `${directory}/`, '-c', config], { encoding: 'utf8', timeout: 10000 });
    assert.equal(checked.status, 0, checked.stderr);
});
