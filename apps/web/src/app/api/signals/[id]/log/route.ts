import { getDb, schema } from '@hamafx/db';
import { logSignalOnChain } from '@hamafx/web3';
import { eq } from 'drizzle-orm';

import { errorResponse } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return Response.json({ error: 'Missing signal ID' }, { status: 400 });
    }

    const db = getDb();
    const [signal] = await db
      .select()
      .from(schema.onChainSignals)
      .where(eq(schema.onChainSignals.id, id))
      .limit(1);

    if (!signal) {
      return Response.json({ error: 'Signal not found' }, { status: 404 });
    }

    if (signal.txHash) {
      return Response.json({ error: 'Signal already logged on-chain' }, { status: 400 });
    }

    // Call the smart contract — DB stores these as text but zod-validated on insert
    const result = await logSignalOnChain({
      signalType: signal.signalType as 'whale_alert' | 'defi_anomaly' | 'alpha_signal' | 'macro_event',
      asset: signal.asset,
      direction: signal.direction as 'bullish' | 'bearish' | 'neutral',
      confidence: signal.confidence,
      committeeGrade: signal.committeeGrade ?? 'C',
      goNoGo: (signal.goNoGo ?? 'caution') as 'go' | 'caution' | 'no-go',
      ipfsHash: '',
      summary: signal.summary,
    });

    // Update DB row
    const [updated] = await db
      .update(schema.onChainSignals)
      .set({
        txHash: result.txHash,
        onChainSignalId: result.signalId,
        explorerUrl: result.explorerUrl,
      })
      .where(eq(schema.onChainSignals.id, id))
      .returning();

    return Response.json(updated);
  } catch (err) {
    return errorResponse(err, req);
  }
}
