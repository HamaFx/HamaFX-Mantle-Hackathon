import type { getDb } from '@hamafx/db';
import { liveTicks } from '@hamafx/db/schema';
import { sql } from 'drizzle-orm';

import type { Logger } from '../logger';
import type { NormalizedTick } from '../signalr/consumer';
import type { TickBuffer } from '../signalr/tick-buffer';

export interface LiveTicksWriterArgs {
  db: ReturnType<typeof getDb>;
  buffer: TickBuffer;
  log: Logger;
}

export async function flushLiveTicks(args: LiveTicksWriterArgs): Promise<{
  written: number;
  totalTicks: number;
}> {
  const drained = args.buffer.drain();
  if (drained.length === 0) return { written: 0, totalTicks: 0 };

  const totalTicks = drained.reduce((sum, d) => sum + d.observed, 0);
  const rows = drained.map(({ tick }) => toRow(tick));

  await args.db
    .insert(liveTicks)
    .values(rows)
    .onConflictDoUpdate({
      target: liveTicks.symbol,
      set: {
        bid: sql`excluded.bid`,
        ask: sql`excluded.ask`,
        mid: sql`excluded.mid`,
        ts: sql`excluded.ts`,
        source: sql`excluded.source`,
        updatedAt: sql`now()`,
      },
    });

  return { written: rows.length, totalTicks };
}

interface LiveTickRow {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  ts: Date;
  source: string;
}

function toRow(tick: NormalizedTick): LiveTickRow {
  return {
    symbol: tick.symbol,
    bid: tick.bid,
    ask: tick.ask,
    mid: tick.mid,
    ts: new Date(tick.ts),
    source: tick.source,
  };
}
