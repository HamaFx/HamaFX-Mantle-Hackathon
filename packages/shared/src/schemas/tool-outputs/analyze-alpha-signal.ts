import { z } from 'zod';
import { OnChainSignalSchema } from '../onchain-signal';

export const AnalyzeAlphaSignalInputSchema = z.object({
  asset: z.string().describe('The crypto asset to analyze (e.g., MNT, WETH)'),
  context: z.string().describe('Context or raw data triggering this analysis'),
});

export const AnalyzeAlphaSignalOutputSchema = z.object({
  signal: OnChainSignalSchema,
});

