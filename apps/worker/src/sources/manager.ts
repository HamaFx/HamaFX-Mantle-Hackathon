import type { Logger } from '../log.js';
import type { NormalizedTick } from '../signalr/consumer.js';
import type { TickSource } from './types.js';

export interface TickSourceManagerOptions {
  /** Primary real-time source (BiQuote SignalR). */
  primary: TickSource;
  /** Fallback REST poll source (Finnhub). Active when primary is down. */
  fallback: TickSource;
  /** Optional MT5 bridge — overrides all other sources when active. */
  mt5?: TickSource;
  log: Logger;
  /** How long to wait after primary disconnection before activating fallback (ms). */
  fallbackActivationDelayMs?: number;
  /** How long primary must be stable before deactivating fallback (ms). */
  primaryStabilityMs?: number;
}

export class TickSourceManager {
  private primary: TickSource;
  private fallback: TickSource;
  private mt5: TickSource | undefined;
  private log: Logger;
  private emit: ((tick: NormalizedTick) => void) | null = null;

  private fallbackActive = false;
  private mt5Active = false;
  private lastTickAt = 0;
  private lastMt5TickAt = 0;

  private readonly fallbackDelayMs: number;
  private readonly stabilityMs: number;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private deactivateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: TickSourceManagerOptions) {
    this.primary = opts.primary;
    this.fallback = opts.fallback;
    this.mt5 = opts.mt5;
    this.log = opts.log.with({ module: 'tick-source-mgr' });
    this.fallbackDelayMs = opts.fallbackActivationDelayMs ?? 15_000;
    this.stabilityMs = opts.primaryStabilityMs ?? 30_000;
  }

  onTick(handler: (tick: NormalizedTick) => void): void {
    this.emit = handler;
  }

  isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  isMt5Active(): boolean {
    return this.mt5Active;
  }

  async start(): Promise<void> {
    this.log.info('starting TickSourceManager');

    // Wire MT5 first — it takes highest priority.
    if (this.mt5) {
      this.mt5.onTick((tick) => {
        this.lastMt5TickAt = Date.now();
        this.lastTickAt = Date.now();
        this.mt5Active = true;
        this.emit?.(tick);
      });
      await this.mt5.start();
    }

    // Wire primary source.
    this.primary.onTick((tick) => {
      this.lastTickAt = Date.now();

      // If MT5 is active, drop BiQuote ticks.
      if (this.mt5Active && Date.now() - this.lastMt5TickAt < 15_000) {
        return;
      }

      this.emit?.(tick);

      // If fallback is active, schedule deactivation once primary is stable.
      if (this.fallbackActive) {
        if (!this.deactivateTimer) {
          this.deactivateTimer = setTimeout(() => {
            if (this.fallbackActive) {
              this.log.info('primary stable — deactivating fallback');
              this.fallbackActive = false;
              void this.fallback.stop();
            }
            this.deactivateTimer = null;
          }, this.stabilityMs);
        }
      }
    });
    await this.primary.start();

    // Monitor primary health — activate fallback if primary goes silent.
    this.monitorPrimary();
  }

  async stop(): Promise<void> {
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    if (this.deactivateTimer) clearTimeout(this.deactivateTimer);
    await Promise.all([
      this.primary.stop(),
      this.fallbackActive ? this.fallback.stop() : Promise.resolve(),
      this.mt5?.stop() ?? Promise.resolve(),
    ]);
  }

  private monitorPrimary(): void {
    const check = () => {
      const ageMs = Date.now() - this.lastTickAt;
      // Don't activate if MT5 is already providing data.
      if (this.mt5Active && Date.now() - this.lastMt5TickAt < 15_000) {
        this.fallbackTimer = setTimeout(check, 5_000);
        return;
      }

      if (!this.fallbackActive && ageMs > this.fallbackDelayMs) {
        this.log.warn('primary silent — activating fallback', { ageMs });
        this.fallbackActive = true;
        this.fallback.onTick((tick) => {
          // Even if fallback is active, MT5 still overrides.
          if (this.mt5Active && Date.now() - this.lastMt5TickAt < 15_000) {
            return;
          }
          this.lastTickAt = Date.now();
          this.emit?.(tick);
        });
        void this.fallback.start();
      }

      this.fallbackTimer = setTimeout(check, 5_000);
    };
    this.fallbackTimer = setTimeout(check, this.fallbackDelayMs);
  }
}
