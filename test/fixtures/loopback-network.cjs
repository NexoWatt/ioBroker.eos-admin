'use strict';
// Optional test-environment fixture only; never part of the installed runtime.
// The isolated executor denies interface enumeration (uv_interface_addresses).
// Real TCP/HTTP sockets still use loopback. No production code imports this file.
if (process.env.EOS_TEST_NETWORK_FIXTURE !== 'loopback') {
    throw new Error('Explicit EOS_TEST_NETWORK_FIXTURE=loopback is required');
}
const os = require('node:os');
os.networkInterfaces = () => ({
    lo: [{address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4',
        // Synthetic locally administered MAC prevents the controller's OS CLI fallback.
        mac: '02:00:00:00:00:01', internal: true, cidr: '127.0.0.1/8'}],
});
