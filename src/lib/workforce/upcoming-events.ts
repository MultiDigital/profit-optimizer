import { MemberEvent } from '@/lib/optimizer/types';

/**
 * Count upcoming events per member_id.
 *
 * "Upcoming" means: `start_date` is STRICTLY AFTER `today`
 * (exclusive — an event starting today is already in effect, not upcoming)
 * AND `start_date` is on or before `today + windowDays`.
 *
 * Dates are 'YYYY-MM-DD' strings; lexical comparison is valid.
 */
export function countUpcomingEventsByMember(
  events: MemberEvent[],
  today: string, // 'YYYY-MM-DD'
  windowDays: number,
): Map<string, number> {
  const windowEnd = addDaysToIsoDate(today, windowDays);
  const result = new Map<string, number>();
  for (const e of events) {
    if (e.start_date <= today) continue;
    if (e.start_date > windowEnd) continue;
    result.set(e.member_id, (result.get(e.member_id) ?? 0) + 1);
  }
  return result;
}

function addDaysToIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
