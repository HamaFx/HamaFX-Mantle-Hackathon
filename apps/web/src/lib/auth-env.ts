// Auth-only env access. Safe to use from Edge middleware because
// it imports nothing from @hamafx/shared. Only zod + process.env.
//
// Keep this file free of any Node.js-only or shared package imports.

import { z } from 'zod';

const AuthEnvSchema = z.object({
  APP_PASSWORD: z.string().min(4),
  AUTH_COOKIE_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

export type AuthEnv = z.infer<typeof AuthEnvSchema>;

let _authEnv: AuthEnv | null = null;

export function getAuthEnv(): AuthEnv {
  if (_authEnv) return _authEnv;
  const result = AuthEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid auth environment:\n${issues}`);
  }
  _authEnv = result.data;
  return _authEnv;
}