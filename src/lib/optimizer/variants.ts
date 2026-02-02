import { Service, ServiceVariant, ScenarioServiceData } from './types';

// Service type for optimization - can be catalog service or scenario service
type OptimizableService = (Service | ScenarioServiceData) & { max_year?: number | null };

const LEVEL_NAMES = ['Senior', 'Middle', 'Junior'];
const RATE_KEYS = ['senior', 'middle', 'junior'] as const;

interface Rates {
  senior: number;
  middle: number;
  junior: number;
}

/**
 * Get efficiency gain when substituting (by levels difference)
 * 1 level down: 5%, 2 levels: 10%
 */
function getEfficiency(levelsDiff: number): number {
  if (levelsDiff <= 0) return 0;
  if (levelsDiff === 1) return 0.05;
  return 0.1; // 2 levels
}

/**
 * Generate all staffing variants for a service, including substitution options
 * where higher seniority levels absorb lower-level work
 */
export function generateVariants(service: OptimizableService, rates: Rates): ServiceVariant[] {
  const variants: ServiceVariant[] = [];
  const {
    id,
    name,
    senior_days: seniorDays,
    middle_days: middleDays,
    junior_days: juniorDays,
    price,
    max_year: maxYear = null,
  } = service;

  const days = [seniorDays || 0, middleDays || 0, juniorDays || 0];
  const rateValues = [rates.senior, rates.middle, rates.junior];

  // Original variant (no substitution)
  const origCost = days.reduce((sum, d, i) => sum + d * rateValues[i], 0);
  const origTotalDays = days.reduce((sum, d) => sum + d, 0);

  variants.push({
    id,
    variantId: `${id}_original`,
    variantName: name,
    baseId: id,
    name,
    seniorDays: days[0],
    middleDays: days[1],
    juniorDays: days[2],
    price,
    maxYear,
    cost: origCost,
    margin: price - origCost,
    totalDays: origTotalDays,
    marginEfficiency: origTotalDays > 0 ? (price - origCost) / origTotalDays : 0,
    isSubstitution: false,
  });

  // Generate "all-in" variants: each level does ALL work at and below its level
  // E.g., "Senior does all" = Senior does Sr + Mid + Jr work
  for (let doerLevel = 0; doerLevel < 2; doerLevel++) {
    // Senior, Middle can substitute
    const newDays = [0, 0, 0];
    let hasSubstitution = false;
    const substitutedLevels: string[] = [];

    // For each level, either keep it or substitute it
    for (let workLevel = 0; workLevel <= 2; workLevel++) {
      if (days[workLevel] <= 0) continue;

      if (workLevel <= doerLevel) {
        // Work is at or above doer level - keep as is
        newDays[workLevel] += days[workLevel];
      } else {
        // Work is below doer level - substitute with efficiency
        const levelsDiff = workLevel - doerLevel;
        const efficiency = getEfficiency(levelsDiff);
        const adjustedDays = days[workLevel] * (1 - efficiency);
        newDays[doerLevel] += adjustedDays;
        hasSubstitution = true;
        substitutedLevels.push(LEVEL_NAMES[workLevel]);
      }
    }

    if (!hasSubstitution) continue; // No substitution happened

    const cost = newDays.reduce((sum, d, i) => sum + d * rateValues[i], 0);
    const margin = price - cost;
    const totalDays = newDays.reduce((sum, d) => sum + d, 0);

    const variantLabel =
      substitutedLevels.length > 1
        ? `${LEVEL_NAMES[doerLevel]}→All`
        : `${LEVEL_NAMES[doerLevel]}→${substitutedLevels[0]}`;

    variants.push({
      id: `${id}_allin${doerLevel}`,
      variantId: `${id}_allin${doerLevel}`,
      variantName: `${name} [${variantLabel}]`,
      baseId: id,
      name,
      seniorDays: newDays[0],
      middleDays: newDays[1],
      juniorDays: newDays[2],
      price,
      maxYear,
      cost,
      margin,
      totalDays,
      marginEfficiency: totalDays > 0 ? margin / totalDays : 0,
      isSubstitution: true,
      substitutionInfo: `${LEVEL_NAMES[doerLevel]} does ${substitutedLevels.join(' + ')} work`,
    });
  }

  return variants;
}
