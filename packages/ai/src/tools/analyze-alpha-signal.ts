import { tool, generateText } from 'ai';
import { z } from 'zod';
import { AnalyzeAlphaSignalInputSchema, type AnalyzeAlphaSignalOutputSchema, type OnChainSignal } from '@hamafx/shared';
import { getDb, schema } from '@hamafx/db';
import { getToolContext, type ToolEnv } from '../tool-context';
import { resolveModel, type ResolveModelEnv } from '../model';
import {
  runCryptoEconomist,
  runCryptoTechnician,
  runCryptoRiskManager,
  runCryptoModerator,
} from '../committee/committee';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    analyze_alpha_signal: { input: z.infer<typeof AnalyzeAlphaSignalInputSchema> };
  }
}

function makeGenerate(env: ToolEnv, modelName: string) {
  return ({ system, prompt }: { system: string; prompt: string }) =>
    generateText({
      model: resolveModel(modelName, env as unknown as ResolveModelEnv),
      system,
      prompt,
    }).then(r => r.text);
}

export const analyzeAlphaSignalTool = tool({
  description: 'Run the on-chain Alpha Committee (Economist + Technician + Risk Manager) on a Mantle asset and generate a graded alpha signal. Automatically persists the signal to the database.',
  inputSchema: AnalyzeAlphaSignalInputSchema,
  execute: async ({ asset, context }): Promise<z.infer<typeof AnalyzeAlphaSignalOutputSchema>> => {
    const ctx = getToolContext();
    const env = ctx.env;

    const generateFundamental = makeGenerate(env, env.AI_FUNDAMENTAL_MODEL ?? 'google-vertex/gemini-2.5-flash');
    const generateTechnical = makeGenerate(env, env.AI_TECHNICAL_MODEL ?? 'google-vertex/gemini-2.5-flash');
    const generateDefault = makeGenerate(env, env.AI_DEFAULT_MODEL ?? 'google-vertex/gemini-2.5-flash');

    // Run 3 committee members in parallel
    const [economist, technician, riskManager] = await Promise.all([
      runCryptoEconomist(asset, context, generateFundamental),
      runCryptoTechnician(asset, context, generateTechnical),
      runCryptoRiskManager(asset, context, generateDefault),
    ]);

    // Moderator synthesizes final grade
    const { grade, goNoGo, consensus, direction, confidence } = await runCryptoModerator(
      asset, context, economist, technician, riskManager, generateDefault,
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

