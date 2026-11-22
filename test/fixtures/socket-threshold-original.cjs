'use strict';
// Isolated original-library reproducer. A rejected async timer must terminate this child.
require('./socket-library-bootstrap.cjs');
const { SocketAdmin } = require('@iobroker/socket-classes');
const adapter = {
    name: 'eos-admin', config: { thresholdValue: 200 },
    log: { info() {}, error() {}, debug() {}, warn() {} },
    getForeignObjectAsync: async () => null,
    subscribeForeignStatesAsync: async () => undefined,
    unsubscribeForeignStatesAsync: async () => undefined,
};
const socket = new SocketAdmin({ language: 'de', ttl: 3600 }, adapter, {});
// Shorten only the reproduction clock; production defaults are asserted in the positive test.
socket.commands.eventsThreshold.checkInterval = 10;
socket.commands.start(() => undefined);
setInterval(() => {
    for (let index = 0; index < 201; index++) socket.stateChange('fixture.event', null);
}, 5);
setTimeout(() => { socket.close(); process.exit(0); }, 2000);
