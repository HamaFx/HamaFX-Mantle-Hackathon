/**
 * Test helpers for @hamafx/worker-core.
 *
 * Provides mock DB, SignalR, and Finnhub doubles so daemon components
 * can be unit-tested without real network or database connections.
 */
import { vi } from 'vitest';
import type { Logger } from '../src/logger.js';
import type { NormalizedTick, ClosedCandle } from '../src/index.js';

// ---- mock logger ---------------------------------------------------

export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    with: vi.fn().mockReturnThis(),
  } as unknown as Logger;
}

// ---- mock tick factory ----------------------------------------------

export function createMockNormalizedTick(
  overrides: Partial<NormalizedTick> = {},
): NormalizedTick {
  return {
    symbol: 'EURUSD',
    bid: 1.0850,
    ask: 1.0852,
    mid: 1.0851,
    ts: Date.now(),
    source: 'biquote-signalr' as const,
    ...overrides,
  };
}

// ---- mock candle factory --------------------------------------------

export function createMockClosedCandle(
  overrides: Partial<ClosedCandle> = {},
): ClosedCandle {
  return {
    symbol: 'EURUSD',
    t: Date.now() - 60_000, // 1 minute ago
    o: 1.0840,
    h: 1.0855,
    l: 1.0830,
    c: 1.0850,
    tickVolume: 42,
    ...overrides,
  };
}

// ---- mock SignalR helpers -------------------------------------------

export interface MockSignalRHubOptions {
  ticks?: NormalizedTick[];
  failOnStart?: boolean;
  failOnSubscribe?: boolean;
}

export function createMockSignalRConnection(
  opts: MockSignalRHubOptions = {},
) {
  const onCallbacks: Record<string, (...args: unknown[]) => void> = {};
  let started = false;

  const connection = {
    start: vi.fn().mockImplementation(async () => {
      if (opts.failOnStart) throw new Error('SignalR connection failed');
      started = true;
    }),
    stop: vi.fn().mockImplementation(async () => {
      started = false;
    }),
    on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      onCallbacks[event] = cb;
    }),
    off: vi.fn().mockImplementation((event: string) => {
      delete onCallbacks[event];
    }),
    invoke: vi.fn().mockImplementation(async (method: string, ...args: unknown[]) => {
      if (method === 'SubscribeToTick' && opts.failOnSubscribe) {
        throw new Error('Subscribe failed');
      }
    }),
    // Test helpers
    _emit(event: string, ...args: unknown[]) {
      const cb = onCallbacks[event];
      if (cb) cb(...args);
    },
    _isStarted() { return started; },
  };

  return connection;
}

// ---- mock DB helpers for worker-core tests --------------------------

export interface MockWorkerDbOptions {
  insertResult?: unknown;
  shouldThrow?: boolean;
}

export function createMockWorkerDb(opts: MockWorkerDbOptions = {}) {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  };

  if (opts.shouldThrow) {
    const err = new Error('Mock DB error');
    Object.values(mockDb).forEach((fn) => {
      if (typeof fn === 'function') {
        (fn as ReturnType<typeof vi.fn>).mockRejectedValue(err);
      }
    });
  }

  return mockDb;
}

// ---- mock Finnhub helpers -------------------------------------------

export interface MockFinnhubOptions {
  ticks?: NormalizedTick[];
  failOnStart?: boolean;
}

export function createMockFinnhubSource(opts: MockFinnhubOptions = {}) {
  let handler: ((tick: NormalizedTick) => void) | null = null;
  let running = false;

  return {
    start: vi.fn().mockImplementation(async () => {
      if (opts.failOnStart) throw new Error('Finnhub start failed');
      running = true;
      // Emit any provided ticks
      if (opts.ticks) {
        for (const t of opts.ticks) {
          handler?.(t);
        }
      }
    }),
    stop: vi.fn().mockImplementation(async () => {
      running = false;
    }),
    onTick: vi.fn().mockImplementation((fn: (tick: NormalizedTick) => void) => {
      handler = fn;
    }),
    _isRunning() { return running; },
    _emit(tick: NormalizedTick) { handler?.(tick); },
  };
}

/** Call in afterEach to clean up vi mocks. */
export function cleanupWorkerCoreMocks(): void {
  vi.clearAllMocks();
}