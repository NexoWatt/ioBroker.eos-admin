#!/usr/bin/env node
// @ts-check
'use strict';
/**
 * Explicit, bounded administrator bootstrap for a NEW EOS site.
 * Never called by npm lifecycle hooks or the unprivileged adapter. No shell,
 * arbitrary paths, network downloads, sudoers changes or existing-cluster edits.
 */
const fs = require('node:fs/promises');
const constants = require('node:fs').constants;
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');

const CLIENT_ROOT = '/etc/nexowatt-eos/postgresql';
const SERVER_ROOT = '/etc/nexowatt-postgresql';
const DATA_ROOT = '/var/lib/nexowatt-postgresql';
const SOCKET_ROOT = '/run/nexowatt-postgresql';
const SERVICE_FILE = '/etc/systemd/system/nexowatt-postgresql.service';
const SERVICE = 'nexowatt-postgresql.service';
const SERVICE_USER = 'nexowatt-pg';
const PG_BIN = '/usr/lib/postgresql/17/bin';
const PORT = 55432;
const PACKAGE_OVERRIDE = '# Temporary EOS bootstrap override; removed after package transaction.\ncreate_main_cluster = false\n';
const PROGRAMS = new Set([
    '/usr/bin/getent', '/usr/sbin/useradd', '/usr/sbin/runuser', '/usr/bin/systemctl',
    '/usr/bin/openssl', '/usr/bin/apt-get', `${PG_BIN}/initdb`, `${PG_BIN}/psql`, `${PG_BIN}/postgres`,
]);
const fail = (/** @type {string} */ code) => new Error(`EOS_POSTGRES_SETUP_${code}`);

/** @param {unknown} namespace @returns {number} */
function instanceNumber(namespace) {
    if (typeof namespace !== 'string' || !/^eos-admin\.(0|[1-9]\d{0,3})$/.test(namespace)) throw fail('NAMESPACE');
    return Number(namespace.split('.')[1]);
}

/** @param {string} namespace */
function names(namespace) {
    const id = instanceNumber(namespace);
    return { database: `eos_history_${id}`, owner: `eos_history_${id}_owner`, runtime: `eos_history_${id}_runtime`, backup: `eos_history_${id}_backup` };
}

/** @param {string} namespace @param {'runtime'|'backup'} purpose @param {string} password */
function profile(namespace, purpose, password) {
    const n = names(namespace);
    if (!/^[a-f0-9]{64}$/.test(password)) throw fail('PASSWORD_FORMAT');
    return { schemaVersion: 1, provider: 'postgresql', provisioned: true, newInstallation: true,
        host: '127.0.0.1', port: PORT, database: n.database, user: n[purpose], password,
        caFile: `${CLIENT_ROOT}/ca.crt`, servername: 'localhost', schema: 'eos_history' };
}

/** Pure render functions are also used by the isolated PostgreSQL acceptance tests. */
function postgresConfig() {
    return `# Managed EOS PostgreSQL 17; explicit administrator bootstrap only.\nlisten_addresses = '127.0.0.1'\nport = ${PORT}\ndata_directory = '${DATA_ROOT}/data'\nhba_file = '${SERVER_ROOT}/pg_hba.conf'\nident_file = '${SERVER_ROOT}/pg_ident.conf'\nunix_socket_directories = '${SOCKET_ROOT}'\nunix_socket_permissions = 0700\nssl = on\nssl_cert_file = '${SERVER_ROOT}/server.crt'\nssl_key_file = '${SERVER_ROOT}/server.key'\nssl_min_protocol_version = 'TLSv1.3'\npassword_encryption = 'scram-sha-256'\nmax_connections = 24\nshared_buffers = '64MB'\nwork_mem = '4MB'\nstatement_timeout = '5s'\nlock_timeout = '2s'\nidle_in_transaction_session_timeout = '10s'\nlog_statement = 'none'\nlog_min_error_statement = 'panic'\nlog_parameter_max_length = 0\nlog_parameter_max_length_on_error = 0\nlogging_collector = off\n`;
}
function hbaConfig() {
    // Peer is limited to the dedicated OS/database maintenance identity. Runtime
    // and backup roles can never fall back to the private maintenance socket.
    return `# Explicit local TLS policy, no trust authentication.\nlocal all ${SERVICE_USER} peer\nlocal all all reject\nhostnossl all all 0.0.0.0/0 reject\nhostnossl all all ::/0 reject\nhostssl all all 127.0.0.1/32 scram-sha-256\nhost all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n`;
}
function serviceConfig() {
    return `[Unit]\nDescription=NexoWatt local PostgreSQL history\nAfter=local-fs.target\n[Service]\nType=simple\nUser=${SERVICE_USER}\nGroup=${SERVICE_USER}\nExecStart=${PG_BIN}/postgres -D ${DATA_ROOT}/data -c config_file=${SERVER_ROOT}/postgresql.conf\nExecReload=/bin/kill -HUP $MAINPID\nKillSignal=SIGINT\nTimeoutStopSec=120\nRestart=on-failure\nRestartSec=5\nUMask=0077\nRuntimeDirectory=nexowatt-postgresql\nRuntimeDirectoryMode=0700\nNoNewPrivileges=true\nPrivateTmp=true\nPrivateDevices=true\nProtectSystem=strict\nProtectHome=true\nProtectKernelTunables=true\nProtectKernelModules=true\nProtectControlGroups=true\nRestrictSUIDSGID=true\nLockPersonality=true\nRestrictRealtime=true\nCapabilityBoundingSet=\nAmbientCapabilities=\nRestrictAddressFamilies=AF_UNIX AF_INET\nIPAddressDeny=any\nIPAddressAllow=127.0.0.1/32\nReadWritePaths=${DATA_ROOT} ${SOCKET_ROOT}\nMemoryMax=768M\nTasksMax=96\nLimitNOFILE=4096\n[Install]\nWantedBy=multi-user.target\n`;
}

/** @param {string} namespace @param {string} runtimePassword @param {string} backupPassword */
function rolesSql(namespace, runtimePassword, backupPassword) {
    const n = names(namespace);
    profile(namespace, 'runtime', runtimePassword); profile(namespace, 'backup', backupPassword);
    return `SET password_encryption = 'scram-sha-256';\nDO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${n.owner}') THEN CREATE ROLE ${n.owner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${n.runtime}') THEN CREATE ROLE ${n.runtime} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${n.backup}') THEN CREATE ROLE ${n.backup} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF;
END $$;
REVOKE ALL ON DATABASE postgres, template0, template1 FROM PUBLIC;
ALTER ROLE ${n.runtime} PASSWORD '${runtimePassword}' CONNECTION LIMIT 8;
ALTER ROLE ${n.backup} PASSWORD '${backupPassword}' CONNECTION LIMIT 2;
SELECT 'CREATE DATABASE ${n.database} OWNER ${n.owner}' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${n.database}')\n\\gexec
REVOKE ALL ON DATABASE ${n.database} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${n.database} TO ${n.runtime}, ${n.backup};
ALTER ROLE ${n.runtime} IN DATABASE ${n.database} SET search_path = eos_history, pg_catalog;
ALTER ROLE ${n.backup} IN DATABASE ${n.database} SET search_path = eos_history, pg_catalog;
ALTER ROLE ${n.backup} IN DATABASE ${n.database} SET statement_timeout = '0';
ALTER ROLE ${n.backup} IN DATABASE ${n.database} SET default_transaction_read_only = on;
`;
}

/** @param {string} namespace */
function schemaSql(namespace) {
    const n = names(namespace);
    return `BEGIN;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS eos_history AUTHORIZATION ${n.owner};
SET LOCAL ROLE ${n.owner};
CREATE TABLE IF NOT EXISTS eos_history.samples (
id text NOT NULL CHECK (length(id) BETWEEN 1 AND 512),
ts bigint NOT NULL CHECK (ts >= 0),
value_type smallint NOT NULL CHECK (value_type IN (0,1,2)),
value_number double precision,
value_boolean boolean,
value_text text CHECK (length(value_text) <= 16384),
PRIMARY KEY (id, ts),
CHECK ((value_type=0 AND value_number IS NOT NULL AND value_boolean IS NULL AND value_text IS NULL)
OR (value_type=1 AND value_number IS NULL AND value_boolean IS NOT NULL AND value_text IS NULL)
OR (value_type=2 AND value_number IS NULL AND value_boolean IS NULL AND value_text IS NOT NULL)),
CHECK (value_number IS NULL OR (value_number > '-Infinity'::float8 AND value_number < 'Infinity'::float8))
);
REVOKE ALL ON SCHEMA eos_history FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA eos_history FROM PUBLIC;
GRANT USAGE ON SCHEMA eos_history TO ${n.runtime}, ${n.backup};
GRANT SELECT, INSERT, UPDATE ON eos_history.samples TO ${n.runtime};
GRANT SELECT ON eos_history.samples TO ${n.backup};
COMMIT;
`;
}

/** @param {string} file @param {boolean} [directory] */
async function trustedRootPath(file, directory = false) {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o022) !== 0 || (directory ? !stat.isDirectory() : !stat.isFile())) throw fail('UNTRUSTED_PATH');
    if (await fs.realpath(file) !== file) throw fail('UNTRUSTED_PATH');
    let parent = path.dirname(file);
    while (parent !== '/') {
        const ancestor = await fs.lstat(parent);
        if (!ancestor.isDirectory() || ancestor.isSymbolicLink() || ancestor.uid !== 0 || (ancestor.mode & 0o022) !== 0) throw fail('UNTRUSTED_PATH');
        parent = path.dirname(parent);
    }
}

/** @param {string} file */
async function trustedExecutable(file) {
    if (!PROGRAMS.has(file)) throw fail('PROGRAM_DENIED');
    const resolved = await fs.realpath(file);
    await trustedRootPath(resolved);
    const stat = await fs.stat(resolved);
    if (!(stat.mode & 0o111)) throw fail('PROGRAM_NOT_EXECUTABLE');
    return resolved;
}

/** @param {string} file @param {string[]} args @param {{input?:string,env?:Record<string,string>,uid?:number,gid?:number,allowFailure?:boolean,timeoutMs?:number,captureOutput?:boolean}} [options] */
async function run(file, args, options = {}) {
    const executable = await trustedExecutable(file);
    return await new Promise((resolve, reject) => {
        const child = spawn(executable, args, { shell: false, cwd: '/', detached: true,
            env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C', HOME: '/', ...options.env },
            stdio: ['pipe','pipe','pipe'], ...(options.uid !== undefined ? { uid: options.uid } : {}), ...(options.gid !== undefined ? { gid: options.gid } : {}) });
        let output = ''; let settled = false;
        function terminateGroup() {
            if (!child.pid) return;
            try { process.kill(-child.pid, 'SIGKILL'); }
            catch(error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH')) child.kill('SIGKILL'); }
        }
        const timer = setTimeout(() => { terminateGroup(); finish(fail('COMMAND_TIMEOUT')); }, options.timeoutMs || 120000);
        /** @param {Error|null} error @param {number|null} [code] */
        function finish(error, code = null) {
            if (settled) return; settled = true; clearTimeout(timer);
            if (error) reject(error); else if (code !== 0 && !options.allowFailure) reject(fail('COMMAND_FAILED')); else resolve({ output, code });
        }
        child.stdout.on('data', chunk => { if (options.captureOutput === false) return; output += chunk.toString(); if (output.length > 256*1024) { terminateGroup(); finish(fail('COMMAND_OUTPUT_LIMIT')); } });
        // Do not log command stderr: SQL failures can echo generated passwords.
        child.stderr.resume();
        child.on('error', () => finish(fail('COMMAND_FAILED')));
        child.on('close', code => finish(null, code));
        child.stdin.on('error', () => { terminateGroup(); finish(fail('COMMAND_INPUT_FAILED')); });
        child.stdin.end(options.input || '');
    });
}

/** @param {string} file @param {string} data @param {number} mode @param {number} gid @param {boolean} [replace] */
async function writeProtected(file, data, mode, gid, replace = false) {
    await trustedRootPath(path.dirname(file), true);
    if (replace) {
        try { await trustedRootPath(file); } catch (e) { if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')) throw e; }
    }
    const temporary = `${file}.${crypto.randomBytes(12).toString('hex')}.tmp`;
    const handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, mode);
    try { await handle.writeFile(data); await handle.chown(0,gid); await handle.chmod(mode); await handle.sync(); }
    finally { await handle.close(); }
    try {
        if (replace) await fs.rename(temporary,file);
        else { await fs.link(temporary,file); await fs.unlink(temporary); }
        const directory=await fs.open(path.dirname(file),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
        try { await directory.sync(); } finally { await directory.close(); }
    // Preserve the original publication failure; temporary names contain no
    // credentials, remain protected, and can be inspected during maintenance.
    } catch (error) { await fs.unlink(temporary).catch(() => {}); throw error; }
}

/** @param {string} directory @param {number} uid @param {number} gid @param {number} mode */
async function privateDirectory(directory, uid, gid, mode) {
    try { await fs.mkdir(directory, { mode }); await fs.chown(directory,uid,gid); }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error; }
    const stat=await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(directory)!==directory || stat.uid!==uid || stat.gid!==gid || (stat.mode&0o777)!==mode) throw fail('DIRECTORY_POLICY');
}

/** @param {string} name @param {'passwd'|'group'} database */
async function identity(name, database) {
    const result=await run('/usr/bin/getent',[database,name],{allowFailure:true});
    if (result.code!==0) return null;
    const fields=result.output.trim().split(':');
    const id=Number(fields[2]); if(!Number.isSafeInteger(id)||id<=0) throw fail('ACCOUNT_POLICY');
    return { id, fields };
}

async function portFree() {
    await new Promise((resolve,reject)=>{
        const server=net.createServer();
        server.once('error',()=>reject(fail('PORT_IN_USE')));
        server.listen(PORT,'127.0.0.1',()=>server.close(error=>error?reject(fail('PORT_CHECK')):resolve(undefined)));
    });
}

/** @param {string} os */
function packageSystemSupported(os) { return /^ID=debian$/m.test(os)&&/^VERSION_ID="?13"?$/m.test(os); }
/** @param {string} defaults */
function packageDefaultsSupported(defaults) { return /^\s*include_dir\s+'\/etc\/postgresql-common\/createcluster\.d'\s*$/m.test(defaults); }
/** @param {{dev:number,ino:number}} original @param {{dev:number,ino:number}} current @param {string} content */
function packagePolicyOwned(original,current,content) { return original.dev===current.dev&&original.ino===current.ino&&content===PACKAGE_OVERRIDE; }

/** Fixed distro package action, only reachable from the explicit root CLI flag. */
async function installPackages() {
    const os=await fs.readFile('/etc/os-release','utf8');
    if(!packageSystemSupported(os))throw fail('PACKAGE_OS_UNSUPPORTED');
    const security=['-o','Acquire::AllowInsecureRepositories=false','-o','APT::Get::AllowUnauthenticated=false','-o','Dpkg::Use-Pty=0','-o','Dpkg::Options::=--force-confold'];
    const options={env:{DEBIAN_FRONTEND:'noninteractive',UCF_FORCE_CONFFOLD:'1'},timeoutMs:600000,captureOutput:false};
    await run('/usr/bin/apt-get',[...security,'update'],options);
    const install=[...security,'--yes','--no-install-recommends','--no-upgrade','install'];
    await run('/usr/bin/apt-get',[...install,'postgresql-common'],options);
    const defaults='/etc/postgresql-common/createcluster.conf';
    const include='/etc/postgresql-common/createcluster.d';
    const override=`${include}/zz-nexowatt-bootstrap.conf`;
    await trustedRootPath(defaults);
    const defaultText=await fs.readFile(defaults,'utf8');
    if(!packageDefaultsSupported(defaultText))throw fail('PACKAGE_CLUSTER_POLICY_UNKNOWN');
    await trustedRootPath('/etc/postgresql-common',true);
    await privateDirectory(include,0,0,0o755);
    await writeProtected(override,PACKAGE_OVERRIDE,0o600,0);
    const original=await fs.lstat(override);
    /** @type {unknown} */
    let installationError;
    try { await run('/usr/bin/apt-get',[...install,'postgresql-17','postgresql-client-17','openssl'],options); }
    catch(error) { installationError=error; }
    await trustedRootPath(override);
    if(!packagePolicyOwned(original,await fs.lstat(override),await fs.readFile(override,'utf8')))throw fail('PACKAGE_POLICY_CHANGED');
    await fs.unlink(override);
    if(installationError!==undefined)throw installationError;
}

/** @param {string} namespace @param {{installPackages?:boolean}} [options] */
async function provisionUnlocked(namespace, options={}) {
    instanceNumber(namespace);
    if (process.platform!=='linux' || process.getuid?.()!==0) throw fail('ADMIN_BOOTSTRAP_REQUIRED');
    await trustedRootPath(await fs.realpath(__filename));
    for (const dir of ['/etc','/etc/systemd','/etc/systemd/system','/var','/var/lib']) await trustedRootPath(dir,true);
    await fs.access('/run/systemd/system');
    const eosGroup=await identity('iobroker','group'); if(!eosGroup) throw fail('IOBROKER_GROUP_MISSING');
    let existing=false;
    try { await fs.lstat(SERVER_ROOT); existing=true; } catch(e) { if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e; }
    if(existing) {
        await trustedRootPath(SERVER_ROOT,true);
        await trustedRootPath(`${SERVER_ROOT}/managed.json`);
        const marker=JSON.parse(await fs.readFile(`${SERVER_ROOT}/managed.json`,'utf8'));
        if(marker.schemaVersion!==1||marker.major!==17||marker.port!==PORT||marker.service!==SERVICE)throw fail('UNMANAGED_CLUSTER');
        for (const required of [`${DATA_ROOT}/data/PG_VERSION`, `${SERVER_ROOT}/postgresql.conf`, `${SERVER_ROOT}/pg_hba.conf`, `${SERVER_ROOT}/server.key`, `${SERVER_ROOT}/server.crt`, `${CLIENT_ROOT}/ca.crt`, SERVICE_FILE]) {
            try { await fs.lstat(required); }
            catch(error) { if(error && typeof error==='object' && 'code' in error && error.code==='ENOENT')throw fail('INCOMPLETE_BOOTSTRAP'); throw error; }
        }
    } else {
        for(const target of [DATA_ROOT,SERVICE_FILE]) {
            try { await fs.lstat(target); throw fail('UNMANAGED_CLUSTER'); } catch(e) { if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e; }
        }
        await portFree();
        const unit=await run('/usr/bin/systemctl',['show','--property=FragmentPath','--value',SERVICE],{allowFailure:true});
        if(unit.output.trim())throw fail('UNMANAGED_SERVICE');
    }
    const dropIns=await run('/usr/bin/systemctl',['show','--property=DropInPaths','--value',SERVICE],{allowFailure:true});
    if(dropIns.output.trim())throw fail('MANAGED_CONFIGURATION_CHANGED');
    let account=await identity(SERVICE_USER,'passwd');
    if(account&&!existing)throw fail('UNMANAGED_ACCOUNT');
    if(options.installPackages)await installPackages();
    for(const exe of [`${PG_BIN}/initdb`,`${PG_BIN}/postgres`,`${PG_BIN}/psql`,'/usr/bin/openssl']) await trustedExecutable(exe);
    const serverVersion=await run(`${PG_BIN}/postgres`,['--version']);
    if(!/PostgreSQL\) 17\./.test(serverVersion.output)) throw fail('VERSION_UNSUPPORTED');
    if(!account) {
        await run('/usr/sbin/useradd',['--system','--user-group','--home-dir',DATA_ROOT,'--no-create-home','--shell','/usr/sbin/nologin',SERVICE_USER]);
        account=await identity(SERVICE_USER,'passwd');
    }
    if(!account||account.fields[5]!==DATA_ROOT||account.fields[6]!=='/usr/sbin/nologin')throw fail('ACCOUNT_POLICY');
    const pgGroup=await identity(SERVICE_USER,'group'); if(!pgGroup)throw fail('ACCOUNT_POLICY');
    const uid=account.id, gid=pgGroup.id;
    await privateDirectory(SERVER_ROOT,0,gid,0o750);
    if(!existing) await writeProtected(`${SERVER_ROOT}/managed.json`,JSON.stringify({schemaVersion:1,major:17,port:PORT,service:SERVICE})+'\n',0o640,gid);
    await privateDirectory(DATA_ROOT,uid,gid,0o700);
    // Existing EOS parent is allowed with tighter modes; never widen it.
    try { await fs.mkdir('/etc/nexowatt-eos',{mode:0o750}); await fs.chown('/etc/nexowatt-eos',0,eosGroup.id); }
    catch(e) { if(!(e&&typeof e==='object'&&'code'in e&&e.code==='EEXIST'))throw e; }
    await trustedRootPath('/etc/nexowatt-eos',true);
    const parent=await fs.stat('/etc/nexowatt-eos');
    if (!(parent.mode&0o001) && !(parent.gid===eosGroup.id&&(parent.mode&0o010)))throw fail('EOS_DIRECTORY_NOT_TRAVERSABLE');
    await privateDirectory(CLIENT_ROOT,0,eosGroup.id,0o750);
    const pending=`${CLIENT_ROOT}/pending-${namespace}.json`;
    const runtimeFile=`${CLIENT_ROOT}/client-${namespace}.json`, backupFile=`${CLIENT_ROOT}/backup-${namespace}.json`;
    const readyFile=`${CLIENT_ROOT}/ready-${namespace}.json`;
    // A failed repeated bootstrap must not leave an old readiness certificate.
    try { await trustedRootPath(readyFile); await fs.unlink(readyFile); }
    catch(e) { if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e; }
    /** @type {{runtime:string,backup:string}} */
    let passwords;
    try {
        await trustedRootPath(pending);
        passwords=JSON.parse(await fs.readFile(pending,'utf8'));
        profile(namespace,'runtime',passwords.runtime); profile(namespace,'backup',passwords.backup);
    } catch(e) {
        if(!(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT'))throw e;
        const present=await Promise.all([runtimeFile,backupFile].map(async file=>{
            try { await trustedRootPath(file); return true; }
            catch(error) { if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return false; throw error; }
        }));
        if(present[0]!==present[1])throw fail('PROFILE_PARTIAL');
        try {
            await trustedRootPath(runtimeFile); await trustedRootPath(backupFile);
            const r=JSON.parse(await fs.readFile(runtimeFile,'utf8')),b=JSON.parse(await fs.readFile(backupFile,'utf8'));
            passwords={runtime:r.password,backup:b.password};
            if(JSON.stringify(profile(namespace,'runtime',r.password))!==JSON.stringify(r)||JSON.stringify(profile(namespace,'backup',b.password))!==JSON.stringify(b))throw fail('PROFILE_CONFLICT');
        } catch(err) {
            if(!(err&&typeof err==='object'&&'code'in err&&err.code==='ENOENT'))throw err;
            passwords={runtime:crypto.randomBytes(32).toString('hex'),backup:crypto.randomBytes(32).toString('hex')};
            await writeProtected(pending,JSON.stringify(passwords)+'\n',0o600,0);
        }
    }
    if(!existing) {
        await run(`${PG_BIN}/initdb`,['-D',`${DATA_ROOT}/data`,'--auth-local=peer','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C.UTF-8'],{uid,gid});
        await run('/usr/bin/openssl',['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',`${SERVER_ROOT}/ca.key`,'-out',`${CLIENT_ROOT}/ca.crt`,'-days','3650','-subj','/CN=NexoWatt local PostgreSQL CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
        await fs.chown(`${SERVER_ROOT}/ca.key`,0,0); await fs.chmod(`${SERVER_ROOT}/ca.key`,0o600);
        await fs.chown(`${CLIENT_ROOT}/ca.crt`,0,eosGroup.id); await fs.chmod(`${CLIENT_ROOT}/ca.crt`,0o640);
        await run('/usr/bin/openssl',['req','-new','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',`${SERVER_ROOT}/server.key`,'-out',`${SERVER_ROOT}/server.csr`,'-subj','/CN=localhost']);
        await writeProtected(`${SERVER_ROOT}/server.ext`,'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n',0o640,gid);
        await run('/usr/bin/openssl',['x509','-req','-in',`${SERVER_ROOT}/server.csr`,'-CA',`${CLIENT_ROOT}/ca.crt`,'-CAkey',`${SERVER_ROOT}/ca.key`,'-set_serial',`0x${crypto.randomBytes(16).toString('hex')}`,'-out',`${SERVER_ROOT}/server.crt`,'-days','825','-sha256','-extfile',`${SERVER_ROOT}/server.ext`]);
        for(const f of ['server.key','server.crt']) { await fs.chown(`${SERVER_ROOT}/${f}`,0,gid);await fs.chmod(`${SERVER_ROOT}/${f}`,0o640); }
        await writeProtected(`${SERVER_ROOT}/postgresql.conf`,postgresConfig(),0o640,gid);
        await writeProtected(`${SERVER_ROOT}/pg_hba.conf`,hbaConfig(),0o640,gid);
        await writeProtected(`${SERVER_ROOT}/pg_ident.conf`,'# No additional user mappings.\n',0o640,gid);
        await writeProtected(SERVICE_FILE,serviceConfig(),0o644,0);
        await run('/usr/bin/systemctl',['daemon-reload']);
        await run('/usr/bin/systemctl',['enable','--now',SERVICE]);
    } else {
        for(const [f,want] of /** @type {const} */ ([[`${SERVER_ROOT}/postgresql.conf`,postgresConfig()],[`${SERVER_ROOT}/pg_hba.conf`,hbaConfig()],[SERVICE_FILE,serviceConfig()]])) {
            await trustedRootPath(f); if(await fs.readFile(f,'utf8')!==want)throw fail('MANAGED_CONFIGURATION_CHANGED');
        }
        await run('/usr/bin/systemctl',['start',SERVICE]);
    }
    // Wait is bounded and used only during explicitly invoked system setup.
    const psql=['--no-psqlrc','--no-password','--set','ON_ERROR_STOP=1','--host',SOCKET_ROOT,'--port',String(PORT),'--username',SERVICE_USER];
    let online=false;
    for(let i=0;i<20;i++) {
        const r=await run(`${PG_BIN}/psql`,[...psql,'--dbname','postgres','--tuples-only','--command','SELECT 1'],{uid,gid,allowFailure:true});
        if(r.code===0){online=true;break;}
        await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!online)throw fail('SERVER_NOT_READY');
    const serverPolicy=await run(`${PG_BIN}/psql`,[...psql,'--dbname','postgres','--tuples-only','--no-align','--command',"SELECT current_setting('listen_addresses')='127.0.0.1' AND current_setting('port')='55432' AND current_setting('ssl')='on' AND current_setting('ssl_min_protocol_version')='TLSv1.3' AND current_setting('password_encryption')='scram-sha-256'"],{uid,gid});
    if(serverPolicy.output.trim()!=='t')throw fail('SERVER_POLICY_CHANGED');
    await run(`${PG_BIN}/psql`,[...psql,'--dbname','postgres'],{uid,gid,input:rolesSql(namespace,passwords.runtime,passwords.backup)});
    await run(`${PG_BIN}/psql`,[...psql,'--dbname',names(namespace).database],{uid,gid,input:schemaSql(namespace)});
    for(const purpose of /** @type {const} */ (['runtime','backup'])) {
        const cfg=profile(namespace,purpose,passwords[purpose]);
        const test=await run(`${PG_BIN}/psql`,['--no-psqlrc','--no-password','--host',cfg.host,'--port',String(PORT),'--username',cfg.user,'--dbname',cfg.database,'--tuples-only','--no-align','--command',`SELECT ssl AND NOT (SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user) AND NOT has_schema_privilege(current_user,'eos_history','CREATE') FROM pg_stat_ssl WHERE pid=pg_backend_pid()`],{env:{PGPASSWORD:cfg.password,PGSSLMODE:'verify-full',PGSSLROOTCERT:cfg.caFile,PGCONNECT_TIMEOUT:'5'}});
        if(test.output.trim()!=='t')throw fail('TLS_OR_PRIVILEGE_CHECK');
    }
    await writeProtected(runtimeFile,JSON.stringify(profile(namespace,'runtime',passwords.runtime))+'\n',0o640,eosGroup.id,true);
    await writeProtected(backupFile,JSON.stringify(profile(namespace,'backup',passwords.backup))+'\n',0o640,eosGroup.id,true);
    await writeProtected(readyFile,JSON.stringify({schemaVersion:1,namespace,provider:'postgresql',newInstallation:true,provisioned:true,major:17,port:PORT,schemaRevision:1,verifiedAt:Date.now(),serverVersion:serverVersion.output.trim()})+'\n',0o640,eosGroup.id,true);
    await fs.unlink(pending).catch(e=>{if(!e||e.code!=='ENOENT')throw e;});
    return { status:'ready', namespace, host:'127.0.0.1', port:PORT, database:names(namespace).database, credentialsExposed:false };
}

/** @param {string} namespace @param {{installPackages?:boolean}} [options] */
async function provision(namespace,options={}) {
    instanceNumber(namespace);
    if(process.platform!=='linux'||process.getuid?.()!==0)throw fail('ADMIN_BOOTSTRAP_REQUIRED');
    await trustedRootPath('/run',true);
    const lock='/run/nexowatt-postgresql-setup.lock';
    let handle;
    try { handle=await fs.open(lock,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600); }
    catch(error) { if(error&&typeof error==='object'&&'code' in error&&error.code==='EEXIST')throw fail('BUSY_OR_INTERRUPTED'); throw error; }
    const original=await handle.stat();
    try { await handle.writeFile(String(process.pid)+'\n'); return await provisionUnlocked(namespace,options); }
    finally {
        await handle.close();
        const current=await fs.lstat(lock);
        if(current.uid===0&&current.dev===original.dev&&current.ino===original.ino&&!current.isSymbolicLink())await fs.unlink(lock);
    }
}

async function main() {
    const [action,namespace,...rest]=process.argv.slice(2);
    if(rest.length>1 || (rest.length===1&&rest[0]!=='--install-packages') || !namespace || (action!=='--plan' && action!=='--new-site'))throw fail('USAGE');
    instanceNumber(namespace);
    if(action==='--plan') {
        console.log(JSON.stringify({schemaVersion:1,namespace,requiresAdministratorBootstrap:true,packagePrerequisites:['postgresql-17','postgresql-client-17','openssl'],installsPackages:rest.length===1,service:SERVICE,serviceUser:SERVICE_USER,host:'127.0.0.1',port:PORT,...names(namespace),clientProfile:`${CLIENT_ROOT}/client-${namespace}.json`,existingInfluxChanged:false},null,2));
    } else {
        process.umask(0o077);
        console.log(JSON.stringify(await provision(namespace,{installPackages:rest.length===1})));
    }
}

module.exports={instanceNumber,names,profile,postgresConfig,hbaConfig,serviceConfig,rolesSql,schemaSql,provision,packageSystemSupported,packageDefaultsSupported,packagePolicyOwned};
if(require.main===module)main().catch(error=>{const code=error instanceof Error&&/^EOS_POSTGRES_SETUP_[A-Z_]+$/.test(error.message)?error.message:'EOS_POSTGRES_SETUP_FAILED';console.error(code);process.exitCode=1;});
