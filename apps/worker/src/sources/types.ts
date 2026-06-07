import type { NormalizedTick } from '../signalr/consumer.js';

/**
 * A source of real-time NormalizedTick events. Implementations may
 * drive a persistent connection (SignalR, WebSocket) or poll REST.
 */
export interface TickSource {
  /** Human-readable name for logging. */
  readonly name: string;
  /** Start producing ticks. Calls onTick for each incoming tick. */
  start(): Promise<void>;
  /** Stop producing ticks. Idempotent. */
  stop(): Promise<void>;
  /** Register the tick handler. Called before start(). */
  onTick(handler: (tick: NormalizedTick) => void): void;
  /** Whether the source is connected and producing ticks. */
  isConnected(): boolean;
}
