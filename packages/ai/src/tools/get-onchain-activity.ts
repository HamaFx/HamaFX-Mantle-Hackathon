import { tool } from 'ai';
import { z } from 'zod';
import { GetOnchainActivityInputSchema, type GetOnchainActivityOutputSchema } from '@hamafx/shared';
import { scanRecentBlocks } from '@hamafx/web3';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    get_onchain_activity: { input: z.infer<typeof GetOnchainActivityInputSchema> };
  }
}

export const getOnchainActivityTool = tool({
  description: 'Scan recent blocks on Mantle for on-chain activity including transaction counts and whale transfers.',
  inputSchema: GetOnchainActivityInputSchema,
  execute: async ({ blockRange }): Promise<z.infer<typeof GetOnchainActivityOutputSchema>> => {
    const data = await scanRecentBlocks(blockRange ?? 200);
    return {
      blockNumber: Number(data.blockNumber),
      timestamp: data.timestamp,
      transactionCount: data.transactionCount,
      whaleTransfers: data.whaleTransfers.map(w => ({
        from: w.from,
        to: w.to,
        value: w.value,
        token: w.token,
        txHash: w.txHash,
      })),
      totalVolumeUsd: data.totalVolumeUsd,
    };
  },
});
