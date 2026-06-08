import {
  BiquoteSignalRTickSchema,
  isSymbol,
  SYMBOLS,
  type Symbol,
} from '@hamafx/shared';

import type { Logger } from '../logger';
import { DEFAULT_RECONNECT_DELAYS, jitteredDelay } from './reconnect';

export interface NormalizedTick {
  symbol: Symbol;
  bid: number;
  ask: number;
  mid: number;
  ts: number;
  source: 'biquote-signalr' | 'mt5-local';
}

export interface MinimalHubConnection {
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke(method: string, ...args: unknown[]): Promise<unknown>;
  on(method: string, handler: (...args: unknown[]) => void): void;
  off(method: string, handler?: (...args: unknown[]) => void): void;
  onreconnecting(handler: (err?: unknown) => void): void;
  onreconnected(handler: (id?: string) => void): void;
  onclose(handler: (err?: unknown) => void): void;
}

export interface BuildConnectionArgs {
  hubUrl: string;
  reconnectDelaysMs?: number[];
}

export type BuildConnection = (args: BuildConnectionArgs) => MinimalHubConnection;

export interface ConsumerOptions {
  hubUrl: string;
  symbols?: Symbol[];
  onTick: (tick: NormalizedTick) => void;
  onActivity?: () => void;
  buildConnection: BuildConnection;
  log: Logger;
  reconnectDelaysMs?: number[];
}

export class SignalRConsumer {
  private readonly opts: ConsumerOptions;
  private connection: MinimalHubConnection | null = null;
  private subscribedSymbols: Symbol[] = [];
  private started = false;
  private stopping = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private static readonly MAX_REBUILD_BACKOFF_MS = 60_000;

  constructor(opts: ConsumerOptions) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (this.started) return;
    const symbols = this.opts.symbols ?? [...SYMBOLS];
    this.subscribedSymbols = symbols;

    const conn = this.opts.buildConnection({
      hubUrl: this.opts.hubUrl,
      reconnectDelaysMs: this.opts.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS,
    });
    this.connection = conn;

    conn.on('ReceiveTick', (...args: unknown[]) => {
      this.handleTick(args[0]);
    });

    conn.onreconnecting((err) => {
      this.opts.log.warn('signalr reconnecting', { err: err ? String(err) : undefined });
    });
    conn.onreconnected(() => {
      this.opts.log.info('signalr reconnected — resubscribing', {
        symbols: this.subscribedSymbols,
      });
      void this.subscribe(this.subscribedSymbols);
    });
    conn.onclose((err) => {
      this.opts.log.error('signalr connection closed', {
        err: err ? String(err) : 'no error',
      });
      this.started = false;
      if (!this.stopping) this.scheduleReconnect();
    });

    this.opts.log.info('signalr starting', {
      hubUrl: this.opts.hubUrl,
      symbols,
    });
    await conn.start();
    await this.subscribe(symbols);
    this.started = true;
    this.opts.log.info('signalr subscribed', { symbols });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.connection) return;
    try {
      await this.unsubscribe(this.subscribedSymbols);
    } catch (err) {
      this.opts.log.warn('signalr unsubscribe failed during stop', { err: String(err) });
    }
    try {
      await this.connection.stop();
    } catch (err) {
      this.opts.log.warn('signalr stop failed', { err: String(err) });
    }
    this.connection = null;
    this.started = false;
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const baseMs = Math.min(
      SignalRConsumer.MAX_REBUILD_BACKOFF_MS,
      2_000 * Math.pow(2, this.reconnectAttempt - 1),
    );
    const delay = jitteredDelay(baseMs);
    this.opts.log.warn('signalr scheduling manual rebuild', {
      attempt: this.reconnectAttempt,
      delayMs: Math.round(delay),
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.rebuild();
    }, delay);
  }

  private async rebuild(): Promise<void> {
    if (this.stopping) return;
    this.connection = null;
    try {
      await this.start();
      this.opts.log.info('signalr manual rebuild succeeded', {
        attempts: this.reconnectAttempt,
      });
      this.reconnectAttempt = 0;
    } catch (err) {
      this.opts.log.error('signalr manual rebuild failed', { err: String(err) });
      this.scheduleReconnect();
    }
  }

  async subscribe(symbols: Symbol[]): Promise<void> {
    if (!this.connection || symbols.length === 0) return;
    await this.connection.invoke('Subscribe', symbols);
  }

  async unsubscribe(symbols: Symbol[]): Promise<void> {
    if (!this.connection || symbols.length === 0) return;
    await this.connection.invoke('Unsubscribe', symbols);
  }

  handleTick(raw: unknown): void {
    const parsed = BiquoteSignalRTickSchema.safeParse(raw);
    if (!parsed.success) {
      const keys =
        raw !== null && typeof raw === 'object' ? Object.keys(raw as Record<string, unknown>) : [];
      this.opts.log.warn('signalr tick rejected: invalid shape', {
        issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join('.')),
        observedKeys: keys.slice(0, 12),
      });
      return;
    }

    const tick = parsed.data;
    if (!isSymbol(tick.symbol)) {
      return;
    }

    const ts = parseTickTimestamp(tick.timestamp);
    if (ts === null) {
      this.opts.log.warn('signalr tick rejected: bad timestamp', {
        timestamp: String(tick.timestamp).slice(0, 60),
      });
      return;
    }

    const mid = (tick.bid + tick.ask) / 2;
    const normalized: NormalizedTick = {
      symbol: tick.symbol,
      bid: tick.bid,
      ask: tick.ask,
      mid,
      ts,
      source: 'biquote-signalr',
    };

    try {
      this.opts.onTick(normalized);
      this.opts.onActivity?.();
    } catch (err) {
      this.opts.log.error('onTick handler threw', { err: String(err) });
    }
  }

  isStarted(): boolean {
    return this.started;
  }
}

function parseTickTimestamp(input: number | string): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return input < 1_000_000_000_000 ? input * 1000 : input;
  }
  const t = Date.parse(input);
  return Number.isNaN(t) ? null : t;
}

export async function createDefaultBuildConnection(): Promise<BuildConnection> {
  const mod = await import('@microsoft/signalr');
  const { HubConnectionBuilder } = mod;

  return ({ hubUrl, reconnectDelaysMs }) => {
    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect(reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS)
      .build();
    return conn as unknown as MinimalHubConnection;
  };
}
