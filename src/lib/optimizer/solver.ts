import { ServiceVariant, Allocation } from './types';

interface SolverResult {
  solution: Allocation;
  margin: number;
  hitIterationLimit?: boolean;
}

const MAX_ITERATIONS = 100_000;

/**
 * Integer Linear Programming solver using branch-and-bound
 * Maximizes total contribution margin subject to capacity and demand constraints
 */
export function solveILP(
  variants: ServiceVariant[],
  variantsByBase: Record<string, ServiceVariant[]>,
  seniorCap: number,
  middleUpCap: number,
  middleCap: number,
  juniorCap: number,
  stageCap: number
): SolverResult {
  // Sort by margin efficiency for better pruning
  const sortedVariants = [...variants].sort((a, b) => {
    const effA = a.margin / (a.totalDays || 1);
    const effB = b.margin / (b.totalDays || 1);
    return effB - effA;
  });

  let bestSolution: Allocation = {};
  let bestMargin = 0;
  let iterations = 0;
  let hitLimit = false;

  variants.forEach((v) => {
    bestSolution[v.variantId] = 0;
  });

  // Calculate max possible quantity for each variant
  const maxQty = sortedVariants.map((v) => {
    let max = Infinity;
    if (v.seniorDays > 0) max = Math.min(max, Math.floor(seniorCap / v.seniorDays));
    if (v.middleUpDays > 0) max = Math.min(max, Math.floor(middleUpCap / v.middleUpDays));
    if (v.middleDays > 0) max = Math.min(max, Math.floor(middleCap / v.middleDays));
    if (v.juniorDays > 0) max = Math.min(max, Math.floor(juniorCap / v.juniorDays));
    if (v.stageDays > 0) max = Math.min(max, Math.floor(stageCap / v.stageDays));
    if (v.maxYear !== null) max = Math.min(max, v.maxYear);
    return Math.max(0, max);
  });

  // Track allocation by baseId for shared demand caps
  function getBaseAllocation(alloc: Allocation, baseId: string): number {
    return (variantsByBase[baseId] || []).reduce(
      (sum, v) => sum + (alloc[v.variantId] || 0),
      0
    );
  }

  // Recursive search with pruning
  function search(
    idx: number,
    seniorLeft: number,
    middleUpLeft: number,
    middleLeft: number,
    juniorLeft: number,
    stageLeft: number,
    currentAlloc: Allocation,
    currentMargin: number
  ): void {
    // Early exit if iteration limit reached
    if (++iterations > MAX_ITERATIONS) {
      hitLimit = true;
      return;
    }

    // Pruning: calculate upper bound (only count positive margin variants)
    let upperBound = currentMargin;
    for (let i = idx; i < sortedVariants.length; i++) {
      const v = sortedVariants[i];
      if (v.margin <= 0) continue; // Only add positive margins to upper bound
      let canDo = Infinity;
      if (v.seniorDays > 0) canDo = Math.min(canDo, seniorLeft / v.seniorDays);
      if (v.middleUpDays > 0) canDo = Math.min(canDo, middleUpLeft / v.middleUpDays);
      if (v.middleDays > 0) canDo = Math.min(canDo, middleLeft / v.middleDays);
      if (v.juniorDays > 0) canDo = Math.min(canDo, juniorLeft / v.juniorDays);
      if (v.stageDays > 0) canDo = Math.min(canDo, stageLeft / v.stageDays);
      if (v.maxYear !== null) {
        const baseAlloc = getBaseAllocation(currentAlloc, v.baseId);
        canDo = Math.min(canDo, v.maxYear - baseAlloc);
      }
      upperBound += Math.max(0, canDo) * v.margin;
    }

    // Only prune if upperBound is strictly less (not equal)
    if (upperBound < bestMargin) return;

    if (idx >= sortedVariants.length) {
      if (currentMargin > bestMargin) {
        bestMargin = currentMargin;
        bestSolution = { ...currentAlloc };
      }
      return;
    }

    const v = sortedVariants[idx];

    // Check demand cap across all variants of same base service
    const baseAlloc = getBaseAllocation(currentAlloc, v.baseId);
    const demandRoom = v.maxYear !== null ? v.maxYear - baseAlloc : Infinity;

    const max = Math.min(
      maxQty[idx],
      demandRoom,
      v.seniorDays > 0 ? Math.floor(seniorLeft / v.seniorDays) : Infinity,
      v.middleUpDays > 0 ? Math.floor(middleUpLeft / v.middleUpDays) : Infinity,
      v.middleDays > 0 ? Math.floor(middleLeft / v.middleDays) : Infinity,
      v.juniorDays > 0 ? Math.floor(juniorLeft / v.juniorDays) : Infinity,
      v.stageDays > 0 ? Math.floor(stageLeft / v.stageDays) : Infinity
    );

    // Only try positive quantities if margin > 0, otherwise just try 0
    const startQty = v.margin > 0 ? max : 0;

    for (let qty = startQty; qty >= 0 && !hitLimit; qty--) {
      currentAlloc[v.variantId] = qty;
      search(
        idx + 1,
        seniorLeft - qty * v.seniorDays,
        middleUpLeft - qty * v.middleUpDays,
        middleLeft - qty * v.middleDays,
        juniorLeft - qty * v.juniorDays,
        stageLeft - qty * v.stageDays,
        currentAlloc,
        currentMargin + qty * v.margin
      );
    }
  }

  const initAlloc: Allocation = {};
  variants.forEach((v) => {
    initAlloc[v.variantId] = 0;
  });

  search(0, seniorCap, middleUpCap, middleCap, juniorCap, stageCap, initAlloc, 0);

  return { solution: bestSolution, margin: bestMargin, hitIterationLimit: hitLimit };
}
