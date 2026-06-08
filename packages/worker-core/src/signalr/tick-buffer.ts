import type { Symbol } from '@hamafx/shared';
import type { NormalizedTick } from './consumer';

interface Slot {
  tick: NormalizedTick;
  observed: number;
}

export class TickBuffer {
  private readonly slots = new Map<Symbol, Slot>();

  push(tick: NormalizedTick): void {
    const existing = this.slots.get(tick.symbol);
    if (existing) {
      existing.tick = tick;
      existing.observed += 1;
    } else {
      this.slots.set(tick.symbol, { tick, observed: 1 });
    }
  }

  drain(): Array<{ tick: NormalizedTick; observed: number }> {
    if (this.slots.size === 0) return [];
    const out: Array<{ tick: NormalizedTick; observed: number }> = [];
    for (const slot of this.slots.values()) {
      out.push({ tick: slot.tick, observed: slot.observed });
    }
    this.slots.clear();
    return out;
  }

  size(): number {
    return this.slots.size;
  }

  clear(): void {
    this.slots.clear();
  }
}
