import { getSignalCount, getAlphaLoggerAddress } from '@hamafx/web3';
import { getDb, schema } from '@hamafx/db';
import { sql } from 'drizzle-orm';
import React from 'react';

export const metadata = {
  title: 'Agent Dashboard | HamaFX-Ai',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const db = getDb();
  
  // Database stats
  const [dbSignalCountRes] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(schema.onChainSignals);
  
  // Contract stats
  let contractSignalCount = 0;
  let contractAddress = '';
  try {
    contractSignalCount = await getSignalCount();
    contractAddress = getAlphaLoggerAddress();
  } catch (err) {
    console.error('Failed to fetch from Mantle contract:', err);
  }

  // Distribution
  const distribution = await db
    .select({
      type: schema.onChainSignals.signalType,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(schema.onChainSignals)
    .groupBy(schema.onChainSignals.signalType);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pt-10 pb-20 sm:p-8">
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Agent Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            On-chain presence and performance metrics.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-premium p-6 rounded-xl border flex flex-col gap-2 bg-card">
          <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Mantle Contract</span>
          <span className="text-xs font-mono break-all text-primary">{contractAddress || 'Offline'}</span>
          <div className="mt-auto pt-4">
            <span className="text-3xl font-bold">{contractSignalCount}</span>
            <span className="text-sm text-muted-foreground ml-2">signals logged</span>
          </div>
        </div>

        <div className="card-premium p-6 rounded-xl border flex flex-col gap-2 bg-card">
          <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Internal DB</span>
          <span className="text-xs text-muted-foreground">Generated via AI committee</span>
          <div className="mt-auto pt-4">
            <span className="text-3xl font-bold">{dbSignalCountRes?.count || 0}</span>
            <span className="text-sm text-muted-foreground ml-2">total signals</span>
          </div>
        </div>

        <div className="card-premium p-6 rounded-xl border flex flex-col gap-2 bg-card">
          <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Signal Distribution</span>
          <div className="mt-auto pt-2 space-y-1">
            {distribution.length === 0 ? (
              <span className="text-sm text-muted-foreground">No data yet.</span>
            ) : (
              distribution.map((d) => (
                <div key={d.type} className="flex justify-between text-sm">
                  <span className="capitalize">{d.type.replace('_', ' ')}</span>
                  <span className="font-medium">{d.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="card-premium p-6 rounded-xl border bg-card">
        <h2 className="text-lg font-semibold mb-4">ERC-8004 Identity</h2>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Agent Name</div>
            <div className="font-medium">HamaFX-Alpha-Agent</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-emerald-500">Active (Mantle Sepolia)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
