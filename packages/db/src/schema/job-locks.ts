import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const jobLocks = pgTable(
  'job_locks',
  {
    jobName: text('job_name').primaryKey(),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    runnerPid: integer('runner_pid'),
    runnerHost: text('runner_host'),
  },
  (t) => [index('job_locks_expires_at_idx').on(t.expiresAt)],
);
