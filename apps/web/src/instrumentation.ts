/**
 * Instrumentation hook for Next.js.
 *
 * In production (non-Vercel) we start the persistent daemon processes
 * (SignalR consumer, Finnhub fallback, on-chain scanner) as a sidecar
 * within the same Node.js process. On Vercel the daemon is skipped
 * because Vercel's serverless runtime doesn't support long-lived
 * connections — the cron routes handle one-shot jobs there instead.
 *
 * IMPORTANT: all imports of @hamafx/worker-core must be dynamic so
 * Vercel's build step doesn't try to webpack the `postgres` Node.js
 * native modules (net/tls/crypto) that @hamafx/db transitively pulls in.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let daemon: any = null;

export async function register(): Promise<void> {
  if (process.env.VERCEL) {
    return;
  }

  // Dynamic import — only resolved at runtime, not at build time
  const { createLogger, runDaemon } = await import('@hamafx/worker-core');

  const log = createLogger({ service: 'web-daemon' });
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
  const log = createLogger({ service: 'web-daemon' });
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