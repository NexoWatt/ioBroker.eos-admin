/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
import { createRequire } from 'node:module';
import { isAbsolute, join, resolve } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { createEosUiProcess, type ProcessOptions, type UiProcessRuntime } from './eosUiProcess';

const runtimeRequire = createRequire(__filename);

interface SplitRuntime extends UiProcessRuntime {
    startEms(): Promise<void>;
    pauseEms(): Promise<void>;
    resumeEms(): Promise<void>;
}

/** The presentation process serves frontend requests without acquiring a controller write or subscription lease. */
export function createEosSplitRuntime(
    owner: Parameters<typeof createEosUiProcess>[0],
    bridge: Parameters<typeof createEosUiProcess>[1],
    options: ProcessOptions,
): SplitRuntime {
    const baseDir = isAbsolute(options.baseDir) ? options.baseDir : resolve(options.baseDir);
    const presentationPath = join(baseDir, 'ui', 'lib', 'eos-presentation.js');
    const routes = runtimeRequire(join(baseDir, 'ui', 'lib', 'eos-presentation-routes.js')) as {
        isPresentationRequest(method: string, url: string): boolean;
    };
    const ui = createEosUiProcess(owner, bridge, {
        ...options,
        baseDir,
        runtimePath: presentationPath,
        presentationOnly: true,
    });
    const ems = createEosUiProcess(owner, bridge, { ...options, baseDir });

    return {
        start: () => ui.start(),
        startEms: () => ems.start(),
        startOperational: () => ems.startOperational(),
        pause: () => ui.pause(),
        resume: () => ui.resume(),
        pauseEms: () => ems.pause(),
        resumeEms: () => ems.resume(),
        async stop(): Promise<void> {
            // Both fences are raised immediately, then wait for both stop confirmations.
            const stopped = await Promise.allSettled([ui.stop(), ems.stop()]);
            const failure = stopped.find(result => result.status === 'rejected');
            if (failure?.status === 'rejected') {
                throw failure.reason;
            }
        },
        status(): Record<string, unknown> {
            const uiStatus = ui.status();
            const emsStatus = ems.status();
            // Legacy migration checks the top-level readiness, error and write authority.
            return { ...emsStatus, active: uiStatus.active, process: uiStatus.process, ui: uiStatus, ems: emsStatus };
        },
        getHistoryBackupRequirement: () => ems.getHistoryBackupRequirement(),
        reconcileDeviceEms: (devices: unknown[]) => ems.reconcileDeviceEms(devices),
        reserveDeviceProfileChange: (change: unknown) => ems.reserveDeviceProfileChange(change),
        onHostedEebusMessage: (message: unknown) => ems.onHostedEebusMessage(message),
        onStateChange: (id: string, state: unknown) => ems.onStateChange(id, state),
        onObjectChange: (id: string, object: unknown) => ems.onObjectChange(id, object),
        onMessage: (message: unknown) => ems.onMessage(message),
        revokeSessions(): void {
            ui.revokeSessions();
            ems.revokeSessions();
        },
        handle(req: Request, res: Response, next: NextFunction): void {
            // Business APIs stay on the single state owner, including independently authenticated peer/device requests.
            const destination = routes.isPresentationRequest(req.method, req.url) ? ui : ems;
            destination.handle(req, res, next);
        },
    };
}
