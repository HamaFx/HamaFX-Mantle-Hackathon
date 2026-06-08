// Tool: get_correlation.
//
// Returns a Pearson correlation matrix over close-to-close returns for
// all pairs of supported symbols at a given timeframe + window, plus a
// derived USD-strength proxy ("DXY proxy") computed from the FX legs.
//
// The proxy is **not** a true DXY (no JPY, CAD, SEK, CHF) — we only have
// ETHUSDT and MNTUSDT. The formula is captured verbatim in
// `dxyProxy.formula` so any agent answer that quotes the value can also
// quote the formula, and the UI labels the value as a proxy clearly.

import { getCandles } from '@hamafx/data';
import {
  GetCorrelationInputSchema,
  SYMBOLS,
  type CorrelationCell,
  type GetCorrelationOutput,
  type Symbol,
  type Timeframe,
} from '@hamafx/shared';
import { tool } from 'ai';
import type { z } from 'zod';

import { computeDxyProxy as sharedDxyProxy } from './dxy-proxy';

const InputSchema = GetCorrelationInputSchema;

declare module '@hamafx/shared' {
  interface ToolIOMap {
    get_correlation: { input: z.infer<typeof InputSchema> };
  }
}

export const getCorrelationTool = tool({
  description:
    "Pearson correlation matrix over close-to-close returns for MNTUSDT/BTCUSDT/ETHUSDT at the given timeframe + window, plus a Crypto-strength proxy ('Crypto proxy') computed from BTCUSDT and ETHUSDT with 50/50 weights. Use for any 'are BTC and ETH both selling off' / 'how correlated is MNT to BTC' / 'what's crypto doing today' prompt. Returns the formula verbatim so you can cite it.",
  inputSchema: InputSchema,
  execute: async ({ tf, windowBars }): Promise<GetCorrelationOutput> => {
    const need = windowBars + 1;
    const candlesBySymbol = new Map<Symbol, ReturnType<typeof bareReturns>>();
    for (const symbol of SYMBOLS) {
      try {
        const bars = await getCandles(symbol, tf, { count: need });
        candlesBySymbol.set(symbol, bareReturns(bars));
      } catch {
        // Per-symbol failure tolerated; skip the matrix entry below.
      }
    }

    const matrix: CorrelationCell[] = [];
    for (let i = 0; i < SYMBOLS.length; i += 1) {
      for (let j = i + 1; j < SYMBOLS.length; j += 1) {
        const a = SYMBOLS[i]!;
        const b = SYMBOLS[j]!;
        const ra = candlesBySymbol.get(a);
        const rb = candlesBySymbol.get(b);
        if (!ra || !rb || ra.returns.length < windowBars || rb.returns.length < windowBars) continue;
        const r = pearson(ra.returns.slice(-windowBars), rb.returns.slice(-windowBars));
        matrix.push({ a, b, r: clampUnit(r) });
      }
    }

    return {
      tf,
      windowBars,
      asOf: Date.now(),
      matrix,
      dxyProxy: computeDxyProxy(candlesBySymbol, tf, windowBars),
    };
  },
});

// ---------------------------------------------------------------------------
// Returns / Pearson
// ---------------------------------------------------------------------------

interface SymbolReturns {
  /** Closes oldest-first; same length as the input candle window. */
  closes: number[];
  /** Close-to-close log returns, length = closes.length - 1. */
  returns: number[];
  /** Bar timestamps (ms epoch UTC), aligned to `closes`. */
  times: number[];
}

function bareReturns(bars: { c: number; t: number }[]): SymbolReturns {
  const closes: number[] = [];
  const times: number[] = [];
  for (const b of bars) {
    if (Number.isFinite(b.c)) {
      closes.push(b.c);
      times.push(b.t);
    }
  }
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1]!;
    const curr = closes[i]!;
    if (prev > 0) returns.push(Math.log(curr / prev));
  }
  return { closes, returns, times };
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i]!;
    const y = ys[i]!;
    sx += x;
    sy += y;
    sxy += x * y;
    sxx += x * x;
    syy += y * y;
  }
  const num = n * sxy - sx * sy;
  const denomX = n * sxx - sx * sx;
  const denomY = n * syy - sy * sy;
  const den = Math.sqrt(denomX * denomY);
  return den === 0 ? 0 : num / den;
}

function clampUnit(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(-1, Math.min(1, x));
}

// ---------------------------------------------------------------------------
// DXY proxy
// ---------------------------------------------------------------------------

function computeDxyProxy(
  data: Map<Symbol, SymbolReturns>,
  _tf: Timeframe,
  _windowBars: number,
): GetCorrelationOutput['dxyProxy'] {
  const core = sharedDxyProxy(data.get('BTCUSDT'), data.get('ETHUSDT'), 'BTCUSDT', 'ETHUSDT');
  const btc = data.get('BTCUSDT');
  const eth = data.get('ETHUSDT');
  return {
    ...core,
    samples: Math.min(btc?.closes.length ?? 0, eth?.closes.length ?? 0),
  };
}
