import { describe, it, expect } from 'vitest';
import { selectScenarioData } from './select-scenario-data';
import type {
  Member,
  MemberEvent,
  EventCostCenterAllocation,
  MemberCostCenterAllocation,
  HRScenarioMember,
  ScenarioMemberEvent,
  HRScenario,
} from '@/lib/optimizer/types';

const catalogMembers: Member[] = [
  {
    id: 'm-1',
    user_id: 'u-1',
    first_name: 'Alice',
    last_name: 'A',
    category: 'dipendente',
    seniority: 'middle',
    salary: 40000,
    chargeable_days: null,
    ft_percentage: 100,
    contract_start_date: '2024-01-01',
    contract_end_date: null,
  },
];
const catalogEvents: MemberEvent[] = [];
const catalogEventAllocations: EventCostCenterAllocation[] = [];
const baseAllocations: MemberCostCenterAllocation[] = [
  { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
];

describe('selectScenarioData (post-delta)', () => {
  it('baseline bundle has canonical arrays + empty synthetic', () => {
    const result = selectScenarioData({
      scenarioId: 'baseline',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios: [],
    });
    expect(result.source).toBe('baseline');
    expect(result.canonicalMembers).toBe(catalogMembers);
    expect(result.syntheticMembers).toEqual([]);
    expect(result.canonicalEvents).toBe(catalogEvents);
    expect(result.scenarioEvents).toEqual([]);
    expect(result.baseAllocations).toBe(baseAllocations);
  });

  it('scenario-loading or deleted-id falls back to baseline', () => {
    const r1 = selectScenarioData({
      scenarioId: 'deleted',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios: [],
    });
    expect(r1.source).toBe('baseline');

    const scenarios: HRScenario[] = [
      { id: 's-1', user_id: 'u-1', name: 'Alt', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    ];
    const r2 = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null, // still loading
      scenarios,
    });
    expect(r2.source).toBe('baseline');
  });

  it('scenario overlay combines canonical + synthetic members and both event streams', () => {
    const syntheticMembers: HRScenarioMember[] = [
      {
        id: 'syn-1',
        user_id: 'u-1',
        hr_scenario_id: 's-1',
        source_member_id: null,
        first_name: 'What-If',
        last_name: 'Hire',
        category: 'dipendente',
        seniority: 'senior',
        salary: 80000,
        ft_percentage: 100,
        chargeable_days: null,
        capacity_percentage: 100,
        cost_percentage: 100,
        contract_start_date: '2024-01-01',
        contract_end_date: null,
        is_synthetic: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const scenarioEvents: ScenarioMemberEvent[] = [
      {
        id: 'se-canonical',
        user_id: 'u-1',
        scenario_member_id: null,
        member_id: 'm-1', // override of canonical m-1
        field: 'salary',
        value: '60000',
        start_date: '2026-01-01',
        end_date: null,
        note: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'se-synthetic',
        user_id: 'u-1',
        scenario_member_id: 'syn-1',
        member_id: null,
        field: 'salary',
        value: '85000',
        start_date: '2026-06-01',
        end_date: null,
        note: null,
        created_at: '2026-06-01T00:00:00Z',
      },
    ];
    const scenarios: HRScenario[] = [
      { id: 's-1', user_id: 'u-1', name: 'Alt', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    ];
    const result = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: {
        scenario: scenarios[0],
        members: syntheticMembers,
        events: scenarioEvents,
        eventAllocations: [],
      },
      scenarios,
    });
    expect(result.source).toBe('scenario');
    expect(result.scenarioName).toBe('Alt');
    expect(result.canonicalMembers).toBe(catalogMembers);
    expect(result.syntheticMembers).toBe(syntheticMembers);
    expect(result.canonicalEvents).toBe(catalogEvents);
    expect(result.scenarioEvents).toBe(scenarioEvents);
    expect(result.baseAllocations).toBe(baseAllocations);
  });
});
