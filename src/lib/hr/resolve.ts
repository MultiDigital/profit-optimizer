import {
  EventCostCenterAllocation,
  Member,
  MemberCategory,
  MEMBER_CATEGORIES,
  MemberCostCenterAllocation,
  MemberEvent,
  MemberEventField,
  ScenarioMemberEvent,
  SeniorityLevel,
  SENIORITY_LEVELS,
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

function asCategory(raw: string | undefined, fallback: MemberCategory): MemberCategory {
  if (raw !== undefined && (MEMBER_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as MemberCategory;
  }
  return fallback;
}

function asSeniority(
  raw: string | undefined,
  fallback: SeniorityLevel | null,
): SeniorityLevel | null {
  if (raw !== undefined && (SENIORITY_LEVELS as readonly string[]).includes(raw)) {
    return raw as SeniorityLevel;
  }
  return fallback;
}

function toResolverEvent<
  T extends {
    id: string;
    field: MemberEventField;
    value: string;
    start_date: string;
    end_date: string | null;
  },
>(e: T, priority: 'canonical' | 'scenario'): AnyResolverEvent {
  return {
    id: e.id,
    field: e.field,
    value: e.value,
    start_date: e.start_date,
    end_date: e.end_date,
    priority,
  };
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
    ...canonicalEvents.map((e) => toResolverEvent(e, 'canonical')),
    ...scenarioEvents.map((e) => toResolverEvent(e, 'scenario')),
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

    category: asCategory(categoryRaw, member.category),
    seniority: asSeniority(seniorityRaw, member.seniority),
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

/**
 * Resolve 12 point-in-time snapshots for a member across a calendar year,
 * one per month, anchored at the 1st of each month.
 *
 * Semantics: each snapshot reflects the member's state AT that exact date.
 * An event whose start_date falls mid-month (e.g., 2026-06-15) is NOT
 * reflected until the NEXT month's snapshot (2026-07-01). This is
 * "snapshot on the 1st" semantics, suitable for month-indexed views
 * where a single column represents a single state.
 *
 * For aggregate monthly metrics (cost, capacity) that need to pro-rate
 * partial months, use the month-range logic in `compute.ts` instead.
 */
export function resolveMemberAtYear(
  member: Member,
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  year: number,
): ResolvedMember[] {
  const snapshots: ResolvedMember[] = [];
  for (let m = 1; m <= 12; m++) {
    const date = `${year}-${String(m).padStart(2, '0')}-01`;
    snapshots.push(
      resolveMemberAtDate(
        member,
        baseAllocations,
        canonicalEvents,
        scenarioEvents,
        eventAllocations,
        date,
      ),
    );
  }
  return snapshots;
}

/**
 * Batch resolve a full workforce at a date.
 *
 * Filters events per-member internally:
 * - canonicalEvents filtered by member_id === member.id
 * - scenarioEvents filtered by scenario_member_id === member.id
 *   (in PR 5 this changes to support scenario events referencing
 *   canonical members via member_id; until then, only synthetic
 *   members consume scenarioEvents via this path.)
 */
export function resolveWorkforceAtDate(
  members: Member[],
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedMember[] {
  return members.map((m) => {
    const mCanonical = canonicalEvents.filter((e) => e.member_id === m.id);
    const mScenario = scenarioEvents.filter((e) => e.scenario_member_id === m.id);
    return resolveMemberAtDate(
      m,
      baseAllocations,
      mCanonical,
      mScenario,
      eventAllocations,
      date,
    );
  });
}
