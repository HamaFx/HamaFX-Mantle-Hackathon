import { z } from 'zod';

export const LogSignalOnchainInputSchema = z.object({
  signalId: z.string().describe('The UUID of the signal to log from the database'),
});

export const LogSignalOnchainOutputSchema = z.object({
  success: z.boolean(),
  txHash: z.string().optional(),
  onChainSignalId: z.number().optional(),
  explorerUrl: z.string().optional(),
  error: z.string().optional(),
});

declare module '../../ai/tool-io' {
  interface ToolRegistry {
    log_signal_onchain: {
      input: z.infer<typeof LogSignalOnchainInputSchema>;
      output: z.infer<typeof LogSignalOnchainOutputSchema>;
    };
  }
}
