import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const onChainSignals = pgTable('onchain_signals', {
  id: text('id').primaryKey(),
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
  triggerData: jsonb('trigger_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source').notNull(),
}, (t) => [
  index('onchain_signals_signal_type_idx').on(t.signalType),
  index('onchain_signals_asset_idx').on(t.asset),
  index('onchain_signals_source_idx').on(t.source),
  index('onchain_signals_created_at_idx').on(t.createdAt),
]);
