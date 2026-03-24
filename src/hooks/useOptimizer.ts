'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Member, Service, Settings, OptimizationResult, ScenarioServiceData, ScenarioMemberData, MemberCategory, computeEffectiveDays } from '@/lib/optimizer/types';

// Service type that can have optional max_year (for optimizer compatibility)
type OptimizableService = (Service | ScenarioServiceData) & { max_year?: number | null };
// Member type that can have optional capacity/cost percentages (for optimizer compatibility)
type OptimizableMember = (Member | ScenarioMemberData) & { category: MemberCategory; capacity_percentage?: number; cost_percentage?: number; chargeable_days?: number | null; ft_percentage?: number | null };
import { generateVariants } from '@/lib/optimizer/variants';
import { solveILP } from '@/lib/optimizer/solver';
import { useDebouncedValue } from './useDebouncedValue';

const DEBOUNCE_MS = 500;

interface OptimizerResult {
  result: OptimizationResult | null;
  isCalculating: boolean;
}

export function useOptimizer(
  members: OptimizableMember[],
  services: OptimizableService[],
  settings: Settings | null
): OptimizerResult {
  // Debounce inputs to avoid running solver on every keystroke
  const debouncedMembers = useDebouncedValue(members, DEBOUNCE_MS);
  const debouncedServices = useDebouncedValue(services, DEBOUNCE_MS);
  const debouncedSettings = useDebouncedValue(settings, DEBOUNCE_MS);

  // Track if inputs have changed but debounce hasn't fired yet
  const [isCalculating, setIsCalculating] = useState(false);
  const prevInputsRef = useRef({ members, services, settings });

  // Set calculating to true when inputs change
  useEffect(() => {
    const inputsChanged =
      members !== prevInputsRef.current.members ||
      services !== prevInputsRef.current.services ||
      settings !== prevInputsRef.current.settings;

    if (inputsChanged) {
      setIsCalculating(true);
      prevInputsRef.current = { members, services, settings };
    }
  }, [members, services, settings]);

  // Clear calculating when debounced values update
  useEffect(() => {
    setIsCalculating(false);
  }, [debouncedMembers, debouncedServices, debouncedSettings]);

  const result = useMemo(() => {
    if (!debouncedSettings || debouncedMembers.length === 0 || debouncedServices.length === 0) {
      return null;
    }

    const rates = {
      senior: debouncedSettings.senior_rate,
      middle_up: debouncedSettings.middle_up_rate,
      middle: debouncedSettings.middle_rate,
      junior: debouncedSettings.junior_rate,
      stage: debouncedSettings.stage_rate,
    };

    // Calculate yearly capacity per seniority level using component-based formula
    const effectiveDaysPerMember = computeEffectiveDays(
      debouncedSettings.yearly_workable_days,
      debouncedSettings.festivita_nazionali,
      debouncedSettings.ferie,
      debouncedSettings.malattia,
      debouncedSettings.formazione
    );
    // Capacity depends on category:
    // - dipendente: effective days (with deductions) * capacity%
    // - freelance: yearly_workable_days (no deductions) * capacity%
    // - segnalatore: 0 (no capacity)
    const calcCapacity = (m: OptimizableMember) => {
      if (m.category === 'segnalatore') return 0;
      // Freelance with manual chargeable_days: use directly (still scaled by capacity%)
      if (m.category === 'freelance' && m.chargeable_days != null) {
        return m.chargeable_days * ((m.capacity_percentage ?? 100) / 100);
      }
      const baseDays = m.category === 'freelance'
        ? debouncedSettings.yearly_workable_days
        : effectiveDaysPerMember * ((m.ft_percentage ?? 100) / 100);
      return baseDays * ((m.capacity_percentage ?? 100) / 100);
    };

    // Filter out segnalatori for capacity (they have null seniority)
    const capacityMembers = debouncedMembers.filter((m) => m.category !== 'segnalatore');

    const capacity = {
      senior: capacityMembers
        .filter((m) => m.seniority === 'senior')
        .reduce((sum, m) => sum + calcCapacity(m), 0),
      middle_up: capacityMembers
        .filter((m) => m.seniority === 'middle_up')
        .reduce((sum, m) => sum + calcCapacity(m), 0),
      middle: capacityMembers
        .filter((m) => m.seniority === 'middle')
        .reduce((sum, m) => sum + calcCapacity(m), 0),
      junior: capacityMembers
        .filter((m) => m.seniority === 'junior')
        .reduce((sum, m) => sum + calcCapacity(m), 0),
      stage: capacityMembers
        .filter((m) => m.seniority === 'stage')
        .reduce((sum, m) => sum + calcCapacity(m), 0),
    };

    // Generate all variants with substitution options
    const allVariants = debouncedServices.flatMap((s) => generateVariants(s, rates));

    // Group variants by base service ID
    const variantsByBase: Record<string, typeof allVariants> = {};
    allVariants.forEach((v) => {
      if (!variantsByBase[v.baseId]) variantsByBase[v.baseId] = [];
      variantsByBase[v.baseId].push(v);
    });

    // Solve ILP
    const { solution, margin: totalMargin } = solveILP(
      allVariants,
      variantsByBase,
      capacity.senior,
      capacity.middle_up,
      capacity.middle,
      capacity.junior,
      capacity.stage
    );

    // Calculate results
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProjects = 0;
    let usedSeniorDays = 0;
    let usedMiddleUpDays = 0;
    let usedMiddleDays = 0;
    let usedJuniorDays = 0;
    let usedStageDays = 0;

    const demandCapped: Record<string, boolean> = {};
    debouncedServices.forEach((s) => {
      const totalForService = variantsByBase[s.id]?.reduce(
        (sum, v) => sum + (solution[v.variantId] || 0),
        0
      ) || 0;
      const maxYear = s.max_year ?? null;
      demandCapped[s.id] = maxYear !== null && totalForService >= maxYear;
    });

    const projectBreakdown: OptimizationResult['projectBreakdown'] = [];

    allVariants.forEach((v) => {
      const count = solution[v.variantId] || 0;
      if (count > 0) {
        const revenue = count * v.price;
        const margin = count * v.margin;
        const cost = count * v.cost;
        totalRevenue += revenue;
        totalCost += cost;
        totalProjects += count;
        usedSeniorDays += count * v.seniorDays;
        usedMiddleUpDays += count * v.middleUpDays;
        usedMiddleDays += count * v.middleDays;
        usedJuniorDays += count * v.juniorDays;
        usedStageDays += count * v.stageDays;

        projectBreakdown.push({
          name: v.variantName,
          count,
          revenue,
          margin,
          unitMargin: v.margin,
          isSubstitution: v.isSubstitution,
          isDemandCapped: demandCapped[v.baseId],
        });
      }
    });

    // Calculate financial metrics (cost_percentage scales salary cost)
    const fixedCosts = debouncedMembers.reduce((sum, m) => {
      const costPct = m.cost_percentage ?? 100;
      return sum + m.salary * (costPct / 100);
    }, 0);
    const contributionPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
    const trueProfit = totalMargin - fixedCosts;
    const profitMarginPct = totalRevenue > 0 ? (trueProfit / totalRevenue) * 100 : 0;
    const breakEvenRevenue =
      fixedCosts > 0 && contributionPct > 0 ? fixedCosts / (contributionPct / 100) : 0;

    // Utilization
    const utilization = {
      senior: capacity.senior > 0 ? (usedSeniorDays / capacity.senior) * 100 : 0,
      middle_up: capacity.middle_up > 0 ? (usedMiddleUpDays / capacity.middle_up) * 100 : 0,
      middle: capacity.middle > 0 ? (usedMiddleDays / capacity.middle) * 100 : 0,
      junior: capacity.junior > 0 ? (usedJuniorDays / capacity.junior) * 100 : 0,
      stage: capacity.stage > 0 ? (usedStageDays / capacity.stage) * 100 : 0,
    };

    // Determine bottleneck
    const demandCappedCount = projectBreakdown.filter((p) => p.isDemandCapped).length;
    const capacityLimitedCount = projectBreakdown.filter((p) => !p.isDemandCapped).length;
    const allDemandCapped = projectBreakdown.length > 0 && capacityLimitedCount === 0;

    let bottleneck: string;
    let bottleneckNote: string;

    if (allDemandCapped) {
      bottleneck = 'Sales';
      bottleneckNote = 'All services at demand cap';
    } else if (projectBreakdown.length === 0) {
      bottleneck = 'None';
      bottleneckNote = 'No projects allocated';
    } else {
      const slacks = [
        { name: 'Senior', slack: capacity.senior - usedSeniorDays, cap: capacity.senior },
        { name: 'Middle Up', slack: capacity.middle_up - usedMiddleUpDays, cap: capacity.middle_up },
        { name: 'Middle', slack: capacity.middle - usedMiddleDays, cap: capacity.middle },
        { name: 'Junior', slack: capacity.junior - usedJuniorDays, cap: capacity.junior },
        { name: 'Stage', slack: capacity.stage - usedStageDays, cap: capacity.stage },
      ].filter((s) => s.cap > 0);

      bottleneck = slacks.length > 0
        ? slacks.reduce((min, s) => (s.slack < min.slack ? s : min)).name
        : 'None';
      bottleneckNote = `${demandCappedCount} demand-capped, ${capacityLimitedCount} capacity-limited`;
    }

    return {
      allocation: solution,
      totalRevenue,
      totalMargin,
      totalCost,
      totalProjects,
      fixedCosts,
      trueProfit,
      contributionPct,
      profitMarginPct,
      breakEvenRevenue,
      usedDays: {
        senior: usedSeniorDays,
        middle_up: usedMiddleUpDays,
        middle: usedMiddleDays,
        junior: usedJuniorDays,
        stage: usedStageDays,
      },
      capacity,
      utilization,
      bottleneck,
      bottleneckNote,
      projectBreakdown,
      variants: allVariants,
    } as OptimizationResult;
  }, [debouncedMembers, debouncedServices, debouncedSettings]);

  return { result, isCalculating };
}
