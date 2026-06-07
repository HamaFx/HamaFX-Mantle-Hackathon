import { tool } from 'ai';
import { z } from 'zod';
import { GetWhaleAlertsInputSchema, type GetWhaleAlertsOutputSchema } from '@hamafx/shared';
import { getDb, schema } from '@hamafx/db';
import { desc, gte } from 'drizzle-orm';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    get_whale_alerts: { input: z.infer<typeof GetWhaleAlertsInputSchema> };
  }
}

// Rough price estimates for USD conversion
const TOKEN_PRICES: Record<string, number> = {
  WETH: 3800,
  USDT: 1,
  USDC: 1,
  WMNT: 0.75,
  mETH: 3900,
  MNT: 0.75,
};

function estimateUsd(token: string, valueHuman: string): number {
  const amount = parseFloat(valueHuman) || 0;
  return amount * (TOKEN_PRICES[token] ?? 0);
}

export const getWhaleAlertsTool = tool({
  description: 'Get recent whale alerts (large transfers) on Mantle network from the database of detected on-chain events.',
  inputSchema: GetWhaleAlertsInputSchema,
  execute: async ({ token, minUsd, limit }): Promise<z.infer<typeof GetWhaleAlertsOutputSchema>> => {
    const db = getDb();

    // Query persisted on-chain events (populated by the worker scanner)
    try {
      // Look at events in the last 24 hours
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const events = await db
        .select()
        .from(schema.onchainEvents)
        .where(gte(schema.onchainEvents.detectedAt, cutoff))
        .orderBy(desc(schema.onchainEvents.detectedAt))
        .limit(200);

      let alerts = events
        .filter((e) => e.eventType === 'whale_transfer')
        .map((e) => {
          const valueUsd = e.valueUsd
            ? parseFloat(e.valueUsd.toString())
            : estimateUsd(e.token, e.valueHuman ?? '0');
          return {
            fromAddress: e.fromAddress ?? '0x0',
            toAddress: e.toAddress ?? '0x0',
            valueHuman: e.valueHuman ?? '0',
            valueUsd,
            token: e.token,
            txHash: e.txHash,
            timestamp: e.detectedAt.getTime(),
          };
        });

      if (token) alerts = alerts.filter((a) => a.token === token);
      if (minUsd) alerts = alerts.filter((a) => a.valueUsd >= minUsd);
      if (limit) alerts = alerts.slice(0, limit);

      return { alerts };
    } catch {
      // If DB query fails (e.g. table not yet migrated), return empty
      return { alerts: [] };
    }
  },
});
