import { tool } from 'ai';
import { z } from 'zod';
import { LogSignalOnchainInputSchema, type LogSignalOnchainOutputSchema } from '@hamafx/shared';
import { logSignalOnChain } from '@hamafx/web3';
import { getDb, schema } from '@hamafx/db';
import { eq } from 'drizzle-orm';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    log_signal_onchain: { input: z.infer<typeof LogSignalOnchainInputSchema> };
  }
}

export const logSignalOnchainTool = tool({
  description: 'Log a validated alpha signal to the Mantle Sepolia smart contract and update the database.',
  inputSchema: LogSignalOnchainInputSchema,
  execute: async ({ signalId }): Promise<z.infer<typeof LogSignalOnchainOutputSchema>> => {
    const db = getDb();
    
    // 1. Fetch signal from DB
    const [signal] = await db
      .select()
      .from(schema.onChainSignals)
      .where(eq(schema.onChainSignals.id, signalId))
      .limit(1);
      
    if (!signal) {
      return { success: false, error: 'Signal not found' };
    }

    // 2. Call Smart Contract
    try {
      const result = await logSignalOnChain({
        signalType: signal.signalType as 'alpha_signal',
        asset: signal.asset,
        direction: signal.direction as 'bullish' | 'bearish',
        confidence: signal.confidence,
        committeeGrade: signal.committeeGrade ?? 'N/A',
        goNoGo: signal.goNoGo as 'go',
        ipfsHash: 'ipfs://dummy', // In a full implementation, we'd upload fullAnalysis to IPFS here
        summary: signal.summary,
      });

      // 3. Update DB with TxHash
      await db
        .update(schema.onChainSignals)
        .set({
          txHash: result.txHash,
          onChainSignalId: result.signalId,
          explorerUrl: result.explorerUrl,
        })
        .where(eq(schema.onChainSignals.id, signalId));

      return {
        success: true,
        txHash: result.txHash,
        onChainSignalId: result.signalId,
        explorerUrl: result.explorerUrl,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});
