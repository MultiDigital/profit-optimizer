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
  canonicalMembers: Member[];
  syntheticMembers: HRScenarioMember[];
  canonicalEvents: MemberEvent[];
  scenarioEvents: ScenarioMemberEvent[];
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
 * Decide which data bundle an analysis page should use.
 *
 * Fallback rules (unchanged from PR 4):
 * - scenarioId === 'baseline' → baseline bundle (catalog only, no synthetic members)
 * - scenarioId UUID not in scenarios list → baseline
 * - scenarioId UUID matches but scenarioData not yet loaded → baseline (prevents flash)
 * - scenarioId UUID matches AND scenarioData ready → overlay bundle
 *
 * In the overlay (scenario) bundle:
 * - canonicalMembers is always the catalog (scenarios overlay, don't replace)
 * - syntheticMembers are the scenario's own HRScenarioMember rows
 * - canonicalEvents is always the catalog's member_events
 * - scenarioEvents contains the scenario's own events (each with either
 *   member_id pointing to a canonical member or scenario_member_id pointing
 *   to a synthetic — never both, enforced by the PR 5a CHECK constraint).
 * - eventAllocations is the merged set (catalog + scenario sidecar rows)
 * - baseAllocations is the catalog's member_cost_center_allocations, unchanged
 *   (no more source_member_id remapping — canonical members keep their IDs)
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

  if (scenarioId === 'baseline') return baselineBundle();

  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return baselineBundle();

  if (!scenarioData || scenarioData.scenario.id !== scenarioId) return baselineBundle();

  return {
    source: 'scenario',
    scenarioId,
    scenarioName: scenario.name,
    canonicalMembers: catalogMembers,
    syntheticMembers: scenarioData.members,
    canonicalEvents: catalogEvents,
    scenarioEvents: scenarioData.events,
    eventAllocations: [...catalogEventAllocations, ...scenarioData.eventAllocations],
    baseAllocations,
  };

  function baselineBundle(): ResolvedScenarioBundle {
    return {
      source: 'baseline',
      scenarioId: 'baseline',
      scenarioName: null,
      canonicalMembers: catalogMembers,
      syntheticMembers: [],
      canonicalEvents: catalogEvents,
      scenarioEvents: [],
      eventAllocations: catalogEventAllocations,
      baseAllocations,
    };
  }
}
