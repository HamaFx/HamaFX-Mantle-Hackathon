// Server env access — wraps @hamafx/shared's full env validation.
// NOT safe for Edge middleware (imports shared package). Use
// @/lib/auth-env for Edge-safe auth-only env access.

import { parseServerEnv, type ServerEnv } from '@hamafx/shared';

export type { AuthEnv } from './auth-env';
export { getAuthEnv } from './auth-env';

let _serverEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;
  _serverEnv = parseServerEnv();
  return _serverEnv;
}