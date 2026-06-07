import { and, eq } from 'drizzle-orm';
import { getDb, schema } from './index';

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
      const existing = await tx
        .select()
        .from(schema.jobLocks)
        .where(eq(schema.jobLocks.jobName, key))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!existing || existing.expiresAt < now) {
        await tx
          .insert(schema.jobLocks)
          .values({
            jobName: key,
            lockedAt: now,
            expiresAt,
            runnerPid: process.pid,
            runnerHost: host ?? process.env.HOSTNAME ?? 'unknown',
          })
          .onConflictDoUpdate({
            target: schema.jobLocks.jobName,
            set: {
              lockedAt: now,
              expiresAt,
              runnerPid: process.pid,
              runnerHost: host ?? process.env.HOSTNAME ?? 'unknown',
            },
          });
        acquired = true;
      }
    });
    return acquired;
  } catch {
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
    const result = await db
      .update(schema.jobLocks)
      .set({ expiresAt })
      .where(
        and(
          eq(schema.jobLocks.jobName, key),
          eq(schema.jobLocks.runnerPid, process.pid),
        ),
      );
    return (result as { rowCount?: number }).rowCount !== 0;
  } catch {
    return false;
  }
}
