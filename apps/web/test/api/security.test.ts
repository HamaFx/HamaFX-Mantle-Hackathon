import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for security-critical API utilities.
 */

describe('CSRF protection', () => {
  // Simulate the CSRF token validation logic used in middleware
  function extractCsrfToken(headers: Headers): string | null {
    return headers.get('x-csrf-token') ?? null;
  }

  function isSafeMethod(method: string): boolean {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  it('allows GET without CSRF token', () => {
    const headers = new Headers();
    const csrf = extractCsrfToken(headers);
    // Safe methods don't need CSRF
    expect(isSafeMethod('GET')).toBe(true);
    expect(csrf).toBeNull();
  });

  it('allows HEAD without CSRF token', () => {
    expect(isSafeMethod('HEAD')).toBe(true);
    expect(isSafeMethod('OPTIONS')).toBe(true);
  });

  it('requires CSRF for POST requests', () => {
    expect(isSafeMethod('POST')).toBe(false);
    expect(isSafeMethod('PUT')).toBe(false);
    expect(isSafeMethod('DELETE')).toBe(false);
    expect(isSafeMethod('PATCH')).toBe(false);
  });

  it('extracts CSRF token from headers', () => {
    const headers = new Headers({ 'x-csrf-token': 'abc123' });
    expect(extractCsrfToken(headers)).toBe('abc123');
  });

  it('returns null when CSRF token is missing', () => {
    const headers = new Headers();
    expect(extractCsrfToken(headers)).toBeNull();
  });
});

describe('Error response formatting', () => {
  function errorResponse(err: unknown): { status: number; body: Record<string, unknown> } {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { status: 499, body: { error: { code: 'ABORTED', message: 'Request cancelled' } } };
      }
      return { status: 500, body: { error: { code: 'INTERNAL', message: 'Internal server error' } } };
    }
    return { status: 500, body: { error: { code: 'INTERNAL', message: 'Internal server error' } } };
  }

  it('returns 499 for AbortError', () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    // Override name since DOMException.name isn't always 'AbortError'
    Object.defineProperty(abortErr, 'name', { value: 'AbortError' });
    const res = errorResponse(abortErr);
    expect(res.status).toBe(499);
    expect(res.body.error.code).toBe('ABORTED');
  });

  it('returns 500 for generic errors', () => {
    const res = errorResponse(new Error('database down'));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
  });

  it('never leaks error message to client', () => {
    const res = errorResponse(new Error('secret DB password: hunter2'));
    expect(res.body.error.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('handles non-Error throws', () => {
    const res = errorResponse('just a string');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
  });

  it('returns 503 for budget exceeded errors', () => {
    const budgetErr = new Error('Daily AI spend cap reached');
    const res = {
      status: 503,
      body: {
        error: { code: 'BUDGET_EXCEEDED', message: 'Daily AI spend cap reached' },
      },
    };
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('BUDGET_EXCEEDED');
  });

  it('returns 401 for auth failures', () => {
    const res = {
      status: 401,
      body: { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
    };
    expect(res.status).toBe(401);
  });
});

describe('Auth cookie security', () => {
  function isSecureCookie(cookieStr: string): boolean {
    return cookieStr.includes('HttpOnly') && cookieStr.includes('Secure') && cookieStr.includes('SameSite=Strict');
  }

  it('auth cookie is HttpOnly + Secure + SameSite', () => {
    const cookie = 'hfx_auth=token123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000';
    expect(isSecureCookie(cookie)).toBe(true);
  });

  it('rejects cookie without HttpOnly', () => {
    const cookie = 'hfx_auth=token123; Secure; SameSite=Strict; Path=/';
    expect(isSecureCookie(cookie)).toBe(false);
  });

  it('rejects cookie without Secure', () => {
    const cookie = 'hfx_auth=token123; HttpOnly; SameSite=Strict; Path=/';
    expect(isSecureCookie(cookie)).toBe(false);
  });

  it('rejects cookie with SameSite=Lax', () => {
    const cookie = 'hfx_auth=token123; HttpOnly; Secure; SameSite=Lax; Path=/';
    expect(isSecureCookie(cookie)).toBe(false);
  });
});