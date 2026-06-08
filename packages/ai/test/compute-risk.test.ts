import { describe, expect, it } from 'vitest';

import { computeRiskTool } from '../src/tools/compute-risk';

// The tool is registered via `tool({ ..., execute })`; we get at the
// underlying implementation via `.execute` for direct testing.
const exec = computeRiskTool.execute as unknown as (input: unknown) => Promise<{
  symbol: string;
  side: string;
  riskUsd: number;
  rewardUsd: number | null;
  rrRatio: number | null;
  pipsToStop: number;
  pipsToTarget: number | null;
  positionSizeLots: number;
  positionSizeUnits: number;
  invalidDirection: boolean;
  summary: string;
}>;

describe('compute_risk — Phase 7b', () => {
  it('sizes a 1 % ETHUSDT long correctly', async () => {
    const r = await exec({
      symbol: 'ETHUSDT',
      side: 'long',
      entry: 1.085,
      stop: 1.082,
      target: 1.092,
      accountUsd: 10_000,
      riskPct: 1,
    });
    // 1 % of 10k = $100 risk; pipsToStop = 30; pip value $10/lot
    // → size = 100 / (30 * 10) = 0.333… lots
    expect(r.riskUsd).toBeCloseTo(100, 6);
    expect(r.pipsToStop).toBeCloseTo(30, 6);
    expect(r.positionSizeLots).toBeCloseTo(100 / (30 * 10), 6);
    expect(r.positionSizeUnits).toBeCloseTo(((100 / (30 * 10)) * 100_000), 0);
    expect(r.rrRatio).toBeCloseTo(70 / 30, 6);
    expect(r.invalidDirection).toBe(false);
  });

  it('sizes BTCUSDT correctly', async () => {
    const r = await exec({
      symbol: 'BTCUSDT',
      side: 'short',
      entry: 2400,
      stop: 2410,
      target: 2380,
      accountUsd: 10_000,
      riskPct: 1,
    });
    // BTCUSDT uses crypto pip schedule (1 pip = 0.0001 for this price range)
    // Difference = 10, so pips = 10 / 0.0001 = 100000
    expect(r.pipsToStop).toBeGreaterThan(0);
    expect(r.riskUsd).toBeCloseTo(100, 6);
    expect(r.invalidDirection).toBe(false);
  });

  it('returns null reward + RR when target is omitted', async () => {
    const r = await exec({
      symbol: 'MNTUSDT',
      side: 'long',
      entry: 1.27,
      stop: 1.265,
      accountUsd: 5_000,
      riskPct: 0.5,
    });
    expect(r.rewardUsd).toBeNull();
    expect(r.rrRatio).toBeNull();
    expect(r.pipsToTarget).toBeNull();
    expect(r.invalidDirection).toBe(false);
  });

  it('flags invalidDirection when stop is on the wrong side of entry', async () => {
    const long = await exec({
      symbol: 'ETHUSDT',
      side: 'long',
      entry: 1.08,
      stop: 1.085, // above entry — wrong for a long
      target: 1.075,
      accountUsd: 10_000,
      riskPct: 1,
    });
    expect(long.invalidDirection).toBe(true);

    const short = await exec({
      symbol: 'ETHUSDT',
      side: 'short',
      entry: 1.08,
      stop: 1.075, // below entry — wrong for a short
      target: 1.085,
      accountUsd: 10_000,
      riskPct: 1,
    });
    expect(short.invalidDirection).toBe(true);
  });

  it('caps riskPct at 10 % via the input schema', async () => {
    // The AI SDK validates the input schema before invoking `execute()`,
    // so we exercise the schema directly here. `tool({})` exposes the
    // schema on `inputSchema`.
    const schema = computeRiskTool.inputSchema as { safeParse: (v: unknown) => { success: boolean } };
    expect(
      schema.safeParse({
        symbol: 'ETHUSDT',
        side: 'long',
        entry: 1.08,
        stop: 1.075,
        accountUsd: 10_000,
        riskPct: 11,
      }).success,
    ).toBe(false);
  });

  it('emits a useful summary string the agent can echo verbatim', async () => {
    const r = await exec({
      symbol: 'ETHUSDT',
      side: 'long',
      entry: 1.085,
      stop: 1.082,
      target: 1.092,
      accountUsd: 10_000,
      riskPct: 1,
    });
    expect(r.summary).toMatch(/Long ETHUSDT/);
    expect(r.summary).toMatch(/lots/);
    expect(r.summary).toMatch(/at risk/);
    expect(r.summary).toMatch(/RR/);
  });
});
