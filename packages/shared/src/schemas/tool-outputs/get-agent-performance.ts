import { z } from 'zod';

export const GetAgentPerformanceInputSchema = z.object({
  days: z.number().optional().describe('Number of days to analyze (default 7)'),
});

export const GetAgentPerformanceOutputSchema = z.object({
  totalSignals: z.number(),
  onChainLoggedSignals: z.number(),
  byDirection: z.record(z.number()),
  byGrade: z.record(z.number()),
  winRateHint: z.number().optional(),
});

