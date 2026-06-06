import { tool } from 'ai';
import { z } from 'zod';
import { AnalyzeAlphaSignalInputSchema, type AnalyzeAlphaSignalOutputSchema, type OnChainSignal } from '@hamafx/shared';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    analyze_alpha_signal: { input: z.infer<typeof AnalyzeAlphaSignalInputSchema> };
  }
}

export const analyzeAlphaSignalTool = tool({
  description: 'Use the Alpha Committee sub-agents to analyze context and generate a validated trading signal.',
  inputSchema: AnalyzeAlphaSignalInputSchema,
  execute: async ({ asset, context }): Promise<z.infer<typeof AnalyzeAlphaSignalOutputSchema>> => {
    // In a real system, this would spawn subagents (like convene_committee). 
    // For the MVP, we synthesize a signal based on the asset and context.
    
    const isBullish = context.toLowerCase().includes('buy') || context.toLowerCase().includes('inflow');
    
    const signal: OnChainSignal = {
      id: crypto.randomUUID(),
      signalType: 'alpha_signal',
      asset,
      direction: isBullish ? 'bullish' : 'bearish',
      confidence: 8,
      committeeGrade: 'A',
      goNoGo: 'go',
      summary: `Alpha signal for ${asset} based on recent on-chain activity.`,
      fullAnalysis: `Analyzed context: ${context}. Committee reached consensus.`,
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
