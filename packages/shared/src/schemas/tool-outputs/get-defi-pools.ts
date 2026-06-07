import { z } from 'zod';

export const GetDefiPoolsInputSchema = z.object({
  protocol: z.enum(['merchant-moe', 'agni']).optional().describe('Filter by protocol'),
});

export const GetDefiPoolsOutputSchema = z.object({
  pools: z.array(z.object({
    pair: z.string(),
    tvlUsd: z.number(),
    volume24hUsd: z.number(),
    apr: z.number(),
    protocol: z.string(),
  })),
});

