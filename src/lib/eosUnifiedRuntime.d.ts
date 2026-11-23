import type { Request, Response, NextFunction } from 'express';
export interface EosHostedRuntime {
    /** Build the request router only; device/EMS startup is explicitly separate. */
    start(): Promise<void>;
    startOperational(): Promise<void>;
    handle(req: Request, res: Response, next: NextFunction): void;
    stop(): Promise<void>;
    revokeSessions?(): void;
    onStateChange?(id: string, state: ioBroker.State | null | undefined): void;
    onObjectChange?(id: string, object: ioBroker.Object | null | undefined): void;
    onMessage?(message: ioBroker.Message): boolean | void;
    onHostedEebusMessage?(message: { from: string; command: string; message: unknown }): Promise<unknown>;
}
