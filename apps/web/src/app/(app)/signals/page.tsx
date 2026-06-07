import { getDb, schema } from '@hamafx/db';
import { desc, sql } from 'drizzle-orm';
import React from 'react';

export const metadata = {
  title: 'On-Chain Alpha Signals | HamaFX-Ai',
  description: 'AI-generated alpha signals logged to the Mantle blockchain — verifiable on-chain.',
};

export const dynamic = 'force-dynamic';

const DIRECTION_STYLES: Record<string, string> = {
  bullish:
    'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  bearish:
    'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
  neutral:
    'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30',
};

const DIRECTION_EMOJI: Record<string, string> = {
  bullish: '📈',
  bearish: '📉',
  neutral: '➖',
};

const TYPE_EMOJI: Record<string, string> = {
  whale_alert: '🐋',
  defi_anomaly: '🏦',
  alpha_signal: '🔮',
  macro_event: '📰',
};

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40',
  B: 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40',
  C: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40',
  D: 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40',
  F: 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40',
};

const GONOGO_STYLES: Record<string, string> = {
  go: 'bg-emerald-500/15 text-emerald-400',
  caution: 'bg-amber-500/15 text-amber-400',
  'no-go': 'bg-rose-500/15 text-rose-400',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value / 10) * 100);
  const color =
    value >= 8
      ? 'bg-emerald-500'
      : value >= 6
      ? 'bg-amber-500'
      : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 rounded-full"
        style={{ background: 'oklch(20% 0 0)' }}
      >
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-fg-muted w-7 text-right">{value}/10</span>
    </div>
  );
}

export default async function SignalsPage() {
  const db = getDb();

  const [signals, statsRes] = await Promise.all([
    db
      .select()
      .from(schema.onChainSignals)
      .orderBy(desc(schema.onChainSignals.createdAt))
      .limit(50),
    db
      .select({
        total: sql<number>`cast(count(*) as integer)`,
        logged: sql<number>`cast(count(*) filter (where tx_hash is not null) as integer)`,
        avgConf: sql<number>`round(avg(confidence)::numeric, 1)`,
      })
      .from(schema.onChainSignals),
  ]);

  const stats = statsRes[0];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pt-10 pb-24 sm:p-8">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-divider pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔮</span>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-fg">
              On-Chain Alpha
            </h1>
          </div>
          <p className="text-fg-muted text-sm">
            AI-verified signals logged to the{' '}
            <a
              href="https://sepolia.mantlescan.xyz"
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              Mantle blockchain
            </a>{' '}
            — tamper-proof alpha with on-chain proof.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 grid-cols-3">
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Total Signals
          </span>
          <span className="text-3xl font-bold text-fg tabular-nums">{stats?.total ?? 0}</span>
        </div>
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            On-Chain Logged
          </span>
          <span className="text-3xl font-bold text-brand tabular-nums">{stats?.logged ?? 0}</span>
        </div>
        <div className="card-premium rounded-xl border border-divider p-5 bg-card flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Avg Confidence
          </span>
          <span className="text-3xl font-bold text-fg tabular-nums">
            {stats?.avgConf ?? '—'}<span className="text-base text-fg-muted">/10</span>
          </span>
        </div>
      </div>

      {/* Signal list */}
      {signals.length === 0 ? (
        <div className="card-premium rounded-2xl border border-dashed border-divider flex flex-col items-center justify-center h-48 gap-3 text-fg-muted">
          <span className="text-4xl">🔮</span>
          <p className="text-sm">No on-chain signals yet.</p>
          <p className="text-xs text-fg-subtle">
            Ask the AI:{' '}
            <span className="font-mono text-brand">
              &quot;Analyze MNT on-chain activity and generate an alpha signal&quot;
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((sig) => {
            const typeEmoji = TYPE_EMOJI[sig.signalType] ?? '📊';
            const dirEmoji = DIRECTION_EMOJI[sig.direction] ?? '➖';
            const dirStyle = DIRECTION_STYLES[sig.direction] ?? DIRECTION_STYLES.neutral;
            const gradeStyle = sig.committeeGrade
              ? (GRADE_STYLES[sig.committeeGrade] ?? 'bg-zinc-500/15 text-zinc-400')
              : 'bg-zinc-500/15 text-zinc-400';
            const gonogoStyle = sig.goNoGo
              ? (GONOGO_STYLES[sig.goNoGo] ?? 'bg-zinc-500/15 text-zinc-400')
              : 'bg-zinc-500/15 text-zinc-400';

            return (
              <div
                key={sig.id}
                className="card-premium rounded-2xl border border-divider bg-card p-5 hover:border-brand/30 transition-colors"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: type + asset + direction */}
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{typeEmoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-fg">{sig.asset}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${dirStyle}`}
                        >
                          {dirEmoji} {sig.direction.toUpperCase()}
                        </span>
                        <span className="text-xs text-fg-muted capitalize">
                          {sig.signalType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-fg-muted line-clamp-2">{sig.summary}</p>
                    </div>
                  </div>

                  {/* Right: badges + explorer */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      {sig.committeeGrade && (
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${gradeStyle}`}
                        >
                          {sig.committeeGrade}
                        </span>
                      )}
                      {sig.goNoGo && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${gonogoStyle}`}
                        >
                          {sig.goNoGo}
                        </span>
                      )}
                    </div>
                    {sig.explorerUrl ? (
                      <a
                        href={sig.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase text-brand ring-1 ring-brand/30 hover:bg-brand/20 transition-all hover:scale-105"
                      >
                        <span className="text-sm leading-none">⚑</span> Verify on Mantle
                      </a>
                    ) : (
                      <span className="text-xs text-fg-subtle">Pending…</span>
                    )}
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="mt-4 pt-3 border-t border-divider">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                      Confidence
                    </span>
                    <span className="text-[11px] text-fg-muted">
                      {new Date(sig.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <ConfidenceBar value={sig.confidence} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
