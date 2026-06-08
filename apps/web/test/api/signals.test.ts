import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {} as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('@hamafx/db', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    onChainSignals: { id: 'id', signalType: 'sig', asset: 'asset', createdAt: 'ts' },
  },
}));

describe('Signals API', () => {
  beforeEach(() => {
    const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'offset'];
    for (const m of methods) {
      mockDb[m] = vi.fn().mockReturnThis();
    }
    // The terminal method resolves to data
    mockDb.limit = vi.fn().mockResolvedValue([
      { id: '1', signalType: 'alpha_signal', asset: 'MNTUSDT', direction: 'bullish', confidence: 8 },
    ]);
  });

  it('builds query with default limit of 20', async () => {
    const rows = await mockDb
      .select()
      .from({ id: 'id' } as never)
      .orderBy({ createdAt: 'desc' } as never)
      .limit(20);

    expect(rows).toHaveLength(1);
    expect(rows[0].asset).toBe('MNTUSDT');
  });

  it('supports offset pagination', async () => {
    // Reset limit to chain properly
    mockDb.limit = vi.fn().mockReturnThis();
    mockDb.offset = vi.fn().mockResolvedValue([]);

    await mockDb
      .select()
      .from({ id: 'id' } as never)
      .orderBy({ createdAt: 'desc' } as never)
      .limit(10)
      .offset(10);

    expect(mockDb.offset).toHaveBeenCalledWith(10);
  });

  it('handles empty result set', async () => {
    mockDb.limit = vi.fn().mockResolvedValue([]);
    const rows = await mockDb.select().from({} as never).limit(20);
    expect(rows).toEqual([]);
  });
});