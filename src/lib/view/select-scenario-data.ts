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
 * Note: when returning a scenario bundle, catalog `baseAllocations` are remapped
 * so their `member_id` points to scenario-member IDs via `source_member_id`.
 * Without this remapping the resolver's filter would return nothing for every
 * scenario member. PR 5's delta overlay refactor will eliminate this step.
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

  // Before returning the scenario bundle, translate catalog baseAllocations
  // so their member_id points to scenario-member IDs. Today's scenarios are
  // full-copies of canonical members, carrying a source_member_id back-reference.
  // Without this, the resolver filters `baseAllocations.filter(a => a.member_id === m.id)`
  // would return nothing for every scenario member.
  // PR 5's delta overlay refactor will eliminate this remapping.
  const sourceToScenarioId = new Map<string, string>();
  for (const sm of scenarioData.members) {
    if (sm.source_member_id) {
      sourceToScenarioId.set(sm.source_member_id, sm.id);
    }
  }
  const remappedBaseAllocations: MemberCostCenterAllocation[] = baseAllocations
    .map((a) => {
      const scenarioMemberId = sourceToScenarioId.get(a.member_id);
      if (!scenarioMemberId) return null;
      return { ...a, member_id: scenarioMemberId };
    })
    .filter((a): a is MemberCostCenterAllocation => a !== null);

  return {
    source: 'scenario',
    scenarioId,
    scenarioName: scenario.name,
    members: scenarioData.members,
    events: scenarioData.events,
    eventAllocations: scenarioData.eventAllocations,
    baseAllocations: remappedBaseAllocations,
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
