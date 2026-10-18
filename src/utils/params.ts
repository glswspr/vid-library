/**
 * Parse a route segment that must be a positive whole number.
 *
 * Deep links are typed by hand and shared, so `/season/abc` must not reach the
 * UI as `NaN` — it falls back to the caller's default instead.
 */
export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
