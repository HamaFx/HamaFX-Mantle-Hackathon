import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Real integration tests for POST /api/auth/login.
 * Tests the actual route handler — only getAuthEnv() and auth utils are mocked.
 */

const mockAuthEnv = {
  APP_PASSWORD: 'correct-secret-password',
  AUTH_COOKIE_SECRET: 'a'.repeat(32),
  CRON_SECRET: 'cron-secret-16chars',
};

vi.mock('@/lib/env', () => ({
  getAuthEnv: vi.fn(() => mockAuthEnv),
}));

vi.mock('@/lib/auth', () => ({
  timingSafeEqual: vi.fn((a: string, b: string) => a === b),
  signAuthToken: vi.fn(() => Promise.resolve('mock-token-xyz')),
  authCookieSerialized: vi.fn((token: string, _isProd: boolean) =>
    `hfx_auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`),
}));

// Relative import since vitest doesn't resolve @/ without alias config
import { POST } from '../../src/app/api/auth/login/route';

describe('POST /api/auth/login (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: unknown, opts?: { ip?: string }): Request {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts?.ip) headers['x-forwarded-for'] = opts.ip;
    return new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  it('returns 200 + secure cookie on correct password', async () => {
    const res = await POST(createRequest({ password: 'correct-secret-password' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const cookie = res.headers.get('Set-Cookie')!;
    expect(cookie).toContain('hfx_auth=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('returns 401 on wrong password', async () => {
    const res = await POST(createRequest({ password: 'wrong' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH');
  });

  it('returns 400 when password is empty', async () => {
    const res = await POST(createRequest({ password: '' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('returns 400 on not-JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{{{broken',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION');
  });

  it('returns 429 after 10 failed attempts from same IP', async () => {
    const ip = '10.0.0.99';
    for (let i = 0; i < 10; i++) {
      await POST(createRequest({ password: 'wrong' }, { ip }));
    }
    const res = await POST(createRequest({ password: 'wrong' }, { ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  it('different IPs get independent rate limits', async () => {
    for (let i = 0; i < 10; i++) {
      await POST(createRequest({ password: 'wrong' }, { ip: '1.1.1.1' }));
    }
    const res = await POST(createRequest({ password: 'wrong' }, { ip: '2.2.2.2' }));
    expect(res.status).toBe(401); // wrong password, NOT rate limited
  });

  it('rate-limited response includes Retry-After header', async () => {
    for (let i = 0; i < 11; i++) {
      await POST(createRequest({ password: 'wrong' }, { ip: '3.3.3.3' }));
    }
    const res = await POST(createRequest({ password: 'wrong' }, { ip: '3.3.3.3' }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});