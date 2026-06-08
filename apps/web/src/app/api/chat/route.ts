// /api/chat — streaming chat endpoint. Receives a UI messages array from
// `useChat`, runs the agent, and streams back the SDK's UI-message stream
// for the client to consume.

import { BudgetExceededError, runChat } from '@hamafx/ai';
import { providerUnavailable } from '@hamafx/shared';
import { type UIMessage } from 'ai';
import { z } from 'zod';

import { errorResponse, parseJsonBody } from '@/lib/api';
import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// We only validate the parts of the body we care about. The full UIMessage
// shape is large + provider-specific, so we trust the client (which is also
// us) for the rest.
const BodySchema = z.object({
  threadId: z.string().uuid(),
  /**
   * Phase 7c — optional one-shot model override forwarded from the chat
   * surface's "Regenerate with…" picker. Wins over the router's per-domain
   * choice for this turn only; the persisted thread.modelOverride is
   * untouched.
   */
  modelOverride: z.string().min(1).max(120).nullable().optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().default(''),
        parts: z.array(z.unknown()).default([]),
      }),
    )
    .min(1),
});

export async function POST(req: Request): Promise<Response> {
  let body: z.infer<typeof BodySchema>;
  try {
    body = await parseJsonBody(req, BodySchema);
  } catch (err) {
    return errorResponse(err);
  }

  const last = body.messages.at(-1);
  if (!last || last.role !== 'user') {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'last message must be from the user' } },
      { status: 400 },
    );
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (err) {
    return errorResponse(err);
  }

  // Parse client AI preferences if provided
  const aiPrefsHeader = req.headers.get('X-AI-Prefs');
  let customInstructions: string | undefined;
  
  // Shallow copy env to prevent mutating global state across concurrent Node requests
  const runEnv = { ...env };
  
  if (aiPrefsHeader) {
    try {
      const prefs = JSON.parse(aiPrefsHeader);
      if (prefs.fundamentalModel) runEnv.AI_FUNDAMENTAL_MODEL = prefs.fundamentalModel;
      if (prefs.technicalModel) runEnv.AI_TECHNICAL_MODEL = prefs.technicalModel;
      if (prefs.summaryModel) runEnv.AI_SUMMARY_MODEL = prefs.summaryModel;
      if (prefs.customInstructions) customInstructions = prefs.customInstructions;
    } catch {
      // ignore invalid json
    }
  }

  try {
    const result = await runChat({
      threadId: body.threadId,
      // The client-side cast to UIMessage is safe enough here — we only
      // forward the shape AI SDK already understands.
      userMessage: last as UIMessage,
      ...(body.modelOverride !== undefined && body.modelOverride !== null
        ? { modelOverride: body.modelOverride }
        : {}),
      ...(customInstructions ? { customInstructions } : {}),
      env: {
        AI_GATEWAY_API_KEY: runEnv.AI_GATEWAY_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: runEnv.GOOGLE_GENERATIVE_AI_API_KEY,
        GOOGLE_VERTEX_PROJECT: runEnv.GOOGLE_VERTEX_PROJECT,
        GOOGLE_VERTEX_LOCATION: runEnv.GOOGLE_VERTEX_LOCATION,
        GOOGLE_APPLICATION_CREDENTIALS_JSON: runEnv.GOOGLE_APPLICATION_CREDENTIALS_JSON,
        GOOGLE_APPLICATION_CREDENTIALS: runEnv.GOOGLE_APPLICATION_CREDENTIALS,
        AI_DEFAULT_MODEL: runEnv.AI_DEFAULT_MODEL,
        AI_TITLE_MODEL: runEnv.AI_TITLE_MODEL,
        AI_VISION_MODEL: runEnv.AI_VISION_MODEL,
        AI_FUNDAMENTAL_MODEL: runEnv.AI_FUNDAMENTAL_MODEL,
        AI_TECHNICAL_MODEL: runEnv.AI_TECHNICAL_MODEL,
        AI_SUMMARY_MODEL: runEnv.AI_SUMMARY_MODEL,
        MAX_DAILY_USD: runEnv.MAX_DAILY_USD,
        MAX_TOOL_ITERATIONS: runEnv.MAX_TOOL_ITERATIONS,
        LOG_PROMPTS: runEnv.LOG_PROMPTS,
      },
      ...(req.signal ? { signal: req.signal } : {}),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return errorResponse(
        providerUnavailable(
          `Daily AI budget exceeded ($${err.spent.toFixed(2)} / $${err.max.toFixed(2)}). Resets at UTC midnight.`,
          { code: 'BUDGET_EXCEEDED', spent: err.spent, max: err.max },
        ),
      );
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    return errorResponse(err);
  }
}
