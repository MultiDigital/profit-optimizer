/**
 * Shape of the persisted view state (as-of date + scenario selection).
 * Versioning: no version field in the payload. If the shape changes, bump
 * the localStorage key instead of migrating.
 */
export interface StoredView {
  asOfDate: string; // ISO YYYY-MM-DD
  scenarioId: string; // 'baseline' or an HR scenario UUID
}

/**
 * Date bounds for the as-of date picker: [current year - 1 start, current year + 4 end].
 * Pinned at import time — acceptable because the app reloads on day change,
 * matching the precedent established by the former YEAR_MIN/YEAR_MAX.
 */
const NOW_YEAR = new Date().getFullYear();
export const AS_OF_DATE_MIN = `${NOW_YEAR - 1}-01-01`;
export const AS_OF_DATE_MAX = `${NOW_YEAR + 4}-12-31`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

/**
 * Clamp an ISO YYYY-MM-DD string to [min, max]. Malformed input maps to min.
 * String comparison is safe for ISO dates (lexical order == chronological order).
 */
export function clampAsOfDate(date: string, min: string, max: string): string {
  if (typeof date !== 'string' || !isIsoDate(date)) return min;
  if (date < min) return min;
  if (date > max) return max;
  return date;
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
  if (typeof obj.asOfDate !== 'string' || !isIsoDate(obj.asOfDate)) return null;
  if (typeof obj.scenarioId !== 'string') return null;
  return { asOfDate: obj.asOfDate, scenarioId: obj.scenarioId };
}
