import type { EventEmitter } from 'node:events';
export interface RuntimeEntry {
  client: unknown; socketConnected: boolean; proto: string; rawIdentity: string;
  connectedAt: number; lastHeartbeatAt: number; heartbeatIntervalSec: number; lastMessageAt: number; lastPowerAt: number; safeZeroAt: number; chargingState: string;
  [key: string]: unknown;
}
export interface OcppRuntime extends EventEmitter {
  namespace: string; config: Record<string, unknown>;
  server: { close(): Promise<void> } | null;
  runtimeIndex: Map<string, RuntimeEntry>;
  _eosLeases: Map<string, { armed: boolean; active: boolean; stopRequired: boolean; untilMs: number }>;
  onReady(): Promise<void>;
  onUnload(callback: () => void): Promise<void>;
  onStateChange(id: string, state: unknown): Promise<void>;
}
export function createOcppRuntime(Base: new (options?: unknown) => object): new (options?: unknown) => OcppRuntime;
