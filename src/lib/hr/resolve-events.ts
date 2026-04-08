import { MemberEvent, MemberEventField, ScenarioMemberEvent, EventCostCenterAllocation } from '@/lib/optimizer/types';

type AnyEvent = MemberEvent | ScenarioMemberEvent;

/**
 * Resolve the effective value of a field for a given month.
 * Precedence: event with most recent start_date wins among active events.
 * Returns undefined if no event is active (use base value).
 */
export function resolveFieldForMonth(
  events: AnyEvent[],
  field: MemberEventField,
  month: string // 'YYYY-MM'
): string | undefined {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  const activeEvents = events.filter((e) => {
    if (e.field !== field) return false;
    if (e.start_date > monthEnd) return false;
    if (e.end_date !== null && e.end_date < monthStart) return false;
    return true;
  });

  if (activeEvents.length === 0) return undefined;

  // Most recent start_date wins
  activeEvents.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return activeEvents[0].value;
}

/**
 * Check if a member is active (within contract dates) for a given month.
 */
export function isMemberActiveInMonth(
  contractStart: string | null,
  contractEnd: string | null,
  month: string
): boolean {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  if (contractStart && contractStart > monthEnd) return false;
  if (contractEnd && contractEnd < monthStart) return false;
  return true;
}

/**
 * Calculate the pro-rata fraction for a partial month.
 * Returns a value between 0 and 1.
 * 1.0 means the member is active for the entire month.
 */
export function monthProRataFraction(
  contractStart: string | null,
  contractEnd: string | null,
  month: string
): number {
  const monthStartStr = `${month}-01`;
  const monthEndStr = lastDayOfMonth(month);
  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();

  let startDay = 1;
  let endDay = daysInMonth;

  if (contractStart && contractStart > monthStartStr && contractStart <= monthEndStr) {
    startDay = parseInt(contractStart.split('-')[2]);
  }

  if (contractEnd && contractEnd >= monthStartStr && contractEnd < monthEndStr) {
    endDay = parseInt(contractEnd.split('-')[2]);
  }

  const activeDays = Math.max(0, endDay - startDay + 1);
  return activeDays / daysInMonth;
}

/**
 * Returns the last day of a month in 'YYYY-MM-DD' format.
 */
function lastDayOfMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const m = parseInt(monthStr);
  const lastDay = new Date(year, m, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Resolve cost center allocations for a given month from events.
 * Returns the allocations from the most recent active CDC event, or null if none.
 */
export function resolveCostCenterAllocationsForMonth(
  events: AnyEvent[],
  eventAllocations: EventCostCenterAllocation[],
  month: string
): EventCostCenterAllocation[] | null {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  // Filter CDC events active in this month
  const cdcEvents = events.filter((e) => {
    if (e.field !== 'cost_center_allocations') return false;
    if (e.start_date > monthEnd) return false;
    if (e.end_date !== null && e.end_date < monthStart) return false;
    return true;
  });

  if (cdcEvents.length === 0) return null;

  // Most recent start_date wins
  cdcEvents.sort((a, b) => b.start_date.localeCompare(a.start_date));
  const winningEvent = cdcEvents[0];

  // Find allocations for this event
  const eventId = winningEvent.id;
  const allocations = eventAllocations.filter((a) => {
    if ('member_id' in winningEvent) {
      return a.member_event_id === eventId;
    }
    return a.scenario_member_event_id === eventId;
  });

  return allocations.length > 0 ? allocations : null;
}

/**
 * Parse event value to the correct type based on field.
 */
export function parseEventValue(field: MemberEventField, value: string): number | string {
  switch (field) {
    case 'salary':
    case 'ft_percentage':
    case 'capacity_percentage':
    case 'chargeable_days':
      return parseFloat(value);
    case 'seniority':
    case 'category':
      return value;
    case 'cost_center_allocations':
      return value;
  }
}
