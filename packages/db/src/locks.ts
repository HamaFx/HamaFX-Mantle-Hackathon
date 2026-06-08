import { and, eq, lt } from 'drizzle-orm';
import { getDb } from './client';
import * as schema from './schema/index';

function lockName(jobName: string): string {
  return `hamafx:job:${jobName}`;
}

export async function acquireJobLock(
  jobName: string,
  ttlMs = 300_000,
  host?: string,
): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const key = lockName(jobName);

  try {
    let acquired = false;
    await db.transaction(async (tx) => {
      // 1. Delete the lock if it has expired
      await tx
        .delete(schema.jobLocks)
        .where(and(eq(schema.jobLocks.jobName, key), lt(schema.jobLocks.expiresAt, now)));

      // 2. Attempt to acquire the lock. If it already exists (and wasn't expired), this does nothing.
      const rows = await tx
        .insert(schema.jobLocks)
        .values({
          jobName: key,
          lockedAt: now,
          expiresAt,
          runnerPid: process.pid,
          runnerHost: host ?? process.env.HOSTNAME ?? 'unknown',
        })
        .onConflictDoNothing()
        .returning({ jobName: schema.jobLocks.jobName });

      if (rows.length > 0) {
        acquired = true;
      }
    });
    return acquired;
  } catch (err) {
    console.error('[locks] acquireJobLock failed', err);
    return false;
  }
}

export async function releaseJobLock(jobName: string): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.jobLocks)
    .where(eq(schema.jobLocks.jobName, lockName(jobName)));
}

export async function renewJobLock(jobName: string, ttlMs = 300_000): Promise<boolean> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlMs);
  const key = lockName(jobName);
  try {
    const [row] = await db
      .update(schema.jobLocks)
      .set({ expiresAt })
      .where(
        and(
          eq(schema.jobLocks.jobName, key),
          eq(schema.jobLocks.runnerPid, process.pid),
        ),
      )
      .returning({ jobName: schema.jobLocks.jobName });
    return row !== undefined;
  } catch (err) {
    console.error('[locks] renewJobLock failed', err);
    return false;
  }
}
