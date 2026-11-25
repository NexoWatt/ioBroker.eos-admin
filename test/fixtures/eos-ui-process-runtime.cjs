'use strict';
/** Deliberately small adapter fixture; it runs in the actual OS child and uses the actual IPC owner. */
exports.createHostedRuntime = (owner, bridge) => {
  let ready = false;
  let last = null;
  const streams = new Set();
  const json = (res, value, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); };
  return {
    async start() { await owner.subscribeForeignStatesAsync('device.0.*'); last = await owner.getForeignStateAsync('device.0.power'); },
    async startOperational() { ready = bridge.canWrite(); },
    async stop() { for (const res of streams) res.end(); await owner.unsubscribeForeignStatesAsync('device.0.*'); },
    status() { return { state: ready ? 'ready' : 'idle', emsReady: ready, active: true, canWrite: bridge.canWrite() }; },
    getHistoryBackupRequirement() { return { provider: 'adapter', instance: 'history.0' }; },
    async reserveDeviceProfileChange() { return () => {}; },
    async reconcileDeviceEms() { return { last, pid: process.pid }; },
    async onHostedEebusMessage(value) { return value; },
    onMessage() { return false; },
    onStateChange(id, state) { last = { id, state }; },
    onObjectChange(id, object) { last = { id, object }; },
    revokeSessions() { for (const res of streams) res.end(); },
    handle(req, res, next) {
      if (req.url === '/identity') { void bridge.resolveAccess(req).then(access => json(res, { access, pid: process.pid, originAllowed: bridge.originAllowed(req), remote: req.socket.remoteAddress })); return; }
      if (req.url === '/state') { json(res, last); return; }
      if (req.url === '/write') { void owner.setForeignStateAsync('device.0.setpoint', { val: 10, ack: false }).then(() => json(res, { ok: true }), error => json(res, { error: error.message }, 503)); return; }
      if (req.url === '/forbidden') { json(res, { canSendToHost: typeof owner.sendToHost === 'function', canExec: typeof owner.exec === 'function' }); return; }
      if (req.url === '/busy') { const until = Date.now() + 9000; while (Date.now() < until) {} json(res, { finished: true }); return; }
      if (req.url === '/crash') { process.exit(70); }
      if (req.url === '/echo') { const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => res.end(Buffer.concat(chunks))); return; }
      if (req.url === '/events') { streams.add(res); res.setHeader('content-type', 'text/event-stream'); res.write('data: connected\n\n'); const timer = setInterval(() => res.write('data: alive\n\n'), 50); res.once('close', () => { clearInterval(timer); streams.delete(res); }); return; }
      next();
    },
  };
};
