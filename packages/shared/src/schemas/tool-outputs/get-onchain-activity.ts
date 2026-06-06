import { z } from 'zod';

export const GetOnchainActivityInputSchema = z.object({
  blockRange: z.number().optional().describe('Number of blocks to scan back (default 200)'),
});

export const GetOnchainActivityOutputSchema = z.object({
  blockNumber: z.number(),
  timestamp: z.number(),
  transactionCount: z.number(),
  whaleTransfers: z.array(z.object({
    from: z.string(),
    to: z.string(),
    value: z.string(),
    token: z.string(),
    txHash: z.string(),
  })),
  totalVolumeUsd: z.number(),
});

declare module '../../ai/tool-io' {
  interface ToolRegistry {
    get_onchain_activity: {
      input: z.infer<typeof GetOnchainActivityInputSchema>;
      output: z.infer<typeof GetOnchainActivityOutputSchema>;
    };
  }
}
