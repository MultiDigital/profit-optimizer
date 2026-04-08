'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Member,
  MemberEvent,
  Settings,
  YearlyView,
  HRScenarioMember,
  ScenarioMemberEvent,
  EventCostCenterAllocation,
} from '@/lib/optimizer/types';
import { computeYearlyView } from '@/lib/hr/compute';

interface CostCenterAllocation {
  member_id: string;
  cost_center_id: string;
  percentage: number;
}

type HRPlanningMembers = Member[] | HRScenarioMember[];
type HRPlanningEvents = MemberEvent[] | ScenarioMemberEvent[];

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useHRPlanning(
  members: HRPlanningMembers,
  events: HRPlanningEvents,
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  eventAllocations: EventCostCenterAllocation[],
  year: number
) {
  const debouncedMembers = useDebouncedValue(members, 500);
  const debouncedEvents = useDebouncedValue(events, 500);
  const debouncedSettings = useDebouncedValue(settings, 500);
  const debouncedAllocations = useDebouncedValue(allocations, 500);
  const debouncedEventAllocations = useDebouncedValue(eventAllocations, 500);
  const debouncedYear = useDebouncedValue(year, 500);

  const [isCalculating, setIsCalculating] = useState(false);
  const prevInputsRef = useRef({ members, events, settings, allocations, eventAllocations, year });

  // Detect input changes to show calculating state
  useEffect(() => {
    const prev = prevInputsRef.current;
    if (
      prev.members !== members ||
      prev.events !== events ||
      prev.settings !== settings ||
      prev.allocations !== allocations ||
      prev.eventAllocations !== eventAllocations ||
      prev.year !== year
    ) {
      setIsCalculating(true);
      prevInputsRef.current = { members, events, settings, allocations, eventAllocations, year };
    }
  }, [members, events, settings, allocations, eventAllocations, year]);

  const yearlyView: YearlyView | null = useMemo(() => {
    if (debouncedMembers.length === 0) {
      setIsCalculating(false);
      return null;
    }

    const result = computeYearlyView(
      debouncedMembers,
      debouncedEvents,
      debouncedSettings,
      debouncedAllocations,
      debouncedEventAllocations,
      debouncedYear
    );

    setIsCalculating(false);
    return result;
  }, [debouncedMembers, debouncedEvents, debouncedSettings, debouncedAllocations, debouncedEventAllocations, debouncedYear]);

  return {
    yearlyView,
    monthlySnapshots: yearlyView?.monthlySnapshots ?? [],
    isCalculating,
  };
}
