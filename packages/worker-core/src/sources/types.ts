import type { NormalizedTick } from '../signalr/consumer.js';

export interface TickSource {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isConnected(): boolean;
  onTick(handler: (tick: NormalizedTick) => void): void;
}
