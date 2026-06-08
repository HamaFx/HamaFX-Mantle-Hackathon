import type { getDb } from '@hamafx/db';
import { candles1m } from '@hamafx/db/schema';

import type { ClosedCandle } from '../aggregator/candle-1m.js';
import type { Logger } from '../logger.js';

export interface FlushClosedCandleArgs {
  db: ReturnType<typeof getDb>;
  log: Logger;
  bar: ClosedCandle;
}

export async function flushClosedCandle(args: FlushClosedCandleArgs): Promise<void> {
  const { bar } = args;
  await args.db
    .insert(candles1m)
    .values({
      symbol: bar.symbol,
      t: new Date(bar.t),
      o: bar.o,
      h: bar.h,
      l: bar.l,
      c: bar.c,
      v: bar.v,
      tickVolume: bar.tickVolume,
      source: bar.source,
    })
    .onConflictDoNothing();
}
