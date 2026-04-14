import { describe, it, expect } from 'vitest';
import {
  isMemberActiveAtDate,
  resolveFieldAtDate,
  resolveCostCenterAllocationsAtDate,
  resolveMemberAtDate,
  AnyResolverEvent,
} from './resolve';
import {
  EventCostCenterAllocation,
  Member,
  MemberCostCenterAllocation,
  MemberEvent,
  ScenarioMemberEvent,
} from '@/lib/optimizer/types';

describe('isMemberActiveAtDate', () => {
  it('returns true when date is after contract_start and end is null', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2026-06-01')).toBe(true);
  });

  it('returns true when date equals contract_start', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2024-01-15')).toBe(true);
  });

  it('returns true when date equals contract_end', () => {
    expect(isMemberActiveAtDate('2024-01-15', '2026-12-31', '2026-12-31')).toBe(true);
  });

  it('returns false when date is before contract_start', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2023-12-31')).toBe(false);
  });

  it('returns false when date is after contract_end', () => {
    expect(isMemberActiveAtDate('2024-01-15', '2026-12-31', '2027-01-01')).toBe(false);
  });

  it('returns true when contract_start is null (no start set)', () => {
    expect(isMemberActiveAtDate(null, null, '2000-01-01')).toBe(true);
  });

  it('returns true when both contract dates are null', () => {
    expect(isMemberActiveAtDate(null, null, '2026-06-01')).toBe(true);
  });
});

let _nextEventId = 0;
function canonicalEvent(partial: Partial<AnyResolverEvent>): AnyResolverEvent {
  return {
    id: partial.id ?? `evt-${_nextEventId++}`,
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    priority: 'canonical',
    ...partial,
  } as AnyResolverEvent;
}

function scenarioEvent(partial: Partial<AnyResolverEvent>): AnyResolverEvent {
  return canonicalEvent({ ...partial, priority: 'scenario' });
}

describe('resolveFieldAtDate', () => {
  it('returns undefined when no events match the field', () => {
    const events: AnyResolverEvent[] = [
      canonicalEvent({ field: 'ft_percentage', value: '80' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBeUndefined();
  });

  it('returns undefined when event has not started yet', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '50000', start_date: '2027-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBeUndefined();
  });

  it('returns undefined when event has already ended before date', () => {
    const events = [
      canonicalEvent({
        field: 'salary',
        value: '45000',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2025-06-01')).toBeUndefined();
  });

  it('returns value when date is exactly start_date (inclusive)', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2026-06-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('45000');
  });

  it('returns value when date is exactly end_date (inclusive)', () => {
    const events = [
      canonicalEvent({
        field: 'salary',
        value: '45000',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2024-12-31')).toBe('45000');
  });

  it('returns the most recent event among multiple active ones', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2024-01-01' }),
      canonicalEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });

  it('scenario event wins over canonical event with same start_date', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2025-01-01' }),
      scenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('60000');
  });

  it('canonical event with later start_date still wins over earlier scenario event', () => {
    const events = [
      scenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
      canonicalEvent({ field: 'salary', value: '48000', start_date: '2025-07-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });

  it('breaks further ties by id ascending when start_date and priority are equal', () => {
    const events = [
      canonicalEvent({ id: 'evt-b', field: 'salary', value: '50000', start_date: '2025-01-01' }),
      canonicalEvent({ id: 'evt-a', field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });
});

describe('resolveCostCenterAllocationsAtDate', () => {
  it('returns base allocations when no CDC events are active', () => {
    const base = [
      { cost_center_id: 'cc-a', percentage: 60 },
      { cost_center_id: 'cc-b', percentage: 40 },
    ];
    const result = resolveCostCenterAllocationsAtDate(base, [], [], '2026-06-01');
    expect(result).toEqual(base);
  });

  it('returns base allocations when all CDC events are in the future', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-1',
        field: 'cost_center_allocations',
        start_date: '2027-01-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
    ];
    expect(
      resolveCostCenterAllocationsAtDate(base, events, eventAllocs, '2026-06-01'),
    ).toEqual(base);
  });

  it('applies the most recent active CDC event (overrides base)', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-1',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 70,
      },
      {
        id: 'a-2',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-c',
        percentage: 30,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(
      base,
      events,
      eventAllocs,
      '2026-06-01',
    );
    expect(result).toEqual([
      { cost_center_id: 'cc-b', percentage: 70 },
      { cost_center_id: 'cc-c', percentage: 30 },
    ]);
  });

  it('picks allocations from the most recent event when multiple active', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-old',
        field: 'cost_center_allocations',
        start_date: '2026-01-01',
      }),
      canonicalEvent({
        id: 'evt-new',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-old',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
      {
        id: 'a-2',
        member_event_id: 'evt-new',
        scenario_member_event_id: null,
        cost_center_id: 'cc-c',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(
      base,
      events,
      eventAllocs,
      '2026-06-01',
    );
    expect(result).toEqual([{ cost_center_id: 'cc-c', percentage: 100 }]);
  });

  it('resolves scenario event allocations via scenario_member_event_id', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      scenarioEvent({
        id: 'sevt-1',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: null,
        scenario_member_event_id: 'sevt-1',
        cost_center_id: 'cc-z',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(
      base,
      events,
      eventAllocs,
      '2026-06-01',
    );
    expect(result).toEqual([{ cost_center_id: 'cc-z', percentage: 100 }]);
  });

  it('scenario CDC event wins over canonical CDC event with same start_date', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-can',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
      scenarioEvent({
        id: 'evt-scen',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-can',
        member_event_id: 'evt-can',
        scenario_member_event_id: null,
        cost_center_id: 'cc-canonical',
        percentage: 100,
      },
      {
        id: 'a-scen',
        member_event_id: null,
        scenario_member_event_id: 'evt-scen',
        cost_center_id: 'cc-scenario',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(base, events, eventAllocs, '2026-06-01');
    expect(result).toEqual([{ cost_center_id: 'cc-scenario', percentage: 100 }]);
  });

  it('breaks CDC ties by id ascending when start_date and priority equal', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-b',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
      canonicalEvent({
        id: 'evt-a',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-a',
        scenario_member_event_id: null,
        cost_center_id: 'cc-winner-a',
        percentage: 100,
      },
      {
        id: 'a-2',
        member_event_id: 'evt-b',
        scenario_member_event_id: null,
        cost_center_id: 'cc-winner-b',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(base, events, eventAllocs, '2026-06-01');
    expect(result).toEqual([{ cost_center_id: 'cc-winner-a', percentage: 100 }]);
  });

  it('applies CDC event on exact start_date (inclusive bound)', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-1',
        field: 'cost_center_allocations',
        start_date: '2026-06-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(base, events, eventAllocs, '2026-06-01');
    expect(result).toEqual([{ cost_center_id: 'cc-b', percentage: 100 }]);
  });

  it('falls back to base when all CDC events have already ended', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-1',
        field: 'cost_center_allocations',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-old',
        percentage: 100,
      },
    ];
    expect(
      resolveCostCenterAllocationsAtDate(base, events, eventAllocs, '2026-06-01'),
    ).toEqual(base);
  });

  it('ignores non-CDC events when resolving allocations', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-sal',
        field: 'salary',
        value: '50000',
        start_date: '2026-05-01',
      }),
    ];
    expect(
      resolveCostCenterAllocationsAtDate(base, events, [], '2026-06-01'),
    ).toEqual(base);
  });
});

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm-1',
    user_id: 'u-1',
    first_name: 'Mario',
    last_name: 'Rossi',
    category: 'dipendente',
    seniority: 'middle',
    salary: 42000,
    chargeable_days: null,
    ft_percentage: 100,
    contract_start_date: '2024-01-15',
    contract_end_date: null,
    ...overrides,
  };
}

let _nextMemberEventId = 0;
function makeMemberEvent(partial: Partial<MemberEvent>): MemberEvent {
  return {
    id: partial.id ?? `me-${_nextMemberEventId++}`,
    user_id: 'u-1',
    member_id: 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    note: null,
    created_at: '2024-01-01T00:00:00Z',
    ...partial,
  };
}

let _nextScenarioEventId = 0;
function makeScenarioEvent(partial: Partial<ScenarioMemberEvent>): ScenarioMemberEvent {
  return {
    id: partial.id ?? `se-${_nextScenarioEventId++}`,
    user_id: 'u-1',
    scenario_member_id: 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    note: null,
    created_at: '2024-01-01T00:00:00Z',
    ...partial,
  };
}

describe('resolveMemberAtDate', () => {
  it('returns initial state when there are no events', () => {
    const m = makeMember();
    const baseAllocs: MemberCostCenterAllocation[] = [
      { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
    ];
    const resolved = resolveMemberAtDate(m, baseAllocs, [], [], [], '2026-06-01');
    expect(resolved.salary).toBe(42000);
    expect(resolved.seniority).toBe('middle');
    expect(resolved.ft_percentage).toBe(100);
    expect(resolved.capacity_percentage).toBe(100);
    expect(resolved.category).toBe('dipendente');
    expect(resolved.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-a', percentage: 100 },
    ]);
    expect(resolved.isActive).toBe(true);
    expect(resolved.resolvedAt).toBe('2026-06-01');
  });

  it('applies a canonical salary event', () => {
    const m = makeMember();
    const events = [
      makeMemberEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], events, [], [], '2026-06-01');
    expect(resolved.salary).toBe(48000);
  });

  it('parses numeric fields as numbers', () => {
    const m = makeMember();
    const events = [
      makeMemberEvent({ field: 'ft_percentage', value: '80', start_date: '2025-01-01' }),
      makeMemberEvent({ field: 'capacity_percentage', value: '75', start_date: '2025-01-01' }),
      makeMemberEvent({ field: 'chargeable_days', value: '180', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], events, [], [], '2026-06-01');
    expect(resolved.ft_percentage).toBe(80);
    expect(resolved.capacity_percentage).toBe(75);
    expect(resolved.chargeable_days).toBe(180);
  });

  it('applies enum fields as strings (seniority, category)', () => {
    const m = makeMember();
    const events = [
      makeMemberEvent({ field: 'seniority', value: 'senior', start_date: '2025-01-01' }),
      makeMemberEvent({ field: 'category', value: 'freelance', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], events, [], [], '2026-06-01');
    expect(resolved.seniority).toBe('senior');
    expect(resolved.category).toBe('freelance');
  });

  it('scenario event overrides canonical event on same start_date', () => {
    const m = makeMember();
    const canonical = [
      makeMemberEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    const scenario = [
      makeScenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], canonical, scenario, [], '2026-06-01');
    expect(resolved.salary).toBe(60000);
  });

  it('isActive=false when date is before contract_start', () => {
    const m = makeMember({ contract_start_date: '2025-01-01' });
    const resolved = resolveMemberAtDate(m, [], [], [], [], '2024-06-01');
    expect(resolved.isActive).toBe(false);
  });

  it('isActive=false when date is after contract_end', () => {
    const m = makeMember({ contract_start_date: '2024-01-01', contract_end_date: '2025-12-31' });
    const resolved = resolveMemberAtDate(m, [], [], [], [], '2026-06-01');
    expect(resolved.isActive).toBe(false);
  });

  it('uses event-level CDC allocations when a CDC event is active', () => {
    const m = makeMember();
    const baseAllocs: MemberCostCenterAllocation[] = [
      { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
    ];
    const event = makeMemberEvent({
      id: 'evt-cdc',
      field: 'cost_center_allocations',
      value: '',
      start_date: '2026-05-01',
    });
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'ea-1',
        member_event_id: 'evt-cdc',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
    ];
    const resolved = resolveMemberAtDate(m, baseAllocs, [event], [], eventAllocs, '2026-06-01');
    expect(resolved.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-b', percentage: 100 },
    ]);
  });

  it('ft_percentage defaults to 100 when member.ft_percentage is null', () => {
    const m = makeMember({ ft_percentage: null });
    const resolved = resolveMemberAtDate(m, [], [], [], [], '2026-06-01');
    expect(resolved.ft_percentage).toBe(100);
  });
});
