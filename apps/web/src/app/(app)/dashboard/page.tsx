import { getSignalCount, getAlphaLoggerAddress, getExplorerUrl } from '@hamafx/web3';
import { getDb, schema } from '@hamafx/db';
import { desc, sql } from 'drizzle-orm';
import React from 'react';

export const metadata = {
  title: 'Agent Dashboard | HamaFX-Ai',
  description: 'Mantle Alpha Agent performance metrics and on-chain identity.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const db = getDb();

  // Database stats
  const [dbStats] = await db
    .select({
      total: sql<number>`cast(count(*) as integer)`,
      logged: sql<number>`cast(count(*) filter (where tx_hash is not null) as integer)`,
      avgConf: sql<number>`round(avg(confidence)::numeric, 1)`,
      bullish: sql<number>`cast(count(*) filter (where direction = 'bullish') as integer)`,
      bearish: sql<number>`cast(count(*) filter (where direction = 'bearish') as integer)`,
      neutral: sql<number>`cast(count(*) filter (where direction = 'neutral') as integer)`,
    })
    .from(schema.onChainSignals);

  // Signal type breakdown
  const distribution = await db
    .select({
      type: schema.onChainSignals.signalType,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(schema.onChainSignals)
    .groupBy(schema.onChainSignals.signalType)
    .orderBy(desc(sql`count(*)`));

  // Recent signals for preview
  const recentSignals = await db
    .select()
    .from(schema.onChainSignals)
    .orderBy(desc(schema.onChainSignals.createdAt))
    .limit(5);

  // Contract stats
  let contractSignalCount = 0;
  let contractAddress = '';
  let contractExplorerUrl = '';
  try {
    contractSignalCount = await getSignalCount();
    contractAddress = getAlphaLoggerAddress();
    contractExplorerUrl = getExplorerUrl('address', contractAddress);
  } catch {
    // Contract not yet deployed or env not set — show graceful placeholder
  }

  const isContractDeployed = Boolean(contractAddress);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pt-10 pb-24 sm:p-8">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-divider pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🤖</span>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-fg">
              Agent Dashboard
            </h1>
          </div>
          <p className="text-fg-muted text-sm">
            HamaFX Alpha Agent — Mantle Network on-chain performance and identity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-emerald-400">Active</span>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">DB Signals</span>
          <span className="text-3xl font-bold text-fg tabular-nums">{dbStats?.total ?? 0}</span>
        </div>
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">On-Chain</span>
          <span className="text-3xl font-bold text-brand tabular-nums">{contractSignalCount}</span>
        </div>
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Logged</span>
          <span className="text-3xl font-bold text-teal-400 tabular-nums">{dbStats?.logged ?? 0}</span>
        </div>
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Avg Conf</span>
          <span className="text-3xl font-bold text-fg tabular-nums">
            {dbStats?.avgConf ?? '—'}<span className="text-base text-fg-muted">/10</span>
          </span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ERC-8004 Identity Card */}
        <div className="card-premium rounded-2xl border border-divider bg-card p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-fg">ERC-8004 Agent Identity</h2>
            <span className="text-xs rounded-full bg-brand/15 text-brand px-2.5 py-0.5 font-semibold ring-1 ring-brand/30">
              Mantle Sepolia
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-fg-muted mb-1 font-medium uppercase tracking-wider">Agent Name</div>
              <div className="font-semibold text-fg">HamaFX-Alpha-Agent</div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1 font-medium uppercase tracking-wider">Status</div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-medium text-emerald-400 text-sm">Active</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1 font-medium uppercase tracking-wider">Smart Contract</div>
              {isContractDeployed ? (
                <a
                  href={contractExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-brand hover:underline break-all"
                >
                  {contractAddress} ↗
                </a>
              ) : (
                <span className="text-xs text-fg-subtle font-mono">Not yet deployed</span>
              )}
            </div>
            <div>
              <div className="text-xs text-fg-muted mb-1 font-medium uppercase tracking-wider">Track</div>
              <div className="text-sm text-fg">Track 2 — AI Alpha &amp; Data</div>
            </div>
          </div>

          {/* Capabilities */}
          <div className="pt-4 border-t border-divider">
            <div className="text-xs text-fg-muted mb-3 font-medium uppercase tracking-wider">Capabilities</div>
            <div className="flex flex-wrap gap-2">
              {[
                '🐋 Whale Detection',
                '🔮 Alpha Analysis',
                '🏦 DeFi Monitoring',
                '📰 Macro Events',
                '🔗 On-Chain Logging',
                '📱 Telegram Alerts',
              ].map((cap) => (
                <span
                  key={cap}
                  className="text-xs rounded-full bg-bg-elev-2 text-fg-muted px-2.5 py-1 border border-divider"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Signal breakdown */}
        <div className="card-premium rounded-2xl border border-divider bg-card p-6 flex flex-col gap-5">
          <h2 className="text-base font-bold text-fg">Signal Breakdown</h2>

          {/* Direction distribution */}
          <div>
            <div className="text-xs text-fg-muted mb-3 font-medium uppercase tracking-wider">By Direction</div>
            <div className="space-y-2">
              {[
                { label: 'Bullish 📈', value: dbStats?.bullish ?? 0, color: 'bg-emerald-500' },
                { label: 'Bearish 📉', value: dbStats?.bearish ?? 0, color: 'bg-rose-500' },
                { label: 'Neutral ➖', value: dbStats?.neutral ?? 0, color: 'bg-zinc-500' },
              ].map(({ label, value, color }) => {
                const total = dbStats?.total ?? 0;
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-fg-muted">{label}</span>
                      <span className="font-medium text-fg tabular-nums">{value} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'oklch(20% 0 0)' }}>
                      <div
                        className={`h-1.5 rounded-full ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type distribution */}
          {distribution.length > 0 && (
            <div className="pt-4 border-t border-divider">
              <div className="text-xs text-fg-muted mb-3 font-medium uppercase tracking-wider">By Type</div>
              <div className="space-y-1">
                {distribution.map((d) => (
                  <div key={d.type} className="flex justify-between text-sm">
                    <span className="text-fg-muted capitalize">{d.type.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-fg tabular-nums">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On-chain sync health */}
          <div className="pt-4 border-t border-divider">
            <div className="text-xs text-fg-muted mb-3 font-medium uppercase tracking-wider">On-Chain Sync</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">
                {dbStats?.logged ?? 0} of {dbStats?.total ?? 0} signals logged
              </span>
              {isContractDeployed ? (
                <span className="text-xs rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 font-semibold ring-1 ring-emerald-500/30">
                  Contract Live
                </span>
              ) : (
                <span className="text-xs rounded-full bg-amber-500/15 text-amber-400 px-2.5 py-0.5 font-semibold ring-1 ring-amber-500/30">
                  Contract Pending
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent signals preview */}
      {recentSignals.length > 0 && (
        <div className="card-premium rounded-2xl border border-divider bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-fg">Recent Signals</h2>
            <a
              href="/signals"
              className="text-xs text-brand hover:underline font-medium"
            >
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {recentSignals.map((sig) => (
              <div
                key={sig.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-divider p-3 bg-bg-elev-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">
                    {sig.direction === 'bullish' ? '📈' : sig.direction === 'bearish' ? '📉' : '➖'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-fg text-sm">{sig.asset}</span>
                      {sig.committeeGrade && (
                        <span className="text-xs font-bold text-brand">{sig.committeeGrade}</span>
                      )}
                    </div>
                    <p className="text-xs text-fg-muted truncate">{sig.summary}</p>
                  </div>
                </div>
                {sig.explorerUrl ? (
                  <a
                    href={sig.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand hover:underline font-mono flex-shrink-0"
                  >
                    🔗 tx ↗
                  </a>
                ) : (
                  <span className="text-xs text-fg-subtle flex-shrink-0">Pending</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
