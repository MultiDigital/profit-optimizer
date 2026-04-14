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

describe('selectScenarioData', () => {
  it('returns baseline bundle when scenarioId is "baseline"', () => {
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
    expect(result.scenarioName).toBeNull();
    expect(result.members).toBe(catalogMembers);
    expect(result.events).toBe(catalogEvents);
    expect(result.eventAllocations).toBe(catalogEventAllocations);
    expect(result.baseAllocations).toBe(baseAllocations);
  });

  it('returns baseline bundle when scenarioId is a UUID but scenarios list is empty (invalid selection)', () => {
    const result = selectScenarioData({
      scenarioId: 'deleted-id',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios: [],
    });
    expect(result.source).toBe('baseline');
    expect(result.scenarioName).toBeNull();
  });

  it('returns scenario bundle when scenarioId matches a known scenario AND scenarioData is loaded', () => {
    const scenarioMembers: HRScenarioMember[] = [
      {
        id: 'sm-1',
        user_id: 'u-1',
        hr_scenario_id: 's-1',
        source_member_id: null,
        first_name: 'Bob',
        last_name: 'B',
        category: 'dipendente',
        seniority: 'senior',
        salary: 80000,
        ft_percentage: 100,
        chargeable_days: null,
        capacity_percentage: 100,
        cost_percentage: 100,
        contract_start_date: '2024-01-01',
        contract_end_date: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const scenarioEvents: ScenarioMemberEvent[] = [];
    const scenarioEventAllocations: EventCostCenterAllocation[] = [];
    const scenarios: HRScenario[] = [
      {
        id: 's-1',
        user_id: 'u-1',
        name: 'Alt Q2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    const result = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: {
        scenario: scenarios[0],
        members: scenarioMembers,
        events: scenarioEvents,
        eventAllocations: scenarioEventAllocations,
      },
      scenarios,
    });
    expect(result.source).toBe('scenario');
    expect(result.scenarioName).toBe('Alt Q2');
    expect(result.members).toBe(scenarioMembers);
    expect(result.events).toBe(scenarioEvents);
    expect(result.eventAllocations).toBe(scenarioEventAllocations);
    // baseAllocations remain the catalog's — scenarios don't override the initial CDC table today
    expect(result.baseAllocations).toBe(baseAllocations);
  });

  it('returns baseline bundle while scenarioData is still loading (scenarios list has the id but data not yet fetched)', () => {
    const scenarios: HRScenario[] = [
      {
        id: 's-1',
        user_id: 'u-1',
        name: 'Alt Q2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    const result = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios,
    });
    // Fallback to baseline so the UI doesn't flash empty
    expect(result.source).toBe('baseline');
    expect(result.scenarioName).toBeNull();
    expect(result.members).toBe(catalogMembers);
  });
});
