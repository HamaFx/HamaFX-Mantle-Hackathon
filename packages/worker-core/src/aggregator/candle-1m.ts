import type { Symbol } from '@hamafx/shared';
import type { NormalizedTick } from '../signalr/consumer';

export interface ClosedCandle {
  symbol: Symbol;
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
  tickVolume: number;
  source: 'biquote-signalr';
}

interface OpenBar {
  bucket: number;
  o: number;
  h: number;
  l: number;
  c: number;
  ticks: number;
}

const MINUTE_MS = 60_000;

export class Candle1mAggregator {
  private readonly bars = new Map<Symbol, OpenBar>();
  private readonly onClosed: (bar: ClosedCandle) => void;

  constructor(onClosed: (bar: ClosedCandle) => void) {
    this.onClosed = onClosed;
  }

  feed(tick: NormalizedTick): void {
    const bucket = Math.floor(tick.ts / MINUTE_MS);
    const existing = this.bars.get(tick.symbol);

    if (!existing) {
      this.bars.set(tick.symbol, this.openBar(bucket, tick.mid));
      return;
    }

    if (bucket < existing.bucket) return;

    if (bucket === existing.bucket) {
      if (tick.mid > existing.h) existing.h = tick.mid;
      if (tick.mid < existing.l) existing.l = tick.mid;
      existing.c = tick.mid;
      existing.ticks += 1;
      return;
    }

    this.emitClosed(tick.symbol, existing);
    this.bars.set(tick.symbol, this.openBar(bucket, tick.mid));
  }

  closeAll(): ClosedCandle[] {
    const closed: ClosedCandle[] = [];
    for (const [symbol, bar] of this.bars) {
      closed.push(this.emitClosed(symbol, bar));
    }
    this.bars.clear();
    return closed;
  }

  peek(symbol: Symbol): OpenBar | undefined {
    return this.bars.get(symbol);
  }

  private openBar(bucket: number, mid: number): OpenBar {
    return { bucket, o: mid, h: mid, l: mid, c: mid, ticks: 1 };
  }

  private emitClosed(symbol: Symbol, bar: OpenBar): ClosedCandle {
    const candle: ClosedCandle = {
      symbol,
      t: bar.bucket * MINUTE_MS,
      o: bar.o,
      h: bar.h,
      l: bar.l,
      c: bar.c,
      v: null,
      tickVolume: bar.ticks,
      source: 'biquote-signalr',
    };
    this.onClosed(candle);
    return candle;
  }
}
