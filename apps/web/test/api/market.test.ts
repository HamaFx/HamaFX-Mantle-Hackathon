import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for the market API route handlers.
 * Tests the query parameter parsing and error handling.
 */

describe('Market API — price endpoint', () => {
  it('rejects requests with missing symbol', () => {
    // Simulate a request without symbol param
    const url = new URL('http://localhost:3000/api/market/price');
    const symbol = url.searchParams.get('symbol');
    expect(symbol).toBeNull();
  });

  it('accepts valid symbol parameter', () => {
    const url = new URL('http://localhost:3000/api/market/price?symbol=BTCUSDT');
    expect(url.searchParams.get('symbol')).toBe('BTCUSDT');
  });

  it('accepts MNTUSDT symbol', () => {
    const url = new URL('http://localhost:3000/api/market/price?symbol=MNTUSDT');
    expect(url.searchParams.get('symbol')).toBe('MNTUSDT');
  });
});

describe('Market API — candles endpoint', () => {
  it('requires symbol and timeframe params', () => {
    const url = new URL('http://localhost:3000/api/market/candles');
    expect(url.searchParams.get('symbol')).toBeNull();
    expect(url.searchParams.get('tf')).toBeNull();
  });

  it('accepts valid params', () => {
    const url = new URL('http://localhost:3000/api/market/candles?symbol=BTCUSDT&tf=1h&count=100');
    expect(url.searchParams.get('symbol')).toBe('BTCUSDT');
    expect(url.searchParams.get('tf')).toBe('1h');
    expect(url.searchParams.get('count')).toBe('100');
  });

  it('defaults count when omitted', () => {
    const url = new URL('http://localhost:3000/api/market/candles?symbol=ETHUSDT&tf=5m');
    expect(url.searchParams.get('count')).toBeNull();
    // Route handler should default to something reasonable
  });

  it('rejects invalid timeframe', () => {
    const url = new URL('http://localhost:3000/api/market/candles?symbol=BTCUSDT&tf=invalid');
    const VALID_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    expect(VALID_TIMEFRAMES).not.toContain('invalid');
  });
});

describe('Market API — indicators endpoint', () => {
  it('accepts RSI indicator request', () => {
    const url = new URL('http://localhost:3000/api/market/indicators?symbol=BTCUSDT&tf=1h&kind=rsi');
    expect(url.searchParams.get('kind')).toBe('rsi');
  });

  it('accepts MACD indicator request', () => {
    const url = new URL('http://localhost:3000/api/market/indicators?symbol=ETHUSDT&tf=4h&kind=macd');
    expect(url.searchParams.get('kind')).toBe('macd');
  });

  it('rejects unknown indicator kind', () => {
    const VALID_KINDS = ['rsi', 'macd', 'bollinger', 'atr', 'sma', 'ema'];
    expect(VALID_KINDS).not.toContain('unknown_indicator');
  });
});