'use strict';
// Test-environment preload only. Never installed or imported by product runtime.
// Normal interface enumeration is preserved; only the executor's exact denied
// uv_interface_addresses operation receives a synthetic loopback-only fixture.
if (process.env.EOS_TEST_NETWORK_FIXTURE !== 'loopback') {
    throw new Error('Explicit EOS_TEST_NETWORK_FIXTURE=loopback is required');
}
const os = require('node:os');
const original = os.networkInterfaces;
let reported = false;
os.networkInterfaces = function () {
    try {
        return original.apply(this, arguments);
    } catch (error) {
        const syscall = error?.syscall || error?.info?.syscall;
        const errno = error?.errno ?? error?.info?.errno;
        const denied = error?.code === 'EPERM' ||
            (error?.code === 'ERR_SYSTEM_ERROR' && (errno === 1 || errno === -1));
        if (syscall !== 'uv_interface_addresses' || !denied) throw error;
        if (!reported) {
            process.stderr.write('[EOS integration environment] denied interface enumeration: synthetic IPv4/IPv6 loopback only\n');
            reported = true;
        }
        // Locally administered synthetic identity avoids the controller's
        // ifconfig/ip-link fallback. This does not describe a customer device.
        const mac = '02:00:00:00:00:01';
        return { lo: [
            { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac, internal: true, cidr: '127.0.0.1/8' },
            { address: '::1', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', mac, internal: true, cidr: '::1/128', scopeid: 0 },
        ] };
    }
};
require('node:module').syncBuiltinESMExports();

// Existing reviewed test-only egress guard: real installed-adapter sockets are
// confined to loopback. The npm installer and controller setup are not mocked.
const { isInstalledAdapter, installLoopbackEgress } = require('../source-917/iobroker.eos-admin/test/fixtures/loopback-egress.cjs');
if (isInstalledAdapter(process.argv, process.cwd())) {
    installLoopbackEgress({
        http: require('node:http'), https: require('node:https'),
        net: require('node:net'), tls: require('node:tls'), dns: require('node:dns'),
    });
}
