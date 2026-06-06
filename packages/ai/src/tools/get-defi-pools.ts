import { tool } from 'ai';
import { z } from 'zod';
import { GetDefiPoolsInputSchema, type GetDefiPoolsOutputSchema } from '@hamafx/shared';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    get_defi_pools: { input: z.infer<typeof GetDefiPoolsInputSchema> };
  }
}

// Mocked for hackathon track 2 (Mantle DeFi integration)
export const getDefiPoolsTool = tool({
  description: 'Retrieve TVL and APR metrics for major Mantle DeFi pools (e.g. Merchant Moe, Agni).',
  inputSchema: GetDefiPoolsInputSchema,
  execute: async ({ protocol }): Promise<z.infer<typeof GetDefiPoolsOutputSchema>> => {
    const pools = [
      { pair: 'MNT/USDT', tvlUsd: 15_000_000, volume24hUsd: 2_500_000, apr: 12.5, protocol: 'merchant-moe' },
      { pair: 'mETH/WETH', tvlUsd: 35_000_000, volume24hUsd: 10_000_000, apr: 8.2, protocol: 'merchant-moe' },
      { pair: 'MNT/USDC', tvlUsd: 8_000_000, volume24hUsd: 1_200_000, apr: 14.1, protocol: 'agni' },
    ];
    
    return {
      pools: protocol ? pools.filter(p => p.protocol === protocol) : pools,
    };
  },
});
