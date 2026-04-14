/**
 * Shape of the persisted view state (year + scenario selection).
 * Versioning: no version field today. If the shape changes, bump the
 * localStorage key instead of migrating.
 */
export interface StoredView {
  year: number;
  scenarioId: string; // 'baseline' or an HR scenario UUID
}

/**
 * Clamp a year to [min, max]. NaN maps to min.
 */
export function clampYear(year: number, min: number, max: number): number {
  if (!Number.isFinite(year)) return min;
  if (year < min) return min;
  if (year > max) return max;
  return year;
}

/**
 * Parse a localStorage string into a StoredView, or null if it's missing
 * or malformed. The caller decides whether to fall back to defaults.
 */
export function parseStoredView(raw: string | null): StoredView | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.year !== 'number') return null;
  if (typeof obj.scenarioId !== 'string') return null;
  return { year: obj.year, scenarioId: obj.scenarioId };
}
