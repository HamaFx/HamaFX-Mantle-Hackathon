import { getDb, schema } from '@hamafx/db';
import { desc } from 'drizzle-orm';
import React from 'react';

export const metadata = {
  title: 'On-Chain Alpha | HamaFX-Ai',
};

// Force dynamic so we get fresh data on every render (useful for hackathon)
export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const db = getDb();
  const signals = await db
    .select()
    .from(schema.onChainSignals)
    .orderBy(desc(schema.onChainSignals.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pt-10 pb-20 sm:p-8">
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">On-Chain Alpha</h1>
          <p className="mt-2 text-muted-foreground">
            AI-verified signals logged to the Mantle blockchain.
          </p>
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          No on-chain signals generated yet.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3 font-medium">Asset</th>
                <th className="p-3 font-medium">Direction</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Grade</th>
                <th className="p-3 font-medium hidden md:table-cell">Summary</th>
                <th className="p-3 font-medium text-right">Proof</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((sig) => (
                <tr key={sig.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-semibold">{sig.asset}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        sig.direction === 'bullish'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : sig.direction === 'bearish'
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-zinc-500/10 text-zinc-500'
                      }`}
                    >
                      {sig.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 capitalize">{sig.signalType.replace('_', ' ')}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        ['A', 'B'].includes(sig.committeeGrade || '')
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {sig.committeeGrade || '-'}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                    {sig.summary}
                  </td>
                  <td className="p-3 text-right">
                    {sig.explorerUrl ? (
                      <a
                        href={sig.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        Mantle tx ↗
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">Pending...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
