# PR 2 — Employee Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-employee detail page at `/dashboard/workforce/[id]` that shows initial state, actual (today-resolved) state, and the timeline of planned changes. Make `/workforce` rows clickable to navigate to that page. Extend the Add Member dialog to capture the initial CDC allocation split.

**Architecture:** The employee detail page composes existing hooks (`useMembers`, `useMemberEvents(memberId)`, `useCostCenters`) and the PR 1 resolver (`resolveMemberAtDate`) to show the Actual State card. The Initial State card reads directly from the Member row + its `member_cost_center_allocations` rows. The Planned Changes panel reuses `HREventList` + `HREventDialog` scoped by `member_id`. The `/workforce` list gets a new clickable-row capability and an "Upcoming changes" column. No schema changes. No global shell changes (those land in PR 3).

**Tech Stack:**
- Next.js 16 App Router (client components) — existing
- Vitest (node env) for pure logic — from PR 1
- Tailwind + shadcn/ui — existing
- PR 1's `src/lib/hr/resolve.ts` as the resolver dependency

**Parent spec:** `docs/superpowers/specs/2026-04-14-employee-page-and-timeline-resolver-design.md`

**Stacking:** This PR branches from `feature/pr1-resolver-layer`; it depends on PR 1's `resolveMemberAtDate`, `ResolvedMember`, and related exports.

---

## File Structure

New files:
- `src/app/dashboard/workforce/[id]/page.tsx` — employee detail page (client component)
- `src/components/workforce/InitialStateCard.tsx` — read-only card rendering initial values
- `src/components/workforce/ActualStateCard.tsx` — read-only card rendering resolved values
- `src/components/workforce/InitialCdcInput.tsx` — compact CDC allocator used once at creation
- `src/lib/workforce/upcoming-events.ts` — pure function: count upcoming events per member within N days
- `src/lib/workforce/upcoming-events.test.ts` — unit tests for the counter

Files modified:
- `src/components/workforce/data-table.tsx` — add optional `onRowClick` prop
- `src/components/workforce/MemberList.tsx` — wire up row-click navigation; pass through events for the new column
- `src/components/workforce/columns.tsx` — new "Upcoming" column + accept events prop
- `src/components/workforce/WorkforceCard.tsx` — extend Add Member dialog with `InitialCdcInput`, forward CDC allocations in the save callback
- `src/app/dashboard/workforce/page.tsx` — wire cost-center data into WorkforceCard, orchestrate `addMember` + `setAllocation` chain, pass events to the list for the upcoming column
- `src/components/workforce/index.ts` — barrel-export the new components if applicable

Files NOT touched:
- `src/hooks/useMembers.ts` — no new hook functions; orchestration happens in the page
- `src/hooks/useMemberEvents.ts` — reuse as-is (supports `memberId` filter)
- `src/hooks/useCostCenters.ts` — reuse as-is (`setAllocation` does upsert)
- Existing edit/delete dialog code in `MemberList.tsx` — left alone this PR (stale-but-functional; spec decision B means timed fields should no longer be edited there, but scope-cleanup belongs to a later PR once the detail page is proven in use)

---

## Task 1: Add a testable `countUpcomingEventsByMember` helper

**Files:**
- Create: `src/lib/workforce/upcoming-events.ts`
- Create: `src/lib/workforce/upcoming-events.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/workforce/upcoming-events.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countUpcomingEventsByMember } from './upcoming-events';
import { MemberEvent } from '@/lib/optimizer/types';

function makeEvent(partial: Partial<MemberEvent> = {}): MemberEvent {
  return {
    id: partial.id ?? `e-${Math.random().toString(36).slice(2)}`,
    user_id: 'u-1',
    member_id: partial.member_id ?? 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2026-01-01',
    end_date: null,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('countUpcomingEventsByMember', () => {
  it('returns empty map when there are no events', () => {
    const result = countUpcomingEventsByMember([], '2026-06-01', 365);
    expect(result.size).toBe(0);
  });

  it('counts events starting strictly after today and within the window', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-07-01' }),
      makeEvent({ member_id: 'm-1', start_date: '2026-09-01' }),
      makeEvent({ member_id: 'm-2', start_date: '2026-08-01' }),
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 365);
    expect(result.get('m-1')).toBe(2);
    expect(result.get('m-2')).toBe(1);
  });

  it('excludes events that already started on or before today', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-06-01' }), // today
      makeEvent({ member_id: 'm-1', start_date: '2026-05-01' }), // past
      makeEvent({ member_id: 'm-1', start_date: '2026-07-01' }), // future
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 365);
    expect(result.get('m-1')).toBe(1);
  });

  it('excludes events starting after the window ends', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-07-01' }),
      makeEvent({ member_id: 'm-1', start_date: '2027-07-02' }), // just outside 365-day window from 2026-06-01
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 365);
    expect(result.get('m-1')).toBe(1);
  });

  it('handles 0-day window (no upcoming count)', () => {
    const events: MemberEvent[] = [
      makeEvent({ member_id: 'm-1', start_date: '2026-06-02' }),
    ];
    const result = countUpcomingEventsByMember(events, '2026-06-01', 0);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module `./upcoming-events` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/workforce/upcoming-events.ts`:

```ts
import { MemberEvent } from '@/lib/optimizer/types';

/**
 * Count upcoming events per member_id.
 *
 * "Upcoming" means: `start_date` is STRICTLY AFTER `today`
 * (exclusive — an event starting today is already in effect, not upcoming)
 * AND `start_date` is on or before `today + windowDays`.
 *
 * Dates are 'YYYY-MM-DD' strings; lexical comparison is valid.
 */
export function countUpcomingEventsByMember(
  events: MemberEvent[],
  today: string, // 'YYYY-MM-DD'
  windowDays: number,
): Map<string, number> {
  const windowEnd = addDaysToIsoDate(today, windowDays);
  const result = new Map<string, number>();
  for (const e of events) {
    if (e.start_date <= today) continue;
    if (e.start_date > windowEnd) continue;
    result.set(e.member_id, (result.get(e.member_id) ?? 0) + 1);
  }
  return result;
}

function addDaysToIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 5 `countUpcomingEventsByMember` tests pass. Prior 45 resolver tests still pass (50 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/workforce/upcoming-events.ts src/lib/workforce/upcoming-events.test.ts
git commit -m "feat(workforce): add countUpcomingEventsByMember helper"
```

---

## Task 2: DataTable supports clickable rows

**Files:**
- Modify: `src/components/workforce/data-table.tsx`

- [ ] **Step 1: Add `onRowClick` prop**

Replace the current `src/components/workforce/data-table.tsx` content with:

```tsx
'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    // Action cells (id='actions') stop propagation so their
                    // dropdown clicks don't trigger the row-level onClick.
                    onClick={
                      cell.column.id === 'actions'
                        ? (e) => e.stopPropagation()
                        : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No team members yet. Add your first member to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check and build**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/data-table.tsx
git commit -m "feat(workforce): support clickable rows via optional onRowClick"
```

---

## Task 3: Workforce list navigates to `/workforce/[id]` on row click

**Files:**
- Modify: `src/components/workforce/MemberList.tsx`

Scope: pass an `onRowClick` that uses Next.js' `useRouter` to navigate. Don't touch the rest of MemberList (edit/delete dialogs stay for now).

- [ ] **Step 1: Import the router and wire `onRowClick`**

In `src/components/workforce/MemberList.tsx`, add this import near the top (alongside existing imports):

```tsx
import { useRouter } from 'next/navigation';
```

Inside the `MemberList` component function body, after the `useState` declarations, add:

```tsx
const router = useRouter();
```

Find the `<DataTable ... />` render (inside the component's return). Change it from:

```tsx
<DataTable columns={columns} data={members} />
```

to:

```tsx
<DataTable
  columns={columns}
  data={members}
  onRowClick={(m) => router.push(`/dashboard/workforce/${m.id}`)}
/>
```

If the existing file's `columns` variable has a different name (e.g., passed through props or memoized), adjust the change to match the actual variable name but keep the `data` and `onRowClick` props as above.

- [ ] **Step 2: Verify type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/MemberList.tsx
git commit -m "feat(workforce): navigate to employee detail on row click"
```

---

## Task 4: "Upcoming changes" column on the workforce list

**Files:**
- Modify: `src/components/workforce/columns.tsx`
- Modify: `src/components/workforce/MemberList.tsx`
- Modify: `src/app/dashboard/workforce/page.tsx`

- [ ] **Step 1: Extend `createColumns` signature with a `upcomingCounts` map**

In `src/components/workforce/columns.tsx`, update the `ColumnActions` interface and `createColumns` signature to accept an `upcomingCounts: Map<string, number>` param. Then add a new column before `actions`. Full change:

Replace:
```ts
interface ColumnActions {
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  capacitySettings: CapacitySettings;
}

export const createColumns = ({ onEdit, onDelete, capacitySettings }: ColumnActions): ColumnDef<Member>[] => [
```

with:
```ts
interface ColumnActions {
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  capacitySettings: CapacitySettings;
  upcomingCounts: Map<string, number>;
}

export const createColumns = ({ onEdit, onDelete, capacitySettings, upcomingCounts }: ColumnActions): ColumnDef<Member>[] => [
```

Then, inside the returned array, insert this column object BETWEEN the existing `salary` column and the `actions` column (i.e. right after the salary column's closing `},`):

```ts
  {
    id: 'upcoming',
    header: () => <div className="text-right">Upcoming</div>,
    cell: ({ row }) => {
      const count = upcomingCounts.get(row.original.id) ?? 0;
      if (count === 0) {
        return <div className="text-right text-muted-foreground">—</div>;
      }
      return (
        <div className="text-right">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-500 border-blue-500/20">
            {count} change{count === 1 ? '' : 's'}
          </Badge>
        </div>
      );
    },
  },
```

(The `Badge` import is already present at the top of `columns.tsx`.)

- [ ] **Step 2: Thread `upcomingCounts` through `MemberList`**

In `src/components/workforce/MemberList.tsx`, extend the `MemberListProps` interface:

Replace:
```ts
interface MemberListProps {
  members: Member[];
  capacitySettings: CapacitySettings;
  onUpdate: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

with:
```ts
interface MemberListProps {
  members: Member[];
  capacitySettings: CapacitySettings;
  upcomingCounts: Map<string, number>;
  onUpdate: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

Destructure `upcomingCounts` in the function signature and pass it through to `createColumns(...)` (find the call, add `upcomingCounts` to the argument object).

- [ ] **Step 3: Thread `upcomingCounts` through `WorkforceCard`**

In `src/components/workforce/WorkforceCard.tsx`, add `upcomingCounts: Map<string, number>` to `WorkforceCardProps`, destructure it, and pass it through to the `<MemberList ... />` render (add `upcomingCounts={upcomingCounts}` to the JSX props).

- [ ] **Step 4: Fetch events at the page level and compute counts**

In `src/app/dashboard/workforce/page.tsx`, replace the current content with:

```tsx
'use client';

import { useMemo } from 'react';
import { useMembers, useSettings } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { WorkforceCard } from '@/components/workforce';
import { DEFAULT_SETTINGS } from '@/lib/optimizer/types';
import { countUpcomingEventsByMember } from '@/lib/workforce/upcoming-events';

export default function WorkforcePage() {
  const { members, loading: membersLoading, addMember, updateMember, deleteMember } = useMembers();
  const { settings } = useSettings();
  const { events, loading: eventsLoading } = useMemberEvents(); // all members

  const upcomingCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return countUpcomingEventsByMember(events, today, 365);
  }, [events]);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <WorkforceCard
          members={members}
          loading={membersLoading || eventsLoading}
          capacitySettings={{
            yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
            festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
            ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
            malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
            formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
          }}
          upcomingCounts={upcomingCounts}
          onAddMember={addMember}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/workforce/columns.tsx src/components/workforce/MemberList.tsx src/components/workforce/WorkforceCard.tsx src/app/dashboard/workforce/page.tsx
git commit -m "feat(workforce): add 'Upcoming changes' column to member list"
```

---

## Task 5: InitialStateCard component

**Files:**
- Create: `src/components/workforce/InitialStateCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/workforce/InitialStateCard.tsx`:

```tsx
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Member,
  MemberCostCenterAllocation,
  CostCenter,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
  SeniorityLevel,
} from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface InitialStateCardProps {
  member: Member;
  baseAllocations: MemberCostCenterAllocation[]; // full table; filtered internally
  costCenters: CostCenter[];
}

export function InitialStateCard({ member, baseAllocations, costCenters }: InitialStateCardProps) {
  const memberAllocations = baseAllocations.filter((a) => a.member_id === member.id);
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));

  const capturedLabel = member.contract_start_date
    ? `captured ${formatDate(member.contract_start_date)}`
    : 'captured at creation';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Initial State</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">view only</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{capturedLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <FieldRow label="Category" value={MEMBER_CATEGORY_LABELS[member.category]} />
        {member.category !== 'segnalatore' && (
          <FieldRow
            label="Seniority"
            value={member.seniority ? SENIORITY_LABELS[member.seniority as SeniorityLevel] : '—'}
          />
        )}
        <FieldRow label="Salary" value={formatCurrency(member.salary)} />
        {member.category === 'dipendente' && (
          <FieldRow label="FT %" value={`${member.ft_percentage ?? 100}%`} />
        )}
        {member.category === 'freelance' && (
          <FieldRow
            label="Chargeable Days"
            value={member.chargeable_days != null ? `${member.chargeable_days} gg` : '—'}
          />
        )}
        <FieldRow label="Capacity %" value="100%" />

        <div className="pt-2">
          <div className="text-xs text-muted-foreground mb-1">Cost Center Allocations</div>
          {memberAllocations.length === 0 ? (
            <div className="text-xs text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {memberAllocations.map((a) => {
                const cc = costCenterById.get(a.cost_center_id);
                return (
                  <li key={a.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{cc ? `${cc.code} ${cc.name}` : a.cost_center_id}</span>
                    <span>{a.percentage}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/InitialStateCard.tsx
git commit -m "feat(workforce): add InitialStateCard component"
```

---

## Task 6: ActualStateCard component

**Files:**
- Create: `src/components/workforce/ActualStateCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/workforce/ActualStateCard.tsx`:

```tsx
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CostCenter,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
} from '@/lib/optimizer/types';
import { ResolvedMember } from '@/lib/hr/types';
import { formatCurrency } from '@/lib/utils';

interface ActualStateCardProps {
  resolved: ResolvedMember;
  costCenters: CostCenter[];
}

export function ActualStateCard({ resolved, costCenters }: ActualStateCardProps) {
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Actual State</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">today</Badge>
        </div>
        {!resolved.isActive && (
          <p className="text-xs text-orange-500">Not active today (outside contract dates)</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <FieldRow label="Category" value={MEMBER_CATEGORY_LABELS[resolved.category]} />
        {resolved.category !== 'segnalatore' && (
          <FieldRow
            label="Seniority"
            value={resolved.seniority ? SENIORITY_LABELS[resolved.seniority] : '—'}
          />
        )}
        <FieldRow label="Salary" value={formatCurrency(resolved.salary)} />
        {resolved.category === 'dipendente' && (
          <FieldRow label="FT %" value={`${resolved.ft_percentage}%`} />
        )}
        {resolved.category === 'freelance' && (
          <FieldRow
            label="Chargeable Days"
            value={resolved.chargeable_days != null ? `${resolved.chargeable_days} gg` : '—'}
          />
        )}
        <FieldRow label="Capacity %" value={`${resolved.capacity_percentage}%`} />

        <div className="pt-2">
          <div className="text-xs text-muted-foreground mb-1">Cost Center Allocations</div>
          {resolved.costCenterAllocations.length === 0 ? (
            <div className="text-xs text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {resolved.costCenterAllocations.map((a) => {
                const cc = costCenterById.get(a.cost_center_id);
                return (
                  <li key={a.cost_center_id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{cc ? `${cc.code} ${cc.name}` : a.cost_center_id}</span>
                    <span>{a.percentage}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/ActualStateCard.tsx
git commit -m "feat(workforce): add ActualStateCard component"
```

---

## Task 7: Employee detail page at `/dashboard/workforce/[id]`

**Files:**
- Create: `src/app/dashboard/workforce/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/dashboard/workforce/[id]/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMembers, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { InitialStateCard } from '@/components/workforce/InitialStateCard';
import { ActualStateCard } from '@/components/workforce/ActualStateCard';
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
  MEMBER_CATEGORY_LABELS,
} from '@/lib/optimizer/types';
import { resolveMemberAtDate } from '@/lib/hr/resolve';

export default function EmployeePage() {
  const params = useParams();
  const id = params.id as string;
  const { members, loading: membersLoading } = useMembers();
  const { costCenters, allocations, loading: ccLoading } = useCostCenters();
  const {
    events,
    eventAllocations,
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
    loading: eventsLoading,
  } = useMemberEvents(id);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | null>(null);

  const member = members.find((m) => m.id === id);
  const loading = membersLoading || ccLoading || eventsLoading;

  const resolved = useMemo(() => {
    if (!member) return null;
    const today = new Date().toISOString().slice(0, 10);
    return resolveMemberAtDate(member, allocations, events, [], eventAllocations, today);
  }, [member, allocations, events, eventAllocations]);

  const handleSaveEvent = async (
    input: MemberEventInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
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
    setEditingEvent(null);
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
        <Link
          href="/dashboard/workforce"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/workforce"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workforce
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {member.first_name} {member.last_name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Badge variant="outline" className="text-xs">
                {MEMBER_CATEGORY_LABELS[member.category]}
              </Badge>
              <span>
                Contract {member.contract_start_date ?? '—'}
                {' → '}
                {member.contract_end_date ?? 'ongoing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
        {/* Left column: Initial + Actual */}
        <div className="space-y-4">
          <InitialStateCard
            member={member}
            baseAllocations={allocations}
            costCenters={costCenters}
          />
          {resolved && (
            <ActualStateCard resolved={resolved} costCenters={costCenters} />
          )}
        </div>

        {/* Right column: Planned Changes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Planned Changes</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingEvent(null);
                  setEventDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Change
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <HREventList
              events={events}
              onEdit={(event) => {
                setEditingEvent(event as MemberEvent);
                setEventDialogOpen(true);
              }}
              onDelete={deleteEvent}
            />
          </CardContent>
        </Card>
      </div>

      {/* Event dialog */}
      <HREventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        members={[member]}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? eventAllocations.filter((a) => a.member_event_id === editingEvent.id)
            : undefined
        }
        editingEvent={
          editingEvent
            ? {
                id: editingEvent.id,
                member_id: editingEvent.member_id,
                field: editingEvent.field,
                value: editingEvent.value,
                start_date: editingEvent.start_date,
                end_date: editingEvent.end_date,
                note: editingEvent.note,
              }
            : null
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` in a background shell (or you can do this manually after the commit).

Visit `/dashboard/workforce`, click a row. Confirm:
- Navigates to `/dashboard/workforce/[id]`.
- Header shows name, category, contract dates.
- Left: Initial State card and Actual State card render.
- Right: Planned Changes panel renders (with existing events if any).
- "+ Add Change" opens the event dialog pre-scoped to this member.
- Back link returns to the list.

Note any issues. No commit if manual test reveals broken behavior — fix first.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/workforce/\[id\]/page.tsx
git commit -m "feat(workforce): add employee detail page with resolver-driven state"
```

---

## Task 8: `InitialCdcInput` component for Add Member dialog

**Files:**
- Create: `src/components/workforce/InitialCdcInput.tsx`

- [ ] **Step 1: Create the compact CDC allocator**

Create `src/components/workforce/InitialCdcInput.tsx`:

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CostCenter } from '@/lib/optimizer/types';

interface InitialCdcInputProps {
  costCenters: CostCenter[];
  value: Record<string, number>; // cost_center_id → percentage
  onChange: (next: Record<string, number>) => void;
}

/**
 * Compact CDC allocator used ONCE when creating a new member.
 * Shows one numeric input per cost center, and a live total.
 * The caller decides whether to enforce sum = 100 (we just display).
 */
export function InitialCdcInput({ costCenters, value, onChange }: InitialCdcInputProps) {
  const total = Object.values(value).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);

  if (costCenters.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        No cost centers defined yet. You can create them in the Cost Centers page and assign later.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Initial Cost Center Allocation</Label>
        <span
          className={
            total === 100
              ? 'text-xs text-green-500'
              : total === 0
                ? 'text-xs text-muted-foreground'
                : 'text-xs text-orange-500'
          }
        >
          Total: {total}%
        </span>
      </div>
      <div className="grid grid-cols-[1fr_90px] gap-2">
        {costCenters.map((cc) => (
          <Row
            key={cc.id}
            label={`${cc.code} ${cc.name}`}
            value={value[cc.id] ?? 0}
            onChange={(n) => {
              const next = { ...value };
              if (n === 0) {
                delete next[cc.id];
              } else {
                next[cc.id] = n;
              }
              onChange(next);
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Set percentages totalling 100%. Leave all at 0 to skip — you can add allocations later via a planned change.
      </p>
    </div>
  );
}

function Row({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <>
      <div className="flex items-center text-sm">{label}</div>
      <Input
        type="number"
        min={0}
        max={100}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') {
            onChange(0);
            return;
          }
          const n = parseFloat(raw);
          if (Number.isFinite(n) && n >= 0 && n <= 100) {
            onChange(n);
          }
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/workforce/InitialCdcInput.tsx
git commit -m "feat(workforce): add InitialCdcInput for new-member CDC capture"
```

---

## Task 9: Wire InitialCdcInput into Add Member dialog + orchestrate save

**Files:**
- Modify: `src/components/workforce/WorkforceCard.tsx`
- Modify: `src/app/dashboard/workforce/page.tsx`

- [ ] **Step 1: Update `WorkforceCardProps` signature**

In `src/components/workforce/WorkforceCard.tsx`, update the props interface. Replace:

```ts
interface WorkforceCardProps {
  members: Member[];
  loading?: boolean;
  capacitySettings: CapacitySettings;
  onAddMember: (input: MemberInput) => Promise<void>;
  onUpdateMember: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}
```

with:

```ts
interface WorkforceCardProps {
  members: Member[];
  loading?: boolean;
  capacitySettings: CapacitySettings;
  upcomingCounts: Map<string, number>;
  costCenters: CostCenter[];
  onAddMember: (
    input: MemberInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => Promise<void>;
  onUpdateMember: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}
```

Add the import for `CostCenter` to the existing `@/lib/optimizer/types` import.

Destructure the new props: add `upcomingCounts` and `costCenters` to the destructured params.

Import the new component at the top:
```ts
import { InitialCdcInput } from './InitialCdcInput';
```

- [ ] **Step 2: Add CDC state in the form**

Inside the `WorkforceCard` component, add a new `useState`:

```ts
const [initialCdc, setInitialCdc] = useState<Record<string, number>>({});
```

Update `resetForm` to also clear it:

```ts
const resetForm = () => {
  setFormData(DEFAULT_MEMBER);
  setInitialCdc({});
  setError(null);
};
```

- [ ] **Step 3: Add a CDC validation check in `handleSave`**

In the existing `handleSave` function, after the existing salary check, add:

```ts
const cdcTotal = Object.values(initialCdc).reduce((s, n) => s + n, 0);
if (cdcTotal !== 0 && cdcTotal !== 100) {
  setError('Cost center allocation must total 0% (skip) or 100%.');
  return;
}
```

Change the call to `onAddMember` to forward allocations. Replace:

```ts
await onAddMember(formData);
```

with:

```ts
const cdcAllocs = Object.entries(initialCdc)
  .filter(([, pct]) => pct > 0)
  .map(([cost_center_id, percentage]) => ({ cost_center_id, percentage }));
await onAddMember(formData, cdcAllocs.length > 0 ? cdcAllocs : undefined);
```

- [ ] **Step 4: Render the `InitialCdcInput` in the dialog**

In the dialog JSX, find the `<div className="grid grid-cols-2 gap-4">` that contains the Contract Start / Contract End inputs. Immediately AFTER that closing `</div>`, insert:

```tsx
<InitialCdcInput
  costCenters={costCenters}
  value={initialCdc}
  onChange={setInitialCdc}
/>
```

- [ ] **Step 5: Update the page to pass costCenters and orchestrate CDC save**

In `src/app/dashboard/workforce/page.tsx`, update the page to fetch cost centers and orchestrate the save. Replace the page's current content with:

```tsx
'use client';

import { useMemo } from 'react';
import { useMembers, useSettings, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { WorkforceCard } from '@/components/workforce';
import { DEFAULT_SETTINGS, MemberInput } from '@/lib/optimizer/types';
import { countUpcomingEventsByMember } from '@/lib/workforce/upcoming-events';

export default function WorkforcePage() {
  const { members, loading: membersLoading, addMember, updateMember, deleteMember } = useMembers();
  const { settings } = useSettings();
  const { events, loading: eventsLoading } = useMemberEvents();
  const { costCenters, setAllocation } = useCostCenters();

  const upcomingCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return countUpcomingEventsByMember(events, today, 365);
  }, [events]);

  const addMemberWithCdc = async (
    input: MemberInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    const created = await addMember(input);
    if (!created) return;
    if (cdcAllocations) {
      for (const a of cdcAllocations) {
        await setAllocation(created.id, a.cost_center_id, a.percentage);
      }
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <WorkforceCard
          members={members}
          loading={membersLoading || eventsLoading}
          capacitySettings={{
            yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
            festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
            ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
            malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
            formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
          }}
          upcomingCounts={upcomingCounts}
          costCenters={costCenters}
          onAddMember={addMemberWithCdc}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify `useMembers.addMember` returns the created member**

Open `src/hooks/useMembers.ts` and confirm that `addMember` already returns the inserted row (it should — line 58 has `return data;` after `.select().single()`). No code change needed here; just a confirmation. If for any reason the current return path is missing, add `return data;` after the `setMembers` call.

- [ ] **Step 7: Verify build, lint, type-check**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 8: Manual smoke test**

Start the dev server and create a new member with an initial CDC split (e.g., 60/40 across two cost centers). Then:

1. On `/dashboard/workforce`, confirm the new row shows up with 0 upcoming changes.
2. Click the row. Confirm the detail page's Initial State card shows the 60/40 split.
3. Confirm the Actual State card matches (no events yet → same as initial).
4. Add a salary change with a future `start_date`. Confirm the event list on the detail page shows it and the workforce-list "Upcoming" column increments by 1.
5. Try creating a member with a CDC total of 80% — form should show the error and not submit.

- [ ] **Step 9: Commit**

```bash
git add src/components/workforce/WorkforceCard.tsx src/app/dashboard/workforce/page.tsx src/hooks/useMembers.ts
git commit -m "feat(workforce): capture initial CDC split during member creation"
```

---

## Task 10: Final sweep — tests, lint, build, manual review

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full verification suite**

Run each of these and confirm each passes:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Paste the final lines of each in the report.

- [ ] **Step 2: Navigate through the happy path**

Start `npm run dev` and verify the full PR 2 feature manually:

1. Land on `/dashboard/workforce` — see the upcoming-changes column.
2. Click a row → lands on detail page with resolved state.
3. Add a future salary event → appears in the list, triggers resolver re-compute? (Actual State card should NOT change because the event is in the future; it only reflects today's state.)
4. Add a backdated event (e.g., salary change from 2024-01-01) → Actual State card now reflects it.
5. Back to list → upcoming counter updated for future events only.
6. Edit/delete an event from the detail page.
7. Create a new member with an initial CDC split.

Note any regressions or UI weirdness. If any, fix and re-verify before the commit.

- [ ] **Step 3: Commit any last fixes (if needed)**

Only if step 2 surfaced fixes.

```bash
git add -A
git commit -m "fix(workforce): post-manual-test adjustments"
```

If no fixes, skip this step.

---

## Done-definition for PR 2

- `npm test` passes ≥ 50 tests (45 from PR 1 + 5 new in `upcoming-events.test.ts`).
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
- `/dashboard/workforce/[id]` renders for any existing member and shows initial + actual state + events list.
- Rows on `/dashboard/workforce` are clickable and navigate to the detail page.
- Add Member dialog captures and saves the initial CDC split.
- No database migrations, no shell changes.
- `src/lib/hr/resolve-events.ts` and `src/lib/hr/compute.ts` remain untouched.
- Existing `/hr-planning` flow still works end-to-end.

---

## Notes for later PRs (not in scope here)

- **Edit dialog cleanup (list page):** the current `/workforce` list still has an Edit dialog allowing changes to timed fields (salary, seniority, etc.). Per spec decision B ("initial state frozen"), that dialog should be slimmed or removed — but the detail page needs to be the definitive authoring surface first. Fold into PR 3 or PR 4.
- **Global year + scenario pickers:** land in PR 3; the detail page's Actual State card will then resolve against the selected year/scenario instead of "today" + baseline.
- **Scenario overlay panel on the detail page:** depends on PR 5's delta schema; don't add it here.
- **Component tests:** PR 1's Vitest config is node-only. If component/integration tests become valuable, add jsdom + `@testing-library/react` in a later PR. For now, manual smoke tests are the acceptance gate.
