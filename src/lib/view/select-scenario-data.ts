import type {
  HRScenario,
  Member,
  MemberEvent,
  MemberCostCenterAllocation,
  EventCostCenterAllocation,
  HRScenarioMember,
  ScenarioMemberEvent,
} from '@/lib/optimizer/types';
import type { HRScenarioWithData } from '@/hooks/useHRScenarios';

export interface ResolvedScenarioBundle {
  source: 'baseline' | 'scenario';
  scenarioId: string; // 'baseline' or the matched scenario UUID
  scenarioName: string | null;
  members: Member[] | HRScenarioMember[];
  events: MemberEvent[] | ScenarioMemberEvent[];
  eventAllocations: EventCostCenterAllocation[];
  baseAllocations: MemberCostCenterAllocation[];
}

export interface SelectScenarioDataInput {
  scenarioId: string;
  catalogMembers: Member[];
  catalogEvents: MemberEvent[];
  catalogEventAllocations: EventCostCenterAllocation[];
  baseAllocations: MemberCostCenterAllocation[];
  scenarioData: HRScenarioWithData | null;
  scenarios: HRScenario[];
}

/**
 * Decide which data bundle an analysis page should use, given the
 * context's `scenarioId` and whatever the caller has fetched.
 *
 * Fallback rules:
 * - scenarioId === 'baseline' → catalog bundle
 * - scenarioId is a UUID but not found in `scenarios` (e.g., deleted) → catalog
 * - scenarioId matches a known scenario but `scenarioData` hasn't loaded → catalog
 *   (prevents empty flash; ScenarioSourcePicker will auto-reset to baseline too)
 * - scenarioId matches AND scenarioData is ready → scenario bundle
 *
 * Note: today's scenarios still use full-copy semantics for members;
 * `baseAllocations` always come from the catalog (scenarios don't copy
 * the member_cost_center_allocations table). PR 5 will refactor this.
 */
export function selectScenarioData(input: SelectScenarioDataInput): ResolvedScenarioBundle {
  const {
    scenarioId,
    catalogMembers,
    catalogEvents,
    catalogEventAllocations,
    baseAllocations,
    scenarioData,
    scenarios,
  } = input;

  if (scenarioId === 'baseline') {
    return baselineBundle();
  }

  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) {
    return baselineBundle();
  }

  if (!scenarioData || scenarioData.scenario.id !== scenarioId) {
    return baselineBundle();
  }

  return {
    source: 'scenario',
    scenarioId,
    scenarioName: scenario.name,
    members: scenarioData.members,
    events: scenarioData.events,
    eventAllocations: scenarioData.eventAllocations,
    baseAllocations, // unchanged — see comment above
  };

  function baselineBundle(): ResolvedScenarioBundle {
    return {
      source: 'baseline',
      scenarioId: 'baseline',
      scenarioName: null,
      members: catalogMembers,
      events: catalogEvents,
      eventAllocations: catalogEventAllocations,
      baseAllocations,
    };
  }
}
