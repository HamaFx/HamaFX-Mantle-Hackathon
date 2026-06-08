import { describe, it, expect } from 'vitest';
import { ServerEnvSchema } from '../src/env';

describe('ServerEnvSchema', () => {
  const validEnv = {
    APP_PASSWORD: 'test-password-1234',
    AUTH_COOKIE_SECRET: 'a'.repeat(32),
    CRON_SECRET: 'cron-secret-at-least-16',
    DATABASE_URL: 'postgres://user:pwd@host:6543/db',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-ai-key',
    AI_DEFAULT_MODEL: 'google/gemini-2.5-flash',
    MAX_DAILY_USD: '5',
    MAX_TOOL_ITERATIONS: '6',
    NODE_ENV: 'development',
  };

  it('accepts valid minimal env', () => {
    const result = ServerEnvSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('rejects missing APP_PASSWORD', () => {
    const { APP_PASSWORD: _, ...rest } = validEnv;
    const result = ServerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects short AUTH_COOKIE_SECRET', () => {
    const result = ServerEnvSchema.safeParse({
      ...validEnv,
      AUTH_COOKIE_SECRET: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('accepts POSTGRES_URL as alternative', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = ServerEnvSchema.safeParse({
      ...rest,
      POSTGRES_URL: 'postgres://user:pwd@host:6543/db',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when both DB URLs missing', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = ServerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('defaults MAX_DAILY_USD to 5', () => {
    const { MAX_DAILY_USD: _, ...rest } = validEnv;
    const result = ServerEnvSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MAX_DAILY_USD).toBe(5);
    }
  });

  it('defaults MAX_TOOL_ITERATIONS to 6', () => {
    const { MAX_TOOL_ITERATIONS: _, ...rest } = validEnv;
    const result = ServerEnvSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MAX_TOOL_ITERATIONS).toBe(6);
    }
  });

  it('accepts Vertex AI transport', () => {
    const result = ServerEnvSchema.safeParse({
      ...validEnv,
      GOOGLE_GENERATIVE_AI_API_KEY: undefined,
      GOOGLE_VERTEX_PROJECT: 'my-project',
      GOOGLE_VERTEX_LOCATION: 'us-central1',
    });
    // COERCE unknown→undefined so Zod treats it as "not set"
    expect(result.success).toBe(true);
  });

  it('rejects when no AI transport configured', () => {
    const { GOOGLE_GENERATIVE_AI_API_KEY: _, ...rest } = validEnv;
    const result = ServerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});