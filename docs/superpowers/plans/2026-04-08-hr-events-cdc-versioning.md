# HR Events, CDC Allocations & Comparison Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contract-date badges to the workforce table, time-varying cost-center allocations via the event system, and a CDC filter to the HR planning/comparison views.

**Architecture:** Extend the existing event system (`member_events` / `scenario_member_events`) with a new `cost_center_allocations` field type backed by a dedicated `event_cost_center_allocations` table. The computation engine resolves CDC allocations per-month just like scalar fields, with fallback to static allocations. The UI gains a CDC filter selector on Planning and Comparison tabs.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js App Router, TypeScript, TanStack React Table, shadcn/ui

---

## File Map

### New files
- `supabase/migrations/20260408000001_add_event_cdc_allocations.sql` — DB migration for new table + field constraint updates
- (no new component files — all changes integrate into existing components)

### Modified files
- `src/lib/optimizer/types.ts` — Add `EventCostCenterAllocation` type, extend `MemberEventField`, add CDC breakdowns to `MonthlySnapshot`/`YearlyView`
- `src/lib/hr/resolve-events.ts` — Add `resolveCostCenterAllocationsForMonth()`
- `src/lib/hr/compute.ts` — Accept `eventAllocations`, use resolved CDC allocations, compute capacity/FTE/headcount by CDC
- `src/hooks/useHRPlanning.ts` — Pass `eventAllocations` through to compute
- `src/hooks/useMemberEvents.ts` — Fetch `event_cost_center_allocations` alongside events, CRUD for CDC events
- `src/hooks/useHRScenarios.ts` — Fetch/copy `event_cost_center_allocations` for scenario events
- `src/components/hr/HREventDialog.tsx` — CDC allocation mini-table when `field = 'cost_center_allocations'`
- `src/components/hr/HREventList.tsx` — Display CDC allocation events
- `src/components/hr/HRKPICards.tsx` — Accept optional `costCenterId` filter
- `src/components/hr/HRYearlyTable.tsx` — Accept optional `costCenterId` filter
- `src/components/hr/HRComparisonView.tsx` — Accept optional `costCenterId` filter
- `src/app/dashboard/hr-planning/page.tsx` — Add CDC filter `Select`, wire through to all components
- `src/components/workforce/columns.tsx` — Add contract status badge column
- `src/components/workforce/MemberList.tsx` — Add contract date fields to edit form

---

## Task 1: Database migration — event_cost_center_allocations table

**Files:**
- Create: `supabase/migrations/20260408000001_add_event_cdc_allocations.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add 'cost_center_allocations' to the field CHECK on member_events
ALTER TABLE member_events DROP CONSTRAINT IF EXISTS member_events_field_check;
ALTER TABLE member_events ADD CONSTRAINT member_events_field_check
  CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days', 'cost_center_allocations'));

-- Add 'cost_center_allocations' to the field CHECK on scenario_member_events
ALTER TABLE scenario_member_events DROP CONSTRAINT IF EXISTS scenario_member_events_field_check;
ALTER TABLE scenario_member_events ADD CONSTRAINT scenario_member_events_field_check
  CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days', 'cost_center_allocations'));

-- Event cost center allocations table
CREATE TABLE IF NOT EXISTS event_cost_center_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_event_id UUID REFERENCES member_events(id) ON DELETE CASCADE,
  scenario_member_event_id UUID REFERENCES scenario_member_events(id) ON DELETE CASCADE,
  cost_center_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE NOT NULL,
  percentage NUMERIC NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  UNIQUE(member_event_id, cost_center_id),
  UNIQUE(scenario_member_event_id, cost_center_id),
  CHECK (
    (member_event_id IS NOT NULL AND scenario_member_event_id IS NULL) OR
    (member_event_id IS NULL AND scenario_member_event_id IS NOT NULL)
  )
);

ALTER TABLE event_cost_center_allocations ENABLE ROW LEVEL SECURITY;

-- RLS: access via member_events → user_id
CREATE POLICY "Users can CRUD own event_cost_center_allocations via member_events" ON event_cost_center_allocations
  FOR ALL USING (
    (member_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM member_events WHERE member_events.id = event_cost_center_allocations.member_event_id AND member_events.user_id = auth.uid()
    ))
    OR
    (scenario_member_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM scenario_member_events WHERE scenario_member_events.id = event_cost_center_allocations.scenario_member_event_id AND scenario_member_events.user_id = auth.uid()
    ))
  );

CREATE INDEX IF NOT EXISTS idx_event_cc_alloc_member_event ON event_cost_center_allocations(member_event_id);
CREATE INDEX IF NOT EXISTS idx_event_cc_alloc_scenario_event ON event_cost_center_allocations(scenario_member_event_id);
CREATE INDEX IF NOT EXISTS idx_event_cc_alloc_cost_center ON event_cost_center_allocations(cost_center_id);
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push`
Expected: Migration applies successfully. The new table and constraints are created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260408000001_add_event_cdc_allocations.sql
git commit -m "feat: add event_cost_center_allocations table and update field constraints"
```

---

## Task 2: Types — EventCostCenterAllocation + extend MemberEventField + CDC breakdowns

**Files:**
- Modify: `src/lib/optimizer/types.ts`

- [ ] **Step 1: Add `cost_center_allocations` to `MemberEventField`**

At line 357, change:

```typescript
export type MemberEventField = 'salary' | 'ft_percentage' | 'seniority' | 'category' | 'capacity_percentage' | 'chargeable_days';
```

to:

```typescript
export type MemberEventField = 'salary' | 'ft_percentage' | 'seniority' | 'category' | 'capacity_percentage' | 'chargeable_days' | 'cost_center_allocations';
```

- [ ] **Step 2: Add `EventCostCenterAllocation` type**

After the `MemberCostCenterAllocation` interface (after line 247), add:

```typescript
export interface EventCostCenterAllocation {
  id: string;
  member_event_id: string | null;
  scenario_member_event_id: string | null;
  cost_center_id: string;
  percentage: number;
}
```

- [ ] **Step 3: Add CDC breakdowns to `MonthlySnapshot`**

In the `MonthlySnapshot` interface (around line 446), add after `costCenterBreakdown`:

```typescript
  capacityByCostCenter: Record<string, number>;
  fteByCostCenter: Record<string, number>;
  headcountByCostCenter: Record<string, number>;
```

- [ ] **Step 4: Add CDC breakdowns to `YearlyView.annualTotals`**

In the `YearlyView` interface `annualTotals` (around line 477), add after `costCenterBreakdown`:

```typescript
    capacityByCostCenter: Record<string, number>;
    fteByCostCenter: Record<string, number>;
    headcountByCostCenter: Record<string, number>;
```

- [ ] **Step 5: Verify build compiles (expect errors from compute.ts — that's OK for now)**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in `compute.ts` about missing properties — these will be fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/lib/optimizer/types.ts
git commit -m "feat: add EventCostCenterAllocation type and CDC breakdowns to snapshots"
```

---

## Task 3: resolve-events.ts — resolveCostCenterAllocationsForMonth

**Files:**
- Modify: `src/lib/hr/resolve-events.ts`

- [ ] **Step 1: Add the `EventCostCenterAllocation` import**

At line 1, change:

```typescript
import { MemberEvent, MemberEventField, ScenarioMemberEvent } from '@/lib/optimizer/types';
```

to:

```typescript
import { MemberEvent, MemberEventField, ScenarioMemberEvent, EventCostCenterAllocation } from '@/lib/optimizer/types';
```

- [ ] **Step 2: Add `resolveCostCenterAllocationsForMonth` function**

After the `lastDayOfMonth` function (after line 86), add:

```typescript
/**
 * Resolve cost center allocations for a given month from events.
 * Returns the allocations from the most recent active CDC event, or null if none.
 */
export function resolveCostCenterAllocationsForMonth(
  events: AnyEvent[],
  eventAllocations: EventCostCenterAllocation[],
  month: string
): EventCostCenterAllocation[] | null {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  // Filter CDC events active in this month
  const cdcEvents = events.filter((e) => {
    if (e.field !== 'cost_center_allocations') return false;
    if (e.start_date > monthEnd) return false;
    if (e.end_date !== null && e.end_date < monthStart) return false;
    return true;
  });

  if (cdcEvents.length === 0) return null;

  // Most recent start_date wins
  cdcEvents.sort((a, b) => b.start_date.localeCompare(a.start_date));
  const winningEvent = cdcEvents[0];

  // Find allocations for this event
  const eventId = winningEvent.id;
  const allocations = eventAllocations.filter((a) => {
    if ('member_id' in winningEvent) {
      return a.member_event_id === eventId;
    }
    return a.scenario_member_event_id === eventId;
  });

  return allocations.length > 0 ? allocations : null;
}
```

- [ ] **Step 3: Update `parseEventValue` to handle `cost_center_allocations`**

In the `parseEventValue` function (line 91), add a case before the closing:

```typescript
    case 'cost_center_allocations':
      return value; // Not used for CDC events — allocations are in separate table
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/hr/resolve-events.ts
git commit -m "feat: add resolveCostCenterAllocationsForMonth to resolve-events"
```

---

## Task 4: compute.ts — use resolved CDC allocations + new breakdowns

**Files:**
- Modify: `src/lib/hr/compute.ts`

- [ ] **Step 1: Add imports**

At line 1, update the imports to include `EventCostCenterAllocation`:

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
  EventCostCenterAllocation,
} from '@/lib/optimizer/types';
```

At line 18, add the `resolveCostCenterAllocationsForMonth` import:

```typescript
import {
  resolveFieldForMonth,
  isMemberActiveInMonth,
  monthProRataFraction,
  parseEventValue,
  resolveCostCenterAllocationsForMonth,
} from './resolve-events';
```

- [ ] **Step 2: Add `eventAllocations` parameter to `computeMonthlySnapshot`**

Change the function signature at line 207:

```typescript
export function computeMonthlySnapshot(
  members: AnyMember[],
  events: AnyEvent[],
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  eventAllocations: EventCostCenterAllocation[],
  month: string
): MonthlySnapshot {
```

- [ ] **Step 3: Add CDC breakdown tracking variables**

After the existing tracking variables (after `let headcount = 0;` around line 225), add:

```typescript
  const capacityByCostCenter: Record<string, number> = {};
  const fteByCostCenter: Record<string, number> = {};
  const headcountByCostCenter: Record<string, number> = {};
```

- [ ] **Step 4: Replace the CDC allocation logic in the member loop**

Replace the "By cost center" section (around lines 252-260):

```typescript
    // By cost center
    const memberId = detail.memberId;
    const memberAllocations = allocations.filter((a) => a.member_id === memberId);
    if (memberAllocations.length > 0) {
      for (const alloc of memberAllocations) {
        const allocatedCost = detail.monthlyCost * (alloc.percentage / 100);
        personnelCostByCostCenter[alloc.cost_center_id] = (personnelCostByCostCenter[alloc.cost_center_id] || 0) + allocatedCost;
      }
    }
```

with:

```typescript
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
```

- [ ] **Step 5: Add new breakdowns to the return value**

In the return statement (around line 277), add the three new fields:

```typescript
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
```

- [ ] **Step 6: Update `computeYearlyView` signature and pass-through**

Change the function signature at line 292:

```typescript
export function computeYearlyView(
  members: AnyMember[],
  events: AnyEvent[],
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  eventAllocations: EventCostCenterAllocation[],
  year: number
): YearlyView {
```

Update the monthly snapshot call inside the loop (around line 303):

```typescript
    monthlySnapshots.push(computeMonthlySnapshot(members, events, settings, allocations, eventAllocations, month));
```

- [ ] **Step 7: Add CDC breakdown aggregation in `computeYearlyView`**

In the `annualTotals` initialization (around line 307), add:

```typescript
    capacityByCostCenter: {} as Record<string, number>,
    fteByCostCenter: {} as Record<string, number>,
    headcountByCostCenter: {} as Record<string, number>,
```

In the snapshot aggregation loop, after the `personnelCostByCostCenter` aggregation (around line 337), add:

```typescript
    for (const [ccId, cap] of Object.entries(snapshot.capacityByCostCenter)) {
      annualTotals.capacityByCostCenter[ccId] = (annualTotals.capacityByCostCenter[ccId] || 0) + cap;
    }
    for (const [ccId, fte] of Object.entries(snapshot.fteByCostCenter)) {
      annualTotals.fteByCostCenter[ccId] = (annualTotals.fteByCostCenter[ccId] || 0) + fte;
    }
    for (const [ccId, hc] of Object.entries(snapshot.headcountByCostCenter)) {
      annualTotals.headcountByCostCenter[ccId] = (annualTotals.headcountByCostCenter[ccId] || 0) + hc;
    }
```

After the annual FTE/headcount averages (around line 342), average the CDC headcount and FTE:

```typescript
  // Average FTE and headcount by cost center
  for (const ccId of Object.keys(annualTotals.fteByCostCenter)) {
    annualTotals.fteByCostCenter[ccId] /= 12;
  }
  for (const ccId of Object.keys(annualTotals.headcountByCostCenter)) {
    annualTotals.headcountByCostCenter[ccId] = Math.round(annualTotals.headcountByCostCenter[ccId] / 12);
  }
```

- [ ] **Step 8: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors only in `useHRPlanning.ts` (missing param) — fixed in Task 5.

- [ ] **Step 9: Commit**

```bash
git add src/lib/hr/compute.ts
git commit -m "feat: compute CDC breakdowns with event-based allocation resolution"
```

---

## Task 5: useHRPlanning hook — pass eventAllocations

**Files:**
- Modify: `src/hooks/useHRPlanning.ts`

- [ ] **Step 1: Add import and parameter**

Add `EventCostCenterAllocation` to the import at line 3:

```typescript
import {
  Member,
  MemberEvent,
  Settings,
  YearlyView,
  HRScenarioMember,
  ScenarioMemberEvent,
  EventCostCenterAllocation,
} from '@/lib/optimizer/types';
```

Update the function signature at line 34:

```typescript
export function useHRPlanning(
  members: HRPlanningMembers,
  events: HRPlanningEvents,
  settings: Settings | null,
  allocations: CostCenterAllocation[],
  eventAllocations: EventCostCenterAllocation[],
  year: number
) {
```

- [ ] **Step 2: Debounce eventAllocations and pass to compute**

Add debounce at line 44 (after the existing debounce lines):

```typescript
  const debouncedEventAllocations = useDebouncedValue(eventAllocations, 500);
```

Update the `prevInputsRef` at line 48 to include `eventAllocations`:

```typescript
  const prevInputsRef = useRef({ members, events, settings, allocations, eventAllocations, year });
```

Update the change detection effect (line 52) to include `eventAllocations`:

```typescript
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
```

Update the `computeYearlyView` call (around line 71):

```typescript
    const result = computeYearlyView(
      debouncedMembers,
      debouncedEvents,
      debouncedSettings,
      debouncedAllocations,
      debouncedEventAllocations,
      debouncedYear
    );
```

Update the `useMemo` deps array to include `debouncedEventAllocations`.

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in `page.tsx` (missing param) — fixed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHRPlanning.ts
git commit -m "feat: pass eventAllocations through useHRPlanning hook"
```

---

## Task 6: useMemberEvents — fetch and manage event CDC allocations

**Files:**
- Modify: `src/hooks/useMemberEvents.ts`

- [ ] **Step 1: Add type import and state**

Update imports at line 6:

```typescript
import { MemberEvent, MemberEventInput, EventCostCenterAllocation } from '@/lib/optimizer/types';
```

Add state inside the hook (after line 9):

```typescript
  const [eventAllocations, setEventAllocations] = useState<EventCostCenterAllocation[]>([]);
```

- [ ] **Step 2: Fetch event CDC allocations alongside events**

In `fetchEvents` (after the events query, around line 34), add:

```typescript
      // Fetch event cost center allocations for CDC events
      const cdcEventIds = (data || [])
        .filter((e: MemberEvent) => e.field === 'cost_center_allocations')
        .map((e: MemberEvent) => e.id);

      if (cdcEventIds.length > 0) {
        const { data: allocData, error: allocError } = await supabase
          .from('event_cost_center_allocations')
          .select('*')
          .in('member_event_id', cdcEventIds);

        if (allocError) throw allocError;
        setEventAllocations(allocData || []);
      } else {
        setEventAllocations([]);
      }
```

- [ ] **Step 3: Add `addEventWithAllocations` for CDC events**

After the existing `addEvent` function, add:

```typescript
  const addEventWithAllocations = useCallback(async (
    input: MemberEventInput,
    cdcAllocations: { cost_center_id: string; percentage: number }[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create the event with value = '' for CDC type
      const { data, error } = await supabase
        .from('member_events')
        .insert({
          user_id: user.id,
          ...input,
          value: '',
        })
        .select()
        .single();

      if (error) throw error;

      // Insert CDC allocations
      if (cdcAllocations.length > 0) {
        const allocRows = cdcAllocations
          .filter((a) => a.percentage > 0)
          .map((a) => ({
            member_event_id: data.id,
            cost_center_id: a.cost_center_id,
            percentage: a.percentage,
          }));

        if (allocRows.length > 0) {
          const { data: allocData, error: allocError } = await supabase
            .from('event_cost_center_allocations')
            .insert(allocRows)
            .select();

          if (allocError) throw allocError;
          setEventAllocations((prev) => [...prev, ...(allocData || [])]);
        }
      }

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
```

- [ ] **Step 4: Add `updateEventAllocations` for editing CDC events**

```typescript
  const updateEventAllocations = useCallback(async (
    eventId: string,
    cdcAllocations: { cost_center_id: string; percentage: number }[]
  ) => {
    try {
      // Delete existing allocations for this event
      await supabase
        .from('event_cost_center_allocations')
        .delete()
        .eq('member_event_id', eventId);

      // Insert new ones
      const allocRows = cdcAllocations
        .filter((a) => a.percentage > 0)
        .map((a) => ({
          member_event_id: eventId,
          cost_center_id: a.cost_center_id,
          percentage: a.percentage,
        }));

      let newAllocData: EventCostCenterAllocation[] = [];
      if (allocRows.length > 0) {
        const { data, error } = await supabase
          .from('event_cost_center_allocations')
          .insert(allocRows)
          .select();

        if (error) throw error;
        newAllocData = data || [];
      }

      setEventAllocations((prev) => [
        ...prev.filter((a) => a.member_event_id !== eventId),
        ...newAllocData,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update allocations';
      toast.error('Failed to update allocations', { description: message });
      throw err;
    }
  }, []);
```

- [ ] **Step 5: Return new values**

Update the return statement to include:

```typescript
  return {
    events,
    eventAllocations,
    loading,
    error,
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
    refetch: fetchEvents,
  };
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMemberEvents.ts
git commit -m "feat: fetch and manage event CDC allocations in useMemberEvents"
```

---

## Task 7: useHRScenarios — fetch/copy event CDC allocations

**Files:**
- Modify: `src/hooks/useHRScenarios.ts`

- [ ] **Step 1: Add type import and update HRScenarioWithData**

Update imports at line 8:

```typescript
import {
  HRScenario,
  HRScenarioMember,
  HRScenarioMemberInput,
  Member,
  MemberEvent,
  ScenarioMemberEvent,
  ScenarioMemberEventInput,
  EventCostCenterAllocation,
} from '@/lib/optimizer/types';
```

Update `HRScenarioWithData` at line 16:

```typescript
export interface HRScenarioWithData {
  scenario: HRScenario;
  members: HRScenarioMember[];
  events: ScenarioMemberEvent[];
  eventAllocations: EventCostCenterAllocation[];
}
```

- [ ] **Step 2: Update `fetchHRScenarioWithData` to load allocations**

In `fetchHRScenarioWithData` (around line 159), after loading events (around line 188), add:

```typescript
      // Fetch event CDC allocations
      const cdcEventIds = events
        .filter((e: ScenarioMemberEvent) => e.field === 'cost_center_allocations')
        .map((e: ScenarioMemberEvent) => e.id);

      let eventAllocations: EventCostCenterAllocation[] = [];
      if (cdcEventIds.length > 0) {
        const { data: allocData, error: allocError } = await supabase
          .from('event_cost_center_allocations')
          .select('*')
          .in('scenario_member_event_id', cdcEventIds);

        if (allocError) throw allocError;
        eventAllocations = allocData || [];
      }

      return { scenario, members: members || [], events, eventAllocations };
```

- [ ] **Step 3: Update `addHRScenario` to copy CDC allocations**

In `addHRScenario`, after the event copying block (around line 123), add:

```typescript
          // Copy CDC event allocations
          if (eventRows.length > 0) {
            const { data: insertedEvents } = await supabase
              .from('scenario_member_events')
              .select('*')
              .eq('user_id', user.id)
              .in('scenario_member_id', insertedMembers.map((m: HRScenarioMember) => m.id))
              .order('start_date', { ascending: true });

            if (insertedEvents) {
              // Map old catalog event IDs to new scenario event IDs for CDC alloc copying
              const cdcCatalogEvents = catalogEvents.filter((e) => e.field === 'cost_center_allocations');
              if (cdcCatalogEvents.length > 0) {
                const catalogEventIds = cdcCatalogEvents.map((e) => e.id);
                const { data: srcAllocs } = await supabase
                  .from('event_cost_center_allocations')
                  .select('*')
                  .in('member_event_id', catalogEventIds);

                if (srcAllocs && srcAllocs.length > 0) {
                  // Match by member + field + start_date to find corresponding new event
                  for (const cdcEvent of cdcCatalogEvents) {
                    const newMemberId = memberIdMap.get(cdcEvent.member_id);
                    if (!newMemberId) continue;
                    const matchingNewEvent = insertedEvents.find(
                      (e: ScenarioMemberEvent) =>
                        e.scenario_member_id === newMemberId &&
                        e.field === 'cost_center_allocations' &&
                        e.start_date === cdcEvent.start_date
                    );
                    if (!matchingNewEvent) continue;
                    const eventAllocs = srcAllocs.filter((a: EventCostCenterAllocation) => a.member_event_id === cdcEvent.id);
                    if (eventAllocs.length > 0) {
                      await supabase.from('event_cost_center_allocations').insert(
                        eventAllocs.map((a: EventCostCenterAllocation) => ({
                          scenario_member_event_id: matchingNewEvent.id,
                          cost_center_id: a.cost_center_id,
                          percentage: a.percentage,
                        }))
                      );
                    }
                  }
                }
              }
            }
          }
```

- [ ] **Step 4: Update `duplicateHRScenario` to copy CDC allocations**

In `duplicateHRScenario`, after the event copying block (around line 262), add similar logic but using `scenario_member_event_id` instead of `member_event_id`:

```typescript
          // Copy CDC event allocations from source scenario
          if (source.events.length > 0 && source.eventAllocations.length > 0) {
            const { data: insertedEvents } = await supabase
              .from('scenario_member_events')
              .select('*')
              .in('scenario_member_id', insertedMembers.map((m: HRScenarioMember) => m.id))
              .order('start_date', { ascending: true });

            if (insertedEvents) {
              for (const srcEvent of source.events.filter((e) => e.field === 'cost_center_allocations')) {
                const newMemberId = memberIdMap.get(srcEvent.scenario_member_id);
                if (!newMemberId) continue;
                const matchingNewEvent = insertedEvents.find(
                  (e: ScenarioMemberEvent) =>
                    e.scenario_member_id === newMemberId &&
                    e.field === 'cost_center_allocations' &&
                    e.start_date === srcEvent.start_date
                );
                if (!matchingNewEvent) continue;
                const eventAllocs = source.eventAllocations.filter((a) => a.scenario_member_event_id === srcEvent.id);
                if (eventAllocs.length > 0) {
                  await supabase.from('event_cost_center_allocations').insert(
                    eventAllocs.map((a) => ({
                      scenario_member_event_id: matchingNewEvent.id,
                      cost_center_id: a.cost_center_id,
                      percentage: a.percentage,
                    }))
                  );
                }
              }
            }
          }
```

- [ ] **Step 5: Add `addScenarioEventWithAllocations` and `updateScenarioEventAllocations`**

After `addScenarioEvent`:

```typescript
  const addScenarioEventWithAllocations = useCallback(async (
    input: ScenarioMemberEventInput,
    cdcAllocations: { cost_center_id: string; percentage: number }[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('scenario_member_events')
        .insert({ user_id: user.id, ...input, value: '' })
        .select()
        .single();

      if (error) throw error;

      if (cdcAllocations.length > 0) {
        const allocRows = cdcAllocations
          .filter((a) => a.percentage > 0)
          .map((a) => ({
            scenario_member_event_id: data.id,
            cost_center_id: a.cost_center_id,
            percentage: a.percentage,
          }));

        if (allocRows.length > 0) {
          await supabase.from('event_cost_center_allocations').insert(allocRows);
        }
      }

      toast.success('Planned change added to scenario');
      return data as ScenarioMemberEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add event';
      setError(message);
      toast.error('Failed to add planned change', { description: message });
      throw err;
    }
  }, []);

  const updateScenarioEventAllocations = useCallback(async (
    eventId: string,
    cdcAllocations: { cost_center_id: string; percentage: number }[]
  ) => {
    try {
      await supabase
        .from('event_cost_center_allocations')
        .delete()
        .eq('scenario_member_event_id', eventId);

      const allocRows = cdcAllocations
        .filter((a) => a.percentage > 0)
        .map((a) => ({
          scenario_member_event_id: eventId,
          cost_center_id: a.cost_center_id,
          percentage: a.percentage,
        }));

      if (allocRows.length > 0) {
        await supabase.from('event_cost_center_allocations').insert(allocRows);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update allocations';
      toast.error('Failed to update allocations', { description: message });
      throw err;
    }
  }, []);
```

- [ ] **Step 6: Update return to include new functions**

Add to the return:

```typescript
    addScenarioEventWithAllocations,
    updateScenarioEventAllocations,
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useHRScenarios.ts
git commit -m "feat: fetch and copy event CDC allocations in useHRScenarios"
```

---

## Task 8: HREventDialog — CDC allocation mini-table

**Files:**
- Modify: `src/components/hr/HREventDialog.tsx`

- [ ] **Step 1: Add imports and props**

Add to imports at line 22:

```typescript
import { Member, MemberEventField, MemberEventInput, HRScenarioMember, CostCenter, EventCostCenterAllocation } from '@/lib/optimizer/types';
```

Update `HREventDialogProps` to accept cost centers and allocations:

```typescript
interface HREventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: AnyMember[];
  onSave: (input: MemberEventInput, cdcAllocations?: { cost_center_id: string; percentage: number }[]) => Promise<void>;
  editingEvent?: {
    id: string;
    member_id: string;
    field: MemberEventField;
    value: string;
    start_date: string;
    end_date: string | null;
    note: string | null;
  } | null;
  costCenters?: CostCenter[];
  editingEventAllocations?: EventCostCenterAllocation[];
}
```

- [ ] **Step 2: Add CDC allocations option to FIELD_OPTIONS**

Add to the `FIELD_OPTIONS` array:

```typescript
  { value: 'cost_center_allocations' as MemberEventField, label: 'Allocazione Centri di Costo' },
```

- [ ] **Step 3: Add state for CDC allocations**

After existing state (line 77), add:

```typescript
  const [cdcAllocations, setCdcAllocations] = useState<Record<string, number>>({});
```

In the `useEffect` that resets state when editing (around line 80), add CDC allocation initialization:

```typescript
  useEffect(() => {
    if (editingEvent) {
      setMemberId(editingEvent.member_id);
      setField(editingEvent.field);
      setValue(editingEvent.value);
      setStartDate(editingEvent.start_date);
      setEndDate(editingEvent.end_date || '');
      setNote(editingEvent.note || '');
      // Initialize CDC allocations if editing a CDC event
      if (editingEvent.field === 'cost_center_allocations' && editingEventAllocations) {
        const allocMap: Record<string, number> = {};
        for (const a of editingEventAllocations) {
          allocMap[a.cost_center_id] = a.percentage;
        }
        setCdcAllocations(allocMap);
      } else {
        setCdcAllocations({});
      }
    } else {
      setMemberId('');
      setField('salary');
      setValue('');
      setStartDate('');
      setEndDate('');
      setNote('');
      setCdcAllocations({});
    }
    setError(null);
  }, [editingEvent, editingEventAllocations, open]);
```

- [ ] **Step 4: Update handleSave for CDC events**

Replace the `handleSave` function:

```typescript
  const handleSave = async () => {
    setError(null);
    if (!memberId) {
      setError('Select a team member');
      return;
    }
    if (field !== 'cost_center_allocations' && !value.trim()) {
      setError('Value is required');
      return;
    }
    if (field === 'cost_center_allocations') {
      const total = Object.values(cdcAllocations).reduce((s, v) => s + v, 0);
      if (total === 0) {
        setError('At least one cost center must have an allocation');
        return;
      }
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }

    setSaving(true);
    try {
      const allocsArray = field === 'cost_center_allocations'
        ? Object.entries(cdcAllocations).map(([ccId, pct]) => ({ cost_center_id: ccId, percentage: pct }))
        : undefined;

      await onSave(
        {
          member_id: memberId,
          field,
          value: field === 'cost_center_allocations' ? '' : value.trim(),
          start_date: startDate,
          end_date: endDate || null,
          note: note.trim() || null,
        },
        allocsArray
      );
      onOpenChange(false);
    } catch {
      // Error handled by hook toast
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 5: Add CDC allocation mini-table to `renderValueInput`**

Add a new branch at the top of `renderValueInput`:

```typescript
  const renderValueInput = () => {
    if (field === 'cost_center_allocations') {
      const centers = costCenters ?? [];
      if (centers.length === 0) {
        return <p className="text-sm text-muted-foreground">No cost centers configured. Add cost centers first.</p>;
      }
      const total = Object.values(cdcAllocations).reduce((s, v) => s + v, 0);
      return (
        <div className="space-y-2">
          {centers.map((cc) => (
            <div key={cc.id} className="flex items-center gap-3">
              <span className="text-sm min-w-[120px]">{cc.code} - {cc.name}</span>
              <Input
                type="number"
                className="w-[100px]"
                value={cdcAllocations[cc.id] ?? 0}
                onChange={(e) => setCdcAllocations((prev) => ({
                  ...prev,
                  [cc.id]: parseFloat(e.target.value) || 0,
                }))}
                min={0}
                max={100}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          ))}
          <div className={cn(
            'text-sm font-medium pt-1 border-t',
            Math.abs(total - 100) > 0.01 ? 'text-yellow-500' : 'text-muted-foreground'
          )}>
            Total: {total.toFixed(0)}%
            {Math.abs(total - 100) > 0.01 && ' (expected 100%)'}
          </div>
        </div>
      );
    }
    if (field === 'seniority') {
      // ... existing code
```

Add `cn` to the import from `@/lib/utils` if not already imported, or from `@/components/ui`.

- [ ] **Step 6: Commit**

```bash
git add src/components/hr/HREventDialog.tsx
git commit -m "feat: add CDC allocation mini-table to HREventDialog"
```

---

## Task 9: HREventList — display CDC allocation events

**Files:**
- Modify: `src/components/hr/HREventList.tsx`

- [ ] **Step 1: Update FIELD_LABELS and formatEventValue**

Add to `FIELD_LABELS`:

```typescript
  cost_center_allocations: 'Alloc. CdC',
```

Update `formatEventValue` to handle the new field:

```typescript
    case 'cost_center_allocations':
      return 'Cambio allocazione';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/hr/HREventList.tsx
git commit -m "feat: display CDC allocation events in HREventList"
```

---

## Task 10: Workforce columns — contract status badges

**Files:**
- Modify: `src/components/workforce/columns.tsx`

- [ ] **Step 1: Add Badge import**

Add to imports:

```typescript
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
```

- [ ] **Step 2: Add contract status badge to the `last_name` column**

Replace the `last_name` column definition:

```typescript
  {
    accessorKey: 'last_name',
    header: 'Last Name',
    cell: ({ row }) => {
      const member = row.original;
      const today = new Date().toISOString().split('T')[0];
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      const sixMonthsStr = sixMonths.toISOString().split('T')[0];

      let badge: { label: string; className: string } | null = null;

      if (member.contract_end_date && member.contract_end_date <= today) {
        badge = { label: 'Terminato', className: 'bg-muted text-muted-foreground' };
      } else if (member.contract_start_date && member.contract_start_date > today) {
        badge = { label: 'Da assumere', className: 'bg-blue-500/15 text-blue-500 border-blue-500/20' };
      } else if (member.contract_end_date && member.contract_end_date <= sixMonthsStr) {
        badge = { label: 'In uscita', className: 'bg-orange-500/15 text-orange-500 border-orange-500/20' };
      }

      return (
        <div className={cn('flex items-center gap-2 font-medium', member.contract_end_date && member.contract_end_date <= today && 'opacity-50')}>
          {row.getValue('last_name')}
          {badge && <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', badge.className)}>{badge.label}</Badge>}
        </div>
      );
    },
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/columns.tsx
git commit -m "feat: add contract status badges to workforce table"
```

---

## Task 11: MemberList — add contract dates to edit form

**Files:**
- Modify: `src/components/workforce/MemberList.tsx`

- [ ] **Step 1: Update formData initialization to include contract dates**

In the `useEffect` that populates the edit form (around line 63), update:

```typescript
  useEffect(() => {
    if (editingMember) {
      setFormData({
        first_name: editingMember.first_name,
        last_name: editingMember.last_name,
        category: editingMember.category,
        seniority: editingMember.seniority,
        salary: editingMember.salary,
        chargeable_days: editingMember.chargeable_days ?? null,
        ft_percentage: editingMember.ft_percentage ?? 100,
        contract_start_date: editingMember.contract_start_date ?? null,
        contract_end_date: editingMember.contract_end_date ?? null,
      });
      setError(null);
    }
  }, [editingMember]);
```

- [ ] **Step 2: Add date fields to the edit dialog form**

After the Salary field in the edit dialog (after the closing `</div>` of the Salary block, around line 235), add:

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

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/MemberList.tsx
git commit -m "feat: add contract date fields to member edit form"
```

---

## Task 12: HR Planning page — wire CDC filter + eventAllocations

**Files:**
- Modify: `src/app/dashboard/hr-planning/page.tsx`
- Modify: `src/components/hr/HRKPICards.tsx`
- Modify: `src/components/hr/HRYearlyTable.tsx`
- Modify: `src/components/hr/HRComparisonView.tsx`

- [ ] **Step 1: Add CDC filter state and import costCenters in page.tsx**

In `page.tsx`, update the `useCostCenters` destructuring (line 41) to also get `costCenters`:

```typescript
  const { costCenters, allocations, loading: costCentersLoading } = useCostCenters();
```

Add CDC filter state after `tab` state (around line 33):

```typescript
  const [cdcFilter, setCdcFilter] = useState<string | null>(null);
```

Import `EventCostCenterAllocation`:

```typescript
import { Member, MemberEvent, MemberEventInput, HRScenarioMember, ScenarioMemberEvent, EventCostCenterAllocation } from '@/lib/optimizer/types';
```

- [ ] **Step 2: Wire eventAllocations from useMemberEvents**

Update the `useMemberEvents` destructuring (line 41):

```typescript
  const { events: catalogEvents, eventAllocations: catalogEventAllocations, addEvent, addEventWithAllocations, updateEvent, updateEventAllocations, deleteEvent, loading: eventsLoading } = useMemberEvents();
```

Add scenario eventAllocations tracking in scenarioData:

```typescript
  const activeEventAllocations: EventCostCenterAllocation[] = source === 'catalog'
    ? catalogEventAllocations
    : (scenarioData?.eventAllocations ?? []);
```

Pass `eventAllocations` to `useHRPlanning`:

```typescript
  const { yearlyView, isCalculating } = useHRPlanning(
    activeMembers,
    activeEvents,
    settings,
    allocations,
    activeEventAllocations,
    year
  );
```

Do the same for the compare computation:

```typescript
  const compareEventAllocations: EventCostCenterAllocation[] = compareSource === 'catalog'
    ? catalogEventAllocations
    : (compareData?.eventAllocations ?? []);

  const { yearlyView: compareYearlyView } = useHRPlanning(
    compareMembers,
    compareEvents,
    settings,
    allocations,
    compareEventAllocations,
    year
  );
```

- [ ] **Step 3: Update handleSaveEvent for CDC events**

Replace the existing `handleSaveEvent` to support CDC allocations:

```typescript
  const handleSaveEvent = async (input: MemberEventInput, cdcAllocations?: { cost_center_id: string; percentage: number }[]) => {
    if (source === 'catalog') {
      if (editingEvent) {
        await updateEvent(editingEvent.id, input);
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await updateEventAllocations(editingEvent.id, cdcAllocations);
        }
      } else {
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addEventWithAllocations(input, cdcAllocations);
        } else {
          await addEvent(input);
        }
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
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await updateScenarioEventAllocations(editingEvent.id, cdcAllocations);
        }
      } else {
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addScenarioEventWithAllocations({
            scenario_member_id: input.member_id,
            field: input.field,
            value: '',
            start_date: input.start_date,
            end_date: input.end_date,
            note: input.note,
          }, cdcAllocations);
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
      }
      const refreshed = await fetchHRScenarioWithData(source);
      setScenarioData(refreshed);
    }
    setEditingEvent(null);
  };
```

Update the `useHRScenarios` destructuring to include the new functions:

```typescript
  const {
    hrScenarios,
    addHRScenario,
    deleteHRScenario,
    duplicateHRScenario,
    fetchHRScenarioWithData,
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEvent,
    updateScenarioEventAllocations,
    deleteScenarioEvent,
  } = useHRScenarios();
```

- [ ] **Step 4: Add CDC filter Select to the header**

In the header `div` (around line 172), add a CDC filter `Select` after the year selector:

```typescript
          <Select value={cdcFilter ?? 'all'} onValueChange={(v) => setCdcFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All cost centers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i centri di costo</SelectItem>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
```

- [ ] **Step 5: Pass costCenterId to child components**

Update `HRKPICards`:

```typescript
      <HRKPICards yearlyView={yearlyView} loading={loading || isCalculating} costCenterId={cdcFilter} />
```

Update `HRYearlyTable`:

```typescript
              <HRYearlyTable yearlyView={yearlyView} loading={loading || isCalculating} costCenterId={cdcFilter} />
```

Update `HRComparisonView`:

```typescript
            <HRComparisonView
              baseView={yearlyView}
              compareView={compareYearlyView}
              baseLabel={source === 'catalog' ? 'Catalogo' : (hrScenarios.find((s) => s.id === source)?.name ?? 'Scenario')}
              compareLabel={compareSource === 'catalog' ? 'Catalogo' : (hrScenarios.find((s) => s.id === compareSource)?.name ?? 'Scenario')}
              costCenterId={cdcFilter}
            />
```

Pass `costCenters` and `editingEventAllocations` to `HREventDialog`:

```typescript
      <HREventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        members={activeMembers}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? activeEventAllocations.filter((a) =>
                'member_id' in editingEvent
                  ? a.member_event_id === editingEvent.id
                  : a.scenario_member_event_id === editingEvent.id
              )
            : undefined
        }
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
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/hr-planning/page.tsx
git commit -m "feat: wire CDC filter and eventAllocations in HR Planning page"
```

---

## Task 13: HRKPICards — support costCenterId filter

**Files:**
- Modify: `src/components/hr/HRKPICards.tsx`

- [ ] **Step 1: Add costCenterId prop**

Update the interface:

```typescript
interface HRKPICardsProps {
  yearlyView: YearlyView | null;
  loading?: boolean;
  costCenterId?: string | null;
}
```

Update the function signature:

```typescript
export function HRKPICards({ yearlyView, loading, costCenterId }: HRKPICardsProps) {
```

- [ ] **Step 2: Filter KPI values when a CDC is selected**

After `const { annualTotals } = yearlyView;` (line 43), add:

```typescript
  const filtered = costCenterId ? {
    totalCompanyCost: annualTotals.personnelCostByCostCenter[costCenterId] ?? 0,
    productiveCapacity: annualTotals.capacityByCostCenter[costCenterId] ?? 0,
    fte: annualTotals.fteByCostCenter[costCenterId] ?? 0,
    headcount: annualTotals.headcountByCostCenter[costCenterId] ?? 0,
  } : {
    totalCompanyCost: annualTotals.totalCompanyCost,
    productiveCapacity: annualTotals.productiveCapacity,
    fte: annualTotals.fte,
    headcount: annualTotals.headcount,
  };
```

Update the cards array to use `filtered` values instead of `annualTotals`:

```typescript
  const cards = [
    {
      label: 'Costo Azienda',
      value: formatCurrency(filtered.totalCompanyCost),
      subtitle: 'Totale annuo',
    },
    {
      label: 'Costo Personale',
      value: formatCurrency(filtered.totalCompanyCost),
      subtitle: 'Per seniority',
      tooltip: costCenterId ? undefined : seniorityDetail,
    },
    {
      label: 'Capacita Produttiva',
      value: `${Math.round(filtered.productiveCapacity).toLocaleString('it-IT')} gg`,
      subtitle: 'Giorni totali',
    },
    {
      label: 'FTE',
      value: filtered.fte.toFixed(1),
      subtitle: 'Full-time equivalent',
    },
    {
      label: 'Headcount',
      value: Math.round(filtered.headcount).toString(),
      subtitle: 'Membri attivi',
    },
    {
      label: 'Costo Orario Medio',
      value: costCenterId
        ? '-'
        : formatCurrency(
            Object.values(annualTotals.avgHourlyCostBySeniority).reduce((sum, v) => sum + v, 0) /
            Object.values(annualTotals.avgHourlyCostBySeniority).filter((v) => v > 0).length || 0
          ) + '/h',
      subtitle: 'Media ponderata',
    },
  ];
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HRKPICards.tsx
git commit -m "feat: support CDC filter in HRKPICards"
```

---

## Task 14: HRYearlyTable — support costCenterId filter

**Files:**
- Modify: `src/components/hr/HRYearlyTable.tsx`

- [ ] **Step 1: Add costCenterId prop**

Update the interface:

```typescript
interface HRYearlyTableProps {
  yearlyView: YearlyView | null;
  loading?: boolean;
  onMemberClick?: (memberId: string) => void;
  costCenterId?: string | null;
}
```

Update the function signature:

```typescript
export function HRYearlyTable({ yearlyView, loading, onMemberClick, costCenterId }: HRYearlyTableProps) {
```

- [ ] **Step 2: Filter month total values by CDC**

Update `getMonthTotal` to filter by CDC:

```typescript
  const getMonthTotal = (monthIndex: number): number => {
    const snapshot = monthlySnapshots[monthIndex];
    if (costCenterId) {
      switch (metric) {
        case 'cost': return snapshot.personnelCostByCostCenter[costCenterId] ?? 0;
        case 'capacity': return snapshot.capacityByCostCenter[costCenterId] ?? 0;
        case 'fte': return snapshot.fteByCostCenter[costCenterId] ?? 0;
      }
    }
    switch (metric) {
      case 'cost': return snapshot.totalCompanyCost;
      case 'capacity': return snapshot.productiveCapacity;
      case 'fte': return snapshot.fte;
    }
  };
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hr/HRYearlyTable.tsx
git commit -m "feat: support CDC filter in HRYearlyTable"
```

---

## Task 15: HRComparisonView — support costCenterId filter

**Files:**
- Modify: `src/components/hr/HRComparisonView.tsx`

- [ ] **Step 1: Add costCenterId prop**

Update the interface:

```typescript
interface HRComparisonViewProps {
  baseView: YearlyView;
  compareView: YearlyView;
  baseLabel: string;
  compareLabel: string;
  costCenterId?: string | null;
}
```

Update the function signature:

```typescript
export function HRComparisonView({ baseView, compareView, baseLabel, compareLabel, costCenterId }: HRComparisonViewProps) {
```

- [ ] **Step 2: Filter comparison values by CDC**

Replace the `rows` definition:

```typescript
  const getValues = (view: YearlyView) => {
    if (costCenterId) {
      return {
        cost: view.annualTotals.personnelCostByCostCenter[costCenterId] ?? 0,
        capacity: view.annualTotals.capacityByCostCenter[costCenterId] ?? 0,
        fte: view.annualTotals.fteByCostCenter[costCenterId] ?? 0,
        headcount: view.annualTotals.headcountByCostCenter[costCenterId] ?? 0,
      };
    }
    return {
      cost: view.annualTotals.totalCompanyCost,
      capacity: view.annualTotals.productiveCapacity,
      fte: view.annualTotals.fte,
      headcount: view.annualTotals.headcount,
    };
  };

  const baseVals = getValues(baseView);
  const compareVals = getValues(compareView);

  const rows: ComparisonRow[] = [
    { label: 'Costo Azienda', baseValue: baseVals.cost, compareValue: compareVals.cost, format: 'currency' },
    { label: 'Capacita Produttiva', baseValue: baseVals.capacity, compareValue: compareVals.capacity, format: 'days' },
    { label: 'FTE', baseValue: baseVals.fte, compareValue: compareVals.fte, format: 'decimal' },
    { label: 'Headcount', baseValue: baseVals.headcount, compareValue: compareVals.headcount, format: 'number' },
  ];
```

- [ ] **Step 3: Filter monthly comparison by CDC**

In the monthly comparison table, update the cell values:

```typescript
            {baseView.monthlySnapshots.map((baseSnap, i) => {
              const compareSnap = compareView.monthlySnapshots[i];
              const monthName = new Date(2026, i, 1).toLocaleDateString('it-IT', { month: 'long' });
              const baseCost = costCenterId
                ? (baseSnap.personnelCostByCostCenter[costCenterId] ?? 0)
                : baseSnap.totalCompanyCost;
              const compareCost = costCenterId
                ? (compareSnap.personnelCostByCostCenter[costCenterId] ?? 0)
                : compareSnap.totalCompanyCost;
              return (
                <tr key={i} className="border-b">
                  <td className="sticky left-0 bg-background px-3 py-2 font-medium capitalize">{monthName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(baseCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(compareCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <DeltaIndicator base={baseCost} compare={compareCost} format="currency" />
                  </td>
                </tr>
              );
            })}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/hr/HRComparisonView.tsx
git commit -m "feat: support CDC filter in HRComparisonView"
```

---

## Task 16: Final verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 4: Manual verification checklist**

Verify in browser:
- [ ] Workforce page: badges appear on members with contract dates
- [ ] Workforce page: edit form shows contract date fields
- [ ] HR Planning: event dialog shows "Allocazione Centri di Costo" option
- [ ] HR Planning: selecting it shows CDC mini-table
- [ ] HR Planning: CDC filter dropdown appears in header
- [ ] HR Planning: KPI cards filter by selected CDC
- [ ] HR Planning: yearly table totals filter by selected CDC
- [ ] HR Planning: comparison view filters by selected CDC
- [ ] HR Planning: creating a scenario copies CDC event allocations
- [ ] HR Planning: duplicating a scenario copies CDC event allocations

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address verification issues"
```
