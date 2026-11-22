'use strict';
// Only replace adapter-core's controller discovery in isolated library tests.
// SocketAdmin/SocketCommandsAdmin, ACL dispatch and subscription methods stay real.
// The integration suite exercises the actual controller and pattern implementation.
const resolved = require.resolve('@iobroker/adapter-core');
require.cache[resolved] = {
    id: resolved, filename: resolved, loaded: true,
    exports: { commonTools: { pattern2RegEx: pattern => `^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$` } },
};
