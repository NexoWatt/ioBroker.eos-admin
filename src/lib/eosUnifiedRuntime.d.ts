import type { Request, Response, NextFunction } from 'express';
export interface EosHostedRuntime {
    start(): Promise<void>;
    handle(req: Request, res: Response, next: NextFunction): void;
    stop(): Promise<void>;
    revokeSessions?(): void;
    onStateChange?(id: string, state: ioBroker.State | null | undefined): void;
    onObjectChange?(id: string, object: ioBroker.Object | null | undefined): void;
    onMessage?(message: ioBroker.Message): boolean | void;
}
