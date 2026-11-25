'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const setup = require('../tools/system/eos-postgresql-setup.cjs');

function loadStatus() {
    const file = path.resolve(__dirname, '../src/lib/eosPostgresProvisioning.ts');
    const built = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loaded = new Module(file, module); loaded.filename = file; loaded.paths = Module._nodeModulePaths(path.dirname(file));
    loaded._compile(built, file); return loaded.exports;
}

const statusModule = loadStatus();
const fixturePassword = () => require('node:crypto').randomBytes(32).toString('hex');
function fixture() {
    const namespace = 'eos-admin.0';
    return { namespace, ready: { schemaVersion: 1, namespace, provider: 'postgresql', newInstallation: true, provisioned: true,
        major: 17, port: 55432, schemaRevision: 1, verifiedAt: Date.now(), serverVersion: 'postgres (PostgreSQL) 17.12 (Debian 17.12-0+deb13u1)' },
        runtime: setup.profile(namespace, 'runtime', fixturePassword()), backup: setup.profile(namespace, 'backup', fixturePassword()) };
}

test('namespace and SQL identifier derivation reject injection and aliases', () => {
    assert.equal(setup.instanceNumber('eos-admin.0'), 0);
    assert.equal(setup.names('eos-admin.12').database, 'eos_history_12');
    for (const input of ['eos-admin.00','eos-admin.-1','nexowatt-ui.0','eos-admin.10000','eos-admin.0; DROP DATABASE postgres','../eos-admin.0']) assert.throws(() => setup.instanceNumber(input));
});

test('local TLS-only policy rejects cleartext and non-maintenance Unix socket', () => {
    const conf = setup.postgresConfig(), hba = setup.hbaConfig();
    assert.match(conf, /listen_addresses = '127\.0\.0\.1'/);
    assert.match(conf, /ssl = on/); assert.match(conf, /ssl_min_protocol_version = 'TLSv1\.3'/);
    assert.ok(hba.indexOf('hostnossl all all 0.0.0.0/0 reject') < hba.indexOf('hostssl'));
    assert.match(hba, /local all nexowatt-pg peer\nlocal all all reject/);
    assert.doesNotMatch(hba, /\btrust\s*$/m);
});

test('unprivileged service and independent data paths avoid existing PostgreSQL', () => {
    const unit = setup.serviceConfig();
    assert.match(unit,/User=nexowatt-pg/); assert.match(unit,/NoNewPrivileges=true/);
    assert.match(unit,/ProtectSystem=strict/); assert.match(unit,/CapabilityBoundingSet=\n/);
    assert.match(unit,/IPAddressDeny=any/); assert.match(unit,/IPAddressAllow=127\.0\.0\.1\/32/);
    assert.doesNotMatch(unit,/sudo|docker|\/var\/lib\/postgresql|:5432/);
});

test('role grants separate runtime and backup and prohibit DDL for both', () => {
    const sql = setup.schemaSql('eos-admin.4');
    assert.match(sql,/GRANT SELECT, INSERT, UPDATE ON eos_history.samples TO eos_history_4_runtime/);
    assert.match(sql,/GRANT SELECT ON eos_history.samples TO eos_history_4_backup/);
    assert.doesNotMatch(sql,/GRANT (ALL|CREATE|DELETE)/);
    assert.match(sql,/SET LOCAL ROLE eos_history_4_owner/);
    assert.match(sql,/PRIMARY KEY \(id, ts\)/);
    assert.match(sql,/value_number < 'Infinity'/);
    assert.match(setup.rolesSql('eos-admin.4',fixturePassword(),fixturePassword()),/REVOKE ALL ON DATABASE postgres, template0, template1 FROM PUBLIC/);
    assert.throws(()=>setup.rolesSql('eos-admin.0',"'bad",fixturePassword()));
});

test('protected provisioning contract requires explicit new-site and both credentials', () => {
    const f = fixture();
    const valid = (r=f.ready,p=f.runtime,b=f.backup)=>statusModule.validateEosPostgresProvisioningDocuments(f.namespace,r,p,b);
    assert.equal(valid(),true);
    assert.equal(valid({...f.ready,newInstallation:false}),false);
    assert.equal(valid(f.ready,{...f.runtime,host:'192.168.1.2'}),false);
    assert.equal(valid(f.ready,{...f.runtime,servername:'attacker'}),false);
    assert.equal(valid(f.ready,{...f.runtime,caFile:'/tmp/ca.crt'}),false);
    assert.equal(valid(f.ready,f.runtime,{...f.backup,user:f.runtime.user}),false);
    assert.equal(valid(f.ready,{...f.runtime,ssl:false}),false);
    assert.equal(valid({...f.ready,verifiedAt:Date.now()+3600000}),false);
});

test('plan mode is read-only and exposes no generated credential', () => {
    const script = path.resolve(__dirname,'../tools/system/eos-postgresql-setup.cjs');
    const result = spawnSync(process.execPath,[script,'--plan','eos-admin.0'],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const plan=JSON.parse(result.stdout);
    assert.equal(plan.existingInfluxChanged,false);
    assert.equal(plan.installsPackages,false);
    assert.equal(plan.requiresAdministratorBootstrap,true);
    assert.doesNotMatch(result.stdout, /"password"|"token"|BEGIN.*PRIVATE KEY/);
});

test('regular adapter user cannot bootstrap or elevate its privileges', {skip:process.getuid?.()===0}, async () => {
    await assert.rejects(setup.provision('eos-admin.0'),/ADMIN_BOOTSTRAP_REQUIRED/);
    await assert.rejects(setup.provision('eos-admin.0',{installPackages:true}),/ADMIN_BOOTSTRAP_REQUIRED/);
});

test('package bootstrap rejects unsupported OS and unknown cluster policy', () => {
    assert.equal(setup.packageSystemSupported('ID=debian\nVERSION_ID="13"\n'),true);
    for(const os of ['ID=ubuntu\nVERSION_ID="13"\n','ID=debian\nVERSION_ID="12"\n','ID=debian\nVERSION_ID="13;evil"\n']) assert.equal(setup.packageSystemSupported(os),false);
    assert.equal(setup.packageDefaultsSupported("# default policy\ninclude_dir '/etc/postgresql-common/createcluster.d'\n"),true);
    assert.equal(setup.packageDefaultsSupported("# include_dir '/etc/postgresql-common/createcluster.d'\n"),false);
    assert.equal(setup.packageDefaultsSupported("include_dir '/tmp/other'\n"),false);
});

test('temporary package policy cleanup cannot remove replaced or edited administrator file', () => {
    const content='# Temporary EOS bootstrap override; removed after package transaction.\ncreate_main_cluster = false\n';
    const identity={dev:8,ino:240};
    assert.equal(setup.packagePolicyOwned(identity,{...identity},content),true);
    assert.equal(setup.packagePolicyOwned(identity,{dev:8,ino:241},content),false);
    assert.equal(setup.packagePolicyOwned(identity,{...identity},content+'# operator edit\n'),false);
});

test('missing or invalid prerequisite reports no database connection success or credentials', async () => {
    const result=await statusModule.getEosPostgresProvisioningStatus('eos-admin.9999');
    assert.notEqual(result.status,'configured');
    assert.equal(result.connectionVerified,false);
    assert.equal(result.administratorBootstrapRequired,true);
    assert.doesNotMatch(JSON.stringify(result),/password|token|PRIVATE KEY/);
});
