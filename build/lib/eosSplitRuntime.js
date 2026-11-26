"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEosSplitRuntime = createEosSplitRuntime;
/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
const node_module_1 = require("node:module");
const node_path_1 = require("node:path");
const eosUiProcess_1 = require("./eosUiProcess");
const runtimeRequire = (0, node_module_1.createRequire)(__filename);
/** The presentation process serves frontend requests without acquiring a controller write or subscription lease. */
function createEosSplitRuntime(owner, bridge, options) {
    const baseDir = (0, node_path_1.isAbsolute)(options.baseDir) ? options.baseDir : (0, node_path_1.resolve)(options.baseDir);
    const presentationPath = (0, node_path_1.join)(baseDir, 'ui', 'lib', 'eos-presentation.js');
    const routes = runtimeRequire((0, node_path_1.join)(baseDir, 'ui', 'lib', 'eos-presentation-routes.js'));
    const ui = (0, eosUiProcess_1.createEosUiProcess)(owner, bridge, {
        ...options,
        baseDir,
        runtimePath: presentationPath,
        presentationOnly: true,
    });
    const ems = (0, eosUiProcess_1.createEosUiProcess)(owner, bridge, { ...options, baseDir });
    return {
        start: () => ui.start(),
        startEms: () => ems.start(),
        startOperational: () => ems.startOperational(),
        pause: () => ui.pause(),
        resume: () => ui.resume(),
        pauseEms: () => ems.pause(),
        resumeEms: () => ems.resume(),
        async stop() {
            // Both fences are raised immediately, then wait for both stop confirmations.
            const stopped = await Promise.allSettled([ui.stop(), ems.stop()]);
            const failure = stopped.find(result => result.status === 'rejected');
            if (failure?.status === 'rejected') {
                throw failure.reason;
            }
        },
        status() {
            const uiStatus = ui.status();
            const emsStatus = ems.status();
            // Legacy migration checks the top-level readiness, error and write authority.
            return { ...emsStatus, active: uiStatus.active, process: uiStatus.process, ui: uiStatus, ems: emsStatus };
        },
        getHistoryBackupRequirement: () => ems.getHistoryBackupRequirement(),
        reconcileDeviceEms: (devices) => ems.reconcileDeviceEms(devices),
        reserveDeviceProfileChange: (change) => ems.reserveDeviceProfileChange(change),
        onHostedEebusMessage: (message) => ems.onHostedEebusMessage(message),
        onStateChange: (id, state) => ems.onStateChange(id, state),
        onObjectChange: (id, object) => ems.onObjectChange(id, object),
        onMessage: (message) => ems.onMessage(message),
        revokeSessions() {
            ui.revokeSessions();
            ems.revokeSessions();
        },
        handle(req, res, next) {
            // Business APIs stay on the single state owner, including independently authenticated peer/device requests.
            const destination = routes.isPresentationRequest(req.method, req.url) ? ui : ems;
            destination.handle(req, res, next);
        },
    };
}
//# sourceMappingURL=eosSplitRuntime.js.map