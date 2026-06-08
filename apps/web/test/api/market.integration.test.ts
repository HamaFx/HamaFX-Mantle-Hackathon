import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetPriceWithMeta = vi.fn();
const mockGetCandlesWithMeta = vi.fn();

vi.mock('@hamafx/data', async () => {
  const actual = await vi.importActual<typeof import('@hamafx/data')>('@hamafx/data');
  return {
    ...actual,
    getPriceWithMeta: (...args: unknown[]) => mockGetPriceWithMeta(...args),
    getCandlesWithMeta: (...args: unknown[]) => mockGetCandlesWithMeta(...args),
  };
});

import { GET as getPrice } from '../../src/app/api/market/price/route';

describe('GET /api/market/price (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns prices for all default symbols', async () => {
    mockGetPriceWithMeta.mockResolvedValue({
      tick: { symbol: 'MNTUSDT', bid: 1.27, ask: 1.28, mid: 1.275, ts: Date.now(), source: 'biquote-signalr' },
      stale: false,
      producedAt: Date.now(),
      ageMs: 100,
    });

    const req = new Request('http://localhost:3000/api/market/price');
    const res = await getPrice(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticks).toBeDefined();
    expect(body.anyStale).toBe(false);
  });

  it('flags stale data', async () => {
    mockGetPriceWithMeta.mockResolvedValue({
      tick: { symbol: 'ETHUSDT', bid: 3400, ask: 3410, mid: 3405, ts: Date.now(), source: 'biquote-signalr' },
      stale: true,
      producedAt: Date.now() - 30000,
      ageMs: 30000,
    });

    const req = new Request('http://localhost:3000/api/market/price?symbol=ETHUSDT');
    const res = await getPrice(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.anyStale).toBe(true);
  });

  it('returns 500 when data layer fails', async () => {
    mockGetPriceWithMeta.mockRejectedValue(new Error('timeout'));

    const req = new Request('http://localhost:3000/api/market/price');
    const res = await getPrice(req);

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeDefined();
  });
});

describe('GET /api/market/candles (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns candles with symbol and tf', async () => {
    const { GET: getCandlesRoute } = await import('../../src/app/api/market/candles/route');
    mockGetCandlesWithMeta.mockResolvedValue({
      candles: [
        { t: 1700000000, o: 1.08, h: 1.09, l: 1.07, c: 1.085 },
        { t: 1700000060, o: 1.085, h: 1.086, l: 1.084, c: 1.085 },
      ],
      stale: false,
      producedAt: Date.now(),
    });

    const req = new Request('http://localhost:3000/api/market/candles?symbol=MNTUSDT&tf=1m&count=2');
    const res = await getCandlesRoute(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.symbol).toBe('MNTUSDT');
    expect(body.candles).toHaveLength(2);
    expect(body.stale).toBe(false);
  });

  it('returns 400 with invalid symbol', async () => {
    const { GET: getCandlesRoute } = await import('../../src/app/api/market/candles/route');

    const req = new Request('http://localhost:3000/api/market/candles?symbol=INVALID&tf=1m');
    const res = await getCandlesRoute(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeDefined();
  });

  it('defaults tf and count when omitted', async () => {
    const { GET: getCandlesRoute } = await import('../../src/app/api/market/candles/route');
    mockGetCandlesWithMeta.mockResolvedValue({
      candles: [],
      stale: false,
      producedAt: Date.now(),
    });

    const req = new Request('http://localhost:3000/api/market/candles?symbol=BTCUSDT');
    const res = await getCandlesRoute(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candles).toEqual([]);
  });
});