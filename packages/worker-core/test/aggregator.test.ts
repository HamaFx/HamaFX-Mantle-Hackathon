import { describe, it, expect } from 'vitest';
import { TickBuffer } from '../src/signalr/tick-buffer';
import { Candle1mAggregator, type ClosedCandle } from '../src/aggregator/candle-1m';
import { createMockNormalizedTick } from './helpers/mocks';

describe('TickBuffer', () => {
  it('starts empty', () => {
    const buf = new TickBuffer();
    expect(buf.size()).toBe(0);
  });

  it('push adds symbols', () => {
    const buf = new TickBuffer();
    buf.push(createMockNormalizedTick({ symbol: 'EURUSD' }));
    expect(buf.size()).toBe(1);
  });

  it('replaces last tick for same symbol', () => {
    const buf = new TickBuffer();
    buf.push(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.08 }));
    buf.push(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.09 }));
    expect(buf.size()).toBe(1);
    const drained = buf.drain();
    expect(drained[0].tick.bid).toBe(1.09);
    expect(drained[0].observed).toBe(2); // pushed twice, observed=2
  });

  it('drain empties buffer', () => {
    const buf = new TickBuffer();
    buf.push(createMockNormalizedTick({ symbol: 'EURUSD' }));
    buf.push(createMockNormalizedTick({ symbol: 'BTCUSDT' }));
    const drained = buf.drain();
    expect(drained).toHaveLength(2);
    expect(buf.size()).toBe(0);
  });

  it('clear removes all ticks', () => {
    const buf = new TickBuffer();
    buf.push(createMockNormalizedTick({ symbol: 'EURUSD' }));
    buf.clear();
    expect(buf.size()).toBe(0);
  });

  it('handles many symbols', () => {
    const buf = new TickBuffer();
    for (let i = 0; i < 10; i++) {
      buf.push(createMockNormalizedTick({ symbol: `SYM${i}` }));
    }
    expect(buf.size()).toBe(10);
  });
});

describe('Candle1mAggregator', () => {
  it('emits closed candle on minute rollover', () => {
    const closed: ClosedCandle[] = [];
    const agg = new Candle1mAggregator((c) => closed.push(c));

    const baseTime = 1_700_000_000_000;
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.0800, ask: 1.0800, mid: 1.0800, ts: baseTime }));
    // Next minute tick triggers close
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.0900, ask: 1.0900, mid: 1.0900, ts: baseTime + 60_000 }));

    expect(closed.length).toBe(1);
    expect(closed[0].symbol).toBe('EURUSD');
    expect(closed[0].tickVolume).toBe(1);
  });

  it('tracks OHLC correctly within a minute', () => {
    const closed: ClosedCandle[] = [];
    const agg = new Candle1mAggregator((c) => closed.push(c));

    const baseTime = 1_700_000_000_000;
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.0800, ask: 1.0802, mid: 1.0801, ts: baseTime }));
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.0850, ask: 1.0852, mid: 1.0851, ts: baseTime + 10_000 }));
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.0820, ask: 1.0822, mid: 1.0821, ts: baseTime + 20_000 }));
    // Trigger close
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', bid: 1.0830, ask: 1.0832, mid: 1.0831, ts: baseTime + 60_000 }));

    expect(closed.length).toBe(1);
    expect(closed[0].tickVolume).toBe(3);
  });

  it('closeAll emits all open candles', () => {
    const closed: ClosedCandle[] = [];
    const agg = new Candle1mAggregator((c) => closed.push(c));

    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', ts: 1_700_000_000_000 }));
    agg.feed(createMockNormalizedTick({ symbol: 'BTCUSDT', ts: 1_700_000_000_000 }));

    const result = agg.closeAll();
    expect(result.length).toBe(2);
    const symbols = result.map((c) => c.symbol).sort();
    expect(symbols).toEqual(['BTCUSDT', 'EURUSD']);
  });

  it('closeAll is idempotent', () => {
    const closed: ClosedCandle[] = [];
    const agg = new Candle1mAggregator((c) => closed.push(c));

    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', ts: 1_700_000_000_000 }));
    expect(agg.closeAll().length).toBe(1);
    expect(agg.closeAll().length).toBe(0);
  });

  it('handles feeds after closeAll', () => {
    const closed: ClosedCandle[] = [];
    const agg = new Candle1mAggregator((c) => closed.push(c));

    agg.closeAll();
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', ts: 1_700_000_000_000 }));
    agg.feed(createMockNormalizedTick({ symbol: 'EURUSD', ts: 1_700_000_060_000 }));

    expect(closed.length).toBe(1);
  });
});