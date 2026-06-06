/* eslint-disable @typescript-eslint/consistent-type-imports */
import { useQuery } from '@tanstack/react-query';
import type { InferSelectModel } from 'drizzle-orm';
import { schema } from '@hamafx/db';

type Signal = InferSelectModel<typeof schema.onChainSignals>;

export function useSignals() {
  return useQuery({
    queryKey: ['signals'],
    queryFn: async (): Promise<Signal[]> => {
      const res = await fetch('/api/signals?limit=50');
      if (!res.ok) {
        throw new Error('Failed to fetch signals');
      }
      return res.json();
    },
    refetchInterval: 30000, // 30 seconds
  });
}
