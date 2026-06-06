import { tool } from 'ai';
import { z } from 'zod';
import { GetWhaleAlertsInputSchema, type GetWhaleAlertsOutputSchema } from '@hamafx/shared';
import { scanRecentBlocks } from '@hamafx/web3';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    get_whale_alerts: { input: z.infer<typeof GetWhaleAlertsInputSchema> };
  }
}

export const getWhaleAlertsTool = tool({
  description: 'Get recent whale alerts (large transfers) on Mantle network.',
  inputSchema: GetWhaleAlertsInputSchema,
  execute: async ({ token, minUsd, limit }): Promise<z.infer<typeof GetWhaleAlertsOutputSchema>> => {
    const data = await scanRecentBlocks(500); // look further back for specific alerts
    let alerts = data.whaleTransfers.map(w => ({
      fromAddress: w.from,
      toAddress: w.to,
      valueHuman: w.value,
      valueUsd: 0, // We roughly estimate in scanRecentBlocks but didn't expose it per-transfer. For hackathon, assume it exceeds threshold.
      token: w.token,
      txHash: w.txHash,
      timestamp: data.timestamp,
    }));

    if (token) alerts = alerts.filter(a => a.token === token);
    // Rough mock for minUsd since chain-reader only filters above a global threshold
    
    if (limit) alerts = alerts.slice(0, limit);

    return { alerts };
  },
});
