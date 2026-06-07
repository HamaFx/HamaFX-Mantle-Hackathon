export interface GenerateTextFn {
  (opts: { system: string; prompt: string }): Promise<string>;
}

export interface CommitteeOutput {
  grade: string;
  goNoGo: 'go' | 'caution' | 'no-go';
  consensus: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}
