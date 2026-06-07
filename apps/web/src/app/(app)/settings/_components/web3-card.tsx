'use client';

import { Activity, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { SettingsRow } from './settings-row';

export function Web3Card() {
  const [autonomousMode, setAutonomousMode] = useState(false);

  useEffect(() => {
    // Read from local storage
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('hamafx:autonomous_mode');
      if (stored === 'true') {
        setAutonomousMode(true);
      }
    }
  }, []);

  function toggleAutonomousMode(v: boolean) {
    setAutonomousMode(v);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('hamafx:autonomous_mode', v.toString());
    }
  }

  return (
    <section
      aria-labelledby="web3-heading"
      className="card-premium flex flex-col gap-1 p-4"
    >
      <header className="flex items-center gap-3 pb-2">
        <h2
          id="web3-heading"
          className="text-fg text-base font-semibold tracking-tight"
        >
          Web3 Configuration
        </h2>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-emerald-400 ring-1 ring-emerald-500/30">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500"></span>
          </span>
          Mantle
        </span>
      </header>

      <SettingsRow
        icon={<Wallet className="size-4" />}
        label="Agent Wallet"
        description="Private key injected via env (MANTLE_AGENT_PRIVATE_KEY)"
        action={
          <span className="font-mono text-xs text-brand bg-brand/10 px-2 py-1 rounded border border-brand/20">
            Connected
          </span>
        }
      />

      <RowDivider />

      <SettingsRow
        icon={<Activity className="size-4" />}
        label="Autonomous Mode"
        description="Allow the agent to log on-chain signals automatically without human approval."
        action={
          <Switch
            checked={autonomousMode}
            onCheckedChange={toggleAutonomousMode}
            srLabel="Autonomous mode"
          />
        }
      />
    </section>
  );
}

function RowDivider() {
  return <div className="border-divider/60 -mx-4 my-1 border-t" />;
}
