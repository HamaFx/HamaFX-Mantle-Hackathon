import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from './helpers/setup';

// We test the locks module in isolation by mocking getDb
vi.mock('../src/client', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../src/client';
import { acquireJobLock, releaseJobLock, renewJobLock } from '../src/locks';

describe('@hamafx/db locks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireJobLock', () => {
    it('returns true when no lock exists', async () => {
      const mockDb = createMockDb();
      // Mock select returning empty (no existing lock)
      vi.mocked(mockDb.from).mockReturnThis();
      vi.mocked(mockDb.where).mockReturnThis();
      vi.mocked(mockDb.limit).mockResolvedValue([] as never);
      vi.mocked(getDb).mockReturnValue(mockDb as never);

      // Mock transaction
      vi.mocked(mockDb.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: unknown) => Promise<void>) => {
          await fn(mockDb);
        },
      );

      const result = await acquireJobLock('test-job');
      expect(result).toBe(true);
    });

    it('returns false when a valid lock exists', async () => {
      const mockDb = createMockDb();
      const existingLock = {
        jobName: 'hamafx:job:test-job',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 300_000),
        runnerPid: 12345,
        runnerHost: 'other-host',
      };
      vi.mocked(mockDb.limit).mockResolvedValue([existingLock] as never);
      vi.mocked(getDb).mockReturnValue(mockDb as never);

      vi.mocked(mockDb.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: unknown) => Promise<void>) => {
          await fn(mockDb);
        },
      );

      const result = await acquireJobLock('test-job');
      expect(result).toBe(false);
    });

    it('acquires expired lock', async () => {
      const mockDb = createMockDb();
      const expiredLock = {
        jobName: 'hamafx:job:test-job',
        lockedAt: new Date(Date.now() - 600_000),
        expiresAt: new Date(Date.now() - 300_000), // expired 5 min ago
        runnerPid: 12345,
        runnerHost: 'other-host',
      };
      vi.mocked(mockDb.limit).mockResolvedValue([expiredLock] as never);
      vi.mocked(getDb).mockReturnValue(mockDb as never);

      vi.mocked(mockDb.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        async (fn: (tx: unknown) => Promise<void>) => {
          await fn(mockDb);
        },
      );

      const result = await acquireJobLock('test-job');
      expect(result).toBe(true);
    });

    it('returns false on DB error and logs', async () => {
      const mockDb = createMockDb();
      vi.mocked(getDb).mockReturnValue(mockDb as never);
      vi.mocked(mockDb.transaction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('connection refused'),
      );

      const result = await acquireJobLock('test-job');
      expect(result).toBe(false);
    });
  });

  describe('renewJobLock', () => {
    it('returns true when lock is renewed', async () => {
      const mockDb = createMockDb();
      vi.mocked(mockDb.from).mockReturnThis();
      vi.mocked(mockDb.set).mockReturnThis();
      vi.mocked(mockDb.where).mockReturnThis();
      vi.mocked(mockDb.returning).mockResolvedValue([
        { jobName: 'hamafx:job:test-job' },
      ] as never);
      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const result = await renewJobLock('test-job');
      expect(result).toBe(true);
    });

    it('returns false when lock not found (no rows returned)', async () => {
      const mockDb = createMockDb();
      vi.mocked(mockDb.onConflictDoNothing).mockReturnThis();
      vi.mocked(mockDb.returning).mockResolvedValue([] as never);
      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const result = await renewJobLock('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false on DB error', async () => {
      const mockDb = createMockDb();
      vi.mocked(getDb).mockReturnValue(mockDb as never);
      vi.mocked(mockDb.returning).mockRejectedValue(new Error('timeout'));

      const result = await renewJobLock('test-job');
      expect(result).toBe(false);
    });
  });

  describe('releaseJobLock', () => {
    it('does not throw on success', async () => {
      const mockDb = createMockDb();
      vi.mocked(getDb).mockReturnValue(mockDb as never);

      await expect(releaseJobLock('test-job')).resolves.toBeUndefined();
    });
  });
});