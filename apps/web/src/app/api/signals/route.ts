import { getDb, schema } from '@hamafx/db';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

import { errorResponse, parseJsonBody } from '@/lib/api';

export const runtime = 'nodejs';

const CreateSignalSchema = z.object({
  signalType: z.enum(['whale_alert', 'defi_anomaly', 'alpha_signal', 'macro_event']),
  asset: z.string(),
  direction: z.enum(['bullish', 'bearish', 'neutral']),
  confidence: z.number().int().min(1).max(10),
  committeeGrade: z.enum(['A', 'B', 'C', 'D', 'F']).nullable().optional(),
  goNoGo: z.enum(['go', 'caution', 'no-go']).nullable().optional(),
  summary: z.string(),
  fullAnalysis: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const db = getDb();
    const signals = await db
      .select()
      .from(schema.onChainSignals)
      .orderBy(desc(schema.onChainSignals.createdAt))
      .limit(limit);

    return Response.json(signals);
  } catch (err) {
    return errorResponse(err, req);
  }
}

export async function POST(req: Request) {
  try {
    const data = await parseJsonBody(req, CreateSignalSchema);

    const db = getDb();
    const [inserted] = await db
      .insert(schema.onChainSignals)
      .values({
        id: crypto.randomUUID(),
        signalType: data.signalType,
        asset: data.asset,
        direction: data.direction,
        confidence: data.confidence,
        committeeGrade: data.committeeGrade ?? null,
        goNoGo: data.goNoGo ?? null,
        summary: data.summary,
        fullAnalysis: data.fullAnalysis ?? null,
        source: 'api',
      })
      .returning();

    return Response.json(inserted);
  } catch (err) {
    return errorResponse(err, req);
  }
}
