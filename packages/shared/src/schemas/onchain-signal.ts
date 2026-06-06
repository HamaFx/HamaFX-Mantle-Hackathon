import { z } from 'zod';

export const OnChainSignalSchema = z.object({
  id: z.string(),
  signalType: z.enum(['whale_alert', 'defi_anomaly', 'alpha_signal', 'macro_event']),
  asset: z.string(),
  direction: z.enum(['bullish', 'bearish', 'neutral']),
  confidence: z.number().int().min(1).max(10),
  committeeGrade: z.enum(['A', 'B', 'C', 'D', 'F']).nullable(),
  goNoGo: z.enum(['go', 'caution', 'no-go']).nullable(),
  summary: z.string(),
  fullAnalysis: z.string().nullable(),
  txHash: z.string().nullable(),
  onChainSignalId: z.number().nullable(),
  explorerUrl: z.string().nullable(),
  triggerData: z.record(z.unknown()).nullable(),
  createdAt: z.number().int(),
  source: z.string(),
});
export type OnChainSignal = z.infer<typeof OnChainSignalSchema>;
