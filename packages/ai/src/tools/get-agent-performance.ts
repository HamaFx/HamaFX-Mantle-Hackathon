import { tool } from 'ai';
import { z } from 'zod';
import { GetAgentPerformanceInputSchema, type GetAgentPerformanceOutputSchema } from '@hamafx/shared';
import { getDb, schema } from '@hamafx/db';

declare module '@hamafx/shared' {
  interface ToolIOMap {
    get_agent_performance: { input: z.infer<typeof GetAgentPerformanceInputSchema> };
  }
}

export const getAgentPerformanceTool = tool({
  description: 'Get analytics on the AI agent\'s historical performance and signal accuracy.',
  inputSchema: GetAgentPerformanceInputSchema,
  execute: async ({ days }): Promise<z.infer<typeof GetAgentPerformanceOutputSchema>> => {
    const db = getDb();
    
    // For MVP, we query the signals table to show metrics.
    const signals = await db.select().from(schema.onChainSignals);
    
    const byDirection: Record<string, number> = { bullish: 0, bearish: 0, neutral: 0 };
    const byGrade: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    
    let logged = 0;
    for (const s of signals) {
      if (byDirection[s.direction] !== undefined) byDirection[s.direction] = (byDirection[s.direction] || 0) + 1;
      if (s.committeeGrade && byGrade[s.committeeGrade] !== undefined) byGrade[s.committeeGrade] = (byGrade[s.committeeGrade] || 0) + 1;
      if (s.txHash) logged++;
    }

    return {
      totalSignals: signals.length,
      onChainLoggedSignals: logged,
      byDirection,
      byGrade,
      winRateHint: 68.5, // Mock historical win rate
    };
  },
});
