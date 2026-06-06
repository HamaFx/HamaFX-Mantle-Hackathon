import { scanRecentBlocks } from '@hamafx/web3';
import { getDb, schema } from '@hamafx/db';
import { NextResponse } from 'next/server';

// Optional: restrict to Vercel Cron via Authorization header check
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activity = await scanRecentBlocks(200);

    let insertedCount = 0;
    if (activity.whaleTransfers.length > 0) {
      const db = getDb();
      const values = activity.whaleTransfers.map((w) => ({
        eventType: 'whale_transfer' as const,
        token: w.token,
        fromAddress: w.from,
        toAddress: w.to,
        valueHuman: w.value,
        valueUsd: w.valueRaw.toString(),
        txHash: w.txHash,
        blockNumber: Number(w.blockNumber),
        detectedAt: new Date(activity.timestamp),
      }));

      // Insert ignoring duplicates based on tx_hash
      const res = await db.insert(schema.onchainEvents).values(values).onConflictDoNothing({
        target: [schema.onchainEvents.txHash],
      });
      insertedCount = res.count;
    }

    return NextResponse.json({
      success: true,
      blockNumber: Number(activity.blockNumber),
      whaleTransfersFound: activity.whaleTransfers.length,
      insertedCount,
    });
  } catch (err) {
    console.error('onchain-scan cron failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
