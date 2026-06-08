import type { Logger } from '@hamafx/worker-core';

/**
 * Instrumentation hook for Next.js.
 *
 * In production (non-Vercel) we start the persistent daemon processes
 * (SignalR consumer, Finnhub fallback, on-chain scanner) as a sidecar
 * within the same Node.js process.  On Vercel the daemon is skipped
 * because Vercel's serverless runtime doesn't support long-lived
 * connections — the cron routes handle one-shot jobs there instead.
 */
let daemon: Awaited<ReturnType<typeof import('@hamafx/worker-core').runDaemon>> | null = null;

export async function register(): Promise<void> {
  if (process.env.VERCEL) {
    return;
  }

  const { createLogger, runDaemon } = await import('@hamafx/worker-core');
  const log: Logger = createLogger({ service: 'web-daemon' });

  log.info('starting unified daemon from instrumentation.ts');

  try {
    daemon = await runDaemon({ log });
    log.info('unified daemon started');
  } catch (err) {
    log.error('failed to start unified daemon', { err: String(err) });
  }
}

// Graceful shutdown on SIGTERM/SIGINT (Docker sends SIGTERM on stop).
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function shutdown(signal: string): Promise<void> {
  const { createLogger } = await import('@hamafx/worker-core');
  const log: Logger = createLogger({ service: 'web-daemon' });
  log.info('shutdown signal received', { signal });

  if (daemon) {
    try {
      await daemon.stop();
      log.info('daemon stopped cleanly');
    } catch (err) {
      log.error('daemon stop error', { err: String(err) });
    }
  }

  process.exit(0);
}
