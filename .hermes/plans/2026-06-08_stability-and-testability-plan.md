# HamaFX-Ai Stability & Testability Hardening Plan

> **For Hermes:** Use test-driven-development and systematic-debugging skills. Execute one phase at a time, verifying with full CI before proceeding.
> **DO NOT implement anything** — this is a planning-only document. The user wants analysis and planning, not execution.

**Goal:** Transform HamaFX-Ai from a hackathon-quality prototype into a production-stable, fully-testable codebase with comprehensive error handling.

**Architecture:** Systematic hardening across 5 layers: (1) Foundation — DB/Web3 test infrastructure, (2) Error Handling — replace silent swallows with structured errors, (3) Critical Bug Fixes — resolve all C/H priority issues from analysis-report.md, (4) Test Coverage — achieve >80% coverage in core packages, (5) CI/CD Hardening — pre-commit gates, coverage thresholds, integration tests.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, viem, Next.js 15, Vercel AI SDK 5

---

## Current State Assessment

### Test Coverage by Package

| Package | Source Files | Test Files | Coverage | Status |
|---------|-------------|------------|----------|--------|
| packages/shared | 57 | 1 | ~2% | CRITICAL |
| packages/db | 26 | 0 | 0% | CRITICAL |
| packages/web3 | 4 | 0 | 0% | CRITICAL |
| packages/worker-core | 13 | 0 | 0% | CRITICAL |
| packages/config | ~5 | 0 | 0% | LOW |
| apps/web | 170 | 2 | ~1% | CRITICAL |
| apps/worker | 26 | 16 | ~62% | GOOD |
| packages/ai | 78 | 17 | ~22% | MEDIUM |
| packages/data | 34 | 15 | ~44% | MEDIUM |
| packages/indicators | 18 | 11 | ~61% | GOOD |

### Error Handling Issues
- **40+ empty catch blocks** silently swallowing errors (packages/ai, web3, worker-core)
- **~15 void fire-and-forget** patterns without `.catch()` handlers
- **4+ process.exit()** calls without graceful cleanup
- **6 critical bugs** still open from analysis-report.md
- **27 unsafe `as` type casts** in critical packages

### Key: Most Fixes Already Verified
C1 (params Promise bug) and H1 (circular import) were already fixed in recent commits. The remaining critical issues are:
- C2: Missing DB migrations
- C3: Candle data loss on shutdown
- C4: MT5 buffer overflow
- H2-H7: Various high-severity issues

---

## Phase 1: Foundation — Test Infrastructure (Week 1)

### Goal
Establish test infrastructure in all packages that currently have zero tests. This is the prerequisite for all other work.

### Task 1.1: Add vitest.config.ts to @hamafx/db
**Objective:** Enable testing in the database package  
**Files:** Create `packages/db/vitest.config.ts`

### Task 1.2: Add vitest.config.ts to @hamafx/web3
**Objective:** Enable testing in the blockchain package  
**Files:** Create `packages/web3/vitest.config.ts`

### Task 1.3: Add vitest.config.ts to @hamafx/worker-core
**Objective:** Enable testing in the worker daemon package  
**Files:** Create `packages/worker-core/vitest.config.ts`

### Task 1.4: Add vitest.config.ts to @hamafx/shared
**Objective:** Fix shared package test infrastructure (has 1 test but likely no config)  
**Files:** Create `packages/shared/vitest.config.ts`

### Task 1.5: Set up test DB helpers
**Objective:** Create a test database setup utility for DB-dependent tests  
**Files:** Create `packages/db/test/helpers/setup.ts`  
- Create in-memory or test-container Postgres connection
- Export helper for applying migrations in tests
- Export helper for seeding test data

### Task 1.6: Set up mock providers for web3 tests
**Objective:** Create viem-compatible mock transport for web3 tests  
**Files:** Create `packages/web3/test/helpers/mock-client.ts`  
- Mock public client for contract reads
- Mock wallet client for contract writes
- Stub block data, transaction receipts, event logs

### Task 1.7: Set up mock DB for worker-core tests
**Objective:** Create test doubles for the DB dependency in worker-core  
**Files:** Create `packages/worker-core/test/helpers/mock-db.ts`  
- Mock Drizzle ORM insert/select/update
- Mock SignalR connection builder
- Mock Finnhub HTTP responses

---

## Phase 2: Critical Bug Fixes (Week 1)

### Goal
Fix all C and H priority issues from analysis-report.md using systematic-debugging approach. Each fix includes a regression test.

### Task 2.1: Fix C2 — Generate missing DB migrations
**Objective:** Create SQL migrations for onchain_events and job_locks tables  
**Files:** 
- Run: `cd packages/db && pnpm drizzle-kit generate`
- Verify: `packages/db/drizzle/` contains new migration files
**Test:** Write test that verifies both tables exist after migration

### Task 2.2: Fix C3 — Prevent candle data loss on worker shutdown
**Objective:** Await pending flush promises before process exit  
**Files:** Modify `apps/worker/src/index.ts:258` and `packages/worker-core/src/runner.ts`  
**Approach:** 
- Change `void (async () => { await flushClosedCandle(...); })()` 
- To: collect promises and `await Promise.all(pendingFlushes)` before shutdown
**Test:** Write test that verifies shutdown waits for flush completion

### Task 2.3: Fix H4 — Initialize lastMt5TickAt to prevent tick dropping
**Objective:** First 15 seconds after startup must not drop BiQuote ticks  
**Files:** Modify `apps/worker/src/index.ts:130`  
**Fix:** Initialize with `-Infinity` or a `started: false` flag
**Test:** Write test verifying ticks are not dropped in initial window

### Task 2.4: Fix H5 — Clean up chart subscription leaks
**Objective:** Ensure every timeScale subscription has proper cleanup  
**Files:** Modify `apps/web/src/components/chart/chart.tsx:274,390,477`  
**Fix:** Store unsubscribe handles and call in useEffect cleanup
**Test:** Write component test verifying no subscription accumulation

### Task 2.5: Fix H6 — Prevent confirm() Promise leak on double-tap
**Objective:** Guard confirm drawer state to prevent leaked resolves  
**Files:** Modify `apps/web/src/components/ui/confirm-drawer.tsx:138-142`  
**Fix:** Use `pendingRef` to track in-flight confirmation
**Test:** Write test verifying rapid double-tap doesn't leak

### Task 2.6: Fix H7 — Add missing tools to ToolOutputMap and TOOL_NAMES
**Objective:** Complete type coverage for 6 Mantle tools  
**Files:** Modify `packages/shared/src/ai/tool-io.ts`, `packages/shared/src/ai/tool-names.ts`  
**Fix:** Add entries for get_onchain_activity, get_whale_alerts, get_defi_pools, analyze_alpha_signal, log_signal_onchain, get_agent_performance
**Test:** Write test verifying all tools appear in ToolOutputMap

### Task 2.7: Fix H2 — Replace unsafe type cast in locks.ts
**Objective:** Use proper Drizzle types instead of `as { rowCount?: number }`  
**Files:** Modify `packages/db/src/locks.ts:77`  
**Fix:** Use `.returning()` pattern or Drizzle's proper `UpdateResult` type
**Test:** Write test for lock acquisition/renewal

---

## Phase 3: Error Handling Hardening (Week 2)

### Goal
Replace all silent error swallowing with structured error handling. Add error boundaries. Implement graceful shutdown.

### Task 3.1: Create structured error classes in @hamafx/shared
**Objective:** Define a typed error hierarchy for the entire project  
**Files:** Create `packages/shared/src/errors/`  
```typescript
// packages/shared/src/errors/base.ts
export class HamaFxError extends Error {
  constructor(message: string, public readonly code: string, public readonly recoverable: boolean) {
    super(message);
    this.name = 'HamaFxError';
  }
}

export class DatabaseError extends HamaFxError { ... }
export class BlockchainError extends HamaFxError { ... }
export class DataProviderError extends HamaFxError { ... }
export class AIProviderError extends HamaFxError { ... }
export class ValidationError extends HamaFxError { ... }
```
**Test:** Write tests for error serialization, code uniqueness

### Task 3.2: Fix silent catch blocks in packages/ai
**Objective:** Replace ~25 empty catch blocks with structured logging + Sentry + fallback values  
**Files:** Modify ~15 files in `packages/ai/src/`  
**Pattern to follow:**
```typescript
// BEFORE (BAD):
} catch {
  // silent swallow
}

// AFTER (GOOD):  
} catch (err) {
  console.error(`[ai] ${operationName} failed`, err);
  Sentry?.captureException(err, { tags: { component: 'ai' } });
  return fallbackValue; // or throw new AIProviderError(...)
}
```
**Test:** Write per-tool tests verifying fallback behavior on errors

### Task 3.3: Fix silent catch blocks in packages/web3
**Objective:** Replace 2 empty catch blocks with proper error handling  
**Files:** Modify `packages/web3/src/alpha-logger.ts:167,179`  
**Pattern:** Return typed error results instead of silently returning zeros
**Test:** Write tests for error paths in getAgentWalletAddress, getAgentBalance

### Task 3.4: Fix silent catch blocks in packages/worker-core
**Objective:** Replace 2 empty catch blocks with structured logging  
**Files:** Modify `packages/worker-core/src/sources/finnhub.ts:41,114`
**Test:** Write tests for Finnhub failure scenarios

### Task 3.5: Fix fire-and-forget void patterns
**Objective:** Add .catch() handlers to all ~15 void promise patterns  
**Files:** Modifying:
- `packages/ai/src/agent.ts` (3 patterns)
- `packages/ai/src/tools/with-telemetry.ts` (2 patterns)
- `packages/ai/src/tools/log-signal-onchain.ts` (1 pattern)
- `packages/ai/src/journal/persistence.ts` (2 patterns)
- `apps/web/src/components/chat/chat-screen.tsx` (6 patterns)
- `packages/worker-core/src/runner.ts` (1 pattern)
**Pattern:** Every `void promise` becomes `void promise.catch(err => console.error(...))`
**Test:** Write tests verifying error paths are logged

### Task 3.6: Implement graceful shutdown sequence
**Objective:** Ensure all process.exit() calls drain pending work first  
**Files:** Modify `apps/worker/src/index.ts`, `apps/worker/src/runner/cli.ts`
**Fix:** Replace `process.exit(N)` with `await drainAndExit(N)` that:
1. Stops signal consumer
2. Awaits pending DB writes
3. Stops on-chain scanner
4. Calls process.exit
**Test:** Write integration test verifying drain-before-exit behavior

### Task 3.7: Add React error boundaries to apps/web
**Objective:** Prevent UI crashes from propagating to blank pages  
**Files:** Create `apps/web/src/components/error-boundary.tsx`
- Wrap `/chat/[threadId]`, `/signals`, `/dashboard`, `/chart/[symbol]` routes
- Show graceful fallback UI with retry button
- Log errors to console + Sentry
**Test:** Write component tests verifying error boundary renders fallback

---

## Phase 4: Core Package Testing (Weeks 2-3)

### Goal
Achieve >80% test coverage on core packages (db, web3, worker-core, shared).

### Task 4.1: Test @hamafx/db — Schema validations
**Objective:** Verify all 20+ Drizzle table definitions  
**Files:** Create test files under `packages/db/test/`
1. `test/schema/chat.test.ts` — verify chat tables structure
2. `test/schema/signals.test.ts` — verify onchain_signals, onchain_events
3. `test/schema/telemetry.test.ts` — verify telemetry, tool_telemetry, daily_ai_spend
4. `test/schema/worker.test.ts` — verify live_ticks, candles_1m, throttle, job_locks
**Pattern:** Test that tables exist, columns have correct types, indexes are defined

### Task 4.2: Test @hamafx/db — Client and locks
**Objective:** Test DB client initialization and distributed lock logic  
**Files:**  
1. `test/client.test.ts` — singleton getDb(), connection pooling
2. `test/locks.test.ts` — acquireJobLock, renewJobLock, deadlock scenarios

### Task 4.3: Test @hamafx/web3 — Client and chain reader
**Objective:** Test Mantle client setup and block scanning  
**Files:**  
1. `test/client.test.ts` — getMantleClient(), chain config, RPC fallback
2. `test/chain-reader.test.ts` — scanRecentBlocks(), whale detection, USD estimation

### Task 4.4: Test @hamafx/web3 — Alpha logger contract
**Objective:** Test contract interaction with mocked viem  
**Files:** `test/alpha-logger.test.ts`
- Mock publicClient + walletClient
- Test logSignal(), getSignalCount(), getAgentBalance()
- Test error paths (missing env vars, failed RPC)

### Task 4.5: Test @hamafx/worker-core — SignalR consumer
**Objective:** Test WebSocket tick consumption  
**Files:** `packages/worker-core/test/signalr/consumer.test.ts`
- Mock HubConnection
- Test tick normalization
- Test reconnection logic
- Test subscription management

### Task 4.6: Test @hamafx/worker-core — TickBuffer and Candle1mAggregator
**Objective:** Test in-memory data structures  
**Files:**  
1. `test/signalr/tick-buffer.test.ts` — push, drain, overflow
2. `test/aggregator/candle-1m.test.ts` — OHLCV aggregation, boundary handling

### Task 4.7: Test @hamafx/worker-core — OnChainScanner
**Objective:** Test the periodic blockchain scanner  
**Files:** `test/onchain-scanner.test.ts`
- Mock scanRecentBlocks
- Test event persistence with deduplication
- Test timer start/stop lifecycle

### Task 4.8: Test @hamafx/worker-core — Finnhub fallback
**Objective:** Test REST tick source  
**Files:** `test/sources/finnhub.test.ts`
- Mock HTTP responses
- Test tick normalization
- Test polling lifecycle

### Task 4.9: Test @hamafx/worker-core — Runner integration
**Objective:** Test the full daemon lifecycle  
**Files:** `test/runner.test.ts`
- Mock all external dependencies
- Test start → tick → flush → stop cycle
- Test healthcheck pings

### Task 4.10: Test @hamafx/shared — Zod schemas
**Objective:** Test all shared schema validations  
**Files:** `packages/shared/test/schemas/`
1. `onchain-signal.test.ts` — signal schema validation
2. `alerts.test.ts` — alert schema validation
3. `biquote.test.ts` — BiQuote response schema
4. `candle.test.ts` — candle schema validation
5. `news.test.ts` — news schema validation
6. `calendar.test.ts` — calendar event schema

### Task 4.11: Test @hamafx/shared — Env validation
**Objective:** Test ServerEnv zod schema  
**Files:** `packages/shared/test/env.test.ts`
- Test valid config passes
- Test missing required fields fail
- Test invalid URLs rejected
- Test mutually exclusive fields

---

## Phase 5: Web App Tests (Weeks 3-4)

### Goal
Add integration tests for critical API routes and component tests for key UI elements.

### Task 5.1: Test critical API routes
**Objective:** API route integration tests with mock DB and AI  
**Files:** `apps/web/test/api/`
1. `chat.test.ts` — POST /api/chat, streaming response, error handling
2. `signals.test.ts` — GET /api/signals, filtering, pagination
3. `signals-log.test.ts` — POST /api/signals/[id]/log, on-chain logging
4. `auth.test.ts` — login/logout flow, cookie management
5. `market-candles.test.ts` — GET /api/market/candles with query params
6. `market-price.test.ts` — GET /api/market/price with symbol param
7. `cron-alerts.test.ts` — POST /api/cron/alerts with CRON_SECRET auth

### Task 5.2: Test key React components
**Objective:** Component tests for core UI elements  
**Files:** `apps/web/test/components/`
1. `chat-screen.test.tsx` — message rendering, auto-submit, error states
2. `composer.test.tsx` — text input, submit, attachment handling
3. `login-form.test.tsx` — validation, error display, success redirect
4. `error-boundary.test.tsx` — crash recovery, retry button

### Task 5.3: Test React hooks
**Objective:** Hook tests for data-fetching hooks  
**Files:** `apps/web/test/hooks/`
1. `use-signals.test.ts` — polling, error states, empty states
2. `use-candles.test.ts` — timeframe switching, loading states
3. `use-prices.test.ts` — real-time update simulation

---

## Phase 6: CI/CD Hardening (Week 4)

### Goal
Prevent regressions with automated gates.

### Task 6.1: Add coverage thresholds to CI
**Objective:** Fail CI if coverage drops below threshold  
**Files:** Modify `.github/workflows/ci.yml` and each `vitest.config.ts`  
- Set per-package coverage thresholds starting at achievable levels:
  - db: 70%, web3: 70%, worker-core: 60%, shared: 50%
  - ai: 40%, data: 50%, indicators: 70%
- Generate coverage report in CI
- Upload as GitHub artifact

### Task 6.2: Add pre-commit quality gates
**Objective:** Run lint + typecheck + subset of tests before every commit  
**Files:** Create `.husky/pre-commit` or modify turbo.json  
- Fast-only tests (unit tests, no integration)
- Lint-check changed files only
- Type-check changed packages only

### Task 6.3: Add integration test job to CI
**Objective:** Run integration tests that need real DB/RPC  
**Files:** Modify `.github/workflows/ci.yml`  
- Add Postgres service container
- Run DB-dependent tests (db, web API routes)
- Skip blockchain tests (no Mantle RPC in CI)

### Task 6.4: Add Sentry alerting for error rate spikes
**Objective:** Detect production errors before users report them  
**Files:** No code changes — Sentry project configuration  
- Set error rate alert threshold
- Configure PagerDuty/Discord notification
- Tag errors by package/service

---

## Phase 7: Code Quality Cleanup (Week 4)

### Goal
Remove dead code, fix type safety issues, align codebase with best practices.

### Task 7.1: Replace 27 unsafe `as` casts with type-safe alternatives
**Objective:** Eliminate all unsafe type assertions in critical packages  
**Files:** Modify files in packages/db, web3, worker-core, ai  
**Pattern:** Replace `(x as SomeType)` with Zod parse, type guards, or proper generics
**Test:** TypeScript strict mode must pass after changes

### Task 7.2: Remove dead code
**Objective:** Delete unused imports, dead functions, deprecated code  
**Files:**
- `packages/db/src/schema/onchain-signals.ts` — remove unused `sql` import
- `packages/shared/src/schemas/ui-parts.ts` — remove `void TOOL_NAMES`
- `apps/worker/package.json` — remove unused `@hamafx/indicators` dep
- Remove the legacy `apps/worker` if `worker-core` fully supersedes it (confirm first)
**Test:** `pnpm typecheck` + `pnpm test` pass

### Task 7.3: Add `'use client'` directives where missing
**Objective:** Fix M1 — ToolCard component missing directive  
**Files:** `apps/web/src/components/chat/parts/tool-card.tsx` + audit all components
**Test:** `pnpm typecheck` passes

### Task 7.4: Add missing DB indexes
**Objective:** Fix M6, M7 — add performance indexes  
**Files:** 
- `packages/db/src/schema/onchain-signals.ts` — add indexes on signal_type, asset, source, created_at
- `packages/db/src/schema/briefings.ts` — add index on message_id
**Test:** Verify indexes exist in test schema

### Task 7.5: Fix M5 — Use jsonb instead of json
**Objective:** Align trigger_data column type with project convention  
**Files:** `packages/db/src/schema/onchain-signals.ts`  
**Fix:** Change `json('trigger_data')` to `jsonb('trigger_data')`, add `withTimezone` to `created_at`
**Test:** Drizzle migration snapshot matches expected schema

---

## Execution Order & Dependencies

```
Phase 1 (Test Infra) ──► Phase 2 (Bug Fixes) ──► Phase 3 (Error Handling)
                                                    │
                                                    ▼
                         Phase 4 (Core Tests) ◄─────┘
                              │
                              ▼
                         Phase 5 (Web Tests)
                              │
                              ▼
                         Phase 6 (CI Hardening)
                              │
                              ▼
                         Phase 7 (Cleanup)
```

**Dependencies:**
- Phase 2 depends on Phase 1 (need test infra to write regression tests)
- Phase 4 depends on Phase 3 (tests for error handling patterns)
- Phase 5 depends on Phase 4 (API tests need tested core packages)
- Phase 6 depends on Phase 5 (coverage thresholds need tests to exist)
- Phase 7 can run in parallel with Phase 6

## Verification Strategy

After each phase:
1. `pnpm install --frozen-lockfile` — verify no dependency breakage
2. `pnpm typecheck` — verify TypeScript compliance
3. `pnpm lint` — verify code style
4. `pnpm test` — verify all tests pass
5. `git diff --stat` — review changes scope

After all phases:
1. Full CI pipeline green (lint → typecheck → test → coverage)
2. Coverage report shows >70% line coverage in core packages
3. Zero empty catch blocks remain
4. Zero `void` fire-and-forget without .catch()
5. All analysis-report issues C1-C4, H1-H7 resolved

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tests break existing functionality | HIGH | Run full test suite between every task. Keep tests independent. |
| DB migration breaks production | HIGH | Test migrations on staging DB first. Always generate (not hand-write) migrations. |
| Over-mocking hides real bugs | MEDIUM | Use integration tests with real DB container in CI alongside unit tests. |
| Error handling changes break Telegram/webhook paths | MEDIUM | Test real webhook handling paths manually before deploying. |
| Chart component tests are brittle | LOW | Use data-testid selectors, not CSS class names. Mock lightweight-charts. |

## Open Questions

1. Should the legacy `apps/worker` be fully deprecated in favor of `packages/worker-core`? The worker-core package already duplicates the daemon logic.
2. Should we add a staging environment before deploying Phase 2 bug fixes?
3. What coverage threshold is realistic for apps/web given 170 component files? 20% may be more achievable than 50%.