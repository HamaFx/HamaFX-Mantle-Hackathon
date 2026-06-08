import { describe, it, expect } from 'vitest';
import * as schema from '../src/schema/index';

describe('@hamafx/db schema', () => {
  describe('chat tables', () => {
    it('chatThreads has expected columns', () => {
      const t = schema.chatThreads;
      expect(t.id).toBeDefined();
      expect(t.title).toBeDefined();
      expect(t.createdAt).toBeDefined();
      expect(t.updatedAt).toBeDefined();
      expect(t.modelOverride).toBeDefined();
    });

    it('chatMessages has expected columns', () => {
      const t = schema.chatMessages;
      expect(t.id).toBeDefined();
      expect(t.threadId).toBeDefined();
      expect(t.role).toBeDefined();
      expect(t.content).toBeDefined();
      expect(t.createdAt).toBeDefined();
    });
  });

  describe('onchain tables', () => {
    it('onChainSignals has all required columns', () => {
      const t = schema.onChainSignals;
      expect(t.id).toBeDefined();
      expect(t.signalType).toBeDefined();
      expect(t.asset).toBeDefined();
      expect(t.direction).toBeDefined();
      expect(t.confidence).toBeDefined();
      expect(t.committeeGrade).toBeDefined();
      expect(t.goNoGo).toBeDefined();
      expect(t.summary).toBeDefined();
      expect(t.fullAnalysis).toBeDefined();
      expect(t.txHash).toBeDefined();
      expect(t.onChainSignalId).toBeDefined();
      expect(t.explorerUrl).toBeDefined();
      expect(t.triggerData).toBeDefined();
      expect(t.createdAt).toBeDefined();
      expect(t.source).toBeDefined();
    });

    it('onchainEvents has required columns', () => {
      const t = schema.onchainEvents;
      expect(t.id).toBeDefined();
      expect(t.eventType).toBeDefined();
      expect(t.token).toBeDefined();
      expect(t.fromAddress).toBeDefined();
      expect(t.toAddress).toBeDefined();
      expect(t.valueHuman).toBeDefined();
      expect(t.valueUsd).toBeDefined();
      expect(t.txHash).toBeDefined();
      expect(t.blockNumber).toBeDefined();
      expect(t.detectedAt).toBeDefined();
    });
  });

  describe('alerts table', () => {
    it('alerts has expected columns', () => {
      const t = schema.alerts;
      expect(t.id).toBeDefined();
      expect(t.rule).toBeDefined();
      expect(t.channels).toBeDefined();
      expect(t.active).toBeDefined();
      expect(t.createdAt).toBeDefined();
      expect(t.firedAt).toBeDefined();
    });
  });

  describe('journalEntries table', () => {
    it('journalEntries has expected columns', () => {
      const t = schema.journalEntries;
      expect(t.id).toBeDefined();
      expect(t.symbol).toBeDefined();
      expect(t.side).toBeDefined();
      expect(t.entry).toBeDefined();
      expect(t.exit).toBeDefined();
      expect(t.size).toBeDefined();
      expect(t.outcome).toBeDefined();
      expect(t.openedAt).toBeDefined();
    });
  });

  describe('news and calendar tables', () => {
    it('newsArticles has expected columns', () => {
      const t = schema.newsArticles;
      expect(t.id).toBeDefined();
      expect(t.title).toBeDefined();
      expect(t.publishedAt).toBeDefined();
      expect(t.source).toBeDefined();
    });

    it('economicEvents has expected columns', () => {
      const t = schema.economicEvents;
      expect(t.id).toBeDefined();
      expect(t.title).toBeDefined();
      expect(t.country).toBeDefined();
      expect(t.importance).toBeDefined();
      expect(t.date).toBeDefined();
      expect(t.source).toBeDefined();
    });
  });

  describe('telemetry tables', () => {
    it('chatTelemetry has expected columns', () => {
      const t = schema.chatTelemetry;
      expect(t.id).toBeDefined();
      expect(t.threadId).toBeDefined();
      expect(t.model).toBeDefined();
      expect(t.inputTokens).toBeDefined();
      expect(t.outputTokens).toBeDefined();
      expect(t.toolCalls).toBeDefined();
      expect(t.ms).toBeDefined();
      expect(t.estCostUsd).toBeDefined();
    });

    it('chatToolTelemetry has expected columns', () => {
      const t = schema.chatToolTelemetry;
      expect(t.id).toBeDefined();
      expect(t.threadId).toBeDefined();
      expect(t.tool).toBeDefined();
      expect(t.ms).toBeDefined();
      expect(t.ok).toBeDefined();
      expect(t.errorCode).toBeDefined();
    });

    it('dailyAiSpend has expected columns', () => {
      const t = schema.dailyAiSpend;
      expect(t.day).toBeDefined();
      expect(t.totalUsdCents).toBeDefined();
    });
  });

  describe('briefings and cot tables', () => {
    it('briefingsEmitted has expected columns', () => {
      const t = schema.briefingsEmitted;
      expect(t.eventId).toBeDefined();
      expect(t.kind).toBeDefined();
      expect(t.messageId).toBeDefined();
      expect(t.createdAt).toBeDefined();
    });

    it('cotReports has expected columns', () => {
      const t = schema.cotReports;
      expect(t.id).toBeDefined();
      expect(t.symbol).toBeDefined();
      expect(t.reportDate).toBeDefined();
    });
  });

  describe('snapshots and share tables', () => {
    it('snapshots has expected columns', () => {
      const t = schema.snapshots;
      expect(t.id).toBeDefined();
      expect(t.symbol).toBeDefined();
      expect(t.createdAt).toBeDefined();
    });

    it('sharedSnapshots has expected columns', () => {
      const t = schema.sharedSnapshots;
      expect(t.id).toBeDefined();
      expect(t.title).toBeDefined();
      expect(t.symbol).toBeDefined();
      expect(t.expiresAt).toBeDefined();
    });
  });

  describe('worker tables', () => {
    it('liveTicks has expected columns', () => {
      const t = schema.liveTicks;
      expect(t.symbol).toBeDefined();
      expect(t.bid).toBeDefined();
      expect(t.ask).toBeDefined();
      expect(t.updatedAt).toBeDefined();
    });

    it('candles1m has expected columns', () => {
      const t = schema.candles1m;
      expect(t.symbol).toBeDefined();
      expect(t.t).toBeDefined();
      expect(t.o).toBeDefined();
      expect(t.h).toBeDefined();
      expect(t.l).toBeDefined();
      expect(t.c).toBeDefined();
      expect(t.tickVolume).toBeDefined();
    });

    it('jobLocks has expected columns', () => {
      const t = schema.jobLocks;
      expect(t.jobName).toBeDefined();
      expect(t.lockedAt).toBeDefined();
      expect(t.expiresAt).toBeDefined();
      expect(t.runnerPid).toBeDefined();
      expect(t.runnerHost).toBeDefined();
    });

    it('providerThrottle has expected columns', () => {
      const t = schema.providerThrottle;
      expect(t.provider).toBeDefined();
      expect(t.count).toBeDefined();
      expect(t.windowStartedAt).toBeDefined();
    });

    it('intermarketResonance has expected columns', () => {
      const t = schema.intermarketResonance;
      expect(t.date).toBeDefined();
      expect(t.realYieldPct).toBeDefined();
      expect(t.breakevenInflationPct).toBeDefined();
      expect(t.dxyIndex).toBeDefined();
      expect(t.createdAt).toBeDefined();
    });
  });

  describe('push and memory tables', () => {
    it('pushSubscriptions has expected columns', () => {
      const t = schema.pushSubscriptions;
      expect(t.id).toBeDefined();
      expect(t.endpoint).toBeDefined();
      expect(t.p256dh).toBeDefined();
      expect(t.auth).toBeDefined();
    });

    it('memoryEmbeddings has expected columns', () => {
      const t = schema.memoryEmbeddings;
      expect(t.id).toBeDefined();
      expect(t.kind).toBeDefined();
      expect(t.sourceId).toBeDefined();
      expect(t.text).toBeDefined();
      expect(t.embedding).toBeDefined();
    });
  });

  describe('table count', () => {
    it('exports at least 20 tables', () => {
      const tableNames = Object.keys(schema).filter(
        (k) => typeof schema[k as keyof typeof schema] === 'object'
          && schema[k as keyof typeof schema] !== null
          && k !== 'REQUIRED_EXTENSIONS',
      );
      expect(tableNames.length).toBeGreaterThanOrEqual(20);
    });
  });
});