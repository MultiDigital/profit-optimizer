import {
  EventCostCenterAllocation,
  Member,
  MemberCategory,
  MemberCostCenterAllocation,
  MemberEvent,
  MemberEventField,
  ScenarioMemberEvent,
  SeniorityLevel,
} from '@/lib/optimizer/types';
import { ResolvedCostCenterAllocation, ResolvedMember } from './types';

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
 * Comparator: sort events by effective precedence (most-recent-wins).
 * 1. start_date DESC (more recent first)
 * 2. priority DESC (scenario before canonical)
 * 3. id ASC (deterministic tie-break)
 */
function compareEventsByPrecedence(a: AnyResolverEvent, b: AnyResolverEvent): number {
  if (a.start_date !== b.start_date) {
    return b.start_date.localeCompare(a.start_date);
  }
  const rank = (p: AnyResolverEvent['priority']) => (p === 'scenario' ? 1 : 0);
  if (a.priority !== b.priority) {
    return rank(b.priority) - rank(a.priority);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Resolve the effective value of a field at a specific date.
 * Returns undefined if no event is active — caller should fall back to
 * the base (initial) value.
 *
 * Precedence:
 * 1. Most recent start_date wins.
 * 2. On tie, scenario events beat canonical.
 * 3. On further tie, the event with the smaller `id` wins (deterministic).
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

  active.sort(compareEventsByPrecedence);
  return active[0].value;
}

/**
 * Resolve cost center allocations at a date.
 *
 * Behavior:
 * - If no `cost_center_allocations` event is active, return base allocations.
 * - Otherwise, the most recent active CDC event's allocations completely
 *   replace the base (CDC events are total, not additive).
 * - Scenario tie-break applies, same as resolveFieldAtDate.
 * - On further ties (equal start_date and priority), smaller event id wins
 *   for determinism.
 */
export function resolveCostCenterAllocationsAtDate(
  baseAllocations: ResolvedCostCenterAllocation[],
  events: AnyResolverEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedCostCenterAllocation[] {
  const activeCdcEvents = events.filter((e) => {
    if (e.field !== 'cost_center_allocations') return false;
    if (e.start_date > date) return false;
    if (e.end_date !== null && e.end_date < date) return false;
    return true;
  });
  if (activeCdcEvents.length === 0) return baseAllocations;

  activeCdcEvents.sort(compareEventsByPrecedence);
  const winner = activeCdcEvents[0];

  const winnerAllocations = eventAllocations.filter((a) => {
    if (winner.priority === 'canonical') return a.member_event_id === winner.id;
    return a.scenario_member_event_id === winner.id;
  });

  return winnerAllocations.map((a) => ({
    cost_center_id: a.cost_center_id,
    percentage: a.percentage,
  }));
}

/**
 * Resolve an employee's full state at a specific date.
 *
 * Inputs:
 * - `member`: the canonical initial state.
 * - `baseAllocations`: initial CDC split (from member_cost_center_allocations).
 *   Only rows for this member should be passed; the caller filters.
 * - `canonicalEvents`: real planned changes for this member.
 * - `scenarioEvents`: optional scenario overlay events for this member
 *   (empty when viewing baseline).
 * - `eventAllocations`: CDC sidecar rows for any cost_center_allocations
 *   events among canonical + scenario. The caller passes the full set;
 *   the resolver filters by event id.
 * - `date`: the 'YYYY-MM-DD' date to resolve at.
 */
export function resolveMemberAtDate(
  member: Member,
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedMember {
  const all: AnyResolverEvent[] = [
    ...canonicalEvents.map((e) => ({
      id: e.id,
      field: e.field,
      value: e.value,
      start_date: e.start_date,
      end_date: e.end_date,
      priority: 'canonical' as const,
    })),
    ...scenarioEvents.map((e) => ({
      id: e.id,
      field: e.field,
      value: e.value,
      start_date: e.start_date,
      end_date: e.end_date,
      priority: 'scenario' as const,
    })),
  ];

  const salaryRaw = resolveFieldAtDate(all, 'salary', date);
  const ftRaw = resolveFieldAtDate(all, 'ft_percentage', date);
  const seniorityRaw = resolveFieldAtDate(all, 'seniority', date);
  const categoryRaw = resolveFieldAtDate(all, 'category', date);
  const capacityRaw = resolveFieldAtDate(all, 'capacity_percentage', date);
  const chargeableRaw = resolveFieldAtDate(all, 'chargeable_days', date);

  const baseForMember = baseAllocations
    .filter((a) => a.member_id === member.id)
    .map((a) => ({ cost_center_id: a.cost_center_id, percentage: a.percentage }));

  const resolvedAllocations = resolveCostCenterAllocationsAtDate(
    baseForMember,
    all,
    eventAllocations,
    date,
  );

  return {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    contract_start_date: member.contract_start_date,
    contract_end_date: member.contract_end_date,

    category: (categoryRaw as MemberCategory | undefined) ?? member.category,
    seniority: (seniorityRaw as SeniorityLevel | undefined) ?? member.seniority,
    salary: salaryRaw !== undefined ? parseFloat(salaryRaw) : member.salary,
    ft_percentage:
      ftRaw !== undefined ? parseFloat(ftRaw) : (member.ft_percentage ?? 100),
    capacity_percentage:
      capacityRaw !== undefined ? parseFloat(capacityRaw) : 100,
    chargeable_days:
      chargeableRaw !== undefined
        ? parseFloat(chargeableRaw)
        : (member.chargeable_days ?? null),

    costCenterAllocations: resolvedAllocations,
    isActive: isMemberActiveAtDate(
      member.contract_start_date,
      member.contract_end_date,
      date,
    ),
    resolvedAt: date,
  };
}
