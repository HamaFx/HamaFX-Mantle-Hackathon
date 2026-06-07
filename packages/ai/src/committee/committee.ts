import type { GenerateTextFn, CommitteeOutput } from './types';

export function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function runCryptoEconomist(
  asset: string,
  context: string,
  generate: GenerateTextFn,
): Promise<string> {
  try {
    const text = await generate({
      system: 'You are the Economist on an on-chain alpha committee for Mantle Network. Analyze macro and on-chain fundamentals. Be concise.',
      prompt: `Asset: ${asset}\nContext: ${context}\n\nProvide a 2-sentence fundamental assessment with a bullish/bearish/neutral verdict and confidence 1-10.`,
    });
    return text.trim();
  } catch {
    return `Economist: Unable to analyze ${asset} at this time. Neutral stance.`;
  }
}

export async function runCryptoTechnician(
  asset: string,
  context: string,
  generate: GenerateTextFn,
): Promise<string> {
  try {
    const text = await generate({
      system: 'You are the Technician on an on-chain alpha committee. Analyze on-chain technical signals: transfer volumes, whale accumulation patterns, DEX depth. Be concise.',
      prompt: `Asset: ${asset}\nOn-chain data: ${context}\n\nProvide a 2-sentence technical assessment with a bullish/bearish/neutral verdict.`,
    });
    return text.trim();
  } catch {
    return `Technician: Insufficient technical data for ${asset}. Neutral.`;
  }
}

export async function runCryptoRiskManager(
  asset: string,
  context: string,
  generate: GenerateTextFn,
): Promise<string> {
  try {
    const text = await generate({
      system: 'You are the Risk Manager on an on-chain alpha committee. Assess concentration risk, smart contract risk, and liquidity risk. Be concise.',
      prompt: `Asset: ${asset}\nContext: ${context}\n\nProvide a 1-sentence risk assessment and whether to go/caution/no-go.`,
    });
    return text.trim();
  } catch {
    return `Risk Manager: Risk assessment unavailable. Proceed with caution.`;
  }
}

export async function runCryptoModerator(
  asset: string,
  context: string,
  economist: string,
  technician: string,
  riskManager: string,
  generate: GenerateTextFn,
): Promise<CommitteeOutput> {
  try {
    const text = await generate({
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
