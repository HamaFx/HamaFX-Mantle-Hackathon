/**
 * Test helpers for @hamafx/db.
 *
 * Provides utilities to manage the singleton Drizzle client between tests,
 * avoiding test pollution from module-scoped state.
 */
import { vi } from 'vitest';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// ---- singleton reset ------------------------------------------------

export function resetDbSingleton(): void {
  vi.resetModules();
}

// ---- mock helpers ---------------------------------------------------

export interface MockDbOptions {
  insertResult?: unknown;
  selectResult?: unknown[];
  updateResult?: unknown;
  shouldThrow?: boolean;
}

export function createMockDb(opts: MockDbOptions = {}) {
  const err = opts.shouldThrow ? new Error('Mock DB error') : null;

  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    execute: vi.fn(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
  };

  if (err) {
    mockDb.execute.mockRejectedValue(err);
    mockDb.transaction.mockRejectedValue(err);
    mockDb.returning.mockRejectedValue(err);
  }

  if (opts.selectResult) {
    mockDb.limit.mockResolvedValue(opts.selectResult);
    mockDb.where.mockResolvedValue(opts.selectResult);
  }

  return mockDb as unknown as PostgresJsDatabase<Record<string, never>>;
}

export function cleanupDbMocks(): void {
  vi.clearAllMocks();
}