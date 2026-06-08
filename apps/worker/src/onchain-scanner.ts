import { getDb, schema } from '@hamafx/db';
import { scanRecentBlocks, type OnChainActivity } from '@hamafx/web3';
import type { Logger } from './log.js';

export class OnChainScanner {
  private timer: NodeJS.Timeout | null = null;
  private pendingTick = false;
  
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly log: Logger,
    private readonly intervalMs: number = 30_000
  ) {}

  start(): void {
    if (this.timer) return;
    this.log.info('Starting on-chain scanner loop', { intervalMs: this.intervalMs });
    
    // Run immediately
    void this.tick();
    
    // Then schedule
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.log.info('Stopped on-chain scanner loop');
    }
  }

  private async tick(): Promise<void> {
    if (this.pendingTick) return;
    this.pendingTick = true;
    try {
      const activity = await scanRecentBlocks(200);
      await this.persistEvents(activity);
    } catch (err) {
      this.log.error('OnChainScanner tick failed', { err: String(err) });
    } finally {
      this.pendingTick = false;
    }
  }

  private async persistEvents(activity: OnChainActivity): Promise<void> {
    if (activity.whaleTransfers.length === 0) return;

    const values = activity.whaleTransfers.map((w) => ({
      eventType: 'whale_transfer' as const,
      token: w.token,
      fromAddress: w.from,
      toAddress: w.to,
      valueHuman: w.value,
      valueUsd: w.valueRaw.toString(), // Storing raw initially as numeric/string
      txHash: w.txHash,
      blockNumber: Number(w.blockNumber),
      detectedAt: new Date(activity.timestamp),
    }));

    // Insert ignoring duplicates based on tx_hash
    await this.db.insert(schema.onchainEvents).values(values).onConflictDoNothing({
      target: [schema.onchainEvents.txHash],
    });

    this.log.info('Persisted on-chain events', { count: values.length, block: Number(activity.blockNumber) });
  }
}
