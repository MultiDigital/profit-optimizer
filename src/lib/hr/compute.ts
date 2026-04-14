import {
  Member,
  MemberEvent,
  ScenarioMemberEvent,
  Settings,
  SeniorityLevel,
  MonthlySnapshot,
  MemberMonthDetail,
  YearlyView,
  MemberEventField,
  HRScenarioMember,
  EventCostCenterAllocation,
} from '@/lib/optimizer/types';
import {
  resolveFieldForMonth,
  isMemberActiveInMonth,
  monthProRataFraction,
  parseEventValue,
  resolveCostCenterAllocationsForMonth,
} from './resolve-events';

type AnyMember = (Member | HRScenarioMember) & {
  contract_start_date?: string | null;
  contract_end_date?: string | null;
};

type AnyEvent = MemberEvent | ScenarioMemberEvent;

interface CostCenterAllocation {
  member_id: string;
  cost_center_id: string;
  percentage: number;
}

const SENIORITY_LEVELS: SeniorityLevel[] = ['senior', 'middle_up', 'middle', 'junior', 'stage'];

const DEFAULT_SETTINGS = {
  yearly_workable_days: 261,
  festivita_nazionali: 8,
  ferie: 25,
  malattia: 5,
  formazione: 3,
};

function getEffectiveDays(settings: Settings | null): number {
  const s = settings || DEFAULT_SETTINGS;
  return (s.yearly_workable_days ?? 261)
    - (s.festivita_nazionali ?? 8)
    - (s.ferie ?? 25)
    - (s.malattia ?? 5)
    - (s.formazione ?? 3);
}

function getMemberId(member: AnyMember): string {
  return member.id;
}

function getEventsForMember(events: AnyEvent[], member: AnyMember): AnyEvent[] {
  const memberId = getMemberId(member);
  return events.filter((e) => {
    if ('member_id' in e) return e.member_id === memberId;
    if ('scenario_member_id' in e) return e.scenario_member_id === memberId;
    return false;
  });
}

interface EffectiveMemberValues {
  salary: number;
  ft_percentage: number;
  seniority: SeniorityLevel | null;
  category: 'dipendente' | 'segnalatore' | 'freelance';
  capacity_percentage: number;
  chargeable_days: number | null;
}

function resolveEffectiveValues(member: AnyMember, memberEvents: AnyEvent[], month: string): EffectiveMemberValues {
  const fields: MemberEventField[] = ['salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days'];
  const base: EffectiveMemberValues = {
    salary: member.salary,
    ft_percentage: member.ft_percentage ?? 100,
    seniority: member.seniority as SeniorityLevel | null,
    category: member.category as 'dipendente' | 'segnalatore' | 'freelance',
    capacity_percentage: ('capacity_percentage' in member ? (member as HRScenarioMember).capacity_percentage : 100) ?? 100,
    chargeable_days: member.chargeable_days ?? null,
  };

  for (const field of fields) {
    const resolved = resolveFieldForMonth(memberEvents, field, month);
    if (resolved !== undefined) {
      const parsed = parseEventValue(field, resolved);
      switch (field) {
        case 'salary':
          base.salary = parsed as number;
          break;
        case 'ft_percentage':
          base.ft_percentage = parsed as number;
          break;
        case 'seniority':
          base.seniority = parsed as SeniorityLevel;
          break;
        case 'category':
          base.category = parsed as 'dipendente' | 'segnalatore' | 'freelance';
          break;
        case 'capacity_percentage':
          base.capacity_percentage = parsed as number;
          break;
        case 'chargeable_days':
          base.chargeable_days = parsed as number;
          break;
      }
    }
  }

  return base;
}

function computeMemberMonth(
  member: AnyMember,
  memberEvents: AnyEvent[],
  settings: Settings | null,
  month: string
): MemberMonthDetail {
  const memberId = getMemberId(member);
  const contractStart = member.contract_start_date ?? null;
  const contractEnd = member.contract_end_date ?? null;

  // Check if active
  const isActive = isMemberActiveInMonth(contractStart, contractEnd, month);
  if (!isActive) {
    return {
      memberId,
      firstName: member.first_name,
      lastName: member.last_name,
      effectiveSeniority: member.seniority as SeniorityLevel | null,
      effectiveSalary: member.salary,
      effectiveFtPercentage: member.ft_percentage ?? 100,
      effectiveCategory: member.category as 'dipendente' | 'segnalatore' | 'freelance',
      monthlyCost: 0,
      monthlyCapacity: 0,
      fte: 0,
      isActive: false,
      activeEvents: [],
    };
  }

  const effective = resolveEffectiveValues(member, memberEvents, month);
  const proRata = monthProRataFraction(contractStart, contractEnd, month);
  const effectiveDays = getEffectiveDays(settings);

  // Monthly cost
  const costPct = ('cost_percentage' in member ? (member as HRScenarioMember).cost_percentage : 100) ?? 100;
  const monthlyCost = (effective.salary / 12) * (costPct / 100) * proRata;

  // Monthly capacity (days)
  let annualCapacity = 0;
  if (effective.category === 'segnalatore') {
    annualCapacity = 0;
  } else if (effective.category === 'freelance') {
    if (effective.chargeable_days !== null) {
      annualCapacity = effective.chargeable_days * (effective.capacity_percentage / 100);
    } else {
      annualCapacity = (settings?.yearly_workable_days ?? 261) * (effective.capacity_percentage / 100);
    }
  } else {
    // dipendente
    annualCapacity = effectiveDays * (effective.ft_percentage / 100) * (effective.capacity_percentage / 100);
  }
  const monthlyCapacity = (annualCapacity / 12) * proRata;

  // FTE
  let fte = 0;
  if (effective.category === 'freelance') {
    fte = (effective.chargeable_days !== null)
      ? (effective.chargeable_days / (settings?.yearly_workable_days ?? 261))
      : 1;
  } else if (effective.category === 'dipendente') {
    fte = effective.ft_percentage / 100;
  }
  fte *= proRata;

  // Active events for this month
  const activeEvents = memberEvents.filter((e) => {
    const monthStart = `${month}-01`;
    const year = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]);
    const lastDay = new Date(year, m, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
    if (e.start_date > monthEnd) return false;
    if (e.end_date !== null && e.end_date < monthStart) return false;
    return true;
  });

  return {
    memberId,
    firstName: member.first_name,
    lastName: member.last_name,
    effectiveSeniority: effective.seniority,
    effectiveSalary: effective.salary,
    effectiveFtPercentage: effective.ft_percentage,
    effectiveCategory: effective.category,
    monthlyCost,
    monthlyCapacity,
    fte,
    isActive: true,
    activeEvents: activeEvents as MemberEvent[] | ScenarioMemberEvent[],
  };
}

export function computeMonthlySnapshot(
  members: AnyMember[],
  events: AnyEvent[],
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  eventAllocations: EventCostCenterAllocation[],
  month: string
): MonthlySnapshot {
  const memberDetails: MemberMonthDetail[] = [];
  const personnelCostBySeniority: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };
  const capacityBySeniority: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };
  const personnelCostByCostCenter: Record<string, number> = {};
  const hourlyCostNumerator: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };
  const hourlyCostDenominator: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };

  let totalCompanyCost = 0;
  let totalCapacity = 0;
  let totalFte = 0;
  let headcount = 0;

  const capacityByCostCenter: Record<string, number> = {};
  const fteByCostCenter: Record<string, number> = {};
  const headcountByCostCenter: Record<string, number> = {};

  for (const member of members) {
    const memberEvents = getEventsForMember(events, member);
    const detail = computeMemberMonth(member, memberEvents, settings, month);
    memberDetails.push(detail);

    if (!detail.isActive) continue;

    totalCompanyCost += detail.monthlyCost;
    totalCapacity += detail.monthlyCapacity;
    totalFte += detail.fte;
    if (detail.fte > 0 || detail.effectiveCategory === 'segnalatore') {
      headcount++;
    }

    // By seniority
    const sen = detail.effectiveSeniority;
    if (sen) {
      personnelCostBySeniority[sen] += detail.monthlyCost;
      capacityBySeniority[sen] += detail.monthlyCapacity;
      const hours = detail.monthlyCapacity * 8;
      if (hours > 0) {
        hourlyCostNumerator[sen] += detail.monthlyCost;
        hourlyCostDenominator[sen] += hours;
      }
    }

    // By cost center — resolve event-based allocations first, fallback to static
    const memberId = detail.memberId;
    const memberEventAllocations = resolveCostCenterAllocationsForMonth(
      memberEvents,
      eventAllocations,
      month
    );
    const resolvedAllocations: { cost_center_id: string; percentage: number }[] =
      memberEventAllocations ??
      allocations
        .filter((a) => a.member_id === memberId)
        .map((a) => ({ cost_center_id: a.cost_center_id, percentage: a.percentage }));

    if (resolvedAllocations.length > 0) {
      for (const alloc of resolvedAllocations) {
        const pct = alloc.percentage / 100;
        personnelCostByCostCenter[alloc.cost_center_id] = (personnelCostByCostCenter[alloc.cost_center_id] || 0) + detail.monthlyCost * pct;
        capacityByCostCenter[alloc.cost_center_id] = (capacityByCostCenter[alloc.cost_center_id] || 0) + detail.monthlyCapacity * pct;
        fteByCostCenter[alloc.cost_center_id] = (fteByCostCenter[alloc.cost_center_id] || 0) + detail.fte * pct;
        headcountByCostCenter[alloc.cost_center_id] = (headcountByCostCenter[alloc.cost_center_id] || 0) + (detail.fte > 0 || detail.effectiveCategory === 'segnalatore' ? 1 : 0) * pct;
      }
    }
  }

  // Hourly cost by seniority
  const avgHourlyCostBySeniority: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };
  for (const sen of SENIORITY_LEVELS) {
    avgHourlyCostBySeniority[sen] = hourlyCostDenominator[sen] > 0
      ? hourlyCostNumerator[sen] / hourlyCostDenominator[sen]
      : 0;
  }

  // Cost center breakdown as percentages
  const costCenterBreakdown: Record<string, number> = {};
  for (const [ccId, cost] of Object.entries(personnelCostByCostCenter)) {
    costCenterBreakdown[ccId] = totalCompanyCost > 0 ? (cost / totalCompanyCost) * 100 : 0;
  }

  return {
    month,
    totalCompanyCost,
    personnelCostBySeniority,
    personnelCostByCostCenter,
    productiveCapacity: totalCapacity,
    capacityBySeniority,
    fte: totalFte,
    headcount,
    avgHourlyCostBySeniority,
    costCenterBreakdown,
    capacityByCostCenter,
    fteByCostCenter,
    headcountByCostCenter,
    memberDetails,
  };
}

export function computeYearlyView(
  members: AnyMember[],
  events: AnyEvent[],
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  eventAllocations: EventCostCenterAllocation[],
  year: number
): YearlyView {
  const monthlySnapshots: MonthlySnapshot[] = [];

  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    monthlySnapshots.push(computeMonthlySnapshot(members, events, settings, allocations, eventAllocations, month));
  }

  // Aggregate annual totals
  const annualTotals = {
    totalCompanyCost: 0,
    personnelCostBySeniority: { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 } as Record<SeniorityLevel, number>,
    personnelCostByCostCenter: {} as Record<string, number>,
    productiveCapacity: 0,
    capacityBySeniority: { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 } as Record<SeniorityLevel, number>,
    fte: 0,
    headcount: 0,
    avgHourlyCostBySeniority: { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 } as Record<SeniorityLevel, number>,
    costCenterBreakdown: {} as Record<string, number>,
    capacityByCostCenter: {} as Record<string, number>,
    fteByCostCenter: {} as Record<string, number>,
    headcountByCostCenter: {} as Record<string, number>,
  };

  const hourlyCostNumerator: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };
  const hourlyCostDenominator: Record<SeniorityLevel, number> = { senior: 0, middle_up: 0, middle: 0, junior: 0, stage: 0 };

  for (const snapshot of monthlySnapshots) {
    annualTotals.totalCompanyCost += snapshot.totalCompanyCost;
    annualTotals.productiveCapacity += snapshot.productiveCapacity;

    for (const sen of SENIORITY_LEVELS) {
      annualTotals.personnelCostBySeniority[sen] += snapshot.personnelCostBySeniority[sen];
      annualTotals.capacityBySeniority[sen] += snapshot.capacityBySeniority[sen];
      const hours = snapshot.capacityBySeniority[sen] * 8;
      if (hours > 0) {
        hourlyCostNumerator[sen] += snapshot.personnelCostBySeniority[sen];
        hourlyCostDenominator[sen] += hours;
      }
    }

    for (const [ccId, cost] of Object.entries(snapshot.personnelCostByCostCenter)) {
      annualTotals.personnelCostByCostCenter[ccId] = (annualTotals.personnelCostByCostCenter[ccId] || 0) + cost;
    }

    for (const [ccId, cap] of Object.entries(snapshot.capacityByCostCenter)) {
      annualTotals.capacityByCostCenter[ccId] = (annualTotals.capacityByCostCenter[ccId] || 0) + cap;
    }
    for (const [ccId, fte] of Object.entries(snapshot.fteByCostCenter)) {
      annualTotals.fteByCostCenter[ccId] = (annualTotals.fteByCostCenter[ccId] || 0) + fte;
    }
    for (const [ccId, hc] of Object.entries(snapshot.headcountByCostCenter)) {
      annualTotals.headcountByCostCenter[ccId] = (annualTotals.headcountByCostCenter[ccId] || 0) + hc;
    }
  }

  // Average FTE and headcount (average across months)
  annualTotals.fte = monthlySnapshots.reduce((sum, s) => sum + s.fte, 0) / 12;
  annualTotals.headcount = Math.round(monthlySnapshots.reduce((sum, s) => sum + s.headcount, 0) / 12);

  // Average FTE and headcount by cost center
  for (const ccId of Object.keys(annualTotals.fteByCostCenter)) {
    annualTotals.fteByCostCenter[ccId] /= 12;
  }
  for (const ccId of Object.keys(annualTotals.headcountByCostCenter)) {
    annualTotals.headcountByCostCenter[ccId] = Math.round(annualTotals.headcountByCostCenter[ccId] / 12);
  }

  // Annual average hourly cost
  for (const sen of SENIORITY_LEVELS) {
    annualTotals.avgHourlyCostBySeniority[sen] = hourlyCostDenominator[sen] > 0
      ? hourlyCostNumerator[sen] / hourlyCostDenominator[sen]
      : 0;
  }

  // Annual cost center breakdown
  for (const [ccId, cost] of Object.entries(annualTotals.personnelCostByCostCenter)) {
    annualTotals.costCenterBreakdown[ccId] = annualTotals.totalCompanyCost > 0
      ? (cost / annualTotals.totalCompanyCost) * 100
      : 0;
  }

  return { year, annualTotals, monthlySnapshots };
}
