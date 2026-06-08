export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  with(extraTags: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  service: string;
  commit?: string;
  forceJson?: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emit(level: 'info' | 'warn' | 'error', msg: string, meta: Record<string, unknown>, pretty: boolean): void {
  if (pretty) {
    const tags = Object.entries(meta)
      .filter(([k]) => k !== 'service')
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ');
    const service = String(meta['service'] ?? '');
    const prefix = `[${level}]${service ? ` ${service}` : ''}`;
    const line = `${nowIso()} ${prefix} ${msg}${tags ? ` ${tags}` : ''}`;
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](line);
    return;
  }
  const line = { ts: nowIso(), level, msg, ...meta };
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](JSON.stringify(line));
}

function makeLogger(baseTags: Record<string, unknown>, pretty: boolean): Logger {
  function log(level: 'info' | 'warn' | 'error', msg: string, meta: Record<string, unknown> = {}): void {
    emit(level, msg, { ...baseTags, ...meta }, pretty);
  }
  return {
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    with: (extraTags) => makeLogger({ ...baseTags, ...extraTags }, pretty),
  };
}

export function createLogger(opts: LoggerOptions): Logger {
  const baseTags: Record<string, unknown> = { service: opts.service };
  if (opts.commit) baseTags['commit'] = opts.commit;
  const underJournald = Boolean(process.env.JOURNAL_STREAM);
  const pretty = !opts.forceJson && !underJournald && process.env.NODE_ENV !== 'production';
  return makeLogger(baseTags, pretty);
}
