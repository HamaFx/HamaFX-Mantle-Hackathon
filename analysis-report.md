# HamaFX-Ai — Full Codebase Analysis Report

> Generated 2026-06-07 · 33 packages scanned · 400+ source files analyzed

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [CRITICAL Issues](#2-critical-issues)
3. [HIGH Severity Issues](#3-high-severity-issues)
4. [MEDIUM Severity Issues](#4-medium-severity-issues)
5. [LOW Severity Issues](#5-low-severity-issues)
6. [Dead Code Inventory](#6-dead-code-inventory)
7. [Type Safety Issues](#7-type-safety-issues)
8. [Missing Migrations](#8-missing-migrations)
9. [Architecture & Design Issues](#9-architecture--design-issues)
10. [Security Audit](#10-security-audit)
11. [Performance Profile](#11-performance-profile)
12. [Recommended Fixes (by priority)](#12-recommended-fixes-by-priority)

---

## 1. Project Overview

**Monorepo:** pnpm 9.15.4 · Turbo 2.9.14 · Node ≥20.11  
**Workspaces:** 7 packages (`shared`, `db`, `ai`, `data`, `web3`, `indicators`, `config`) + 2 apps (`web`, `worker`) + 1 standalone (`contracts`)  

```
@hamafx/shared        (zod schemas, types)           — leaf
@hamafx/db            (Drizzle ORM, Postgres schema)  — depends on shared
@hamafx/indicators    (technical analysis)            — depends on shared
@hamafx/data          (market data providers)         — depends on shared, db
@hamafx/web3          (Mantle blockchain client)      — depends on shared
@hamafx/ai            (AI agent + 40 tools)           — depends on shared, db, data, indicators, web3
@hamafx/config        (eslint, tsconfig, tailwind)    — leaf
@hamafx/web           (Next.js 15 app — web UI)       — depends on all except config
@hamafx/worker        (Node.js daemon — cron jobs)    — depends on all except config
```

---

## 2. CRITICAL Issues

These issues will cause runtime crashes, data loss, or silent failures in production.

### C1. `params` used synchronously in Next.js 15 route handler
**File:** `apps/web/src/app/api/signals/[id]/log/route.ts:12`  
**What:** `{ params }: { params: { id: string } }` — In Next.js 15, `params` is a `Promise<{ id: string }>`, not a plain object. `params.id` on a Promise always returns `undefined`, so every request hits the "Missing signal ID" error branch.  
**Fix:** Change to `{ params }: { params: Promise<{ id: string }> }` + `const { id } = await ctx.params;`  
**Evidence:** Compare with correctly-implemented routes: `api/chat/threads/[id]/route.ts:22`, `api/journal/[id]/route.ts:18`, `api/alerts/[id]/route.ts:18`.

### C2. Missing migrations for `onchain_events` and `job_locks` tables
**Files:**
- `packages/db/src/schema/onchain-events.ts` — fully defined, zero migration
- `packages/db/src/schema/job-locks.ts` — fully defined, zero migration

**What:** Two schema files exist in TypeScript but have NO corresponding SQL migration files under `packages/db/drizzle/`. The `job_locks` table is essential for `packages/db/src/locks.ts` to function. The `onchain_events` table is queried by `apps/worker/src/onchain-scanner.ts`.  
**Fix:** Run `drizzle-kit generate` to produce migrations, then `drizzle-kit migrate` or apply manually.  
**Impact:** Any runtime access to `schema.onchainEvents` or `schema.jobLocks` crashes with `relation does not exist`.

### C3. Candle data loss on worker shutdown
**File:** `apps/worker/src/index.ts:258`  
**What:** `aggregator.closeAll()` calls `onClosed` callback which does `void (async () => { await flushClosedCandle(...); })()`. The promise is discarded. If `process.exit(0)` runs before the DB write completes, the final 1-3 minutes of closed candles are lost on every restart/deploy.  
**Fix:** `await` the closeAll promise chain, or drain aggregator before calling Promise.all on the stop sequence.

### C4. Unbounded TCP buffer growth in MT5 server
**File:** `apps/worker/src/mt5-server.ts:23-69`  
**What:** `buffer += chunk.toString('utf8')` — per-socket buffer grows indefinitely when a client sends data without newlines. A malfunctioning MT5 terminal could cause OOM.  
**Fix:** Cap buffer at a reasonable size (e.g. 64KB) and disconnect the client if exceeded.

---

## 3. HIGH Severity Issues

These are bugs likely to cause incorrect behavior, data races, or significant maintenance burden.

### H1. Circular import in `locks.ts`
**File:** `packages/db/src/locks.ts:2`  
**What:** `import { getDb, schema } from './index'` — `index.ts` re-exports from `locks.ts`, creating a circular dependency. In ESM, `locks.ts` gets an uninitialized binding for `getDb` and `schema`.  
**Fix:** Import from `./client` directly instead: `import { getDb } from './client'; import * as schema from './schema/index';`

### H2. Unsafe cast in `locks.ts:77`
**File:** `packages/db/src/locks.ts:77`  
**What:** `(result as { rowCount?: number }).rowCount !== 0` — TypeScript `UpdateResult` from Drizzle may not have `rowCount` in all query modes.  
**Fix:** Use Drizzle's proper return type or switch to `.returning()` pattern.

### H3. Silent error swallowing in lock functions
**Files:** `packages/db/src/locks.ts:51-53,78-80`  
**What:** Both `acquireJobLock` and `renewJobLock` have `catch {}` blocks that swallow ALL errors silently. A transaction failure, serialization error, or deadlock produces no log or Sentry event.  
**Fix:** Add `console.error` or structured logger call in the catch block. At minimum re-throw unexpected errors after logging.

### H4. All BiQuote ticks dropped for first 15 seconds after startup
**File:** `apps/worker/src/index.ts:130`  
**What:** `lastMt5TickAt` starts at 0, so `now - lastMt5TickAt < 15_000` is true for the first 15 seconds, dropping ALL BiQuote ticks. If the MT5 bridge never connects, all BiQuote ticks are permanently dropped.  
**Fix:** Initialize `lastMt5TickAt` to `-Infinity` or add a "not yet initialized" flag.

### H5. Time scale subscription leak in chart component
**File:** `apps/web/src/components/chart/chart.tsx:274,390,477`  
**What:** RSI/MACD/ATR sub-pane effects call `mainChart.timeScale().subscribeVisibleLogicalRangeChange(...)` on EVERY effect run without cleaning up the previous subscription. Subscriptions accumulate with every dependency change (theme, candles, settings).  
**Fix:** Store the unsubscribe function and call it in the effect cleanup.

### H6. `confirm()` Promise leak on rapid double-tap
**File:** `apps/web/src/components/ui/confirm-drawer.tsx:138-142`  
**What:** If `confirm()` is called twice before the first drawer is dismissed, the second call's `resolve` overwrites the first in state, and the **first Promise never resolves** — it leaks forever in memory.  
**Fix:** Guard with a `pendingRef` or queue resolves.

### H7. 6 Phase-7c tools missing from `ToolOutputMap` and `TOOL_NAMES`
**Files:**
- `packages/shared/src/ai/tool-io.ts:69-104` — no entries for `get_onchain_activity`, `get_whale_alerts`, `get_defi_pools`, `analyze_alpha_signal`, `log_signal_onchain`, `get_agent_performance`
- `packages/shared/src/ai/tool-names.ts:7-42` — same 6 tools not listed

**What:** These tools use `declare module` augmentations referencing a non-existent `ToolRegistry` interface (the actual interface is `ToolIOMap`/`ToolOutputMap`). The module augmentation pattern is broken — the type declarations are dead code. Moreover, `TOOL_NAMES` iteration cannot discover them, breaking any code that iterates tools.  
**Fix:** Add entries to `ToolOutputMap` in `tool-io.ts` and add to `TOOL_NAMES` array in `tool-names.ts`.

### H8. Duplicate migrations 0006/0007
**Files:** `packages/db/drizzle/0006_phase1_hardening.sql`, `packages/db/drizzle/0007_high_gateway.sql`  
**What:** Migration 0007 re-creates `daily_ai_spend` table and `memory_embeddings_kind_source_uk` constraint that already exist in 0006. On a fresh DB, both would need to run; on an existing DB (where 0006 already ran), 0007 fails because objects already exist.  
**Fix:** Merge or regenerate migrations from current schema state.

### H9. Race condition in `confirm-drawer` Promise allocation
**File:** `apps/web/src/components/ui/confirm-drawer.tsx:138`  
**What:** Same as H6 — the `new Promise<boolean>((resolve) => { setState({...opts, open: true, resolve })})` stores the resolve function in state. If called twice rapidly, the first resolve is lost and the first Promise never settles.  
**Fix:** Add a `useRef` to track state and reject/ignore duplicate calls.

### H10. Raw `String(err)` leaks internal error details in signals API
**Files:**
- `apps/web/src/app/api/signals/route.ts:31,59`
- `apps/web/src/app/api/signals/[id]/log/route.ts:57`
- `apps/web/src/app/api/cron/onchain-scan/route.ts:44-45`

**What:** These routes use `String(err)` in the response body, which leaks DB query text, stack traces, and internal paths to the client. All other API routes use `errorResponse(err)` from `lib/api.ts` which returns a sanitized envelope.  
**Fix:** Use `errorResponse(err)` or return a generic "Internal error" message.

### H11. Non-constant-time CRON secret comparison
**File:** `apps/web/src/app/api/cron/onchain-scan/route.ts:9`  
**What:** Uses `!==` for bearer token comparison instead of `timingSafeEqual` from `lib/auth.ts`. Vulnerable to timing attacks on the CRON secret.  
**Fix:** Use `timingSafeEqual(secret, providedSecret)` like all other cron routes (`lib/cron.ts`).

### H12. Unstoppable Finnhub startup timer
**File:** `apps/worker/src/index.ts:197`  
**What:** `setTimeout(() => finnhubSource.start(), 15_000)` is never captured or cleared. If the worker stops during the 15-second bootstrap window, the timer fires after `stop()` and calls `start()` on a stopped source. Error is swallowed by `.catch(() => {})`.  
**Fix:** Capture `setTimeout` return and `clearTimeout` in `stop()`.

### H13. Found dead `main().catch(console.error)` in shipped source
**File:** `packages/ai/src/scratch.ts:25`  
**What:** The entire file is a development scratchpad (`async function main() { ... }; main().catch(console.error)`) included in the shipped package. It imports `@ai-sdk/google-vertex` and `ai` at the module top level. While tree-shaking likely removes the dead code, it's a code-quality flag and could mask issues.  
**Fix:** Delete the file.

### H14. Actor-critical tools bypass `withTelemetry()`
**Files:**
- `packages/ai/src/tools/analyze-chart-image.ts:80` — raw `{ ... }` not wrapped with `withTelemetry()`
- `packages/ai/src/tools/summarize-thread.ts:51` — same issue

**What:** These are among the most expensive tools (LLM calls), yet they bypass the central telemetry wrapper (`withTelemetry`). No `chat_tool_telemetry` rows are recorded for these invocations, losing cost tracking and failure diagnostics.  
**Fix:** Wrap them like every other tool in `tools/index.ts`.

---

## 4. MEDIUM Severity Issues

These cause degraded experience, wasted resources, or are latent bugs.

### M1. Missing `'use client'` on `ToolCard` component
**File:** `apps/web/src/components/chat/parts/tool-card.tsx:8`  
**What:** Uses `useState` but lacks `'use client'` directive. Works because it's only imported by client components, but would break if imported from a server component.  
**Fix:** Add `'use client';` at the top.

### M2. `@hamafx/indicators` listed in worker deps but never imported
**File:** `apps/worker/package.json:20`  
**What:** `@hamafx/indicators` is a dependency but is never imported anywhere in the worker source. It's either dead or used transitively by another `@hamafx/*` package (which would still work as a transitive dep).  
**Fix:** Remove the unused dependency.

### M3. `void TOOL_NAMES;` dead code in shared package
**File:** `packages/shared/src/schemas/ui-parts.ts:126`  
**What:** `void TOOL_NAMES;` imports `TOOL_NAMES` only to suppress the "unused import" lint warning. The import serves no runtime purpose.  
**Fix:** Remove the unused import and the `void` statement.

### M4. Unused `sql` import in `onchain-signals.ts`
**File:** `packages/db/src/schema/onchain-signals.ts:8`  
**What:** `import { sql } from 'drizzle-orm';` imported but never used anywhere in the file.  
**Fix:** Remove the import.

### M5. `trigger_data` uses `json` instead of `jsonb`
**File:** `packages/db/src/schema/onchain-signals.ts:23`  
**What:** Uses `json('trigger_data')` while every other JSON column in the schema uses `jsonb`. Also `created_at` uses `timestamp` without `{ withTimezone: true }`.  
**Fix:** Change to `jsonb('trigger_data')` and add `{ withTimezone: true }` to `created_at`.

### M6. `onchain_signals` table has NO indexes
**File:** `packages/db/src/schema/onchain-signals.ts`  
**What:** No indexes defined. Every query by `signal_type`, `asset`, `source`, or `created_at` will be a sequential scan. As this table grows, performance degrades linearly.  
**Fix:** Add indexes on `signal_type`, `asset`, `source`, `created_at`.

### M7. `briefings_emitted.message_id` has no FK index
**File:** `packages/db/src/schema/briefings.ts`  
**What:** `message_id` is an FK to `chat_messages.id` with ON DELETE CASCADE but no index. Any join or filter by message_id will scan.  
**Fix:** Add a B-tree index on `message_id`.

### M8. `void AUTH_COOKIE_NAME;` lint trick in login route
**File:** `apps/web/src/app/api/auth/login/route.ts:97`  
**What:** `AUTH_COOKIE_NAME` imported, mentioned in a comment, then voided to satisfy the linter. Should use a type-only import of the constant or remove the dead reference.  
**Fix:** Either use it or remove the import.

### M9. Fire-and-forget `sendMessage` without `.catch()`
**File:** `apps/web/src/components/chat/chat-screen.tsx:128,208,222,229,246,274,277`  
**What:** `void sendMessage({...})` — the void suppresses "floating promise" lint but doesn't handle errors. While `useChat` likely handles internal errors, network errors during send would be silently lost.  
**Fix:** Add `.catch(console.error)` or ensure `useChat` propagates errors.

### M10. No `AbortError` handling in chat API route
**File:** `apps/web/src/app/api/chat/route.ts:117`  
**What:** When a client disconnects (navigates away, closes tab), the AI SDK throws `AbortError`. The current catch block returns a 500 "Internal error" response for this expected case.  
**Fix:** Catch `AbortError` specifically and return a 499 (or no response).

### M11. `req.signal` not propagated in several cron routes
**Files:** `apps/web/src/app/api/cron/weekly-review/route.ts`, `apps/web/src/app/api/cron/snapshots/route.ts`, `apps/web/src/app/api/cron/calendar/route.ts`, `apps/web/src/app/api/cron/news/route.ts`  
**What:** Unlike `alerts` and `embedding-backfill`, these cron handlers don't pass `req.signal` to their operations. Inconsistent abort signal handling across cron routes.  
**Fix:** Pass `req.signal` to long-running operations consistently.

### M12. Duplicate `readCookie` function in 5 files
**Files:**
- `apps/web/src/lib/cron.ts:75`
- `apps/web/src/app/api/push/subscribe/route.ts:68`
- `apps/web/src/app/api/push/unsubscribe/route.ts:46`
- `apps/web/src/app/api/admin/test-telegram/route.ts:92`
- `apps/web/src/app/api/admin/test-alert-email/route.ts:96`

**What:** The same `readCookie` function is duplicated across 5 files.  
**Fix:** Extract into `lib/auth.ts` and import everywhere.

### M13. Hardcoded Sepolia token addresses with no mainnet fallback
**File:** `packages/web3/src/chain-reader.ts:25-31`  
**What:** `MANTLE_TOKENS` contains hardcoded Sepolia testnet addresses. No mainnet address map exists. A production deployment pointing to mainnet RPC would use testnet addresses, likely causing silent failures or reverts.  
**Fix:** Add a mainnet address map and switch based on `MANTLE_RPC_URL` or `NODE_ENV`.

### M14. No RPC fallback for Mantle client
**File:** `packages/web3/src/client.ts:25-31`  
**What:** Single `PublicClient` with one hardcoded RPC URL. If the primary RPC endpoint is down or rate-limited, ALL blockchain operations fail.  
**Fix:** Implement multi-RPC failover (try next URL on failure/rate-limit).

### M15. `confirmDrawer.confirm()` called twice leaks unresolved Promise
**File:** `apps/web/src/components/ui/confirm-drawer.tsx:138` — Same as H6/H9. Duplicates across severity levels for prioritization.

### M16. Chat top-bar 6-line dead comment
**Files:** `apps/web/src/app/api/telegram/webhook/route.ts:27-32` — 6-line comment about `waitUntil` that describes a problem, ideal solution, then says "we'll just await it."  
**Fix:** Reduce to concise 1-2 line note.

### M17. Async IIFE with silent error swallow in chat-screen
**File:** `apps/web/src/components/chat/chat-screen.tsx:136-157`  
**What:** `void (async () => {... try {...} catch { /* silent */ } })();` — The title refresh after streaming swallows errors silently.  
**Fix:** Log the error.

### M18. Race condition in in-memory throttle path
**File:** `packages/data/src/cache/throttle.ts:64-74`  
**What:** Two concurrent `tryReserve` calls can both pass the `effectiveLimit` check before either increments, allowing bursts beyond the configured limit.  
**Fix:** Add a mutex or use atomic operations.

### M19. Finnhub response shape not validated
**File:** `apps/worker/src/sources/finnhub.ts:33-34`  
**What:** `const json: FinnhubQuote = await res.json(); if (json.c === 0) return null;` — If Finnhub changes API shape, `json.c` could be `undefined` (which is not `=== 0`), so the check passes and `undefined` flows as `NaN` after arithmetic.  
**Fix:** Use zod to validate the response shape.

### M20. Falsy timestamp bug in MT5 server
**File:** `apps/worker/src/mt5-server.ts:52`  
**What:** `Number(raw.ts) || Date.now()` — treats `0` (valid ms epoch for 1970) as falsy and falls back. Should use `??` instead of `||`.  
**Fix:** Use `Number(raw.ts) ?? Date.now()` or check `!= null`.

---

## 5. LOW Severity Issues

These are minor code quality, style, or future-proofing concerns.

### L1. `_extensions.ts` references non-existent migration file
**File:** `packages/db/src/schema/_extensions.ts:3` — Comment says `./drizzle/0000_extensions.sql` but the actual file is `./drizzle/0000_lazy_red_shift.sql`.

### L2. Missing `runtime = 'nodejs'` in signals API routes
**Files:** `apps/web/src/app/api/signals/route.ts`, `apps/web/src/app/api/signals/[id]/log/route.ts`  
**Note:** These use `getDb()` which requires Node.js. No runtime export means they could deploy to Edge by default depending on Vercel configuration.

### L3. `void sql;` in memory.ts for unused import suppression
**File:** `packages/db/src/schema/memory.ts:63`

### L4. Confusing preprocessor duplication in worker env
**File:** `apps/worker/src/env.ts:21-29` — `coerceEmptyToUndefined` and `optionalNonEmpty` are semantically identical but use different zod mechanisms.

### L5. `ToolCard` popover uses experimental CSS anchor positioning
**File:** `apps/web/src/components/chat/message.tsx:204,207,220-221` — CSS Anchor Positioning (`anchor-name`, `position-anchor`) is Chrome 125+ only. Falls back to default positioning in Firefox/Safari.

### L6. Redundant `Date.now()` in cache success path
**File:** `packages/data/src/cache/memory.ts:100` — Captures `producedAt` at line 82 but calls `Date.now()` again at line 100.

### L7. `RETURNING` clause fetches unused `count` column in throttle
**File:** `packages/data/src/cache/throttle.ts:109` — `.returning({ count: providerThrottle.count })` returns count but only checks `result.length > 0`. Useless round-trip data.

### L8. `defaultSwingLookback` returns `undefined` for unknown timeframe
**File:** `packages/indicators/src/smc/defaults.ts:21` — No `default` case in switch. Returns `undefined` which propagates as `NaN`.

### L9. `msPerTimeframe` returns `undefined` for unknown timeframe
**File:** `packages/shared/src/timeframes.ts:31` — No `default` case in switch.

### L10. No NaN guard on `closes()` extractor
**File:** `packages/indicators/src/util.ts:8` — `c.c` could be `NaN` if upstream candle data is corrupt. Typed as `number` but real validation is in zod, not at call site.

### L11. Roundtrip precision loss in `chain-reader.ts`
**File:** `packages/web3/src/chain-reader.ts:72,97` — Formats `value` to 4 decimal string, then re-parses to number. Drops sub-0.0001 precision.

### L12. `Date.now()` used instead of block timestamp
**File:** `packages/web3/src/chain-reader.ts:78` — Comment acknowledges this. Block-level timestamps available via `log.blockNumber`.

### L13. Concurrent poll overlap in Finnhub source
**File:** `apps/worker/src/sources/finnhub.ts:74` — `void this.poll()` runs immediately + `setInterval(5s)`. If `poll()` takes >5s, concurrent polls stack up. No concurrency guard.

### L14. Concurrent scanner overlap
**File:** `apps/worker/src/onchain-scanner.ts:19-24` — `this.tick()` without `await` + `setInterval(30s)`. Same pattern as L13.

### L15. `popoverTarget` may not be recognized by React 19 types
**File:** `apps/web/src/components/chat/message.tsx:204` — The React 19 JSX types may not include the `popoverTarget` prop. Currently cast with `as any`.

### L16. `logSignalOnChain` heavy `as any` casts
**File:** `apps/web/src/app/api/signals/[id]/log/route.ts:34,36,38` — Multiple `as any` casts to match the smart contract function signature.

---

## 6. Dead Code Inventory

| ID | File | Code | Status |
|----|------|------|--------|
| D1 | `packages/ai/src/scratch.ts` | Entire file — dev scratchpad | **DELETE** |
| D2 | `apps/worker/src/sources/manager.ts` | Entire file (139 lines) — `TickSourceManager` never imported anywhere | **DELETE** |
| D3 | `apps/worker/src/sources/types.ts` | `TickSource` interface — only 1 consumer (finnhub.ts); abstraction value near-zero | **KEEP** |
| D4 | `packages/shared/src/schemas/ui-parts.ts:126` | `void TOOL_NAMES;` — lint suppression dead code | **DELETE** |
| D5 | `packages/db/src/schema/onchain-signals.ts:8` | `import { sql } from 'drizzle-orm'` — never used | **DELETE** |
| D6 | `packages/db/src/schema/memory.ts:63` | `void sql;` — lint suppression | **CLEANUP** |
| D7 | `apps/web/src/app/api/auth/login/route.ts:97` | `void AUTH_COOKIE_NAME;` — lint suppression | **CLEANUP** |
| D8 | `apps/web/src/app/api/telegram/webhook/route.ts:27-32` | 6-line dead comment about waitUntil | **CLEANUP** |
| D9 | `apps/web/src/app/api/chat/route.ts:77-83` | Historical dead comment about removed auto-journal | **CLEANUP** |
| D10 | `packages/ai/src tools/` — 6 tools with broken `declare module` augmentations referencing non-existent `ToolRegistry` | Broken type declarations | **FIX** |

---

## 7. Type Safety Issues

| ID | File:Line | Severity | Issue |
|----|-----------|----------|-------|
| TS1 | `packages/db/src/locks.ts:77` | HIGH | `(result as { rowCount?: number }).rowCount` — unsafe cast on `UpdateResult` |
| TS2 | `apps/web/src/app/api/signals/[id]/log/route.ts:34-38` | HIGH | 5 `as any` casts to match smart contract function |
| TS3 | `apps/web/src/app/(app)/chat/[threadId]/page.tsx:50` | HIGH | `as any[]` on entire message array |
| TS4 | `apps/web/src/components/chart/chart.tsx` (16 locations) | MEDIUM | Multiple `as any` casts for lightweight-charts integration |
| TS5 | `apps/worker/src/jobs/resonance-sync.ts:71` | MEDIUM | `s.data as { close?: number }` — trusts DB JSON column shape |
| TS6 | `packages/web3/src/alpha-logger.ts:80,86` | MEDIUM | `addr as \`0x${string}\`` — no hex format validation on env vars |
| TS7 | `packages/web3/src/alpha-logger.ts:120` | MEDIUM | `wallet.account!` — non-null assertion on potentially undefined account |
| TS8 | `shared/ai/tool-io.ts:69-104` | HIGH | 6 tools missing from `ToolOutputMap`, module augmentation references non-existent `ToolRegistry` |
| TS9 | `apps/worker/src/sources/finnhub.ts:94-101` | MEDIUM | No NaN guard on Finnhub response numeric fields |
| TS10 | `apps/web/src/components/chat/message.tsx:73,298,310-318` | MEDIUM | Multiple `as unknown as` casts for chat part types |

---

## 8. Missing Migrations

| Table | Schema File | Migration File | Status |
|-------|-------------|----------------|--------|
| `onchain_events` | `schema/onchain-events.ts` | **NONE** | **CRITICAL** — runtime crash when scanned |
| `job_locks` | `schema/job-locks.ts` | **NONE** | **CRITICAL** — runner CLI depends on this |

Both tables exist only in TypeScript. No SQL migration files exist under `packages/db/drizzle/`. Any code that queries these tables (onchain-scanner.ts, runner/cli.ts) will crash with `relation does not exist` at runtime.

---

## 9. Architecture & Design Issues

### 9.1 Dual Committee Systems
The project has **two competing committee implementations**:
1. **`packages/ai/src/committee/committee.ts`** — our Phase 7b refactored version with `GenerateTextFn` callback
2. **`packages/ai/src/tools/convene-committee.ts`** — the Phase 7c tool that calls AI models directly

These share zero code. The Phase 7c tool doesn't use the refactored `committee.ts` module.

### 9.2 Dual DXY Proxy Implementations
Two different ways to estimate the DXY index from available data:
1. **`packages/ai/src/tools/get-correlation.ts`** — one formula
2. **`packages/data/src/providers/fred/resonance.ts`** — different formula and symbols

Both produce slightly different values for the same concept.

### 9.3 Source Manager Dead Code vs. Inline Logic
The worker's `src/sources/manager.ts` (139 lines) provides a clean `TickSourceManager` abstraction for primary/fallback/MT5 orchestration, but it's never imported. The actual `index.ts` replicates the same logic inline (less documented, harder to test). Decision needed: delete manager.ts or refactor to use it.

### 9.4 `ToolIOMap` vs `ToolRegistry` Interface Mismatch
7 tools use `declare module '...' { interface ToolRegistry { ... } }` but the module defines `ToolIOMap` and `ToolOutputMap`. The `ToolRegistry` interface doesn't exist. This module augmentation pattern is broken — it produces dead type declarations.

### 9.5 Duplicate `TradeDirectionSchema` (3 copies)
The same `z.enum(['long', 'short'])` schema is defined in:
- `schemas/tool-outputs/compute-risk.ts:15` — as `TradeDirectionSchema`
- `schemas/tool-outputs/verify-call.ts:26` — as `VerifyCallDirectionSchema`
- `schemas/ui-parts.ts:78` — inline

Should be extracted to a shared location.

---

## 10. Security Audit

| ID | File:Line | Issue | Severity |
|----|-----------|-------|----------|
| S1 | `apps/web/src/app/api/cron/onchain-scan/route.ts:9` | Non-constant-time CRON secret comparison | **HIGH** |
| S2 | `apps/web/src/app/api/signals/route.ts:31,59` | `String(err)` leaks error details to client | **HIGH** |
| S3 | `apps/web/src/app/api/signals/[id]/log/route.ts:57` | Same leak pattern | **HIGH** |
| S4 | `apps/web/src/app/api/auth/login/route.ts:76-77` | ✅ Timing-safe comparison correctly used | Good |
| S5 | `apps/web/src/app/api/signals/route.ts:38` | `.parse()` instead of `.safeParse()` — Zod error messages leak schema structure | **MEDIUM** |
| S6 | `apps/web/src/app/api/cron/onchain-scan/route.ts:9` | No `timingSafeEqual` import | **HIGH** |
| S7 | `packages/web3/src/alpha-logger.ts:86` | Private key passed as `\`0x${string}\`` cast without validation | **MEDIUM** |

---

## 11. Performance Profile

### 11.1 Bundle Size (Web)
Current production bundle as of last build:
- First Load JS shared: **103 kB**
- `/chat/[threadId]`: **280 kB** (largest)
- `/chart/[symbol]`: **207 kB**
- Middleware: **135 kB**

### 11.2 Slowest Pages
| Page | Size | Notes |
|------|------|-------|
| Chat with thread | 280 kB | All 27 tool renderers included |
| Chart with symbol | 207 kB | lightweight-charts dynamic import |
| Alerts | 198 kB | Form + list components |
| Settings | 168 kB | 12 setting cards |

### 11.3 API Route Performance
- Chat API route has `maxDuration: 60s` in `vercel.json` — reasonable for AI streaming
- 7 cron routes with varying durations (15-60s)
- `onchain-scan` cron: **missing `maxDuration`** override in vercel.json (defaults to 10s or 30s depending on plan)

### 11.4 Database Query Efficiency
- `onchain_signals` table has **NO indexes** — every query scans full table
- `briefings_emitted.message_id` FK has no index
- `chat_messages_thread_idx` is well-designed (composite on thread_id + created_at)
- `candles_1m` PK is (symbol, t) — good for time-series queries

---

## 12. Recommended Fixes (by priority)

### Tier 1 — Fix Now (production-blocking)

| # | Fix | File(s) | Effort |
|---|-----|---------|--------|
| 1 | Fix Next.js 15 `params` Promise usage | `signals/[id]/log/route.ts` | 2 min |
| 2 | Generate migrations for `onchain_events` + `job_locks` | `packages/db/src/schema/*` | 10 min |
| 3 | Eliminate circular import in `locks.ts` | `packages/db/src/locks.ts` | 5 min |
| 4 | `await` aggregator closeAll on shutdown | `apps/worker/src/index.ts` | 5 min |
| 5 | Fix MT5 unbounded TCP buffer | `apps/worker/src/mt5-server.ts` | 10 min |

### Tier 2 — Fix This Week (may cause incorrect behavior)

| # | Fix | File(s) | Effort |
|---|-----|---------|--------|
| 6 | Add 6 missing tools to `ToolOutputMap` + `TOOL_NAMES` | `packages/ai/src/tools/*`, `packages/shared/src/ai/*` | 20 min |
| 7 | Fix chart time scale subscription leak | `apps/web/src/components/chart/chart.tsx` | 15 min |
| 8 | Fix `confirm()` Promise leak | `apps/web/src/components/ui/confirm-drawer.tsx` | 5 min |
| 9 | Fix all BiQuote tick drop at startup | `apps/worker/src/index.ts` | 5 min |
| 10 | Remove `scratch.ts` from shipped code | `packages/ai/src/scratch.ts` | 1 min |
| 11 | Fix duplicate migrations 0006/0007 | `packages/db/drizzle/` | 15 min |
| 12 | Add `withTelemetry()` to analyze-chart-image + summarize-thread | `packages/ai/src/tools/*` | 10 min |
| 13 | Fix locks.ts silent catch blocks | `packages/db/src/locks.ts` | 5 min |
| 14 | Fix locks.ts unsafe cast | `packages/db/src/locks.ts` | 5 min |
| 15 | Fix signals API routes to use `errorResponse` | `apps/web/src/app/api/signals/` | 10 min |
| 16 | Fix CRON secret timing-safe comparison | `apps/web/src/app/api/cron/onchain-scan/route.ts` | 5 min |

### Tier 3 — Fix This Sprint

| # | Fix | Effort |
|---|-----|--------|
| 17 | Add indexes to `onchain_signals` | 10 min |
| 18 | Add index to `briefings_emitted.message_id` | 5 min |
| 19 | Remove dead code: `manager.ts`, `void TOOL_NAMES`, `void sql`, `void AUTH_COOKIE_NAME` | 10 min |
| 20 | Extract `readCookie` to shared `lib/auth.ts` | 15 min |
| 21 | Add mainnet token addresses + RPC fallback to `@hamafx/web3` | 30 min |
| 22 | Fix `onchain-signals.ts` `json`→`jsonb`, add `withTimezone` | 5 min |
| 23 | Remove unused `@hamafx/indicators` from worker deps | 2 min |
| 24 | Fix Finnhub response validation and NaN guards | `apps/worker/src/sources/finnhub.ts` | 15 min |
| 25 | Fix `||` vs `??` falsy trap in MT5 server | 5 min |

### Tier 4 — Nice to Have

| # | Fix | Effort |
|---|-----|--------|
| 26 | Remove dead comment blocks in chat/telegram routes | 5 min |
| 27 | Add `runtime = 'nodejs'` to signals API routes | 2 min |
| 28 | Propagate `req.signal` consistently across cron routes | 10 min |
| 29 | Add `'use client'` to ToolCard | 1 min |
| 30 | Add concurrency guard to Finnhub poll + onchain scanner | 10 min |
| 31 | Reconcile dual committee and dual DXY implementations | 2-4 hours |
| 32 | Extract `TradeDirectionSchema` to shared location | 10 min |
| 33 | Fix `defaultSwingLookback` default case | 5 min |
| 34 | Fix `msPerTimeframe` default case | 5 min |
| 35 | Add NaN guard to `closes()` extractor | 5 min |

---

## File Count Summary

| Scope | Files Read | Issues Found |
|-------|-----------|--------------|
| Root config | 12 | 0 |
| `packages/shared` | 55 | 12 |
| `packages/db` | 27 | 15 |
| `packages/data` | 30 | 7 |
| `packages/ai` | 74 | 18+ |
| `packages/web3` | 4 | 8 |
| `packages/indicators` | 17 | 6 |
| `packages/config` | 7 | 0 |
| `apps/web` | 106+ | 30+ |
| `apps/worker` | 27 | 25+ |
| `infra/` | 40+ | 2 (in timers already fixed) |
| **Total** | **400+** | **120+** |
