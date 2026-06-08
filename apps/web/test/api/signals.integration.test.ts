import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();
const mockReturning = vi.fn();

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  orderBy: mockOrderBy,
  limit: mockLimit,
  insert: mockInsert,
  values: mockValues,
  returning: mockReturning,
};

vi.mock('@hamafx/db', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    onChainSignals: {
      id: 'id', signalType: 'signal_type', asset: 'asset', direction: 'direction',
      confidence: 'confidence', committeeGrade: 'committee_grade', goNoGo: 'go_no_go',
      summary: 'summary', fullAnalysis: 'full_analysis', txHash: 'tx_hash',
      onChainSignalId: 'onchain_signal_id', explorerUrl: 'explorer_url',
      triggerData: 'trigger_data', createdAt: 'created_at', source: 'source',
    },
  },
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    desc: vi.fn((col: unknown) => col),
    eq: vi.fn(() => ({})),
  };
});

import { GET, POST } from '../../src/app/api/signals/route';

describe('GET /api/signals (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockFrom.mockReturnThis();
    mockOrderBy.mockReturnThis();
    mockLimit.mockResolvedValue([
      { id: 'sig-1', signalType: 'alpha_signal', asset: 'MNTUSDT', direction: 'bullish', confidence: 8 },
    ]);
  });

  it('returns signals ordered by date desc', async () => {
    const req = new Request('http://localhost:3000/api/signals');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].asset).toBe('MNTUSDT');
  });

  it('defaults to limit 50', async () => {
    await GET(new Request('http://localhost:3000/api/signals'));
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('respects limit query param', async () => {
    await GET(new Request('http://localhost:3000/api/signals?limit=10'));
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('returns 500 on DB error, without leaking details', async () => {
    mockLimit.mockRejectedValue(new Error('connection refused'));
    const res = await GET(new Request('http://localhost:3000/api/signals'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('connection refused');
  });
});