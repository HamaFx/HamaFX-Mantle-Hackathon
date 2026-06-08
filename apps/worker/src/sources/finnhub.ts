import { isSymbol, SYMBOLS, type Symbol } from '@hamafx/shared';
import { z } from 'zod';
import type { Logger } from '../log.js';
import type { NormalizedTick } from '../signalr/consumer.js';
import type { TickSource } from './types.js';

const BASE_URL = 'https://finnhub.io/api/v1/quote';

const FinnhubQuoteSchema = z.object({
  c: z.number(),
  h: z.number(),
  l: z.number(),
  o: z.number(),
  pc: z.number(),
  t: z.number(),
});

type FinnhubQuote = z.infer<typeof FinnhubQuoteSchema>;

async function fetchQuote(symbol: Symbol, apiKey: string): Promise<FinnhubQuote | null> {
  const symbolMap: Record<Symbol, string> = {
    MNTUSDT: 'BINANCE:MNTUSDT',
    BTCUSDT: 'BINANCE:BTCUSDT',
    ETHUSDT: 'BINANCE:ETHUSDT',
  };
  const finnhubSym = symbolMap[symbol] ?? symbol;
  const url = new URL(BASE_URL);
  url.searchParams.set('symbol', finnhubSym);
  url.searchParams.set('token', apiKey);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) {
      await res.text().catch(() => {});
      return null;
    }
    const json = await res.json();
    const parsed = FinnhubQuoteSchema.safeParse(json);
    if (!parsed.success) return null;
    if (parsed.data.c === 0) return null;
    return parsed.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class FinnhubTickSource implements TickSource {
  readonly name = 'finnhub-rest';
  private handler: ((tick: NormalizedTick) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private apiKey = '';
  private log: Logger;
  private pendingPoll = false;

  constructor(log: Logger) {
    this.log = log.with({ module: 'finnhub-source' });
  }

  onTick(handler: (tick: NormalizedTick) => void): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this._connected;
  }

  async start(): Promise<void> {
    this.apiKey = process.env.FINNHUB_API_KEY ?? '';
    if (!this.apiKey) {
      this.log.warn('FINNHUB_API_KEY not set — Finnhub fallback disabled');
      return;
    }

    this._connected = true;
    this.log.info('starting Finnhub REST poll fallback (5s interval)');

    void this.poll();
    this.timer = setInterval(() => void this.poll(), 5_000);
  }

  stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._connected = false;
    return Promise.resolve();
  }

  private async poll(): Promise<void> {
    if (!this.handler || !this.apiKey) return;
    if (this.pendingPoll) return;
    this.pendingPoll = true;
    try {

    for (const symbol of SYMBOLS) {
      try {
        const quote = await fetchQuote(symbol, this.apiKey);
        if (!quote) continue;

        const t = quote.t * 1000;
        if (!Number.isFinite(t) || !Number.isFinite(quote.c)) continue;

        const tick: NormalizedTick = {
          symbol,
          bid: quote.c,
          ask: quote.c,
          mid: quote.c,
          ts: t,
          source: 'biquote-signalr',
        };
        this.handler(tick);
      } catch {
        // Individual symbol failure is not fatal
      }
    }
    } finally {
      this.pendingPoll = false;
    }
  }
}
