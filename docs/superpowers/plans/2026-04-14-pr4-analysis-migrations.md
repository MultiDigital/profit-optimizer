# PR 4 — Analysis Page Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `/dashboard/cost-centers` and `/dashboard/workforce-analytics` to read `year` and `scenarioId` from the PR 3 `ViewContext` and resolve workforce state at that year. Make the cost-centers Allocazioni tab read-only. Add "Monthly Timeline" and "Compare scenarios" tabs to workforce-analytics.

**Architecture:** New `useResolvedScenario()` hook encapsulates the "baseline-vs-scenario" branching that currently lives inline on `/hr-planning`. Pages consume it to get the active members/events/allocations, then call `resolveWorkforceAtDate(..., \`${year}-06-01\`)` for point-in-time snapshot views (cost-centers + workforce-analytics per-CDC breakdown) or pass the active data to `useHRPlanning` for the 12-month aggregate views (Monthly Timeline + Compare). No schema changes. `/hr-planning` stays untouched — its repurpose is PR 6.

**Tech Stack:**
- PR 1 resolver (`resolveWorkforceAtDate`)
- PR 3 `ViewContext` (`useViewContext`)
- Existing `HRYearlyTable`, `HRComparisonView`, `useHRPlanning`, `useHRScenarios`
- Vitest (node env) for pure adapter logic

**Parent spec:** `docs/superpowers/specs/2026-04-14-employee-page-and-timeline-resolver-design.md` § "Analysis page migrations"

**Stacking:** branches from `feature/pr3-global-shell-controls`. Depends on PR 1 resolver + PR 3 context.

---

## File Structure

New files:
- `src/lib/view/select-scenario-data.ts` — pure helper that selects the right data bundle based on `scenarioId`
- `src/lib/view/select-scenario-data.test.ts` — unit tests for the helper
- `src/hooks/useResolvedScenario.ts` — React hook wrapping the pure helper + async scenario fetch

Files modified:
- `src/app/dashboard/cost-centers/page.tsx` — year + scenario aware; both tabs use resolved data
- `src/components/cost-centers/AllocationMatrix.tsx` — accept `readOnly` prop and show resolved percentages
- `src/app/dashboard/workforce-analytics/page.tsx` — tabs layout; existing breakdown becomes year/scenario-resolved; add two new tabs

Files NOT touched:
- `/dashboard/hr-planning/page.tsx` — stays as-is until PR 6
- `src/components/hr/HRYearlyTable.tsx`, `HRComparisonView.tsx` — reused unchanged
- `src/hooks/useHRPlanning.ts` — reused unchanged
- `src/lib/hr/resolve.ts`, `compute.ts`, `resolve-events.ts` — no changes

---

## Task 1: Pure `selectScenarioData` helper + tests

**Files:**
- Create: `src/lib/view/select-scenario-data.ts`
- Create: `src/lib/view/select-scenario-data.test.ts`

This is the pure decision logic: given a scenarioId, catalog data, and optionally loaded scenario data, return the bundle the analysis page should use.

- [ ] **Step 1: Write failing tests**

Create `src/lib/view/select-scenario-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectScenarioData } from './select-scenario-data';
import type {
  Member,
  MemberEvent,
  EventCostCenterAllocation,
  MemberCostCenterAllocation,
  HRScenarioMember,
  ScenarioMemberEvent,
  HRScenario,
} from '@/lib/optimizer/types';

const catalogMembers: Member[] = [
  {
    id: 'm-1',
    user_id: 'u-1',
    first_name: 'Alice',
    last_name: 'A',
    category: 'dipendente',
    seniority: 'middle',
    salary: 40000,
    chargeable_days: null,
    ft_percentage: 100,
    contract_start_date: '2024-01-01',
    contract_end_date: null,
  },
];
const catalogEvents: MemberEvent[] = [];
const catalogEventAllocations: EventCostCenterAllocation[] = [];
const baseAllocations: MemberCostCenterAllocation[] = [
  { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
];

describe('selectScenarioData', () => {
  it('returns baseline bundle when scenarioId is "baseline"', () => {
    const result = selectScenarioData({
      scenarioId: 'baseline',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios: [],
    });
    expect(result.source).toBe('baseline');
    expect(result.scenarioName).toBeNull();
    expect(result.members).toBe(catalogMembers);
    expect(result.events).toBe(catalogEvents);
    expect(result.eventAllocations).toBe(catalogEventAllocations);
    expect(result.baseAllocations).toBe(baseAllocations);
  });

  it('returns baseline bundle when scenarioId is a UUID but scenarios list is empty (invalid selection)', () => {
    const result = selectScenarioData({
      scenarioId: 'deleted-id',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios: [],
    });
    expect(result.source).toBe('baseline');
    expect(result.scenarioName).toBeNull();
  });

  it('returns scenario bundle when scenarioId matches a known scenario AND scenarioData is loaded', () => {
    const scenarioMembers: HRScenarioMember[] = [
      {
        id: 'sm-1',
        user_id: 'u-1',
        hr_scenario_id: 's-1',
        source_member_id: null,
        first_name: 'Bob',
        last_name: 'B',
        category: 'dipendente',
        seniority: 'senior',
        salary: 80000,
        ft_percentage: 100,
        chargeable_days: null,
        capacity_percentage: 100,
        cost_percentage: 100,
        contract_start_date: '2024-01-01',
        contract_end_date: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const scenarioEvents: ScenarioMemberEvent[] = [];
    const scenarioEventAllocations: EventCostCenterAllocation[] = [];
    const scenarios: HRScenario[] = [
      {
        id: 's-1',
        user_id: 'u-1',
        name: 'Alt Q2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    const result = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: {
        scenario: scenarios[0],
        members: scenarioMembers,
        events: scenarioEvents,
        eventAllocations: scenarioEventAllocations,
      },
      scenarios,
    });
    expect(result.source).toBe('scenario');
    expect(result.scenarioName).toBe('Alt Q2');
    expect(result.members).toBe(scenarioMembers);
    expect(result.events).toBe(scenarioEvents);
    expect(result.eventAllocations).toBe(scenarioEventAllocations);
    // baseAllocations remain the catalog's — scenarios don't override the initial CDC table today
    expect(result.baseAllocations).toBe(baseAllocations);
  });

  it('returns baseline bundle while scenarioData is still loading (scenarios list has the id but data not yet fetched)', () => {
    const scenarios: HRScenario[] = [
      {
        id: 's-1',
        user_id: 'u-1',
        name: 'Alt Q2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];
    const result = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios,
    });
    // Fallback to baseline so the UI doesn't flash empty
    expect(result.source).toBe('baseline');
    expect(result.scenarioName).toBeNull();
    expect(result.members).toBe(catalogMembers);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module `./select-scenario-data` does not exist. Prior 60 tests still pass.

- [ ] **Step 3: Implement the helper**

Create `src/lib/view/select-scenario-data.ts`:

```ts
import type {
  HRScenario,
  Member,
  MemberEvent,
  MemberCostCenterAllocation,
  EventCostCenterAllocation,
  HRScenarioMember,
  ScenarioMemberEvent,
} from '@/lib/optimizer/types';
import type { HRScenarioWithData } from '@/hooks/useHRScenarios';

export interface ResolvedScenarioBundle {
  source: 'baseline' | 'scenario';
  scenarioId: string; // 'baseline' or the matched scenario UUID
  scenarioName: string | null;
  members: Member[] | HRScenarioMember[];
  events: MemberEvent[] | ScenarioMemberEvent[];
  eventAllocations: EventCostCenterAllocation[];
  baseAllocations: MemberCostCenterAllocation[];
}

export interface SelectScenarioDataInput {
  scenarioId: string;
  catalogMembers: Member[];
  catalogEvents: MemberEvent[];
  catalogEventAllocations: EventCostCenterAllocation[];
  baseAllocations: MemberCostCenterAllocation[];
  scenarioData: HRScenarioWithData | null;
  scenarios: HRScenario[];
}

/**
 * Decide which data bundle an analysis page should use, given the
 * context's `scenarioId` and whatever the caller has fetched.
 *
 * Fallback rules:
 * - scenarioId === 'baseline' → catalog bundle
 * - scenarioId is a UUID but not found in `scenarios` (e.g., deleted) → catalog
 * - scenarioId matches a known scenario but `scenarioData` hasn't loaded → catalog
 *   (prevents empty flash; ScenarioSourcePicker will auto-reset to baseline too)
 * - scenarioId matches AND scenarioData is ready → scenario bundle
 *
 * Note: today's scenarios still use full-copy semantics for members;
 * `baseAllocations` always come from the catalog (scenarios don't copy
 * the member_cost_center_allocations table). PR 5 will refactor this.
 */
export function selectScenarioData(input: SelectScenarioDataInput): ResolvedScenarioBundle {
  const {
    scenarioId,
    catalogMembers,
    catalogEvents,
    catalogEventAllocations,
    baseAllocations,
    scenarioData,
    scenarios,
  } = input;

  if (scenarioId === 'baseline') {
    return baselineBundle();
  }

  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) {
    return baselineBundle();
  }

  if (!scenarioData || scenarioData.scenario.id !== scenarioId) {
    return baselineBundle();
  }

  return {
    source: 'scenario',
    scenarioId,
    scenarioName: scenario.name,
    members: scenarioData.members,
    events: scenarioData.events,
    eventAllocations: scenarioData.eventAllocations,
    baseAllocations, // unchanged — see comment above
  };

  function baselineBundle(): ResolvedScenarioBundle {
    return {
      source: 'baseline',
      scenarioId: 'baseline',
      scenarioName: null,
      members: catalogMembers,
      events: catalogEvents,
      eventAllocations: catalogEventAllocations,
      baseAllocations,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 64 total (60 prior + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/select-scenario-data.ts src/lib/view/select-scenario-data.test.ts
git commit -m "feat(view): add selectScenarioData helper for baseline/scenario branching"
```

---

## Task 2: `useResolvedScenario` hook

**Files:**
- Create: `src/hooks/useResolvedScenario.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useResolvedScenario.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { useViewContext } from '@/contexts/ViewContext';
import { useMembers, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios, type HRScenarioWithData } from '@/hooks/useHRScenarios';
import { selectScenarioData, type ResolvedScenarioBundle } from '@/lib/view/select-scenario-data';

export interface UseResolvedScenarioResult {
  bundle: ResolvedScenarioBundle;
  loading: boolean;
}

/**
 * Composes the scenario-aware data bundle for an analysis page.
 *
 * Reads `scenarioId` from ViewContext (or the optional `scenarioIdOverride`
 * for per-page local overrides, per spec decision C).
 *
 * Returns a bundle usable by the resolver; falls back to baseline while
 * scenario data is loading to avoid empty-state flash.
 */
export function useResolvedScenario(scenarioIdOverride?: string): UseResolvedScenarioResult {
  const { scenarioId: contextScenarioId } = useViewContext();
  const activeScenarioId = scenarioIdOverride ?? contextScenarioId;

  const { members: catalogMembers, loading: membersLoading } = useMembers();
  const { events: catalogEvents, eventAllocations: catalogEventAllocations, loading: eventsLoading } = useMemberEvents();
  const { allocations: baseAllocations, loading: ccLoading } = useCostCenters();
  const { hrScenarios, fetchHRScenarioWithData, loading: scenariosLoading } = useHRScenarios();

  const [scenarioData, setScenarioData] = useState<HRScenarioWithData | null>(null);
  const [scenarioFetching, setScenarioFetching] = useState(false);

  // Fetch scenario data when a non-baseline scenario is selected.
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

  return { bundle, loading };
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useResolvedScenario.ts
git commit -m "feat(view): add useResolvedScenario hook for analysis pages"
```

---

## Task 3: Make `AllocationMatrix` support read-only mode + resolved values

**Files:**
- Modify: `src/components/cost-centers/AllocationMatrix.tsx`

Current component: editable grid where each cell accepts a percentage. Need:
- New prop `readOnly?: boolean` — when true, render cells as plain text (no inputs, no onSetAllocation invocations, no inline editing UX)
- New prop `resolvedAllocations?: ResolvedCostCenterAllocation[] | Map<string, ResolvedCostCenterAllocation[]>` — when provided, display these per-member resolved percentages instead of the `allocations` prop

Let me keep the change small: instead of introducing resolved-allocations plumbing through the existing prop shape, accept a resolver function.

- [ ] **Step 1: Read the current file**

Read `src/components/cost-centers/AllocationMatrix.tsx` in full first to understand the render structure.

- [ ] **Step 2: Add `readOnly` + `resolveCellPercentage` props**

Modify the `AllocationMatrixProps` interface to become:

```ts
interface AllocationMatrixProps {
  members: Member[];
  costCenters: CostCenter[];
  allocations: MemberCostCenterAllocation[];
  capacitySettings: CapacitySettings;
  onSetAllocation?: (memberId: string, costCenterId: string, percentage: number) => Promise<void>;
  readOnly?: boolean;
  /**
   * Optional resolver for the percentage to display in each (member, costCenter) cell.
   * When omitted, falls back to `allocations` (legacy editable behaviour).
   * When provided, the matrix displays these resolved values — typically from
   * `resolveWorkforceAtDate` output — and edit cells are disabled.
   */
  resolveCellPercentage?: (memberId: string, costCenterId: string) => number;
}
```

Change `onSetAllocation` to optional. Keep legacy behaviour when both `readOnly` is undefined/false AND `onSetAllocation` is provided.

Inside the component:
- If `readOnly === true` OR `resolveCellPercentage` is provided, render cells as plain text (`<span>{pct}%</span>`) without the editing input and without the `editingCell` state interactions for that cell.
- The member-total column still shows the resolved sum.
- When rendering read-only, use `resolveCellPercentage(memberId, costCenterId)` if provided, else fall back to `getAllocation(memberId, costCenterId)`.

No save/commit logic changes — `onSetAllocation` is simply not called in read-only mode. Existing callers remain backward-compatible.

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/cost-centers/AllocationMatrix.tsx
git commit -m "feat(cost-centers): add readOnly + resolveCellPercentage to AllocationMatrix"
```

---

## Task 4: Migrate `/dashboard/cost-centers`

**Files:**
- Modify: `src/app/dashboard/cost-centers/page.tsx`

This is the bigger migration. Changes:

1. Read `year` from `useViewContext()`.
2. Use `useResolvedScenario()` for data.
3. Call `resolveWorkforceAtDate(bundle.members, bundle.baseAllocations, bundle.events, [], bundle.eventAllocations, \`${year}-06-01\`)` to get resolved state.
4. Build a `resolvedByMember: Map<string, ResolvedMember>` from the result.
5. Pass `readOnly` + `resolveCellPercentage` to `AllocationMatrix` (the Allocazioni tab).
6. Update `computeCostSummary` (the Riepilogo tab) to accept resolved members instead of raw members — use their resolved `salary` and `costCenterAllocations`.

- [ ] **Step 1: Read the current page** to understand the existing layout.

- [ ] **Step 2: Rewrite the page**

Replace the page with a version that:
- Imports `useViewContext`, `useResolvedScenario`, `resolveWorkforceAtDate`.
- Filters scenario-specific members appropriately (scenario members are `HRScenarioMember[]` which are close enough structurally to `Member` — the resolver typings accept the overlap).
- Uses resolved data for both tabs.
- Keeps the CDC entity CRUD (add/edit/delete cost center) unchanged.
- Removes the AllocationMatrix's edit UX from the Allocazioni tab (via `readOnly` prop) but keeps the grid visible.

Important: `HRScenarioMember` has extra fields (e.g., `capacity_percentage`, `cost_percentage`). The resolver takes `Member[]`. In practice the scenario members can be cast to `Member[]` for the resolver call because they include all `Member` fields. Use a type cast with a comment explaining why. Safer: type the resolver input as `(Member | HRScenarioMember)[]` if convenient, but keeping the cast is fine for PR 4.

Specific change to `computeCostSummary`:

```ts
function computeCostSummary(
  resolvedMembers: ResolvedMember[],
  costCenters: CostCenter[],
  effectiveDays: number,
  yearlyWorkableDays: number,
): CostCenterSummary[] {
  // Build allocation index from resolved CDC allocations
  const allocMap = new Map<string, Map<string, number>>();
  for (const m of resolvedMembers) {
    const entry = new Map<string, number>();
    for (const a of m.costCenterAllocations) {
      entry.set(a.cost_center_id, a.percentage);
    }
    allocMap.set(m.id, entry);
  }

  // ... rest of logic as before, but:
  // - m.salary → resolved salary (already on ResolvedMember)
  // - m.category / m.seniority / m.chargeable_days / m.ft_percentage → resolved
  // - allocation pct → from allocMap (resolved CDC)
  // - skip inactive members via m.isActive === false
}
```

Full page rewrite — paste this content to replace the existing `src/app/dashboard/cost-centers/page.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCostCenters, useSettings } from '@/hooks';
import { AllocationMatrix, CostCenterDialog } from '@/components/cost-centers';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { resolveWorkforceAtDate } from '@/lib/hr/resolve';
import type { ResolvedMember } from '@/lib/hr/types';
import {
  CostCenter,
  DEFAULT_SETTINGS,
  Member,
  SENIORITY_LEVELS,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
  SeniorityLevel,
  computeEffectiveDays,
} from '@/lib/optimizer/types';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';

function formatFte(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// --- Cost summary types & computation ---

interface CostRow {
  label: string;
  fte: number;
  totalCost: number;
}

interface CostCenterSummary {
  costCenter: CostCenter;
  rows: CostRow[];
  totalFte: number;
  totalCost: number;
}

function computeCostSummary(
  resolvedMembers: ResolvedMember[],
  costCenters: CostCenter[],
  effectiveDays: number,
  yearlyWorkableDays: number,
): CostCenterSummary[] {
  const groups: CostCenterSummary[] = [];

  for (const cc of costCenters) {
    const rowMap = new Map<string, CostRow>();

    for (const m of resolvedMembers) {
      if (!m.isActive) continue;
      const alloc = m.costCenterAllocations.find((a) => a.cost_center_id === cc.id);
      if (!alloc || alloc.percentage === 0) continue;
      const allocFraction = alloc.percentage / 100;

      let label: string;
      let memberFte: number;

      if (m.category === 'segnalatore') {
        label = MEMBER_CATEGORY_LABELS.segnalatore;
        memberFte = 1;
      } else {
        const seniority = m.seniority as SeniorityLevel;
        label = SENIORITY_LABELS[seniority];
        if (m.category === 'freelance') {
          memberFte = m.chargeable_days != null
            ? m.chargeable_days / effectiveDays
            : yearlyWorkableDays / effectiveDays;
        } else {
          memberFte = (m.ft_percentage ?? 100) / 100;
        }
      }

      const existing = rowMap.get(label) ?? { label, fte: 0, totalCost: 0 };
      existing.fte += memberFte * allocFraction;
      existing.totalCost += m.salary * allocFraction;
      rowMap.set(label, existing);
    }

    const seniorityOrder = SENIORITY_LEVELS.map((s) => SENIORITY_LABELS[s]);
    const rows = Array.from(rowMap.values()).sort((a, b) => {
      const ai = seniorityOrder.indexOf(a.label);
      const bi = seniorityOrder.indexOf(b.label);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    if (rows.length > 0) {
      groups.push({
        costCenter: cc,
        rows,
        totalFte: rows.reduce((s, r) => s + r.fte, 0),
        totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
      });
    }
  }

  return groups;
}

// --- Page component ---

export default function CostCentersPage() {
  const { year } = useViewContext();
  const { bundle, loading: scenarioLoading } = useResolvedScenario();
  const { settings } = useSettings();
  const {
    costCenters,
    loading: ccLoading,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
  } = useCostCenters();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCc, setEditingCc] = useState<CostCenter | null>(null);
  const [deletingCc, setDeletingCc] = useState<CostCenter | null>(null);

  const loading = scenarioLoading || ccLoading;

  const s = settings ?? DEFAULT_SETTINGS;
  const effectiveDays = computeEffectiveDays(
    s.yearly_workable_days,
    s.festivita_nazionali,
    s.ferie,
    s.malattia,
    s.formazione,
  );

  // Resolve workforce at mid-year of the selected year.
  const resolved = useMemo(() => {
    const anchorDate = `${year}-06-01`;
    // bundle.members is Member[] when baseline, HRScenarioMember[] when scenario.
    // HRScenarioMember is structurally compatible with Member for the resolver
    // (shares all required fields); cast to satisfy the resolver signature.
    return resolveWorkforceAtDate(
      bundle.members as Member[],
      bundle.baseAllocations,
      bundle.events,
      [],
      bundle.eventAllocations,
      anchorDate,
    );
  }, [bundle, year]);

  const resolvedByMember = useMemo(() => {
    const map = new Map<string, ResolvedMember>();
    for (const m of resolved) map.set(m.id, m);
    return map;
  }, [resolved]);

  const resolveCellPercentage = (memberId: string, costCenterId: string): number => {
    const m = resolvedByMember.get(memberId);
    if (!m) return 0;
    const alloc = m.costCenterAllocations.find((a) => a.cost_center_id === costCenterId);
    return alloc?.percentage ?? 0;
  };

  const summaryGroups = useMemo(
    () => computeCostSummary(resolved, costCenters, effectiveDays, s.yearly_workable_days),
    [resolved, costCenters, effectiveDays, s.yearly_workable_days],
  );

  const grandTotal = useMemo(
    () => ({
      fte: summaryGroups.reduce((s, g) => s + g.totalFte, 0),
      totalCost: summaryGroups.reduce((s, g) => s + g.totalCost, 0),
    }),
    [summaryGroups],
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleCreate = async (input: { code: string; name: string }) => {
    await addCostCenter(input);
  };

  const handleEdit = async (input: { code: string; name: string }) => {
    if (!editingCc) return;
    await updateCostCenter(editingCc.id, input);
    setEditingCc(null);
  };

  const handleDelete = async () => {
    if (!deletingCc) return;
    await deleteCostCenter(deletingCc.id);
    setDeletingCc(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Cost Centers
                {bundle.source === 'scenario' && bundle.scenarioName && (
                  <Badge variant="outline" className="text-[10px]">
                    scenario: {bundle.scenarioName}
                  </Badge>
                )}
              </CardTitle>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Add Cost Center
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : (
              <Tabs defaultValue="allocations">
                <TabsList>
                  <TabsTrigger value="allocations">Allocazioni</TabsTrigger>
                  <TabsTrigger value="summary">Riepilogo Costi</TabsTrigger>
                </TabsList>

                <TabsContent value="allocations">
                  {costCenters.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {costCenters.map((cc) => (
                        <Badge
                          key={cc.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 text-sm py-1 px-3 gap-2"
                          onClick={() => setEditingCc(cc)}
                        >
                          <span className="font-bold">{cc.code}</span>
                          <span className="text-muted-foreground">{cc.name}</span>
                          <button
                            className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCc(cc);
                            }}
                          >
                            &times;
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <AllocationMatrix
                    members={bundle.members as Member[]}
                    costCenters={costCenters}
                    allocations={bundle.baseAllocations}
                    capacitySettings={{
                      yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
                      festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
                      ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
                      malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
                      formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
                    }}
                    readOnly
                    resolveCellPercentage={resolveCellPercentage}
                  />
                </TabsContent>

                <TabsContent value="summary">
                  {summaryGroups.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">
                      No data to display. Make sure you have members assigned to cost centers.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]"></TableHead>
                          <TableHead className="text-right">FTE</TableHead>
                          <TableHead className="text-right">Totale Costo Personale</TableHead>
                          <TableHead className="text-right">% Incidenza</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryGroups.map((g) => (
                          <CostCenterSummarySection
                            key={g.costCenter.id}
                            group={g}
                            isCollapsed={collapsed[g.costCenter.id] ?? false}
                            onToggle={() => toggle(g.costCenter.id)}
                            grandTotalCost={grandTotal.totalCost}
                          />
                        ))}
                        <TableRow className="border-t-2 border-foreground/20 font-bold">
                          <TableCell>Totale</TableCell>
                          <TableCell className="text-right">{formatFte(grandTotal.fte)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(grandTotal.totalCost)}</TableCell>
                          <TableCell className="text-right"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <CostCenterDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSave={handleCreate}
          mode="create"
        />

        {/* Edit Dialog */}
        <CostCenterDialog
          open={!!editingCc}
          onOpenChange={(open) => !open && setEditingCc(null)}
          costCenter={editingCc}
          onSave={handleEdit}
          mode="edit"
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingCc} onOpenChange={(open) => !open && setDeletingCc(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete cost center?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingCc?.code} - {deletingCc?.name}</strong>?
                All allocations for this cost center will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// --- Cost center summary collapsible section ---

function CostCenterSummarySection({
  group,
  isCollapsed,
  onToggle,
  grandTotalCost,
}: {
  group: CostCenterSummary;
  isCollapsed: boolean;
  onToggle: () => void;
  grandTotalCost: number;
}) {
  return (
    <>
      <TableRow
        className="bg-muted/50 cursor-pointer hover:bg-muted font-semibold"
        onClick={onToggle}
      >
        <TableCell>
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                !isCollapsed && 'rotate-90'
              )}
            />
            {group.costCenter.code}
          </span>
        </TableCell>
        <TableCell className="text-right">{formatFte(group.totalFte)}</TableCell>
        <TableCell className="text-right">{formatCurrency(group.totalCost)}</TableCell>
        <TableCell className="text-right">
          {grandTotalCost > 0
            ? `${((group.totalCost / grandTotalCost) * 100).toFixed(1)}%`
            : '-'}
        </TableCell>
      </TableRow>

      {!isCollapsed &&
        group.rows.map((row) => (
          <TableRow key={`${group.costCenter.id}-${row.label}`}>
            <TableCell className="pl-10 text-muted-foreground">{row.label}</TableCell>
            <TableCell className="text-right">{formatFte(row.fte)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.totalCost)}</TableCell>
            <TableCell className="text-right">
              {group.totalCost > 0
                ? `${((row.totalCost / group.totalCost) * 100).toFixed(1)}%`
                : '-'}
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}
```

- [ ] **Step 3: Verify type-check, lint, build, tests**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

All pass. Tests still 64.

- [ ] **Step 4: Manual smoke test**

Start `npm run dev`. Navigate to `/dashboard/cost-centers`:
1. Allocazioni tab renders as read-only (no editable cells). Percentages shown are the year-resolved values.
2. Switch to a different year via the top-bar year picker. If any employee had a CDC allocation event scheduled for that year, values update.
3. Switch to a scenario via the scenario picker. Values reflect the scenario's members.
4. Riepilogo Costi tab shows cost aggregation per CDC, reflecting resolved salaries and allocations.
5. CDC entity CRUD (add/edit/delete) still works.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/cost-centers/page.tsx
git commit -m "feat(cost-centers): migrate page to year + scenario aware resolved workforce"
```

---

## Task 5: Migrate `/dashboard/workforce-analytics` — existing breakdown tab

**Files:**
- Modify: `src/app/dashboard/workforce-analytics/page.tsx`

Changes the existing single-card layout into a tabbed layout with one tab so far ("Per CDC"). The existing compute functions get updated to accept resolved members.

- [ ] **Step 1: Read the current file** in full.

- [ ] **Step 2: Update compute functions to accept `ResolvedMember[]`**

Change `computeTotalWorkforce` and `computeByCostCenter` signatures:

```ts
function computeTotalWorkforce(
  resolvedMembers: ResolvedMember[],
  settings: Settings | null,
): TotalSummary { ... }

function computeByCostCenter(
  resolvedMembers: ResolvedMember[],
  costCenters: CostCenter[],
  settings: Settings | null,
): CostCenterGroup[] { ... }
```

- Remove the `allocations` parameter from `computeByCostCenter` — resolved members carry their own `costCenterAllocations`.
- Inside each, replace `m.salary` → resolved salary (already on `ResolvedMember`), `m.ft_percentage ?? 100` → resolved `ft_percentage`, `m.chargeable_days` → resolved `chargeable_days`, `m.category` → resolved, `m.seniority` → resolved.
- Use `m.costCenterAllocations` for the inner loop instead of the external `allocations` map.
- Skip inactive members (`m.isActive === false`).

- [ ] **Step 3: Update the page component**

Replace the page's `WorkforceAnalyticsPage` function with a version that:

- Drops `useMembers` + inline allocations; uses `useViewContext()` + `useResolvedScenario()`.
- Computes `resolvedMembers` via `resolveWorkforceAtDate(bundle.members as Member[], bundle.baseAllocations, bundle.events, [], bundle.eventAllocations, \`${year}-06-01\`)`.
- Wraps the existing tables in a `Tabs` component with a single tab "Per CDC" for now (Tasks 6 and 7 add the two new tabs).
- Shows a scenario badge in the CardHeader when `bundle.source === 'scenario'`.

Key imports to add:
```ts
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { resolveWorkforceAtDate } from '@/lib/hr/resolve';
import type { ResolvedMember } from '@/lib/hr/types';
import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '@/components/ui';
```

- [ ] **Step 4: Verify type-check, lint, build, tests**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

All pass. Tests still 64.

- [ ] **Step 5: Manual smoke test**

Start `npm run dev`. Navigate to `/dashboard/workforce-analytics`:
1. Page renders with the existing breakdown inside a "Per CDC" tab.
2. Year picker changes update values.
3. Scenario picker change updates values. Badge appears when non-baseline.
4. Numbers match `/dashboard/cost-centers` Riepilogo Costi for the same year + scenario (sanity check — both should use the same resolver output).

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/workforce-analytics/page.tsx
git commit -m "feat(workforce-analytics): migrate per-CDC breakdown to resolved workforce"
```

---

## Task 6: Add "Monthly Timeline" tab to `/dashboard/workforce-analytics`

**Files:**
- Modify: `src/app/dashboard/workforce-analytics/page.tsx`

- [ ] **Step 1: Add the tab**

Add a new `<TabsTrigger value="monthly">Monthly Timeline</TabsTrigger>` and the corresponding `<TabsContent value="monthly">` to the tabs block.

The content uses `useHRPlanning(bundle.members, bundle.events, settings, bundle.baseAllocations, bundle.eventAllocations, year)` to compute the 12-month snapshots, and renders `<HRYearlyTable yearlyView={yearlyView} loading={...} />`.

Imports to add:
```ts
import { useHRPlanning } from '@/hooks/useHRPlanning';
import { HRYearlyTable } from '@/components/hr/HRYearlyTable';
```

Pass the active year from `useViewContext()` to `useHRPlanning`.

Note: `bundle.members` type is `Member[] | HRScenarioMember[]` and `useHRPlanning` accepts either (it has a union type internally). No cast needed.

- [ ] **Step 2: Verify type-check, lint, build, tests**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

Still 64 tests.

- [ ] **Step 3: Manual smoke test**

Monthly Timeline tab renders. Shows month × metric matrix. Metric selector (cost / capacity / fte) still works via the HRYearlyTable internal state. Scrolling / expand-collapse behaves as in hr-planning.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/workforce-analytics/page.tsx
git commit -m "feat(workforce-analytics): add Monthly Timeline tab"
```

---

## Task 7: Add "Compare scenarios" tab to `/dashboard/workforce-analytics`

**Files:**
- Modify: `src/app/dashboard/workforce-analytics/page.tsx`

Per spec: the compare tab picks two sources (baseline or any HR scenario) **locally** (independent of the global picker, per spec decision C), and renders `HRComparisonView`.

- [ ] **Step 1: Add the tab**

Add `<TabsTrigger value="compare">Compare scenarios</TabsTrigger>` and its `TabsContent`.

The content:
1. Two local `useState<string>('baseline')` selectors — `sideA` and `sideB`.
2. Call `useResolvedScenario(sideA)` and `useResolvedScenario(sideB)` (the hook supports the `scenarioIdOverride` arg).

**Important:** calling the hook twice with different args is legal (each call is independent); the hook's internal `useEffect` scopes its fetch to the passed id. Because `useHRScenarios` caches scenarios, the only duplicated fetch is the per-scenario data which is different anyway.

3. Compute two `yearlyView`s via `useHRPlanning` — one per side — using the global `year` but each side's bundle.
4. Render two `Select` inputs at the top to pick each side.
5. Render `<HRComparisonView baseView={yearlyViewA} compareView={yearlyViewB} baseLabel={labelA} compareLabel={labelB} />`.

- [ ] **Step 2: Verify type-check, lint, build, tests**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

Still 64 tests.

- [ ] **Step 3: Manual smoke test**

Compare tab renders. Two local selectors default to Baseline. Changing them updates the comparison table. Doesn't affect the other tabs (they still use the global picker).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/workforce-analytics/page.tsx
git commit -m "feat(workforce-analytics): add Compare scenarios tab with local selectors"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full verification suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

All pass. 64 tests.

- [ ] **Step 2: Manual end-to-end walkthrough**

Start `npm run dev`. Verify:
1. **Global pickers** on `/cost-centers` and `/workforce-analytics` drive the displayed data.
2. **Year change** updates both pages' resolved workforce.
3. **Scenario change** shows scenario-specific members + events across both pages. Scenario badge appears.
4. **`/hr-planning` untouched** — still works, still shows its own local scenario selector.
5. **`/workforce/[id]`** still shows today-only state (PR 2 behavior).
6. **Allocazioni tab on cost-centers** is read-only. No edit inputs.
7. **Monthly Timeline tab** shows month × metric table. Metric selector works.
8. **Compare tab** — pick baseline vs a scenario. Table shows deltas.
9. **localStorage** still holds `profit-optimizer.view.v1` with year + scenarioId.

- [ ] **Step 3: Commit any final fixes** (skip if none)

---

## Done-definition for PR 4

- `npm test` passes ≥ 64 tests (60 prior + 4 new in `select-scenario-data.test.ts`).
- `tsc --noEmit`, `lint`, `build` all clean.
- `/cost-centers` and `/workforce-analytics` consume `year` + `scenarioId` from `ViewContext`.
- `/cost-centers` Allocazioni tab is read-only.
- `/workforce-analytics` has three tabs: Per CDC, Monthly Timeline, Compare scenarios.
- `/hr-planning` and `/workforce/[id]` behaviour is unchanged.
- No database migrations.

---

## Notes for later PRs (not in scope here)

- **`/hr-planning` repurpose to events log** — PR 6 will rebuild hr-planning as the cross-employee events log. The Monthly Timeline and Compare tabs duplicated here will become the primary homes for those features, and hr-planning can drop them (or keep them until PR 6 explicitly removes).
- **Edit dialog cleanup on `/workforce`** — the list page's Edit dialog still lets users edit timed fields, contradicting spec decision B. Address in PR 5 or 6 when the authoring surface is fully the employee detail page.
- **Scenario delta schema** — PR 5 adds `member_id` to `hr_scenarios_events`, enabling canonical-member overrides. `selectScenarioData` will need to extend its output bundle to surface both canonical members AND their scenario event overrides, instead of swapping to scenario-member full-copies. The `source_member_id`-based baseAllocations remapping added in this PR (fix `65a7fbe`) also goes away — scenarios will share canonical baseAllocations directly. Design the bundle shape change carefully to avoid breaking the PR 4 callsites; consider introducing `events: { canonical: MemberEvent[]; scenario: ScenarioMemberEvent[] }` now (one empty today) to smooth the transition.
- **Cache for `useHRScenarios`** — the "PR 3 follow-ups" note about double-fetching becomes more acute here: `useResolvedScenario` also calls `useHRScenarios` internally, so the workforce-analytics Compare tab (three calls total: global + side A + side B) plus any page-level call could trigger redundant fetches. Revisit with React Query, SWR, or a context-owned cache if the repeat calls cause user-visible latency.
- **Mid-year anchor `${year}-06-01`** — we use mid-year as a single-snapshot anchor for "resolved at year". This is a heuristic; a user who has a change on May 15 will see the "after" state for the whole year in cost-centers' Riepilogo. The Monthly Timeline tab provides the fine-grained view. Consider exposing the anchor date as a user setting if ambiguity becomes a complaint.
- **Nested Tabs on workforce-analytics** — the outer Tabs (Per CDC / Monthly Timeline / Compare) wrap an inner Tabs (Total / Per CDC) inside the "Per CDC" TabsContent. Functionally correct (Radix Tabs supports nesting) but visually two tab strips stack. Consider flattening to four top-level tabs (Totale, Per CDC, Monthly Timeline, Compare) in a UX polish pass.
- **Scenario badge on Compare tab** — the page-level badge reflects the global scenario, not the Compare tab's local Side A / Side B selectors. Potentially confusing when the global is non-baseline but the user is comparing two different sources. Hide the badge or add a helper hint when `tab === 'compare'`.
- **AllocationMatrix cost annotations use unresolved salary** — the per-cell euro annotation and the Cost/Year footer row still read `member.salary` (the raw input salary), while the percentage comes through `resolveCellPercentage`. If a salary event fires before the anchor date, the percentage is post-event but the salary annotation is pre-event. The Riepilogo Costi table is unaffected (it reads from `ResolvedMember.salary`). Fix: extend `resolveCellPercentage` to a richer `resolveCell(memberId, ccId) → { percentage, resolvedSalary }`, or pass a `resolveMemberSalary(memberId)` helper alongside.
- **Type-union tidy-up in resolver** — `resolveWorkforceAtDate` accepts `Member[]` strictly, but callers pass `HRScenarioMember[]` via a cast. The cast is safe today (structural subset) but brittle. Consider widening the resolver signature to accept the union, matching `useHRPlanning`'s already-unioned types.
