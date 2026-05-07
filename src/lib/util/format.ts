/**
 * Format a play count as "1.2k", "1.4M", etc. Locale-aware comma fallback
 * for under-1k counts to preserve the "1,248" style from the reference mock.
 */
export function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}
