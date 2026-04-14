/**
 * Returns true if the member is within their contract window at `date`.
 * Bounds are inclusive on both ends.
 * Null start/end means "no bound" on that side.
 *
 * All dates are 'YYYY-MM-DD' strings. Lexical comparison is valid because
 * the ISO date format sorts correctly as strings.
 */
export function isMemberActiveAtDate(
  contractStart: string | null,
  contractEnd: string | null,
  date: string,
): boolean {
  if (contractStart !== null && date < contractStart) return false;
  if (contractEnd !== null && date > contractEnd) return false;
  return true;
}

import { MemberEventField } from '@/lib/optimizer/types';

/**
 * Internal event shape used by the resolver.
 * Upstream code wraps canonical MemberEvent (priority='canonical') and
 * scenario ScenarioMemberEvent (priority='scenario') into this shape.
 *
 * The `priority` field controls tie-breaking: when two events have the
 * same start_date on the same field, 'scenario' wins over 'canonical'.
 */
export interface AnyResolverEvent {
  id: string;
  field: MemberEventField;
  value: string;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string | null; // 'YYYY-MM-DD' inclusive, null = ongoing
  priority: 'canonical' | 'scenario';
}

/**
 * Resolve the effective value of a field at a specific date.
 * Returns undefined if no event is active — caller should fall back to
 * the base (initial) value.
 *
 * Precedence:
 * 1. Most recent start_date wins.
 * 2. On tie, scenario events beat canonical.
 */
export function resolveFieldAtDate(
  events: AnyResolverEvent[],
  field: MemberEventField,
  date: string,
): string | undefined {
  const active = events.filter((e) => {
    if (e.field !== field) return false;
    if (e.start_date > date) return false;
    if (e.end_date !== null && e.end_date < date) return false;
    return true;
  });
  if (active.length === 0) return undefined;

  // Sort: start_date DESC, then priority (scenario before canonical) DESC.
  // 'scenario' > 'canonical' lexically works in our favor (s > c),
  // but to be explicit and robust we compare priority numerically.
  const priorityRank = (p: AnyResolverEvent['priority']) =>
    p === 'scenario' ? 1 : 0;
  active.sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return b.start_date.localeCompare(a.start_date);
    }
    return priorityRank(b.priority) - priorityRank(a.priority);
  });
  return active[0].value;
}
