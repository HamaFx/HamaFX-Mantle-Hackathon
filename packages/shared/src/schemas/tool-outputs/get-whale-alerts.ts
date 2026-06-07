import { z } from 'zod';

export const GetWhaleAlertsInputSchema = z.object({
  token: z.string().optional().describe('Filter by specific token (e.g., MNT, WETH)'),
  minUsd: z.number().optional().describe('Minimum USD value of transfer (default 50000)'),
  limit: z.number().optional().describe('Max number of alerts to return (default 10)'),
});

export const GetWhaleAlertsOutputSchema = z.object({
  alerts: z.array(z.object({
    fromAddress: z.string(),
    toAddress: z.string(),
    valueHuman: z.string(),
    valueUsd: z.number(),
    token: z.string(),
    txHash: z.string(),
    timestamp: z.number(),
  })),
});

