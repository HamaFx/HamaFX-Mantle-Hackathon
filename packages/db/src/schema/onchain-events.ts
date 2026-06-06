import { bigint, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const onchainEvents = pgTable(
  'onchain_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(), // whale_transfer | dex_swap | liquidity_add | liquidity_remove
    token: text('token').notNull(),
    fromAddress: text('from_address'),
    toAddress: text('to_address'),
    valueHuman: text('value_human'),
    valueUsd: numeric('value_usd'),
    txHash: text('tx_hash').notNull().unique(), // Added unique so onConflictDoNothing works
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_onchain_events_detected').on(table.detectedAt),
    index('idx_onchain_events_type').on(table.eventType),
  ],
);
