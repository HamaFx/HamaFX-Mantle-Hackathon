import { getDb } from '@hamafx/db';

import { Candle1mAggregator, type ClosedCandle } from './aggregator/candle-1m.js';
import { ping } from './healthchecks.js';
import type { Logger } from './logger.js';
import { flushClosedCandle } from './persistence/candles-1m.js';
import { flushLiveTicks } from './persistence/live-ticks.js';
import {
  createDefaultBuildConnection,
  SignalRConsumer,
  type BuildConnection,
  type NormalizedTick,
} from './signalr/consumer.js';
import { TickBuffer } from './signalr/tick-buffer.js';
import { FinnhubTickSource } from './sources/finnhub.js';
import { OnChainScanner } from './onchain-scanner.js';

export interface RunDaemonArgs {
  log: Logger;
  buildConnection?: BuildConnection;
  flushIntervalMs?: number;
  heartbeatIntervalMs?: number;
  onTick?: (tick: NormalizedTick) => void;
}

export interface RunningDaemon {
  stop(): Promise<void>;
}

export async function runDaemon(args: RunDaemonArgs): Promise<RunningDaemon> {
  const { log } = args;
  const buildConnection =
    args.buildConnection ?? (await createDefaultBuildConnection());
  const buffer = new TickBuffer();
  const db = getDb();

  let lastTickAt = 0;

  const handleIncomingTick = (tick: NormalizedTick) => {
    const now = Date.now();
    buffer.push(tick);
    aggregator.feed(tick);
    args.onTick?.(tick);
    lastTickAt = now;
  };

  const aggregator = new Candle1mAggregator((bar: ClosedCandle) => {
    void (async () => {
      try {
        await flushClosedCandle({ db, log, bar });
        log.info('candle closed', {
          symbol: bar.symbol,
          t: new Date(bar.t).toISOString(),
          o: bar.o,
          h: bar.h,
          l: bar.l,
          c: bar.c,
          ticks: bar.tickVolume,
        });
      } catch (err) {
        log.error('flushClosedCandle failed', { err: String(err), symbol: bar.symbol });
      }
    })();
  });

  const hubUrl = process.env.BIQUOTE_HUB_URL ?? 'https://biquote.io/hubs/tick';
  const consumer = new SignalRConsumer({
    hubUrl,
    onTick: handleIncomingTick,
    buildConnection,
    log: log.with({ module: 'signalr' }),
  });

  await consumer.start();

  let finnhubActive = false;
  const finnhubSource = new FinnhubTickSource(log);
  finnhubSource.onTick((tick: NormalizedTick) => {
    const now = Date.now();
    if (now - lastTickAt > 15_000) {
      handleIncomingTick({ ...tick, source: 'biquote-signalr' });
    }
  });

  const finnhubStartTimer = setTimeout(() => {
    finnhubSource.start().catch((err) => {
      log.warn('finnhub fallback failed to start', { err: String(err) });
    });
    finnhubActive = true;
  }, 15_000);

  const flushIntervalMs = args.flushIntervalMs ?? 1_000;
  const flushTimer = setInterval(() => {
    void (async () => {
      try {
        const r = await flushLiveTicks({ db, buffer, log });
        if (r.written > 0) {
          log.info('flushed live_ticks', { written: r.written, ticks: r.totalTicks });
        }
      } catch (err) {
        log.error('flushLiveTicks failed', { err: String(err) });
      }
    })();
  }, flushIntervalMs);

  const heartbeatIntervalMs = args.heartbeatIntervalMs ?? 30_000;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  if (heartbeatIntervalMs > 0) {
    const hcUuid = process.env.HC_SIGNALR_UUID;
    heartbeatTimer = setInterval(() => {
      const ageMs = Date.now() - lastTickAt;
      if (lastTickAt > 0 && ageMs < 60_000) {
        void ping(hcUuid, 'success', `last_tick=${ageMs}ms`);
      } else {
        void ping(hcUuid, 'fail', `no_ticks_for=${Math.floor(ageMs / 1000)}s`);
      }
    }, heartbeatIntervalMs);
  }

  const scanner = new OnChainScanner(db, log.with({ module: 'onchain-scanner' }), 30_000);
  scanner.start();

  const stop = async (): Promise<void> => {
    clearTimeout(finnhubStartTimer);
    clearInterval(flushTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);

    await Promise.all([
      consumer.stop(),
      finnhubActive ? finnhubSource.stop() : Promise.resolve(),
    ]);

    try {
      await flushLiveTicks({ db, buffer, log });
    } catch (err) {
      log.warn('final flush on stop failed', { err: String(err) });
    }

    const closed = aggregator.closeAll();
    for (const bar of closed) {
      try {
        await flushClosedCandle({ db, log, bar });
        log.info('candle closed on shutdown', {
          symbol: bar.symbol,
          t: new Date(bar.t).toISOString(),
          o: bar.o,
          h: bar.h,
          l: bar.l,
          c: bar.c,
          ticks: bar.tickVolume,
        });
      } catch (err) {
        log.error('flushClosedCandle on shutdown failed', { err: String(err), symbol: bar.symbol });
      }
    }

    scanner.stop();
  };

  return { stop };
}
