export const DEFAULT_RECONNECT_DELAYS: number[] = [0, 2_000, 5_000, 10_000, 30_000];

export function jitteredDelay(baseMs: number): number {
  const jitter = baseMs * 0.25;
  return Math.max(100, baseMs + (Math.random() * 2 - 1) * jitter);
}
