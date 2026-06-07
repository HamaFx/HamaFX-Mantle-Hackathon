export function hasRows<T>(result: unknown): result is { rows: T[] } {
  return typeof result === 'object' && result !== null && 'rows' in result && Array.isArray((result as { rows: unknown }).rows);
}
