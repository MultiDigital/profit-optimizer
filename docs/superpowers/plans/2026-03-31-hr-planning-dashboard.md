# HR Planning Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an HR Planning dashboard with time-based event planning, real-time KPI reactivity, and scenario comparison for workforce cost and capacity tracking.

**Architecture:** New database tables for member events and HR scenarios. Client-side computation engine resolves events per month and produces KPI snapshots. New `/dashboard/hr-planning` page with KPI cards, yearly table with monthly drill-down, event management, and scenario comparison. Integration with existing scenario detail pages via embeddable KPI section.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + RLS), shadcn/ui, TanStack React Table, Tailwind CSS v4, sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-03-31-hr-planning-dashboard-design.md`

---

## File Structure

### New Files

```
supabase/migrations/
  YYYYMMDD000001_add_contract_dates.sql          # contract_start_date, contract_end_date on members + scenario_members_data
  YYYYMMDD000002_create_member_events.sql         # member_events table + RLS
  YYYYMMDD000003_create_hr_scenarios.sql          # hr_scenarios, hr_scenario_members, scenario_member_events + RLS

src/lib/optimizer/types.ts                        # MODIFY: add new types
src/lib/hr/compute.ts                             # Monthly snapshot + yearly view computation engine
src/lib/hr/resolve-events.ts                      # Event precedence resolution logic

src/hooks/useMemberEvents.ts                      # CRUD for member_events
src/hooks/useHRScenarios.ts                       # CRUD for hr_scenarios + members + events
src/hooks/useHRPlanning.ts                        # Computation hook (yearly view from members + events + settings)

src/components/hr/HRKPICards.tsx                   # KPI cards row
src/components/hr/HRYearlyTable.tsx                # Members x months table with drill-down
src/components/hr/HREventDialog.tsx                # Create/edit event dialog
src/components/hr/HREventList.tsx                  # Event list for expanded member row
src/components/hr/HRScenarioSelector.tsx           # Catalog/scenario toggle + scenario CRUD
src/components/hr/HRComparisonView.tsx             # Side-by-side comparison with deltas
src/components/hr/HRScenarioKPIs.tsx               # Embeddable KPI section for existing scenarios

src/app/dashboard/hr-planning/page.tsx             # Main HR Planning page

src/components/AppSidebar.tsx                      # MODIFY: add nav item
src/app/dashboard/scenarios/[id]/page.tsx          # MODIFY: add HRScenarioKPIs section
```

---

## Task 1: Database Migration — Contract Dates

**Files:**
- Create: `supabase/migrations/20260331000001_add_contract_dates.sql`

- [ ] **Step 1: Write migration for contract dates**

```sql
-- Add contract date fields to members
ALTER TABLE members ADD COLUMN contract_start_date DATE;
ALTER TABLE members ADD COLUMN contract_end_date DATE;

-- Add contract date fields to scenario_members_data
ALTER TABLE scenario_members_data ADD COLUMN contract_start_date DATE;
ALTER TABLE scenario_members_data ADD COLUMN contract_end_date DATE;
```

- [ ] **Step 2: Push migration to Supabase**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260331000001_add_contract_dates.sql
git commit -m "feat: add contract_start_date and contract_end_date to members tables"
```

---

## Task 2: Database Migration — Member Events

**Files:**
- Create: `supabase/migrations/20260331000002_create_member_events.sql`

- [ ] **Step 1: Write migration for member_events table**

```sql
CREATE TABLE IF NOT EXISTS member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days')),
  value TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own member_events" ON member_events
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_member_events_user_id ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_member_id ON member_events(member_id);
CREATE INDEX IF NOT EXISTS idx_member_events_dates ON member_events(start_date, end_date);
```

- [ ] **Step 2: Push migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260331000002_create_member_events.sql
git commit -m "feat: create member_events table with RLS"
```

---

## Task 3: Database Migration — HR Scenarios

**Files:**
- Create: `supabase/migrations/20260331000003_create_hr_scenarios.sql`

- [ ] **Step 1: Write migration for HR scenario tables**

```sql
-- HR Scenarios
CREATE TABLE IF NOT EXISTS hr_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own hr_scenarios" ON hr_scenarios
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hr_scenarios_user_id ON hr_scenarios(user_id);

-- HR Scenario Members
CREATE TABLE IF NOT EXISTS hr_scenario_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hr_scenario_id UUID REFERENCES hr_scenarios(id) ON DELETE CASCADE NOT NULL,
  source_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('dipendente', 'segnalatore', 'freelance')),
  seniority TEXT CHECK (seniority IN ('senior', 'middle_up', 'middle', 'junior', 'stage')),
  salary NUMERIC NOT NULL DEFAULT 0,
  ft_percentage NUMERIC DEFAULT 100,
  chargeable_days NUMERIC,
  capacity_percentage NUMERIC DEFAULT 100,
  cost_percentage NUMERIC DEFAULT 100,
  contract_start_date DATE,
  contract_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr_scenario_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own hr_scenario_members" ON hr_scenario_members
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hr_scenario_members_scenario_id ON hr_scenario_members(hr_scenario_id);
CREATE INDEX IF NOT EXISTS idx_hr_scenario_members_source ON hr_scenario_members(source_member_id);

-- Scenario Member Events
CREATE TABLE IF NOT EXISTS scenario_member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scenario_member_id UUID REFERENCES hr_scenario_members(id) ON DELETE CASCADE NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days')),
  value TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scenario_member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own scenario_member_events" ON scenario_member_events
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scenario_member_events_member_id ON scenario_member_events(scenario_member_id);
CREATE INDEX IF NOT EXISTS idx_scenario_member_events_dates ON scenario_member_events(start_date, end_date);
```

- [ ] **Step 2: Push migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260331000003_create_hr_scenarios.sql
git commit -m "feat: create hr_scenarios, hr_scenario_members, scenario_member_events tables"
```

---

## Task 4: TypeScript Types

**Files:**
- Modify: `src/lib/optimizer/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Add the following types at the end of the file, before the closing of the file:

```typescript
// ─── HR Planning Types ───────────────────────────────────────────────

export type MemberEventField = 'salary' | 'ft_percentage' | 'seniority' | 'category' | 'capacity_percentage' | 'chargeable_days';

export interface MemberEvent {
  id: string;
  user_id: string;
  member_id: string;
  field: MemberEventField;
  value: string;
  start_date: string; // DATE as ISO string
  end_date: string | null;
  note: string | null;
  created_at: string;
}

export interface MemberEventInput {
  member_id: string;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date?: string | null;
  note?: string | null;
}

export interface HRScenario {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface HRScenarioInput {
  name: string;
}

export interface HRScenarioMember {
  id: string;
  user_id: string;
  hr_scenario_id: string;
  source_member_id: string | null;
  first_name: string;
  last_name: string;
  category: 'dipendente' | 'segnalatore' | 'freelance';
  seniority: SeniorityLevel | null;
  salary: number;
  ft_percentage: number;
  chargeable_days: number | null;
  capacity_percentage: number;
  cost_percentage: number;
  contract_start_date: string | null;
  contract_end_date: string | null;
  created_at: string;
}

export interface HRScenarioMemberInput {
  first_name: string;
  last_name: string;
  category: 'dipendente' | 'segnalatore' | 'freelance';
  seniority?: SeniorityLevel | null;
  salary: number;
  ft_percentage?: number;
  chargeable_days?: number | null;
  capacity_percentage?: number;
  cost_percentage?: number;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
}

export interface ScenarioMemberEvent {
  id: string;
  user_id: string;
  scenario_member_id: string;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date: string | null;
  note: string | null;
  created_at: string;
}

export interface ScenarioMemberEventInput {
  scenario_member_id: string;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date?: string | null;
  note?: string | null;
}

export interface MonthlySnapshot {
  month: string; // 'YYYY-MM'
  totalCompanyCost: number;
  personnelCostBySeniority: Record<SeniorityLevel, number>;
  personnelCostByCostCenter: Record<string, number>;
  productiveCapacity: number;
  capacityBySeniority: Record<SeniorityLevel, number>;
  fte: number;
  headcount: number;
  avgHourlyCostBySeniority: Record<SeniorityLevel, number>;
  costCenterBreakdown: Record<string, number>;
  memberDetails: MemberMonthDetail[];
}

export interface MemberMonthDetail {
  memberId: string;
  firstName: string;
  lastName: string;
  effectiveSeniority: SeniorityLevel | null;
  effectiveSalary: number;
  effectiveFtPercentage: number;
  effectiveCategory: 'dipendente' | 'segnalatore' | 'freelance';
  monthlyCost: number;
  monthlyCapacity: number;
  fte: number;
  isActive: boolean; // false if outside contract dates
  activeEvents: MemberEvent[] | ScenarioMemberEvent[];
}

export interface YearlyView {
  year: number;
  annualTotals: {
    totalCompanyCost: number;
    personnelCostBySeniority: Record<SeniorityLevel, number>;
    personnelCostByCostCenter: Record<string, number>;
    productiveCapacity: number;
    capacityBySeniority: Record<SeniorityLevel, number>;
    fte: number;
    headcount: number;
    avgHourlyCostBySeniority: Record<SeniorityLevel, number>;
    costCenterBreakdown: Record<string, number>;
  };
  monthlySnapshots: MonthlySnapshot[];
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new types

- [ ] **Step 3: Commit**

```bash
git add src/lib/optimizer/types.ts
git commit -m "feat: add HR planning TypeScript types"
```

---

## Task 5: Event Resolution Logic

**Files:**
- Create: `src/lib/hr/resolve-events.ts`

- [ ] **Step 1: Write the event resolver**

```typescript
import { MemberEvent, MemberEventField, ScenarioMemberEvent } from '@/lib/optimizer/types';

type AnyEvent = MemberEvent | ScenarioMemberEvent;

/**
 * Resolve the effective value of a field for a given month.
 * Precedence: event with most recent start_date wins among active events.
 * Returns undefined if no event is active (use base value).
 */
export function resolveFieldForMonth(
  events: AnyEvent[],
  field: MemberEventField,
  month: string // 'YYYY-MM'
): string | undefined {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  const activeEvents = events.filter((e) => {
    if (e.field !== field) return false;
    if (e.start_date > monthEnd) return false;
    if (e.end_date !== null && e.end_date < monthStart) return false;
    return true;
  });

  if (activeEvents.length === 0) return undefined;

  // Most recent start_date wins
  activeEvents.sort((a, b) => b.start_date.localeCompare(a.start_date));
  return activeEvents[0].value;
}

/**
 * Check if a member is active (within contract dates) for a given month.
 */
export function isMemberActiveInMonth(
  contractStart: string | null,
  contractEnd: string | null,
  month: string
): boolean {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  if (contractStart && contractStart > monthEnd) return false;
  if (contractEnd && contractEnd < monthStart) return false;
  return true;
}

/**
 * Calculate the pro-rata fraction for a partial month.
 * Returns a value between 0 and 1.
 * 1.0 means the member is active for the entire month.
 */
export function monthProRataFraction(
  contractStart: string | null,
  contractEnd: string | null,
  month: string
): number {
  const monthStartStr = `${month}-01`;
  const monthEndStr = lastDayOfMonth(month);
  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();

  let startDay = 1;
  let endDay = daysInMonth;

  if (contractStart && contractStart > monthStartStr && contractStart <= monthEndStr) {
    startDay = parseInt(contractStart.split('-')[2]);
  }

  if (contractEnd && contractEnd >= monthStartStr && contractEnd < monthEndStr) {
    endDay = parseInt(contractEnd.split('-')[2]);
  }

  const activeDays = Math.max(0, endDay - startDay + 1);
  return activeDays / daysInMonth;
}

/**
 * Returns the last day of a month in 'YYYY-MM-DD' format.
 */
function lastDayOfMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const m = parseInt(monthStr);
  const lastDay = new Date(year, m, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Parse event value to the correct type based on field.
 */
export function parseEventValue(field: MemberEventField, value: string): number | string {
  switch (field) {
    case 'salary':
    case 'ft_percentage':
    case 'capacity_percentage':
    case 'chargeable_days':
      return parseFloat(value);
    case 'seniority':
    case 'category':
      return value;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/hr/resolve-events.ts
git commit -m "feat: add event resolution logic for HR planning"
```

---

## Task 6: Monthly Snapshot Computation Engine

**Files:**
- Create: `src/lib/hr/compute.ts`

- [ ] **Step 1: Write the computation engine**

```typescript
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
} from '@/lib/optimizer/types';
import {
  resolveFieldForMonth,
  isMemberActiveInMonth,
  monthProRataFraction,
  parseEventValue,
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
    activeEvents,
  };
}

export function computeMonthlySnapshot(
  members: AnyMember[],
  events: AnyEvent[],
  settings: Settings | null,
  allocations: CostCenterAllocation[],
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

    // By cost center
    const memberId = detail.memberId;
    const memberAllocations = allocations.filter((a) => a.member_id === memberId);
    if (memberAllocations.length > 0) {
      for (const alloc of memberAllocations) {
        const allocatedCost = detail.monthlyCost * (alloc.percentage / 100);
        personnelCostByCostCenter[alloc.cost_center_id] = (personnelCostByCostCenter[alloc.cost_center_id] || 0) + allocatedCost;
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
    memberDetails,
  };
}

export function computeYearlyView(
  members: AnyMember[],
  events: AnyEvent[],
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  year: number
): YearlyView {
  const monthlySnapshots: MonthlySnapshot[] = [];

  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    monthlySnapshots.push(computeMonthlySnapshot(members, events, settings, allocations, month));
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
  }

  // Average FTE and headcount (average across months)
  annualTotals.fte = monthlySnapshots.reduce((sum, s) => sum + s.fte, 0) / 12;
  annualTotals.headcount = Math.round(monthlySnapshots.reduce((sum, s) => sum + s.headcount, 0) / 12);

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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/hr/compute.ts
git commit -m "feat: add HR planning computation engine"
```

---

## Task 7: useMemberEvents Hook

**Files:**
- Create: `src/hooks/useMemberEvents.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { MemberEvent, MemberEventInput } from '@/lib/optimizer/types';

export function useMemberEvents(memberId?: string) {
  const [events, setEvents] = useState<MemberEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('member_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (memberId) {
        query = query.eq('member_id', memberId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  const addEvent = useCallback(async (input: MemberEventInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('member_events')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      setEvents((prev) => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      toast.success('Planned change added');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add event';
      setError(message);
      toast.error('Failed to add planned change', { description: message });
      throw err;
    }
  }, []);

  const updateEvent = useCallback(async (id: string, input: Partial<MemberEventInput>) => {
    try {
      const { data, error } = await supabase
        .from('member_events')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === id ? data : e)).sort((a, b) => a.start_date.localeCompare(b.start_date)));
      toast.success('Planned change updated');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
      toast.error('Failed to update planned change', { description: message });
      throw err;
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('member_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Planned change removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      toast.error('Failed to remove planned change', { description: message });
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    refetch: fetchEvents,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMemberEvents.ts
git commit -m "feat: add useMemberEvents CRUD hook"
```

---

## Task 8: useHRScenarios Hook

**Files:**
- Create: `src/hooks/useHRScenarios.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  HRScenario,
  HRScenarioMember,
  HRScenarioMemberInput,
  Member,
  MemberEvent,
  ScenarioMemberEvent,
  ScenarioMemberEventInput,
} from '@/lib/optimizer/types';

export interface HRScenarioWithData {
  scenario: HRScenario;
  members: HRScenarioMember[];
  events: ScenarioMemberEvent[];
}

export function useHRScenarios() {
  const [hrScenarios, setHrScenarios] = useState<HRScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchHRScenarios = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('hr_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHrScenarios(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch HR scenarios');
    } finally {
      setLoading(false);
    }
  }, []);

  const addHRScenario = useCallback(async (
    name: string,
    catalogMembers: Member[],
    catalogEvents: MemberEvent[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create scenario
      const { data: scenario, error: scenarioError } = await supabase
        .from('hr_scenarios')
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // 2. Copy catalog members
      if (catalogMembers.length > 0) {
        const memberRows = catalogMembers.map((m) => ({
          user_id: user.id,
          hr_scenario_id: scenario.id,
          source_member_id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          category: m.category,
          seniority: m.seniority,
          salary: m.salary,
          ft_percentage: m.ft_percentage ?? 100,
          chargeable_days: m.chargeable_days,
          capacity_percentage: 100,
          cost_percentage: 100,
          contract_start_date: m.contract_start_date ?? null,
          contract_end_date: m.contract_end_date ?? null,
        }));

        const { data: insertedMembers, error: memberError } = await supabase
          .from('hr_scenario_members')
          .insert(memberRows)
          .select();

        if (memberError) throw memberError;

        // 3. Copy catalog events mapped to new scenario member IDs
        if (catalogEvents.length > 0 && insertedMembers) {
          const memberIdMap = new Map<string, string>();
          for (const inserted of insertedMembers) {
            if (inserted.source_member_id) {
              memberIdMap.set(inserted.source_member_id, inserted.id);
            }
          }

          const eventRows = catalogEvents
            .filter((e) => memberIdMap.has(e.member_id))
            .map((e) => ({
              user_id: user.id,
              scenario_member_id: memberIdMap.get(e.member_id)!,
              field: e.field,
              value: e.value,
              start_date: e.start_date,
              end_date: e.end_date,
              note: e.note,
            }));

          if (eventRows.length > 0) {
            const { error: eventError } = await supabase
              .from('scenario_member_events')
              .insert(eventRows);

            if (eventError) throw eventError;
          }
        }
      }

      setHrScenarios((prev) => [scenario, ...prev]);
      toast.success('HR scenario created', { description: `${name} has been created` });
      return scenario as HRScenario;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create HR scenario';
      setError(message);
      toast.error('Failed to create HR scenario', { description: message });
      throw err;
    }
  }, []);

  const deleteHRScenario = useCallback(async (id: string) => {
    const scenario = hrScenarios.find((s) => s.id === id);
    try {
      const { error } = await supabase
        .from('hr_scenarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setHrScenarios((prev) => prev.filter((s) => s.id !== id));
      toast.success('HR scenario deleted', {
        description: scenario ? `${scenario.name} has been deleted` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete HR scenario';
      setError(message);
      toast.error('Failed to delete HR scenario', { description: message });
      throw err;
    }
  }, [hrScenarios]);

  const duplicateHRScenario = useCallback(async (id: string) => {
    try {
      const source = await fetchHRScenarioWithData(id);
      if (!source) throw new Error('Scenario not found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create new scenario
      const { data: newScenario, error: scenarioError } = await supabase
        .from('hr_scenarios')
        .insert({ user_id: user.id, name: `${source.scenario.name} (Copy)` })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // Copy members
      if (source.members.length > 0) {
        const memberRows = source.members.map((m) => ({
          user_id: user.id,
          hr_scenario_id: newScenario.id,
          source_member_id: m.source_member_id,
          first_name: m.first_name,
          last_name: m.last_name,
          category: m.category,
          seniority: m.seniority,
          salary: m.salary,
          ft_percentage: m.ft_percentage,
          chargeable_days: m.chargeable_days,
          capacity_percentage: m.capacity_percentage,
          cost_percentage: m.cost_percentage,
          contract_start_date: m.contract_start_date,
          contract_end_date: m.contract_end_date,
        }));

        const { data: insertedMembers, error: memberError } = await supabase
          .from('hr_scenario_members')
          .insert(memberRows)
          .select();

        if (memberError) throw memberError;

        // Copy events
        if (source.events.length > 0 && insertedMembers) {
          const memberIdMap = new Map<string, string>();
          for (let i = 0; i < source.members.length; i++) {
            memberIdMap.set(source.members[i].id, insertedMembers[i].id);
          }

          const eventRows = source.events
            .filter((e) => memberIdMap.has(e.scenario_member_id))
            .map((e) => ({
              user_id: user.id,
              scenario_member_id: memberIdMap.get(e.scenario_member_id)!,
              field: e.field,
              value: e.value,
              start_date: e.start_date,
              end_date: e.end_date,
              note: e.note,
            }));

          if (eventRows.length > 0) {
            await supabase.from('scenario_member_events').insert(eventRows);
          }
        }
      }

      setHrScenarios((prev) => [newScenario, ...prev]);
      toast.success('HR scenario duplicated', { description: `${newScenario.name} has been created` });
      return newScenario as HRScenario;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate HR scenario';
      setError(message);
      toast.error('Failed to duplicate', { description: message });
      throw err;
    }
  }, []);

  const fetchHRScenarioWithData = useCallback(async (scenarioId: string): Promise<HRScenarioWithData | null> => {
    try {
      const { data: scenario, error: scenarioError } = await supabase
        .from('hr_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      if (scenarioError) throw scenarioError;

      const { data: members, error: membersError } = await supabase
        .from('hr_scenario_members')
        .select('*')
        .eq('hr_scenario_id', scenarioId)
        .order('last_name', { ascending: true });

      if (membersError) throw membersError;

      const memberIds = (members || []).map((m: HRScenarioMember) => m.id);
      let events: ScenarioMemberEvent[] = [];
      if (memberIds.length > 0) {
        const { data: eventData, error: eventsError } = await supabase
          .from('scenario_member_events')
          .select('*')
          .in('scenario_member_id', memberIds)
          .order('start_date', { ascending: true });

        if (eventsError) throw eventsError;
        events = eventData || [];
      }

      return { scenario, members: members || [], events };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch HR scenario';
      setError(message);
      return null;
    }
  }, []);

  const addHypotheticalMember = useCallback(async (scenarioId: string, input: HRScenarioMemberInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('hr_scenario_members')
        .insert({
          user_id: user.id,
          hr_scenario_id: scenarioId,
          source_member_id: null,
          first_name: input.first_name,
          last_name: input.last_name,
          category: input.category,
          seniority: input.seniority ?? null,
          salary: input.salary,
          ft_percentage: input.ft_percentage ?? 100,
          chargeable_days: input.chargeable_days ?? null,
          capacity_percentage: input.capacity_percentage ?? 100,
          cost_percentage: input.cost_percentage ?? 100,
          contract_start_date: input.contract_start_date ?? null,
          contract_end_date: input.contract_end_date ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Hypothetical member added', {
        description: `${input.first_name} ${input.last_name} added to scenario`,
      });
      return data as HRScenarioMember;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add hypothetical member';
      setError(message);
      toast.error('Failed to add member', { description: message });
      throw err;
    }
  }, []);

  const removeScenarioMember = useCallback(async (scenarioMemberId: string) => {
    try {
      const { error } = await supabase
        .from('hr_scenario_members')
        .delete()
        .eq('id', scenarioMemberId);

      if (error) throw error;
      toast.success('Member removed from scenario');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setError(message);
      toast.error('Failed to remove member', { description: message });
      throw err;
    }
  }, []);

  const addScenarioEvent = useCallback(async (input: ScenarioMemberEventInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('scenario_member_events')
        .insert({ user_id: user.id, ...input })
        .select()
        .single();

      if (error) throw error;
      toast.success('Planned change added to scenario');
      return data as ScenarioMemberEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add event';
      setError(message);
      toast.error('Failed to add planned change', { description: message });
      throw err;
    }
  }, []);

  const updateScenarioEvent = useCallback(async (id: string, input: Partial<ScenarioMemberEventInput>) => {
    try {
      const { data, error } = await supabase
        .from('scenario_member_events')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Planned change updated');
      return data as ScenarioMemberEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
      toast.error('Failed to update', { description: message });
      throw err;
    }
  }, []);

  const deleteScenarioEvent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('scenario_member_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Planned change removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      toast.error('Failed to remove', { description: message });
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchHRScenarios();
  }, [fetchHRScenarios]);

  return {
    hrScenarios,
    loading,
    error,
    addHRScenario,
    deleteHRScenario,
    duplicateHRScenario,
    fetchHRScenarioWithData,
    addHypotheticalMember,
    removeScenarioMember,
    addScenarioEvent,
    updateScenarioEvent,
    deleteScenarioEvent,
    refetch: fetchHRScenarios,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHRScenarios.ts
git commit -m "feat: add useHRScenarios CRUD hook with event management"
```

---

## Task 9: useHRPlanning Computation Hook

**Files:**
- Create: `src/hooks/useHRPlanning.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Member,
  MemberEvent,
  Settings,
  YearlyView,
  HRScenarioMember,
  ScenarioMemberEvent,
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
  year: number
) {
  const debouncedMembers = useDebouncedValue(members, 500);
  const debouncedEvents = useDebouncedValue(events, 500);
  const debouncedSettings = useDebouncedValue(settings, 500);
  const debouncedAllocations = useDebouncedValue(allocations, 500);
  const debouncedYear = useDebouncedValue(year, 500);

  const [isCalculating, setIsCalculating] = useState(false);
  const prevInputsRef = useRef({ members, events, settings, allocations, year });

  // Detect input changes to show calculating state
  useEffect(() => {
    const prev = prevInputsRef.current;
    if (
      prev.members !== members ||
      prev.events !== events ||
      prev.settings !== settings ||
      prev.allocations !== allocations ||
      prev.year !== year
    ) {
      setIsCalculating(true);
      prevInputsRef.current = { members, events, settings, allocations, year };
    }
  }, [members, events, settings, allocations, year]);

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
      debouncedYear
    );

    setIsCalculating(false);
    return result;
  }, [debouncedMembers, debouncedEvents, debouncedSettings, debouncedAllocations, debouncedYear]);

  return {
    yearlyView,
    monthlySnapshots: yearlyView?.monthlySnapshots ?? [],
    isCalculating,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHRPlanning.ts
git commit -m "feat: add useHRPlanning computation hook with debounce"
```

---

## Task 10: HRKPICards Component

**Files:**
- Create: `src/components/hr/HRKPICards.tsx`

- [ ] **Step 1: Write the KPI cards component**

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { YearlyView, SeniorityLevel } from '@/lib/optimizer/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HRKPICardsProps {
  yearlyView: YearlyView | null;
  loading?: boolean;
}

const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  senior: 'Senior',
  middle_up: 'Middle Up',
  middle: 'Middle',
  junior: 'Junior',
  stage: 'Stage',
};

export function HRKPICards({ yearlyView, loading }: HRKPICardsProps) {
  if (loading || !yearlyView) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { annualTotals } = yearlyView;

  const seniorityDetail = Object.entries(annualTotals.personnelCostBySeniority)
    .filter(([, cost]) => cost > 0)
    .map(([sen, cost]) => `${SENIORITY_LABELS[sen as SeniorityLevel]}: ${formatCurrency(cost)}`)
    .join('\n');

  const cards = [
    {
      label: 'Costo Azienda',
      value: formatCurrency(annualTotals.totalCompanyCost),
      subtitle: 'Totale annuo',
    },
    {
      label: 'Costo Personale',
      value: formatCurrency(annualTotals.totalCompanyCost),
      subtitle: 'Per seniority',
      tooltip: seniorityDetail,
    },
    {
      label: 'Capacita Produttiva',
      value: `${Math.round(annualTotals.productiveCapacity).toLocaleString('it-IT')} gg`,
      subtitle: 'Giorni totali',
    },
    {
      label: 'FTE',
      value: annualTotals.fte.toFixed(1),
      subtitle: 'Full-time equivalent',
    },
    {
      label: 'Headcount',
      value: annualTotals.headcount.toString(),
      subtitle: 'Membri attivi',
    },
    {
      label: 'Costo Orario Medio',
      value: formatCurrency(
        Object.values(annualTotals.avgHourlyCostBySeniority).reduce((sum, v) => sum + v, 0) /
        Object.values(annualTotals.avgHourlyCostBySeniority).filter((v) => v > 0).length || 0
      ) + '/h',
      subtitle: 'Media ponderata',
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              {card.tooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xl font-bold cursor-help">{card.value}</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <pre className="text-xs whitespace-pre">{card.tooltip}</pre>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <p className="text-xl font-bold">{card.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HRKPICards.tsx
git commit -m "feat: add HRKPICards component with tooltips"
```

---

## Task 11: HREventDialog Component

**Files:**
- Create: `src/components/hr/HREventDialog.tsx`

- [ ] **Step 1: Write the event dialog**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Member, MemberEventField, MemberEventInput, HRScenarioMember } from '@/lib/optimizer/types';

type AnyMember = Member | HRScenarioMember;

interface HREventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: AnyMember[];
  onSave: (input: MemberEventInput) => Promise<void>;
  editingEvent?: {
    id: string;
    member_id: string;
    field: MemberEventField;
    value: string;
    start_date: string;
    end_date: string | null;
    note: string | null;
  } | null;
}

const FIELD_OPTIONS: { value: MemberEventField; label: string }[] = [
  { value: 'salary', label: 'Stipendio (RAL)' },
  { value: 'ft_percentage', label: 'FT%' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'category', label: 'Categoria' },
  { value: 'capacity_percentage', label: 'Capacity %' },
  { value: 'chargeable_days', label: 'Giorni fatturabili' },
];

const SENIORITY_OPTIONS = [
  { value: 'senior', label: 'Senior' },
  { value: 'middle_up', label: 'Middle Up' },
  { value: 'middle', label: 'Middle' },
  { value: 'junior', label: 'Junior' },
  { value: 'stage', label: 'Stage' },
];

const CATEGORY_OPTIONS = [
  { value: 'dipendente', label: 'Dipendente' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'segnalatore', label: 'Segnalatore' },
];

export function HREventDialog({
  open,
  onOpenChange,
  members,
  onSave,
  editingEvent,
}: HREventDialogProps) {
  const [memberId, setMemberId] = useState('');
  const [field, setField] = useState<MemberEventField>('salary');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEvent) {
      setMemberId(editingEvent.member_id);
      setField(editingEvent.field);
      setValue(editingEvent.value);
      setStartDate(editingEvent.start_date);
      setEndDate(editingEvent.end_date || '');
      setNote(editingEvent.note || '');
    } else {
      setMemberId('');
      setField('salary');
      setValue('');
      setStartDate('');
      setEndDate('');
      setNote('');
    }
    setError(null);
  }, [editingEvent, open]);

  const handleSave = async () => {
    setError(null);
    if (!memberId) {
      setError('Select a team member');
      return;
    }
    if (!value.trim()) {
      setError('Value is required');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        member_id: memberId,
        field,
        value: value.trim(),
        start_date: startDate,
        end_date: endDate || null,
        note: note.trim() || null,
      });
      onOpenChange(false);
    } catch {
      // Error handled by hook toast
    } finally {
      setSaving(false);
    }
  };

  const renderValueInput = () => {
    if (field === 'seniority') {
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select seniority" />
          </SelectTrigger>
          <SelectContent>
            {SENIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (field === 'category') {
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={field === 'salary' ? 'e.g. 45000' : 'e.g. 100'}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Edit Planned Change' : 'New Planned Change'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label>Team Member</Label>
            <Select value={memberId} onValueChange={setMemberId} disabled={!!editingEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Variable</Label>
            <Select value={field} onValueChange={(v) => { setField(v as MemberEventField); setValue(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>New Value</Label>
            {renderValueInput()}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End Date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Maternita, Promozione" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingEvent ? 'Update' : 'Add Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HREventDialog.tsx
git commit -m "feat: add HREventDialog component for planned changes"
```

---

## Task 12: HREventList Component

**Files:**
- Create: `src/components/hr/HREventList.tsx`

- [ ] **Step 1: Write the event list component**

```typescript
'use client';

import { MemberEvent, ScenarioMemberEvent, MemberEventField } from '@/lib/optimizer/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type AnyEvent = MemberEvent | ScenarioMemberEvent;

interface HREventListProps {
  events: AnyEvent[];
  onEdit: (event: AnyEvent) => void;
  onDelete: (eventId: string) => void;
}

const FIELD_LABELS: Record<MemberEventField, string> = {
  salary: 'Stipendio',
  ft_percentage: 'FT%',
  seniority: 'Seniority',
  category: 'Categoria',
  capacity_percentage: 'Capacity %',
  chargeable_days: 'Giorni fatturabili',
};

function formatEventValue(field: MemberEventField, value: string): string {
  switch (field) {
    case 'salary':
      return formatCurrency(parseFloat(value));
    case 'ft_percentage':
    case 'capacity_percentage':
      return `${value}%`;
    case 'chargeable_days':
      return `${value} gg`;
    case 'seniority':
      return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');
    case 'category':
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function HREventList({ events, onEdit, onDelete }: HREventListProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No planned changes</p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-3">
            <Badge variant="outline">{FIELD_LABELS[event.field]}</Badge>
            <span className="font-medium">{formatEventValue(event.field, event.value)}</span>
            <span className="text-muted-foreground">
              {formatDate(event.start_date)}
              {event.end_date ? ` - ${formatDate(event.end_date)}` : ' onwards'}
            </span>
            {event.note && (
              <span className="text-muted-foreground italic">{event.note}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(event)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(event.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HREventList.tsx
git commit -m "feat: add HREventList component"
```

---

## Task 13: HRYearlyTable Component

**Files:**
- Create: `src/components/hr/HRYearlyTable.tsx`

- [ ] **Step 1: Write the yearly table component**

```typescript
'use client';

import { useState } from 'react';
import { YearlyView, SeniorityLevel } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Metric = 'cost' | 'capacity' | 'fte';

interface HRYearlyTableProps {
  yearlyView: YearlyView | null;
  loading?: boolean;
  onMemberClick?: (memberId: string) => void;
}

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function formatCell(value: number, metric: Metric): string {
  switch (metric) {
    case 'cost':
      return value > 0 ? formatCurrency(value) : '-';
    case 'capacity':
      return value > 0 ? value.toFixed(1) : '-';
    case 'fte':
      return value > 0 ? value.toFixed(2) : '-';
  }
}

export function HRYearlyTable({ yearlyView, loading, onMemberClick }: HRYearlyTableProps) {
  const [metric, setMetric] = useState<Metric>('cost');
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  if (loading || !yearlyView) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { monthlySnapshots } = yearlyView;

  // Get unique members from first snapshot that has members
  const allMemberIds = new Set<string>();
  const memberInfo = new Map<string, { firstName: string; lastName: string; seniority: SeniorityLevel | null }>();
  for (const snapshot of monthlySnapshots) {
    for (const detail of snapshot.memberDetails) {
      if (!allMemberIds.has(detail.memberId)) {
        allMemberIds.add(detail.memberId);
        memberInfo.set(detail.memberId, {
          firstName: detail.firstName,
          lastName: detail.lastName,
          seniority: detail.effectiveSeniority,
        });
      }
    }
  }

  const memberIds = Array.from(allMemberIds);

  const toggleMember = (memberId: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const getMemberMonthValue = (memberId: string, monthIndex: number): number => {
    const snapshot = monthlySnapshots[monthIndex];
    const detail = snapshot.memberDetails.find((d) => d.memberId === memberId);
    if (!detail || !detail.isActive) return 0;
    switch (metric) {
      case 'cost': return detail.monthlyCost;
      case 'capacity': return detail.monthlyCapacity;
      case 'fte': return detail.fte;
    }
  };

  const getMemberYearTotal = (memberId: string): number => {
    return monthlySnapshots.reduce((sum, _, i) => sum + getMemberMonthValue(memberId, i), 0);
  };

  const getMonthTotal = (monthIndex: number): number => {
    const snapshot = monthlySnapshots[monthIndex];
    switch (metric) {
      case 'cost': return snapshot.totalCompanyCost;
      case 'capacity': return snapshot.productiveCapacity;
      case 'fte': return snapshot.fte;
    }
  };

  const hasActiveEvents = (memberId: string, monthIndex: number): boolean => {
    const snapshot = monthlySnapshots[monthIndex];
    const detail = snapshot.memberDetails.find((d) => d.memberId === memberId);
    return (detail?.activeEvents?.length ?? 0) > 0;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Detail by Member</h3>
        <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cost">Cost (EUR)</SelectItem>
            <SelectItem value="capacity">Capacity (days)</SelectItem>
            <SelectItem value="fte">FTE</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium min-w-[180px]">Member</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-3 py-2 text-right font-medium min-w-[80px]">{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium min-w-[100px] bg-muted/80">Total</th>
            </tr>
          </thead>
          <tbody>
            {memberIds.map((memberId) => {
              const info = memberInfo.get(memberId)!;
              const isExpanded = expandedMembers.has(memberId);
              return (
                <tr
                  key={memberId}
                  className="border-b hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggleMember(memberId)}
                >
                  <td className="sticky left-0 bg-background px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                      {info.firstName} {info.lastName}
                    </div>
                  </td>
                  {MONTHS.map((_, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        hasActiveEvents(memberId, i) && 'bg-yellow-500/10'
                      )}
                    >
                      {formatCell(getMemberMonthValue(memberId, i), metric)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums bg-muted/30">
                    {formatCell(getMemberYearTotal(memberId), metric)}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 bg-muted/50 font-bold">
              <td className="sticky left-0 bg-muted/50 px-3 py-2">Total</td>
              {MONTHS.map((_, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums">
                  {formatCell(getMonthTotal(i), metric)}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums bg-muted/80">
                {formatCell(monthlySnapshots.reduce((sum, _, i) => sum + getMonthTotal(i), 0), metric)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HRYearlyTable.tsx
git commit -m "feat: add HRYearlyTable with monthly drill-down and metric selector"
```

---

## Task 14: HRScenarioSelector Component

**Files:**
- Create: `src/components/hr/HRScenarioSelector.tsx`

- [ ] **Step 1: Write the scenario selector**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HRScenario } from '@/lib/optimizer/types';
import { Plus, Copy, Trash2, MoreHorizontal } from 'lucide-react';

interface HRScenarioSelectorProps {
  source: string; // 'catalog' or scenario ID
  onSourceChange: (source: string) => void;
  hrScenarios: HRScenario[];
  onCreateScenario: (name: string) => Promise<void>;
  onDuplicateScenario: (id: string) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
}

export function HRScenarioSelector({
  source,
  onSourceChange,
  hrScenarios,
  onCreateScenario,
  onDuplicateScenario,
  onDeleteScenario,
}: HRScenarioSelectorProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreateScenario(newName.trim());
      setCreateDialogOpen(false);
      setNewName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Select value={source} onValueChange={onSourceChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="catalog">Catalogo</SelectItem>
          {hrScenarios.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {source !== 'catalog' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onDuplicateScenario(source)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteScenario(source)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New HR Scenario
      </Button>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New HR Scenario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Scenario name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HRScenarioSelector.tsx
git commit -m "feat: add HRScenarioSelector component"
```

---

## Task 15: HRComparisonView Component

**Files:**
- Create: `src/components/hr/HRComparisonView.tsx`

- [ ] **Step 1: Write the comparison view**

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { YearlyView, SeniorityLevel } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface HRComparisonViewProps {
  baseView: YearlyView;
  compareView: YearlyView;
  baseLabel: string;
  compareLabel: string;
}

interface ComparisonRow {
  label: string;
  baseValue: number;
  compareValue: number;
  format: 'currency' | 'days' | 'number' | 'decimal';
}

function formatValue(value: number, format: ComparisonRow['format']): string {
  switch (format) {
    case 'currency': return formatCurrency(value);
    case 'days': return `${Math.round(value).toLocaleString('it-IT')} gg`;
    case 'number': return Math.round(value).toString();
    case 'decimal': return value.toFixed(1);
  }
}

function DeltaIndicator({ base, compare, format }: { base: number; compare: number; format: ComparisonRow['format'] }) {
  const delta = compare - base;
  const pct = base > 0 ? ((delta / base) * 100) : 0;

  if (Math.abs(delta) < 0.01) {
    return <span className="flex items-center gap-1 text-muted-foreground"><Minus className="h-3 w-3" /> -</span>;
  }

  const isPositive = delta > 0;
  return (
    <span className={cn('flex items-center gap-1', isPositive ? 'text-green-500' : 'text-red-500')}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{formatValue(delta, format)} ({isPositive ? '+' : ''}{pct.toFixed(1)}%)
    </span>
  );
}

export function HRComparisonView({ baseView, compareView, baseLabel, compareLabel }: HRComparisonViewProps) {
  const rows: ComparisonRow[] = [
    {
      label: 'Costo Azienda',
      baseValue: baseView.annualTotals.totalCompanyCost,
      compareValue: compareView.annualTotals.totalCompanyCost,
      format: 'currency',
    },
    {
      label: 'Capacita Produttiva',
      baseValue: baseView.annualTotals.productiveCapacity,
      compareValue: compareView.annualTotals.productiveCapacity,
      format: 'days',
    },
    {
      label: 'FTE',
      baseValue: baseView.annualTotals.fte,
      compareValue: compareView.annualTotals.fte,
      format: 'decimal',
    },
    {
      label: 'Headcount',
      baseValue: baseView.annualTotals.headcount,
      compareValue: compareView.annualTotals.headcount,
      format: 'number',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">KPI</th>
              <th className="px-4 py-3 text-right font-medium">{baseLabel}</th>
              <th className="px-4 py-3 text-right font-medium">{compareLabel}</th>
              <th className="px-4 py-3 text-right font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatValue(row.baseValue, row.format)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatValue(row.compareValue, row.format)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <DeltaIndicator base={row.baseValue} compare={row.compareValue} format={row.format} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monthly comparison */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">{baseLabel}</th>
              <th className="px-3 py-2 text-right font-medium">{compareLabel}</th>
              <th className="px-3 py-2 text-right font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            {baseView.monthlySnapshots.map((baseSnap, i) => {
              const compareSnap = compareView.monthlySnapshots[i];
              const monthName = new Date(2026, i, 1).toLocaleDateString('it-IT', { month: 'long' });
              return (
                <tr key={i} className="border-b">
                  <td className="sticky left-0 bg-background px-3 py-2 font-medium capitalize">{monthName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(baseSnap.totalCompanyCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(compareSnap.totalCompanyCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <DeltaIndicator base={baseSnap.totalCompanyCost} compare={compareSnap.totalCompanyCost} format="currency" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HRComparisonView.tsx
git commit -m "feat: add HRComparisonView component with delta indicators"
```

---

## Task 16: HR Planning Page

**Files:**
- Create: `src/app/dashboard/hr-planning/page.tsx`

- [ ] **Step 1: Write the main page**

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios, HRScenarioWithData } from '@/hooks/useHRScenarios';
import { useHRPlanning } from '@/hooks/useHRPlanning';
import { HRKPICards } from '@/components/hr/HRKPICards';
import { HRYearlyTable } from '@/components/hr/HRYearlyTable';
import { HREventDialog } from '@/components/hr/HREventDialog';
import { HREventList } from '@/components/hr/HREventList';
import { HRScenarioSelector } from '@/components/hr/HRScenarioSelector';
import { HRComparisonView } from '@/components/hr/HRComparisonView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, GitCompareArrows } from 'lucide-react';
import { Member, MemberEvent, MemberEventInput, HRScenarioMember, ScenarioMemberEvent } from '@/lib/optimizer/types';

export default function HRPlanningPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [source, setSource] = useState('catalog');
  const [tab, setTab] = useState('planning');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | ScenarioMemberEvent | null>(null);

  // Catalog data
  const { members: catalogMembers, loading: membersLoading } = useMembers();
  const { settings, loading: settingsLoading } = useSettings();
  const { allocations, loading: costCentersLoading } = useCostCenters();
  const { events: catalogEvents, addEvent, updateEvent, deleteEvent, loading: eventsLoading } = useMemberEvents();

  // HR Scenarios
  const {
    hrScenarios,
    addHRScenario,
    deleteHRScenario,
    duplicateHRScenario,
    fetchHRScenarioWithData,
    addHypotheticalMember,
    removeScenarioMember,
    addScenarioEvent,
    updateScenarioEvent,
    deleteScenarioEvent,
  } = useHRScenarios();

  // Scenario data (loaded when source changes)
  const [scenarioData, setScenarioData] = useState<HRScenarioWithData | null>(null);

  useEffect(() => {
    if (source !== 'catalog') {
      fetchHRScenarioWithData(source).then(setScenarioData);
    } else {
      setScenarioData(null);
    }
  }, [source, fetchHRScenarioWithData]);

  // Determine active members and events based on source
  const activeMembers = source === 'catalog'
    ? catalogMembers
    : (scenarioData?.members ?? []);
  const activeEvents = source === 'catalog'
    ? catalogEvents
    : (scenarioData?.events ?? []);

  // Computation
  const { yearlyView, isCalculating } = useHRPlanning(
    activeMembers,
    activeEvents,
    settings,
    allocations,
    year
  );

  // Comparison state
  const [compareSource, setCompareSource] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<HRScenarioWithData | null>(null);

  const compareMembers = compareSource === 'catalog'
    ? catalogMembers
    : (compareData?.members ?? []);
  const compareEvents = compareSource === 'catalog'
    ? catalogEvents
    : (compareData?.events ?? []);

  const { yearlyView: compareYearlyView } = useHRPlanning(
    compareMembers,
    compareEvents,
    settings,
    allocations,
    year
  );

  useEffect(() => {
    if (compareSource && compareSource !== 'catalog') {
      fetchHRScenarioWithData(compareSource).then(setCompareData);
    } else {
      setCompareData(null);
    }
  }, [compareSource, fetchHRScenarioWithData]);

  // Event handlers
  const handleSaveEvent = async (input: MemberEventInput) => {
    if (source === 'catalog') {
      if (editingEvent) {
        await updateEvent(editingEvent.id, input);
      } else {
        await addEvent(input);
      }
    } else {
      if (editingEvent) {
        await updateScenarioEvent(editingEvent.id, {
          scenario_member_id: input.member_id,
          field: input.field,
          value: input.value,
          start_date: input.start_date,
          end_date: input.end_date,
          note: input.note,
        });
      } else {
        await addScenarioEvent({
          scenario_member_id: input.member_id,
          field: input.field,
          value: input.value,
          start_date: input.start_date,
          end_date: input.end_date,
          note: input.note,
        });
      }
      // Refresh scenario data
      const refreshed = await fetchHRScenarioWithData(source);
      setScenarioData(refreshed);
    }
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (source === 'catalog') {
      await deleteEvent(eventId);
    } else {
      await deleteScenarioEvent(eventId);
      const refreshed = await fetchHRScenarioWithData(source);
      setScenarioData(refreshed);
    }
  };

  const handleCreateScenario = async (name: string) => {
    const scenario = await addHRScenario(name, catalogMembers, catalogEvents);
    setSource(scenario.id);
  };

  const handleDeleteScenario = async (id: string) => {
    await deleteHRScenario(id);
    setSource('catalog');
  };

  const loading = membersLoading || settingsLoading || costCentersLoading || eventsLoading;
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">HR Planning</h1>
        <div className="flex items-center gap-4">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HRScenarioSelector
            source={source}
            onSourceChange={setSource}
            hrScenarios={hrScenarios}
            onCreateScenario={handleCreateScenario}
            onDuplicateScenario={duplicateHRScenario}
            onDeleteScenario={handleDeleteScenario}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <HRKPICards yearlyView={yearlyView} loading={loading || isCalculating} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompareArrows className="mr-2 h-4 w-4" />
            Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-6">
          {/* Event management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Planned Changes</CardTitle>
                <Button size="sm" onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Change
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <HREventList
                events={activeEvents}
                onEdit={(event) => {
                  setEditingEvent(event as MemberEvent);
                  setEventDialogOpen(true);
                }}
                onDelete={handleDeleteEvent}
              />
            </CardContent>
          </Card>

          {/* Yearly table */}
          <Card>
            <CardContent className="pt-6">
              <HRYearlyTable yearlyView={yearlyView} loading={loading || isCalculating} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Compare with:</span>
            <Select value={compareSource ?? ''} onValueChange={(v) => setCompareSource(v || null)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select to compare" />
              </SelectTrigger>
              <SelectContent>
                {source !== 'catalog' && (
                  <SelectItem value="catalog">Catalogo</SelectItem>
                )}
                {hrScenarios
                  .filter((s) => s.id !== source)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {yearlyView && compareYearlyView && compareSource && (
            <HRComparisonView
              baseView={yearlyView}
              compareView={compareYearlyView}
              baseLabel={source === 'catalog' ? 'Catalogo' : (hrScenarios.find((s) => s.id === source)?.name ?? 'Scenario')}
              compareLabel={compareSource === 'catalog' ? 'Catalogo' : (hrScenarios.find((s) => s.id === compareSource)?.name ?? 'Scenario')}
            />
          )}

          {!compareSource && (
            <p className="text-sm text-muted-foreground">Select a source to compare with.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Event dialog */}
      <HREventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        members={activeMembers}
        onSave={handleSaveEvent}
        editingEvent={editingEvent ? {
          id: editingEvent.id,
          member_id: 'member_id' in editingEvent ? editingEvent.member_id : (editingEvent as ScenarioMemberEvent).scenario_member_id,
          field: editingEvent.field,
          value: editingEvent.value,
          start_date: editingEvent.start_date,
          end_date: editingEvent.end_date,
          note: editingEvent.note,
        } : null}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/hr-planning/page.tsx
git commit -m "feat: add HR Planning page with KPIs, events, table, and comparison"
```

---

## Task 17: Add Sidebar Navigation Item

**Files:**
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Add HR Planning to navItems**

In `src/components/AppSidebar.tsx`, add the HR Planning item to the `navItems` array. Insert it after the Workforce Analytics entry and before the Compare entry:

```typescript
// Add this import at the top alongside existing lucide imports:
// CalendarClock is already available from lucide-react

// Add this entry to the navItems array after workforce-analytics:
{ href: '/dashboard/hr-planning', icon: CalendarClock, label: 'HR Planning' },
```

The import line should add `CalendarClock` to the existing destructured import from `lucide-react`.

The navItems array should look like:
```typescript
const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/dashboard/workforce', icon: Users, label: 'Workforce' },
  { href: '/dashboard/services', icon: Package, label: 'Services' },
  { href: '/dashboard/cost-centers', icon: Building2, label: 'Cost Centers' },
  { href: '/dashboard/workforce-analytics', icon: TrendingUp, label: 'Workforce Analytics' },
  { href: '/dashboard/hr-planning', icon: CalendarClock, label: 'HR Planning' },
  { href: '/dashboard/compare', icon: GitCompareArrows, label: 'Compare' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat: add HR Planning to sidebar navigation"
```

---

## Task 18: HRScenarioKPIs for Existing Scenario Pages

**Files:**
- Create: `src/components/hr/HRScenarioKPIs.tsx`
- Modify: `src/app/dashboard/scenarios/[id]/page.tsx`

- [ ] **Step 1: Write the embeddable KPI component**

```typescript
'use client';

import { useMemo } from 'react';
import { ScenarioMemberData, Settings } from '@/lib/optimizer/types';
import { computeYearlyView } from '@/lib/hr/compute';
import { HRKPICards } from './HRKPICards';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface HRScenarioKPIsProps {
  members: ScenarioMemberData[];
  settings: Settings | null;
}

export function HRScenarioKPIs({ members, settings }: HRScenarioKPIsProps) {
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();

  const yearlyView = useMemo(() => {
    if (members.length === 0) return null;
    return computeYearlyView(members, [], settings, [], year);
  }, [members, settings, year]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
        <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
        HR KPIs
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <HRKPICards yearlyView={yearlyView} />
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 2: Add HRScenarioKPIs to the scenario detail page**

In `src/app/dashboard/scenarios/[id]/page.tsx`, add the following:

1. Add import at top:
```typescript
import { HRScenarioKPIs } from '@/components/hr/HRScenarioKPIs';
```

2. Add the component after the existing ResultsCard section (before the Tabs for members/services), passing the scenario's members and settings:
```typescript
<HRScenarioKPIs members={scenario.members} settings={settings} />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/hr/HRScenarioKPIs.tsx src/app/dashboard/scenarios/[id]/page.tsx
git commit -m "feat: add HR KPI section to existing scenario detail pages"
```

---

## Task 19: Update Member Forms with Contract Dates

**Files:**
- Modify: `src/components/workforce/WorkforceCard.tsx`

- [ ] **Step 1: Add contract date fields to the member creation form**

In `WorkforceCard.tsx`, add two date inputs to the form inside the Dialog, after the existing salary field:

```typescript
<div className="grid grid-cols-2 gap-4">
  <div className="grid gap-2">
    <Label>Contract Start</Label>
    <Input
      type="date"
      value={formData.contract_start_date || ''}
      onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value || null })}
    />
  </div>
  <div className="grid gap-2">
    <Label>Contract End</Label>
    <Input
      type="date"
      value={formData.contract_end_date || ''}
      onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value || null })}
    />
  </div>
</div>
```

Also update the default form data to include `contract_start_date: null` and `contract_end_date: null`.

- [ ] **Step 2: Update the Member type to include contract dates**

In `src/lib/optimizer/types.ts`, add to the `Member` interface:

```typescript
contract_start_date: string | null;
contract_end_date: string | null;
```

And to `MemberInput`:

```typescript
contract_start_date?: string | null;
contract_end_date?: string | null;
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/workforce/WorkforceCard.tsx src/lib/optimizer/types.ts
git commit -m "feat: add contract date fields to member creation form"
```

---

## Task 20: Final Integration Test

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Start dev server and verify pages load**

Run: `npm run dev`

Navigate to:
- `/dashboard/hr-planning` — verify page loads with KPI cards, empty state
- `/dashboard/workforce` — verify contract date fields appear in add member dialog
- `/dashboard/scenarios/[any-id]` — verify HR KPIs section appears

- [ ] **Step 3: Commit any fixes if needed**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete HR Planning dashboard implementation"
```
