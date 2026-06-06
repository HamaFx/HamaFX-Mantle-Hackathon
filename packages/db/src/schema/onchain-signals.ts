import {
  pgTable,
  text,
  integer,
  json,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const onChainSignals = pgTable('onchain_signals', {
  id: text('id').primaryKey(), // UUID
  signalType: text('signal_type').notNull(),
  asset: text('asset').notNull(),
  direction: text('direction').notNull(),
  confidence: integer('confidence').notNull(),
  committeeGrade: text('committee_grade'),
  goNoGo: text('go_no_go'),
  summary: text('summary').notNull(),
  fullAnalysis: text('full_analysis'),
  txHash: text('tx_hash'),
  onChainSignalId: integer('onchain_signal_id'),
  explorerUrl: text('explorer_url'),
  triggerData: json('trigger_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  source: text('source').notNull(),
});
