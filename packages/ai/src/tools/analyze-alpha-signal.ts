import { tool, generateText } from 'ai';
import { z } from 'zod';
import { AnalyzeAlphaSignalInputSchema, type AnalyzeAlphaSignalOutputSchema, type OnChainSignal } from '@hamafx/shared';
import { getDb, schema } from '@hamafx/db';
import { getToolContext } from '../tool-context';
import { resolveModel } from '../model';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    analyze_alpha_signal: { input: z.infer<typeof AnalyzeAlphaSignalInputSchema> };
  }
}

function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export const analyzeAlphaSignalTool = tool({
  description: 'Run the on-chain Alpha Committee (Economist + Technician + Risk Manager) on a Mantle asset and generate a graded alpha signal. Automatically persists the signal to the database.',
  inputSchema: AnalyzeAlphaSignalInputSchema,
  execute: async ({ asset, context }): Promise<z.infer<typeof AnalyzeAlphaSignalOutputSchema>> => {
    const ctx = getToolContext();
    const env = ctx.env;

    // Run 3 committee members in parallel
    const [economist, technician, riskManager] = await Promise.all([
      runCryptoEconomist(asset, context, env),
      runCryptoTechnician(asset, context, env),
      runCryptoRiskManager(asset, context, env),
    ]);

    // Moderator synthesizes final grade
    const { grade, goNoGo, consensus, direction, confidence } = await runCryptoModerator(
      asset, context, economist, technician, riskManager, env,
    );

    const signalId = crypto.randomUUID();
    const summary = consensus.slice(0, 280);

    const validGrades = ['A', 'B', 'C', 'D', 'F'] as const;
    const validatedGrade = validGrades.includes(grade as (typeof validGrades)[number])
      ? (grade as (typeof validGrades)[number])
      : 'C' as const;

    // Persist to database
    try {
      const db = getDb();
      await db.insert(schema.onChainSignals).values({
        id: signalId,
        signalType: 'alpha_signal',
        asset,
        direction,
        confidence,
        committeeGrade: validatedGrade,
        goNoGo,
        summary,
        fullAnalysis: `Economist: ${economist}\n\nTechnician: ${technician}\n\nRisk Manager: ${riskManager}\n\nConsensus: ${consensus}`,
        triggerData: { context, asset },
        source: 'analyze_alpha_signal',
      });
    } catch (dbErr) {
      console.error('[analyze_alpha_signal] DB persist failed:', dbErr);
    }

    const signal: OnChainSignal = {
      id: signalId,
      signalType: 'alpha_signal',
      asset,
      direction,
      confidence,
      committeeGrade: validatedGrade,
      goNoGo,
      summary,
      fullAnalysis: consensus,
      txHash: null,
      onChainSignalId: null,
      explorerUrl: null,
      triggerData: { context },
      createdAt: Date.now(),
      source: 'Mantle_Alpha_Agent',
    };

    return { signal };
  },
});

// ---------------------------------------------------------------------------
// Committee Sub-Agents (adapted for crypto / on-chain)
// ---------------------------------------------------------------------------

async function runCryptoEconomist(asset: string, context: string, env: ReturnType<typeof getToolContext>['env']): Promise<string> {
  try {
    const { text } = await generateText({
      model: resolveModel(env.AI_FUNDAMENTAL_MODEL ?? 'google-vertex/gemini-2.5-flash', env),
      system: 'You are the Economist on an on-chain alpha committee for Mantle Network. Analyze macro and on-chain fundamentals. Be concise.',
      prompt: `Asset: ${asset}\nContext: ${context}\n\nProvide a 2-sentence fundamental assessment with a bullish/bearish/neutral verdict and confidence 1-10.`,
    });
    return text.trim();
  } catch {
    return `Economist: Unable to analyze ${asset} at this time. Neutral stance.`;
  }
}

async function runCryptoTechnician(asset: string, context: string, env: ReturnType<typeof getToolContext>['env']): Promise<string> {
  try {
    const { text } = await generateText({
      model: resolveModel(env.AI_TECHNICAL_MODEL ?? 'google-vertex/gemini-2.5-flash', env),
      system: 'You are the Technician on an on-chain alpha committee. Analyze on-chain technical signals: transfer volumes, whale accumulation patterns, DEX depth. Be concise.',
      prompt: `Asset: ${asset}\nOn-chain data: ${context}\n\nProvide a 2-sentence technical assessment with a bullish/bearish/neutral verdict.`,
    });
    return text.trim();
  } catch {
    return `Technician: Insufficient technical data for ${asset}. Neutral.`;
  }
}

async function runCryptoRiskManager(asset: string, context: string, env: ReturnType<typeof getToolContext>['env']): Promise<string> {
  try {
    const { text } = await generateText({
      model: resolveModel(env.AI_DEFAULT_MODEL ?? 'google-vertex/gemini-2.5-flash', env),
      system: 'You are the Risk Manager on an on-chain alpha committee. Assess concentration risk, smart contract risk, and liquidity risk. Be concise.',
      prompt: `Asset: ${asset}\nContext: ${context}\n\nProvide a 1-sentence risk assessment and whether to go/caution/no-go.`,
    });
    return text.trim();
  } catch {
    return `Risk Manager: Risk assessment unavailable. Proceed with caution.`;
  }
}

async function runCryptoModerator(
  asset: string,
  context: string,
  economist: string,
  technician: string,
  riskManager: string,
  env: ReturnType<typeof getToolContext>['env'],
): Promise<{ grade: string; goNoGo: 'go' | 'caution' | 'no-go'; consensus: string; direction: 'bullish' | 'bearish' | 'neutral'; confidence: number }> {
  try {
    const { text } = await generateText({
      model: resolveModel(env.AI_DEFAULT_MODEL ?? 'google-vertex/gemini-2.5-flash', env),
      system: 'You are the Moderator of an on-chain alpha committee. Synthesize three committee reports into a final verdict. Always output raw JSON with no markdown.',
      prompt: `Asset: ${asset}
Context: ${context}

Committee reports:
- Economist: ${economist}
- Technician: ${technician}
- Risk Manager: ${riskManager}

Output ONLY this JSON (no markdown fences):
{"grade":"A","goNoGo":"go","direction":"bullish","confidence":8,"consensus":"2-3 sentence summary"}

grade must be A/B/C/D/F, goNoGo must be go/caution/no-go, direction must be bullish/bearish/neutral, confidence 1-10.`,
    });

    const parsed = parseJson<{ grade: string; goNoGo: string; direction: string; confidence: number; consensus: string }>(text);
    if (!parsed) throw new Error('Parse failed');

    return {
      grade: parsed.grade ?? 'C',
      goNoGo: (['go', 'caution', 'no-go'].includes(parsed.goNoGo) ? parsed.goNoGo : 'caution') as 'go' | 'caution' | 'no-go',
      consensus: parsed.consensus ?? `Committee analysis for ${asset} complete.`,
      direction: (['bullish', 'bearish', 'neutral'].includes(parsed.direction) ? parsed.direction : 'neutral') as 'bullish' | 'bearish' | 'neutral',
      confidence: typeof parsed.confidence === 'number' ? Math.min(10, Math.max(1, Math.round(parsed.confidence))) : 6,
    };
  } catch {
    return {
      grade: 'C',
      goNoGo: 'caution',
      consensus: `Alpha committee analysis for ${asset}: insufficient consensus. Proceed with caution.`,
      direction: 'neutral',
      confidence: 4,
    };
  }
}

