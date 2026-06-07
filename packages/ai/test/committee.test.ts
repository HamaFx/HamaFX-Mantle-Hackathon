import { describe, it, expect } from 'vitest';
import {
  runCryptoEconomist,
  runCryptoTechnician,
  runCryptoRiskManager,
  runCryptoModerator,
  parseJson,
} from '../src/committee';
import type { GenerateTextFn } from '../src/committee';

function fakeGenerate(text: string): GenerateTextFn {
  return async () => text;
}

function throwingGenerate(): GenerateTextFn {
  return async () => { throw new Error('AI call failed'); };
}

describe('parseJson', () => {
  it('parses valid JSON', () => {
    const result = parseJson<{ a: number }>('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  it('strips markdown fences', () => {
    const result = parseJson<{ a: number }>('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON', () => {
    expect(parseJson('not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseJson('')).toBeNull();
  });
});

describe('runCryptoEconomist', () => {
  it('returns trimmed text from generate function', async () => {
    const result = await runCryptoEconomist('MNT', 'bullish momentum', fakeGenerate('  bullish  '));
    expect(result).toBe('bullish');
  });

  it('returns fallback when generate throws', async () => {
    const result = await runCryptoEconomist('MNT', 'bad data', throwingGenerate());
    expect(result).toBe('Economist: Unable to analyze MNT at this time. Neutral stance.');
  });
});

describe('runCryptoTechnician', () => {
  it('returns trimmed text from generate function', async () => {
    const result = await runCryptoTechnician('BTC', 'high volume', fakeGenerate('  bearish  '));
    expect(result).toBe('bearish');
  });

  it('returns fallback when generate throws', async () => {
    const result = await runCryptoTechnician('BTC', 'error', throwingGenerate());
    expect(result).toBe('Technician: Insufficient technical data for BTC. Neutral.');
  });
});

describe('runCryptoRiskManager', () => {
  it('returns trimmed text from generate function', async () => {
    const result = await runCryptoRiskManager('ETH', 'high risk', fakeGenerate('  caution  '));
    expect(result).toBe('caution');
  });

  it('returns fallback when generate throws', async () => {
    const result = await runCryptoRiskManager('ETH', 'error', throwingGenerate());
    expect(result).toBe('Risk Manager: Risk assessment unavailable. Proceed with caution.');
  });
});

describe('runCryptoModerator', () => {
  it('parses valid JSON moderator output', async () => {
    const json = JSON.stringify({
      grade: 'A',
      goNoGo: 'go',
      direction: 'bullish',
      confidence: 8,
      consensus: 'Strong setup confirmed across all analysts.',
    });
    const result = await runCryptoModerator('MNT', 'positive context', 'bullish', 'bullish', 'go', fakeGenerate(json));

    expect(result.grade).toBe('A');
    expect(result.goNoGo).toBe('go');
    expect(result.direction).toBe('bullish');
    expect(result.confidence).toBe(8);
    expect(result.consensus).toContain('Strong setup');
  });

  it('clamps confidence to 1-10 range', async () => {
    const json = JSON.stringify({
      grade: 'B',
      goNoGo: 'caution',
      direction: 'neutral',
      confidence: 15,
      consensus: 'Overconfident but okay.',
    });
    const result = await runCryptoModerator('MNT', 'test', 'bullish', 'neutral', 'caution', fakeGenerate(json));
    expect(result.confidence).toBe(10);
  });

  it('uses confidence floor of 1', async () => {
    const json = JSON.stringify({
      grade: 'C',
      goNoGo: 'no-go',
      direction: 'bearish',
      confidence: -5,
      consensus: 'Very weak.',
    });
    const result = await runCryptoModerator('MNT', 'test', 'bearish', 'bearish', 'no-go', fakeGenerate(json));
    expect(result.confidence).toBe(1);
  });

  it('validates goNoGo to allowed values', async () => {
    const json = JSON.stringify({
      grade: 'D',
      goNoGo: 'invalid',
      direction: 'neutral',
      confidence: 5,
      consensus: 'Invalid goNoGo.',
    });
    const result = await runCryptoModerator('MNT', 'test', 'neutral', 'neutral', 'caution', fakeGenerate(json));
    expect(result.goNoGo).toBe('caution');
  });

  it('validates direction to allowed values', async () => {
    const json = JSON.stringify({
      grade: 'F',
      goNoGo: 'no-go',
      direction: 'invalid',
      confidence: 2,
      consensus: 'Invalid direction.',
    });
    const result = await runCryptoModerator('MNT', 'test', 'bearish', 'bearish', 'no-go', fakeGenerate(json));
    expect(result.direction).toBe('neutral');
  });

  it('fills defaults for missing fields', async () => {
    const json = JSON.stringify({ grade: 'B' });
    const result = await runCryptoModerator('MNT', 'test', 'bullish', 'bullish', 'go', fakeGenerate(json));
    expect(result.goNoGo).toBe('caution');
    expect(result.direction).toBe('neutral');
    expect(result.confidence).toBe(6);
    expect(result.consensus).toContain('MNT');
  });

  it('returns fallback when generate throws', async () => {
    const result = await runCryptoModerator('MNT', 'error', 'bullish', 'bullish', 'go', throwingGenerate());
    expect(result.grade).toBe('C');
    expect(result.goNoGo).toBe('caution');
    expect(result.confidence).toBe(4);
    expect(result.direction).toBe('neutral');
    expect(result.consensus).toContain('insufficient consensus');
  });

  it('returns fallback when JSON is malformed', async () => {
    const result = await runCryptoModerator('MNT', 'test', 'bullish', 'bullish', 'go', fakeGenerate('not json'));
    expect(result.grade).toBe('C');
    expect(result.goNoGo).toBe('caution');
    expect(result.confidence).toBe(4);
  });
});
