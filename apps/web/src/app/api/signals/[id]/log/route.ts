/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, schema } from '@hamafx/db';
import { logSignalOnChain } from '@hamafx/web3';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'Missing signal ID' }, { status: 400 });
    }

    const db = getDb();
    const [signal] = await db
      .select()
      .from(schema.onChainSignals)
      .where(eq(schema.onChainSignals.id, id))
      .limit(1);

    if (!signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    if (signal.txHash) {
      return NextResponse.json({ error: 'Signal already logged on-chain' }, { status: 400 });
    }

    // Call the smart contract
    const result = await logSignalOnChain({
      signalType: signal.signalType as any,
      asset: signal.asset,
      direction: signal.direction as any,
      confidence: signal.confidence,
      committeeGrade: (signal.committeeGrade || 'C') as any,
      goNoGo: (signal.goNoGo || 'caution') as any,
      ipfsHash: '', // Phase 2
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

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
