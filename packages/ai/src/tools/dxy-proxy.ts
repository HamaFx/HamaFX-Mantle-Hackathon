import type { Symbol } from '@hamafx/shared';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface SymbolCloses {
  closes: number[];
  times: number[];
}

interface DxyProxyResult {
  value: number;
  change24h: number;
  formula: string;
}

export function computeDxyProxy(
  a: SymbolCloses | undefined,
  b: SymbolCloses | undefined,
  symbolA: Symbol,
  symbolB: Symbol,
): DxyProxyResult {
  const formula = `DXY proxy = 100 / (${symbolA}^0.5 * ${symbolB}^0.5). Two-leg approximation; not a true DXY.`;

  if (!a || !b || a.closes.length === 0 || b.closes.length === 0) {
    return { value: 0, change24h: 0, formula };
  }

  const lastA = a.closes[a.closes.length - 1]!;
  const lastB = b.closes[b.closes.length - 1]!;
  const value = 100 / (Math.pow(lastA, 0.5) * Math.pow(lastB, 0.5));

  const lastTime = a.times[a.times.length - 1] ?? Date.now();
  const targetTime = lastTime - ONE_DAY_MS;
  const aAtTarget = closestPrice(a, targetTime);
  const bAtTarget = closestPrice(b, targetTime);

  let change24h = 0;
  if (aAtTarget !== null && bAtTarget !== null) {
    const past = 100 / (Math.pow(aAtTarget, 0.5) * Math.pow(bAtTarget, 0.5));
    if (past > 0) change24h = ((value - past) / past) * 100;
  }

  return { value, change24h, formula };
}

function closestPrice(s: SymbolCloses, targetMs: number): number | null {
  if (s.times.length === 0) return null;
  let bestIdx = 0;
  let bestDiff = Math.abs(s.times[0]! - targetMs);
  for (let i = 1; i < s.times.length; i += 1) {
    const d = Math.abs(s.times[i]! - targetMs);
    if (d < bestDiff) {
      bestDiff = d;
      bestIdx = i;
    }
  }
  return s.closes[bestIdx] ?? null;
}
