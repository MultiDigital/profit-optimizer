'use client';

import { useCallback, useEffect, useState } from 'react';
import { useViewContext } from '@/contexts/ViewContext';
import { useMembers, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios, type HRScenarioWithData } from '@/hooks/useHRScenarios';
import { selectScenarioData, type ResolvedScenarioBundle } from '@/lib/view/select-scenario-data';

export interface UseResolvedScenarioResult {
  bundle: ResolvedScenarioBundle;
  loading: boolean;
  /**
   * Re-fetch the scenario data for the current scenarioId. Call this after
   * mutations that change scenario state so the bundle reflects fresh data.
   * No-op when the active scenario is 'baseline' (catalog state is managed
   * by the individual hooks that back it).
   */
  refetch: () => Promise<void>;
}

export function useResolvedScenario(scenarioIdOverride?: string): UseResolvedScenarioResult {
  const { scenarioId: contextScenarioId } = useViewContext();
  const activeScenarioId = scenarioIdOverride ?? contextScenarioId;

  const { members: catalogMembers, loading: membersLoading } = useMembers();
  const { events: catalogEvents, eventAllocations: catalogEventAllocations, loading: eventsLoading } = useMemberEvents();
  const { allocations: baseAllocations, loading: ccLoading } = useCostCenters();
  const { hrScenarios, fetchHRScenarioWithData, loading: scenariosLoading } = useHRScenarios();

  const [scenarioData, setScenarioData] = useState<HRScenarioWithData | null>(null);
  const [scenarioFetching, setScenarioFetching] = useState(false);

  const loadScenario = useCallback(async (id: string) => {
    setScenarioFetching(true);
    try {
      const data = await fetchHRScenarioWithData(id);
      setScenarioData(data);
    } finally {
      setScenarioFetching(false);
    }
  }, [fetchHRScenarioWithData]);

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

  const refetch = useCallback(async () => {
    if (activeScenarioId === 'baseline') return;
    await loadScenario(activeScenarioId);
  }, [activeScenarioId, loadScenario]);

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

  return { bundle, loading, refetch };
}
