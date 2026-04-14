'use client';

import { useEffect, useState } from 'react';
import { useViewContext } from '@/contexts/ViewContext';
import { useMembers, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios, type HRScenarioWithData } from '@/hooks/useHRScenarios';
import { selectScenarioData, type ResolvedScenarioBundle } from '@/lib/view/select-scenario-data';

export interface UseResolvedScenarioResult {
  bundle: ResolvedScenarioBundle;
  loading: boolean;
}

/**
 * Composes the scenario-aware data bundle for an analysis page.
 *
 * Reads `scenarioId` from ViewContext (or the optional `scenarioIdOverride`
 * for per-page local overrides, per spec decision C).
 *
 * Returns a bundle usable by the resolver; falls back to baseline while
 * scenario data is loading to avoid empty-state flash.
 */
export function useResolvedScenario(scenarioIdOverride?: string): UseResolvedScenarioResult {
  const { scenarioId: contextScenarioId } = useViewContext();
  const activeScenarioId = scenarioIdOverride ?? contextScenarioId;

  const { members: catalogMembers, loading: membersLoading } = useMembers();
  const { events: catalogEvents, eventAllocations: catalogEventAllocations, loading: eventsLoading } = useMemberEvents();
  const { allocations: baseAllocations, loading: ccLoading } = useCostCenters();
  const { hrScenarios, fetchHRScenarioWithData, loading: scenariosLoading } = useHRScenarios();

  const [scenarioData, setScenarioData] = useState<HRScenarioWithData | null>(null);
  const [scenarioFetching, setScenarioFetching] = useState(false);

  // Fetch scenario data when a non-baseline scenario is selected.
  useEffect(() => {
    if (activeScenarioId === 'baseline') {
      setScenarioData(null);
      return;
    }
    let cancelled = false;
    setScenarioFetching(true);
    fetchHRScenarioWithData(activeScenarioId).then((data) => {
      if (cancelled) return;
      setScenarioData(data);
      setScenarioFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeScenarioId, fetchHRScenarioWithData]);

  const bundle = selectScenarioData({
    scenarioId: activeScenarioId,
    catalogMembers,
    catalogEvents,
    catalogEventAllocations,
    baseAllocations,
    scenarioData,
    scenarios: hrScenarios,
  });

  const loading =
    membersLoading ||
    eventsLoading ||
    ccLoading ||
    scenariosLoading ||
    (activeScenarioId !== 'baseline' && scenarioFetching);

  return { bundle, loading };
}
