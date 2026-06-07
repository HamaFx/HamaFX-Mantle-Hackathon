import { tool } from 'ai';
import { z } from 'zod';
import { LogSignalOnchainInputSchema, type LogSignalOnchainOutputSchema } from '@hamafx/shared';
import { logSignalOnChain } from '@hamafx/web3';
import { getDb, schema } from '@hamafx/db';
import { eq } from 'drizzle-orm';
import { sendSignalPushNotification } from '../push/signal-notify';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    log_signal_onchain: { input: z.infer<typeof LogSignalOnchainInputSchema> };
  }
}

export const logSignalOnchainTool = tool({
  description: 'Log a validated alpha signal to the Mantle Sepolia smart contract and update the database. Also sends a Telegram notification for high-confidence signals (confidence ≥ 7 or grade A/B).',
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
        signalType: signal.signalType as 'alpha_signal' | 'whale_alert' | 'defi_anomaly' | 'macro_event',
        asset: signal.asset,
        direction: signal.direction as 'bullish' | 'bearish' | 'neutral',
        confidence: signal.confidence,
        committeeGrade: signal.committeeGrade ?? 'N/A',
        goNoGo: (signal.goNoGo ?? 'caution') as 'go' | 'caution' | 'no-go',
        ipfsHash: '', // IPFS upload not implemented in this phase
        summary: signal.summary,
      });

      // 3. Update DB with TxHash + explorer link
      await db
        .update(schema.onChainSignals)
        .set({
          txHash: result.txHash,
          onChainSignalId: result.signalId,
          explorerUrl: result.explorerUrl,
        })
        .where(eq(schema.onChainSignals.id, signalId));

      // 4. Telegram push notification for high-confidence signals
      const isHighConfidence =
        signal.confidence >= 7 || ['A', 'B'].includes(signal.committeeGrade ?? '');
      if (isHighConfidence) {
        // Use process.env directly to avoid ToolEnv → ServerEnv type mismatch.
        // sendSignalPushNotification only reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
        void sendSignalPushNotification(
          {
            asset: signal.asset,
            direction: signal.direction as 'bullish' | 'bearish' | 'neutral',
            confidence: signal.confidence,
            committeeGrade: signal.committeeGrade ?? '?',
            goNoGo: signal.goNoGo ?? 'caution',
            summary: signal.summary,
            explorerUrl: result.explorerUrl,
            signalType: signal.signalType,
          },
          process.env as unknown as Parameters<typeof sendSignalPushNotification>[1],
        );
      }

      return {
        success: true,
        txHash: result.txHash,
        onChainSignalId: result.signalId,
        explorerUrl: result.explorerUrl,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
