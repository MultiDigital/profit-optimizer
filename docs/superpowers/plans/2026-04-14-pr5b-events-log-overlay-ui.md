# PR 5b — Events Log + Employee Overlay + Scenario-Aware Authoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the spec's PR 5 by landing all the UI surface changes that build on PR 5a's delta schema. Rebuild `/hr-planning` as a cross-employee "Planned Changes" events log. Rename sidebar label. Make the employee detail page (`/workforce/[id]`) scenario-aware — writes route to the correct table, and when a scenario is active a second "Scenario overlay" panel appears under the canonical timeline. Add `hr_scenario_id` to `scenario_member_events` to eliminate PR 5a's cross-scenario leakage workaround.

**Architecture:** Events log reads the global `ViewContext` scenario picker and renders a flat chronological list from the active `ResolvedScenarioBundle`'s canonical + scenario events. Employee page uses `useViewContext().scenarioId` to decide where to write (baseline → `member_events`; scenario → `scenario_member_events` with `member_id` set + `hr_scenario_id` set). The new `hr_scenario_id` column eliminates the "fetch all canonical overrides" workaround in `useHRScenarios`.

**Tech Stack:** Same as PR 5a — Supabase migration + React components + resolver hooks.

**Parent spec:** `docs/superpowers/specs/2026-04-14-employee-page-and-timeline-resolver-design.md` § "/hr-planning repurposed" and § "Scenario delta semantics > UX touchpoints"

**Stacking:** branches from `feature/pr5-events-log-scenario-delta` (PR 5a).

---

## File Structure

New files:
- `supabase/migrations/YYYYMMDDHHMMSS_scenario_events_scope.sql` — add `hr_scenario_id` column + backfill
- `src/components/hr/EventsLogList.tsx` — chronological cross-employee events list (new component)
- `src/components/workforce/ScenarioOverlayPanel.tsx` — scenario overrides panel for employee detail page

Modified files:
- `src/lib/optimizer/types.ts` — `ScenarioMemberEvent.hr_scenario_id: string`, `ScenarioMemberEventInput.hr_scenario_id: string`
- `src/components/AppSidebar.tsx` — rename "HR Planning" label to "Planned Changes"
- `src/hooks/useHRScenarios.ts` — `addScenarioEvent*`/`updateScenarioEvent` write `hr_scenario_id`; `fetchHRScenarioWithData` scopes by `hr_scenario_id` (drops the `.not('member_id', 'is', null)` workaround); `duplicateHRScenario` duplicates canonical-override events too
- `src/app/dashboard/hr-planning/page.tsx` — wholesale rebuild as events log
- `src/app/dashboard/workforce/[id]/page.tsx` — scenario-aware authoring + overlay panel
- `src/components/hr/HREventList.tsx` — accept optional `scenarioBadge` prop to render "scenario" badge on scenario-sourced events

Files NOT touched:
- `src/components/hr/HRScenarioSelector.tsx`, `HRComparisonView.tsx`, `HRYearlyTable.tsx`, `HRScenarioKPIs.tsx`, `HRKPICards.tsx` — stay as-is (used by `/workforce-analytics`). The selector is decoupled from `/hr-planning` entirely.
- `src/app/dashboard/workforce-analytics/page.tsx` — PR 4 + PR 5a already migrated; no more changes.
- `src/app/dashboard/cost-centers/page.tsx` — no changes.

---

## Task 1: Add `hr_scenario_id` to `scenario_member_events`

**File:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_scenario_events_scope.sql`

Use a timestamp after PR 5a's `20260414130000` (e.g., `20260414140000_scenario_events_scope.sql`).

### Migration content

```sql
-- PR 5b — scope scenario events to their scenario server-side.
-- Today we infer which scenario an event belongs to via scenario_member_id
-- (joins to hr_scenario_members.hr_scenario_id) OR, for canonical-override
-- events created by PR 5a's data migration, we can't infer at all (the
-- source hr_scenario_members rows were deleted). Adding the column makes
-- scoping explicit and eliminates the `.not('member_id', 'is', null)`
-- fetch workaround in useHRScenarios.

BEGIN;

-- 1. Add hr_scenario_id column (nullable for the backfill; tightened at the end)
ALTER TABLE scenario_member_events
  ADD COLUMN IF NOT EXISTS hr_scenario_id UUID REFERENCES hr_scenarios(id) ON DELETE CASCADE;

-- 2. Backfill via scenario_member_id join (works for all synthetic-scoped events)
UPDATE scenario_member_events sme
SET hr_scenario_id = sm.hr_scenario_id
FROM hr_scenario_members sm
WHERE sme.scenario_member_id = sm.id
  AND sme.hr_scenario_id IS NULL;

-- 3. Orphan cleanup: events with member_id set (canonical overrides from PR 5a
-- migration) have no preserved hr_scenario_id. If there's exactly one scenario
-- for the user, auto-attribute; otherwise leave NULL and we'll delete them.
-- Rationale: these are "scenario-less" overrides, which has no meaning in the
-- delta model — they'd apply to all scenarios uniformly, which equals never.
UPDATE scenario_member_events sme
SET hr_scenario_id = (
  SELECT id FROM hr_scenarios hs
  WHERE hs.user_id = sme.user_id
  LIMIT 1
)
WHERE sme.hr_scenario_id IS NULL
  AND sme.member_id IS NOT NULL
  AND (SELECT COUNT(*) FROM hr_scenarios hs WHERE hs.user_id = sme.user_id) = 1;

-- 4. Delete any remaining NULL-hr_scenario_id events (multi-scenario users with
-- untraceable PR 5a canonical-override orphans). Cascade removes their CDC
-- sidecar rows automatically.
DELETE FROM scenario_member_events WHERE hr_scenario_id IS NULL;

-- 5. Tighten: hr_scenario_id is now NOT NULL
ALTER TABLE scenario_member_events
  ALTER COLUMN hr_scenario_id SET NOT NULL;

-- 6. Index for per-scenario lookups
CREATE INDEX IF NOT EXISTS idx_scenario_member_events_hr_scenario_id
  ON scenario_member_events(hr_scenario_id);

COMMIT;
```

### Steps

- [ ] **Step 1:** Create the migration file with the timestamped name and the SQL above. Do not run it (user applies at their own cadence).

- [ ] **Step 2:** Commit

```bash
git add supabase/migrations/*scenario_events_scope.sql
git commit -m "feat(db): add hr_scenario_id to scenario_member_events + backfill"
```

---

## Task 2: Update `ScenarioMemberEvent` type + write path

**File:**
- Modify: `src/lib/optimizer/types.ts`
- Modify: `src/hooks/useHRScenarios.ts`

### Step 1: Add `hr_scenario_id` to the types

In `src/lib/optimizer/types.ts`, update both interfaces:

`ScenarioMemberEvent`:
```ts
export interface ScenarioMemberEvent {
  id: string;
  user_id: string;
  hr_scenario_id: string; // NEW — scopes the event to a scenario
  scenario_member_id: string | null;
  member_id: string | null;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date: string | null;
  note: string | null;
  created_at: string;
}
```

`ScenarioMemberEventInput`:
```ts
export interface ScenarioMemberEventInput {
  hr_scenario_id: string; // NEW — caller must provide
  scenario_member_id?: string | null;
  member_id?: string | null;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date?: string | null;
  note?: string | null;
}
```

### Step 2: Update write functions in `useHRScenarios.ts`

Find the functions that insert into `scenario_member_events` — likely `addScenarioEvent`, `addScenarioEventWithAllocations`, `updateScenarioEvent`. These already accept `ScenarioMemberEventInput` (or similar). Ensure the `hr_scenario_id` from the input flows into the insert rows.

Example change for `addScenarioEvent`:

```ts
const addScenarioEvent = useCallback(async (input: ScenarioMemberEventInput) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('scenario_member_events')
      .insert({
        user_id: user.id,
        hr_scenario_id: input.hr_scenario_id,  // NEW
        scenario_member_id: input.scenario_member_id ?? null,
        member_id: input.member_id ?? null,
        field: input.field,
        value: input.value,
        start_date: input.start_date,
        end_date: input.end_date ?? null,
        note: input.note ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    toast.success('Scenario change added');
    return data;
  } catch (err) {
    // ... existing error handling
  }
}, []);
```

Apply the same `hr_scenario_id: input.hr_scenario_id` addition to `addScenarioEventWithAllocations`. `updateScenarioEvent` doesn't need to set `hr_scenario_id` (it doesn't move scenarios — updates are scoped to a specific event id).

### Step 3: Update fetch to scope by `hr_scenario_id`

In `fetchHRScenarioWithData`, find the event-fetching block added in PR 5a (the `Promise.all` with synthetic events + canonical overrides). Replace with a single query scoped by `hr_scenario_id`:

```ts
const { data: eventData, error: eventsError } = await supabase
  .from('scenario_member_events')
  .select('*')
  .eq('hr_scenario_id', scenarioId)
  .order('start_date', { ascending: true });

if (eventsError) throw eventsError;
const events: ScenarioMemberEvent[] = eventData || [];
```

Delete the old `Promise.all`/merge logic. This simplifies back to a single query and eliminates the cross-scenario leakage entirely.

### Step 4: Update `duplicateHRScenario` to duplicate canonical-override events

In `useHRScenarios.ts`, find `duplicateHRScenario`. Currently it only duplicates events with `scenario_member_id !== null`. Update it to ALSO duplicate events with `member_id !== null` (canonical overrides). Since canonical member IDs are shared across scenarios, duplicate canonical overrides verbatim (same `member_id`, new `hr_scenario_id` pointing to the new scenario).

Find the event-copying block in `duplicateHRScenario`. Alongside the synthetic event copy, add a canonical-override copy:

```ts
// Copy canonical-override events: same member_id, new hr_scenario_id
const canonicalOverrides = events.filter((e: ScenarioMemberEvent) => e.member_id !== null);
if (canonicalOverrides.length > 0) {
  const overrideRows = canonicalOverrides.map((e: ScenarioMemberEvent) => ({
    user_id: user.id,
    hr_scenario_id: newScenario.id,
    member_id: e.member_id,
    scenario_member_id: null,
    field: e.field,
    value: e.value,
    start_date: e.start_date,
    end_date: e.end_date,
    note: e.note,
  }));
  const { error: overrideError } = await supabase
    .from('scenario_member_events')
    .insert(overrideRows);
  if (overrideError) throw overrideError;
  // Note: CDC sidecar rows for canonical overrides are NOT duplicated here.
  // Follow the existing pattern — if the synthetic-event duplication copies
  // CDC rows, replicate that for canonical overrides; otherwise leave out
  // and note it as a known limitation.
}
```

If the existing synthetic-event duplication copies CDC sidecars, add analogous code for canonical overrides. If not, leave a `// TODO` comment.

### Step 5: Verify

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

All clean. Tests: 66.

### Step 6: Commit

```bash
git add src/lib/optimizer/types.ts src/hooks/useHRScenarios.ts
git commit -m "feat(scenarios): scope scenario events by hr_scenario_id server-side"
```

---

## Task 3: Rename sidebar label

**File:**
- Modify: `src/components/AppSidebar.tsx`

### Step 1: Find the nav item for `/dashboard/hr-planning`

```ts
{ href: '/dashboard/hr-planning', icon: CalendarClock, label: 'HR Planning' },
```

### Step 2: Rename `label`

```ts
{ href: '/dashboard/hr-planning', icon: CalendarClock, label: 'Planned Changes' },
```

### Step 3: Commit

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat(shell): rename sidebar 'HR Planning' -> 'Planned Changes'"
```

---

## Task 4: Build the cross-employee events log — `EventsLogList` component

**File:**
- Create: `src/components/hr/EventsLogList.tsx`

Chronological list of all events across all employees. Supports filtering by employee, field, and time window. Shows a "scenario" badge on scenario-sourced events.

### Step 1: Create the component

```tsx
'use client';

import { useMemo } from 'react';
import {
  MemberEvent,
  ScenarioMemberEvent,
  MemberEventField,
  Member,
  HRScenarioMember,
} from '@/lib/optimizer/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

type AnyEvent = MemberEvent | ScenarioMemberEvent;

interface EventsLogListProps {
  canonicalEvents: MemberEvent[];
  scenarioEvents: ScenarioMemberEvent[];
  canonicalMembers: Member[];
  syntheticMembers: HRScenarioMember[];
  employeeFilter: string | null; // member_id or scenario_member_id; null = all
  fieldFilter: MemberEventField | null; // null = all
  windowFilter: 'all' | '3m' | '12m'; // all-time / next 3 months / next 12 months
  onEdit: (event: AnyEvent) => void;
  onDelete: (event: AnyEvent) => void;
}

const FIELD_LABELS: Record<MemberEventField, string> = {
  salary: 'Stipendio',
  ft_percentage: 'FT%',
  seniority: 'Seniority',
  category: 'Categoria',
  capacity_percentage: 'Capacity %',
  chargeable_days: 'Giorni fatturabili',
  cost_center_allocations: 'Alloc. CdC',
};

function formatEventValue(field: MemberEventField, value: string): string {
  switch (field) {
    case 'salary': return formatCurrency(parseFloat(value));
    case 'ft_percentage':
    case 'capacity_percentage':
      return `${value}%`;
    case 'chargeable_days': return `${value} gg`;
    case 'seniority':
      return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');
    case 'category':
      return value.charAt(0).toUpperCase() + value.slice(1);
    case 'cost_center_allocations':
      return 'Cambio allocazione';
  }
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function EventsLogList({
  canonicalEvents,
  scenarioEvents,
  canonicalMembers,
  syntheticMembers,
  employeeFilter,
  fieldFilter,
  windowFilter,
  onEdit,
  onDelete,
}: EventsLogListProps) {
  const today = new Date().toISOString().slice(0, 10);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of canonicalMembers) {
      map.set(m.id, `${m.first_name} ${m.last_name}`);
    }
    for (const s of syntheticMembers) {
      map.set(s.id, `${s.first_name} ${s.last_name}`);
    }
    return map;
  }, [canonicalMembers, syntheticMembers]);

  const windowEnd = useMemo(() => {
    if (windowFilter === '3m') return addDays(today, 90);
    if (windowFilter === '12m') return addDays(today, 365);
    return null;
  }, [windowFilter, today]);

  // Unified, filtered, chronologically sorted list
  const rows = useMemo(() => {
    type Row = {
      event: AnyEvent;
      source: 'canonical' | 'scenario';
      memberName: string;
      memberId: string; // for go-to-employee link (canonical events always; scenario events use member_id if set)
    };
    const all: Row[] = [];

    for (const e of canonicalEvents) {
      all.push({
        event: e,
        source: 'canonical',
        memberName: memberNameById.get(e.member_id) ?? '—',
        memberId: e.member_id,
      });
    }
    for (const e of scenarioEvents) {
      const targetId = e.member_id ?? e.scenario_member_id ?? '';
      all.push({
        event: e,
        source: 'scenario',
        memberName: memberNameById.get(targetId) ?? '—',
        memberId: targetId,
      });
    }

    // Filter
    const filtered = all.filter((row) => {
      if (employeeFilter && row.memberId !== employeeFilter) return false;
      if (fieldFilter && row.event.field !== fieldFilter) return false;
      if (windowEnd) {
        if (row.event.start_date <= today) return false;
        if (row.event.start_date > windowEnd) return false;
      }
      return true;
    });

    // Chronological: earliest first
    filtered.sort((a, b) => a.event.start_date.localeCompare(b.event.start_date));
    return filtered;
  }, [canonicalEvents, scenarioEvents, memberNameById, employeeFilter, fieldFilter, windowEnd, today]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No planned changes match the current filters.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map(({ event, source, memberName, memberId }) => (
        <div
          key={event.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
              {formatDate(event.start_date)}
            </span>
            <Link
              href={`/dashboard/workforce/${memberId}`}
              className="font-medium hover:underline whitespace-nowrap"
            >
              {memberName}
            </Link>
            <Badge variant="outline" className="text-[10px]">{FIELD_LABELS[event.field]}</Badge>
            <span className="truncate">{formatEventValue(event.field, event.value)}</span>
            {source === 'scenario' && (
              <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-500 border-purple-500/20">
                scenario
              </Badge>
            )}
            {event.note && (
              <span className="text-muted-foreground italic truncate">{event.note}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/dashboard/workforce/${memberId}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Go to employee">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(event)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onDelete(event)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Step 2: Verify

```bash
npx tsc --noEmit && npm run lint
```

Clean.

### Step 3: Commit

```bash
git add src/components/hr/EventsLogList.tsx
git commit -m "feat(hr): add EventsLogList component for cross-employee chronological view"
```

---

## Task 5: Rebuild `/hr-planning` as the Planned Changes events log

**File:**
- Modify: `src/app/dashboard/hr-planning/page.tsx`

This replaces the existing page content wholesale. The new page:
- Reads the GLOBAL `ViewContext` scenario picker (not a local source state)
- Renders `EventsLogList` with filters for employee, field, time window
- "+ Add Change" opens the existing `HREventDialog` with no pre-selected member
- Edit/delete actions route to the correct table based on the event's source
- No yearly table, no compare tab, no scenario management UI

### Step 1: Replace the page

Replace the ENTIRE content of `src/app/dashboard/hr-planning/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios } from '@/hooks/useHRScenarios';
import { EventsLogList } from '@/components/hr/EventsLogList';
import { HREventDialog } from '@/components/hr/HREventDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge, Skeleton } from '@/components/ui';
import { Plus } from 'lucide-react';
import {
  MemberEvent,
  MemberEventInput,
  MemberEventField,
  ScenarioMemberEvent,
} from '@/lib/optimizer/types';

const FIELD_OPTIONS: { value: MemberEventField | 'all'; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'salary', label: 'Stipendio' },
  { value: 'ft_percentage', label: 'FT%' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'category', label: 'Categoria' },
  { value: 'capacity_percentage', label: 'Capacity %' },
  { value: 'chargeable_days', label: 'Giorni fatturabili' },
  { value: 'cost_center_allocations', label: 'Alloc. CdC' },
];

export default function PlannedChangesPage() {
  const { scenarioId } = useViewContext();
  const { bundle, loading: bundleLoading, refetch: refetchActive } = useResolvedScenario();
  const { costCenters } = useCostCenters();
  const {
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
  } = useMemberEvents();
  const {
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEvent,
    updateScenarioEventAllocations,
    deleteScenarioEvent,
  } = useHRScenarios();

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState<MemberEventField | null>(null);
  const [windowFilter, setWindowFilter] = useState<'all' | '3m' | '12m'>('12m');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | ScenarioMemberEvent | null>(null);

  const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];

  const handleSaveEvent = async (
    input: MemberEventInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    const isScenario = scenarioId !== 'baseline';
    // Which pool does the selected member belong to?
    const isSynthetic = bundle.syntheticMembers.some((m) => m.id === input.member_id);

    if (editingEvent) {
      // Edit: dispatch by which table the event lives in
      if ('hr_scenario_id' in editingEvent) {
        await updateScenarioEvent(editingEvent.id, {
          hr_scenario_id: editingEvent.hr_scenario_id,
          scenario_member_id: isSynthetic ? input.member_id : null,
          member_id: isSynthetic ? null : input.member_id,
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
        await updateEvent(editingEvent.id, input);
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await updateEventAllocations(editingEvent.id, cdcAllocations);
        }
      }
    } else {
      // Add: choose table by global scenario mode
      if (isScenario) {
        const scenInput = {
          hr_scenario_id: scenarioId,
          scenario_member_id: isSynthetic ? input.member_id : null,
          member_id: isSynthetic ? null : input.member_id,
          field: input.field,
          value: input.value,
          start_date: input.start_date,
          end_date: input.end_date,
          note: input.note,
        };
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addScenarioEventWithAllocations(scenInput, cdcAllocations);
        } else {
          await addScenarioEvent(scenInput);
        }
      } else {
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addEventWithAllocations(input, cdcAllocations);
        } else {
          await addEvent(input);
        }
      }
    }

    await refetchActive();
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (event: MemberEvent | ScenarioMemberEvent) => {
    if ('hr_scenario_id' in event) {
      await deleteScenarioEvent(event.id);
    } else {
      await deleteEvent(event.id);
    }
    await refetchActive();
  };

  const activeScenarioName = bundle.scenarioName;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Planned Changes
            {bundle.source === 'scenario' && activeScenarioName && (
              <Badge variant="outline" className="text-[10px]">
                scenario: {activeScenarioName}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological log of all dated changes across the workforce. Use the global scenario picker
            (top bar) to overlay a scenario&apos;s deltas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEvent(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Change
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Employee:</span>
              <Select
                value={employeeFilter ?? 'all'}
                onValueChange={(v) => setEmployeeFilter(v === 'all' ? null : v)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {allMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Field:</span>
              <Select
                value={fieldFilter ?? 'all'}
                onValueChange={(v) =>
                  setFieldFilter(v === 'all' ? null : (v as MemberEventField))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Window:</span>
              <Select
                value={windowFilter}
                onValueChange={(v) => setWindowFilter(v as 'all' | '3m' | '12m')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Next 3 months</SelectItem>
                  <SelectItem value="12m">Next 12 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      <Card>
        <CardContent className="pt-6">
          {bundleLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <EventsLogList
              canonicalEvents={bundle.canonicalEvents}
              scenarioEvents={bundle.scenarioEvents}
              canonicalMembers={bundle.canonicalMembers}
              syntheticMembers={bundle.syntheticMembers}
              employeeFilter={employeeFilter}
              fieldFilter={fieldFilter}
              windowFilter={windowFilter}
              onEdit={(event) => {
                setEditingEvent(event);
                setDialogOpen(true);
              }}
              onDelete={handleDeleteEvent}
            />
          )}
        </CardContent>
      </Card>

      {/* Event dialog */}
      <HREventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={allMembers}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEvent={
          editingEvent
            ? {
                id: editingEvent.id,
                member_id:
                  'member_id' in editingEvent && editingEvent.member_id
                    ? editingEvent.member_id
                    : 'scenario_member_id' in editingEvent && editingEvent.scenario_member_id
                      ? editingEvent.scenario_member_id
                      : '',
                field: editingEvent.field,
                value: editingEvent.value,
                start_date: editingEvent.start_date,
                end_date: editingEvent.end_date,
                note: editingEvent.note,
              }
            : null
        }
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? bundle.eventAllocations.filter(
                (a) =>
                  a.member_event_id === editingEvent.id ||
                  a.scenario_member_event_id === editingEvent.id,
              )
            : undefined
        }
      />
    </div>
  );
}
```

### Step 2: Verify

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

Clean. 66 tests.

### Step 3: Manual smoke test (if dev server available)

Visit `/dashboard/hr-planning`:
- Title reads "Planned Changes"; sidebar label also reads "Planned Changes"
- In baseline mode (global picker): list shows all canonical events. No "scenario" badges.
- Switch to a scenario via the global picker: list now includes scenario events tagged with a purple "scenario" badge. Existing canonical events remain (they show under the scenario too — that's the overlay model).
- Filters work: employee, field, window
- "+ Add Change": opens dialog; member must be selected; save adds event to the right table based on the global scenario picker
- Edit an event from the list: dialog opens pre-filled; save updates the right table

### Step 4: Commit

```bash
git add src/app/dashboard/hr-planning/page.tsx
git commit -m "feat(hr-planning): rebuild as cross-employee Planned Changes events log"
```

---

## Task 6: Employee page — scenario-aware writes + scenario overlay panel

**Files:**
- Create: `src/components/workforce/ScenarioOverlayPanel.tsx`
- Modify: `src/app/dashboard/workforce/[id]/page.tsx`

### Step 1: Create the overlay panel component

Create `src/components/workforce/ScenarioOverlayPanel.tsx`:

```tsx
'use client';

import { ScenarioMemberEvent } from '@/lib/optimizer/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HREventList } from '@/components/hr/HREventList';
import { Plus } from 'lucide-react';

interface ScenarioOverlayPanelProps {
  scenarioName: string;
  events: ScenarioMemberEvent[]; // scoped to this one employee
  onAdd: () => void;
  onEdit: (event: ScenarioMemberEvent) => void;
  onDelete: (eventId: string) => void;
}

export function ScenarioOverlayPanel({
  scenarioName,
  events,
  onAdd,
  onEdit,
  onDelete,
}: ScenarioOverlayPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Scenario overlay
            <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-500 border-purple-500/20">
              {scenarioName}
            </Badge>
          </CardTitle>
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Change (scenario)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <HREventList events={events} onEdit={(e) => onEdit(e as ScenarioMemberEvent)} onDelete={onDelete} />
      </CardContent>
    </Card>
  );
}
```

### Step 2: Update employee detail page to consume `useResolvedScenario` + add overlay panel + scenario-aware writes

Replace the ENTIRE content of `src/app/dashboard/workforce/[id]/page.tsx` with:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios } from '@/hooks/useHRScenarios';
import { InitialStateCard } from '@/components/workforce/InitialStateCard';
import { ActualStateCard } from '@/components/workforce/ActualStateCard';
import { ScenarioOverlayPanel } from '@/components/workforce/ScenarioOverlayPanel';
import { HREventList } from '@/components/hr/HREventList';
import { HREventDialog } from '@/components/hr/HREventDialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
} from '@/components/ui';
import {
  MemberEvent,
  MemberEventInput,
  ScenarioMemberEvent,
  MEMBER_CATEGORY_LABELS,
} from '@/lib/optimizer/types';
import { resolveMemberAtDate } from '@/lib/hr/resolve';

export default function EmployeePage() {
  const params = useParams();
  const id = params.id as string;

  const { scenarioId } = useViewContext();
  const { bundle, loading: bundleLoading, refetch: refetchActive } = useResolvedScenario();

  // Direct member-events hook for THIS employee (baseline authoring path)
  const {
    events: canonicalEventsForMember,
    eventAllocations: canonicalEventAllocations,
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
    loading: canonicalEventsLoading,
  } = useMemberEvents(id);

  const {
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEvent,
    updateScenarioEventAllocations,
    deleteScenarioEvent,
  } = useHRScenarios();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | ScenarioMemberEvent | null>(null);
  // Whether the next "Add" click opens the baseline or scenario dialog.
  // Driven by which panel's + button was pressed.
  const [dialogTarget, setDialogTarget] = useState<'baseline' | 'scenario'>('baseline');

  const member = bundle.canonicalMembers.find((m) => m.id === id);
  const loading = bundleLoading || canonicalEventsLoading;

  // Scenario events scoped to THIS canonical member
  const scenarioEventsForMember = useMemo(
    () => bundle.scenarioEvents.filter((e) => e.member_id === id),
    [bundle.scenarioEvents, id],
  );

  // Resolved state TODAY (scenario overlay applied if a scenario is active)
  const resolved = useMemo(() => {
    if (!member) return null;
    const today = new Date().toISOString().slice(0, 10);
    return resolveMemberAtDate(
      member,
      bundle.baseAllocations,
      canonicalEventsForMember,
      scenarioEventsForMember,
      bundle.eventAllocations,
      today,
    );
  }, [member, bundle.baseAllocations, canonicalEventsForMember, scenarioEventsForMember, bundle.eventAllocations]);

  const handleSaveEvent = async (
    input: MemberEventInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    if (editingEvent) {
      // Dispatch edit based on which table the event lives in
      if ('hr_scenario_id' in editingEvent) {
        await updateScenarioEvent(editingEvent.id, {
          hr_scenario_id: editingEvent.hr_scenario_id,
          member_id: input.member_id,
          scenario_member_id: null,
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
        await updateEvent(editingEvent.id, input);
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await updateEventAllocations(editingEvent.id, cdcAllocations);
        }
      }
    } else {
      // Add: route based on dialogTarget
      if (dialogTarget === 'scenario') {
        if (scenarioId === 'baseline') return; // safety; panel is hidden in baseline mode
        const scenInput = {
          hr_scenario_id: scenarioId,
          member_id: id,
          scenario_member_id: null,
          field: input.field,
          value: input.value,
          start_date: input.start_date,
          end_date: input.end_date,
          note: input.note,
        };
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addScenarioEventWithAllocations(scenInput, cdcAllocations);
        } else {
          await addScenarioEvent(scenInput);
        }
      } else {
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addEventWithAllocations(input, cdcAllocations);
        } else {
          await addEvent(input);
        }
      }
    }

    await refetchActive();
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (event: MemberEvent | ScenarioMemberEvent) => {
    if ('hr_scenario_id' in event) {
      await deleteScenarioEvent(event.id);
    } else {
      await deleteEvent(event.id);
    }
    await refetchActive();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/dashboard/workforce" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workforce
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Employee not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const scenarioActive = scenarioId !== 'baseline' && bundle.source === 'scenario';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/workforce" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workforce
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {member.first_name} {member.last_name}
              {scenarioActive && bundle.scenarioName && (
                <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-500 border-purple-500/20">
                  scenario: {bundle.scenarioName}
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Badge variant="outline" className="text-xs">{MEMBER_CATEGORY_LABELS[member.category]}</Badge>
              <span>
                Contract {member.contract_start_date ?? '—'}{' → '}{member.contract_end_date ?? 'ongoing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
        {/* Left column: Initial + Actual */}
        <div className="space-y-4">
          <InitialStateCard member={member} baseAllocations={bundle.baseAllocations} costCenters={bundle.baseAllocations.length > 0 ? [] /* populated via separate hook below if needed */ : []} />
          {resolved && <ActualStateCard resolved={resolved} costCenters={[]} />}
        </div>

        {/* Right column: canonical timeline + optional scenario overlay */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Planned Changes (baseline)</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingEvent(null);
                    setDialogTarget('baseline');
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Change
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <HREventList
                events={canonicalEventsForMember}
                onEdit={(event) => {
                  setEditingEvent(event as MemberEvent);
                  setDialogTarget('baseline');
                  setDialogOpen(true);
                }}
                onDelete={(eventId) => {
                  const target = canonicalEventsForMember.find((e) => e.id === eventId);
                  if (target) handleDeleteEvent(target);
                }}
              />
            </CardContent>
          </Card>

          {scenarioActive && bundle.scenarioName && (
            <ScenarioOverlayPanel
              scenarioName={bundle.scenarioName}
              events={scenarioEventsForMember}
              onAdd={() => {
                setEditingEvent(null);
                setDialogTarget('scenario');
                setDialogOpen(true);
              }}
              onEdit={(event) => {
                setEditingEvent(event);
                setDialogTarget('scenario');
                setDialogOpen(true);
              }}
              onDelete={(eventId) => {
                const target = scenarioEventsForMember.find((e) => e.id === eventId);
                if (target) handleDeleteEvent(target);
              }}
            />
          )}
        </div>
      </div>

      {/* Event dialog */}
      <HREventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={[member]}
        onSave={handleSaveEvent}
        costCenters={[]}
        editingEvent={
          editingEvent
            ? {
                id: editingEvent.id,
                member_id: member.id,
                field: editingEvent.field,
                value: editingEvent.value,
                start_date: editingEvent.start_date,
                end_date: editingEvent.end_date,
                note: editingEvent.note,
              }
            : null
        }
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? (canonicalEventAllocations.filter((a) => a.member_event_id === editingEvent.id)).concat(
                bundle.eventAllocations.filter((a) => a.scenario_member_event_id === editingEvent.id),
              )
            : undefined
        }
      />
    </div>
  );
}
```

**Important simplification**: this rewrite passes empty `costCenters` arrays to InitialStateCard / ActualStateCard / HREventDialog. That loses some CDC display polish but keeps the PR focused. If you notice CDC context missing, add `useCostCenters` back and pass `costCenters` through.

Actually, re-add `useCostCenters` for completeness — it's already imported at the top-level hooks barrel. Add to the hooks section at the top of the component body:

```ts
import { useCostCenters } from '@/hooks/useCostCenters';
// ...
const { costCenters } = useCostCenters();
```

And pass `costCenters={costCenters}` to InitialStateCard, ActualStateCard, and HREventDialog.

### Step 3: Verify

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

Clean. 66 tests.

### Step 4: Manual smoke test

Visit `/dashboard/workforce/[id]` for an existing member:
- Baseline mode: one "Planned Changes (baseline)" panel. Adding a change writes to `member_events`. Actual State card reflects it when start_date ≤ today.
- Switch global scenario picker to a scenario: a second "Scenario overlay" panel appears with the scenario's overrides for this employee. Actual State recomputes with overlay applied.
- Click "+ Add Change (scenario)" in the overlay panel: dialog opens. Save writes to `scenario_member_events` with `member_id = <this canonical id>` and `hr_scenario_id = <active scenario>`.
- Edit a scenario-side event: save dispatches to `updateScenarioEvent`.
- Delete either side: removes from the right table, list refreshes.

### Step 5: Commit

```bash
git add src/components/workforce/ScenarioOverlayPanel.tsx src/app/dashboard/workforce/\[id\]/page.tsx
git commit -m "feat(workforce): scenario overlay panel + scenario-aware authoring on employee page"
```

---

## Task 7: Final verification + end-to-end manual test

### Step 1: Full verification

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

All clean. 66 tests.

### Step 2: Manual end-to-end walkthrough

Start `npm run dev`. Walk through (this is what you're waiting to test):

1. **Sidebar**: "HR Planning" has been renamed to "Planned Changes".
2. **Baseline events log** (`/dashboard/hr-planning`, global scenario = Baseline):
   - Chronological list of all canonical `member_events` across all employees.
   - Filters work: employee, field, window.
   - "+ Add Change" → dialog → save → new row appears after refetch.
   - Row "Edit" action opens dialog pre-filled.
   - Row "Delete" removes the event.
   - Row "Go to employee" → navigates to `/workforce/[id]`.
3. **Scenario events log**:
   - Pick a scenario in the global top-bar picker.
   - Events log now includes the scenario's events — both overlay events (with `member_id`, attached to canonical members) and synthetic-only events.
   - Scenario events carry a purple "scenario" badge.
   - Baseline events remain visible.
4. **Employee detail page baseline**: baseline timeline authoring works as before.
5. **Employee detail page scenario mode**: second "Scenario overlay" panel appears below baseline. Add/edit/delete scenario-side events works. Actual State card reflects the overlay applied at today's date.
6. **Analysis pages** (`/cost-centers`, `/workforce-analytics`): still work. Scenario mode on each shows numbers reflecting the overlay (canonical members with scenario overrides applied, plus synthetic members).
7. **Scenario deletion**: delete a scenario (through whatever path still exposes this — likely via direct Supabase or we need to keep the HRScenarioSelector somewhere). Global picker falls back to Baseline (PR 3 behavior).

### Step 3: If scenario CRUD needs a home

After the rebuild, there's no UI to create/delete scenarios. For testing purposes, users can create them via the Supabase console. If you want a quick management UI in PR 5b, add a small dropdown in the Planned Changes page header with Create / Delete / Duplicate actions — a 30-line addition. Decide based on whether your test plan needs it.

Optional commit (if you add management UI):

```bash
git add src/app/dashboard/hr-planning/page.tsx
git commit -m "feat(hr-planning): add inline scenario management dropdown"
```

### Step 4: Commit any final fixes (skip if none)

---

## Done-definition for PR 5b

- Migration SQL applies cleanly (schema adds `hr_scenario_id`, backfills via scenario_member_id join, handles orphans conservatively, sets NOT NULL, indexes).
- Tests, tsc, lint, build all clean.
- Sidebar reads "Planned Changes".
- `/hr-planning` renders as a chronological events log with filters; writes dispatch to the right table based on scenario mode.
- `/workforce/[id]` renders a scenario overlay panel when a scenario is active and writes dispatch accordingly.
- `useHRScenarios.fetchHRScenarioWithData` uses the single-query `.eq('hr_scenario_id', scenarioId)` path (leakage workaround gone).

---

## Notes for PR 6 (not in scope)

- **Optimizer migration**: `/scenarios/[id]` optimizer pages still copy `scenario_members_data`. PR 6 replaces that with `resolveWorkforceAtDate` + a `target_year` + `hr_scenario_id` on the `scenarios` table.
- **Replace `useHRPlanning` + `computeYearlyView`** with the new resolver's `resolveMemberAtYear`. Consolidates routing and eliminates the current OR-pattern in `compute.ts:getEventsForMember`.
- **Widen `useHRPlanning` signature**: eliminate the `as MemberEvent[]` casts at call sites.
- **Resolver discriminator hardening**: `'hr_scenario_id' in m` → check `is_synthetic` or pass separated arrays.
- **Scenario CRUD surface**: if users need to create/rename/duplicate/delete scenarios interactively, either (a) add a management dropdown on `/hr-planning` or (b) add it to the global `ScenarioSourcePicker` as a small menu. Out of scope here unless testing requires it.
