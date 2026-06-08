import { z } from 'zod';
import { SymbolSchema } from '../../symbols';
import { TradeDirectionSchema } from './compute-risk';
import { CommitteeVerdictSchema } from '../ui-parts';

export const ConveneCommitteeInputSchema = z.object({
  symbol: SymbolSchema,
  side: TradeDirectionSchema,
  entry: z.number().positive(),
  stop: z.number().positive().optional(),
  target: z.number().positive().optional(),
  notes: z.string().optional(),
});
export type ConveneCommitteeInput = z.infer<typeof ConveneCommitteeInputSchema>;

export const ConveneCommitteeOutputSchema = z.object({
  symbol: SymbolSchema,
  side: TradeDirectionSchema,
  entry: z.number(),
  stop: z.number().optional(),
  target: z.number().optional(),
  verdicts: z.array(CommitteeVerdictSchema).length(3),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  goNoGo: z.enum(['go', 'caution', 'no-go']),
  consensus: z.string(),
});
export type ConveneCommitteeOutput = z.infer<typeof ConveneCommitteeOutputSchema>;
