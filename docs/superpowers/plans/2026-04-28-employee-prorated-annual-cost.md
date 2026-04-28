# Employee Prorated Annual Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Cost (YYYY)` row to the Actual State card on the employee page, summing month-level cost for the current calendar year so late starts and early ends are reflected automatically.

**Architecture:** Export a thin `computeMemberAnnualCost` helper from `src/lib/hr/compute.ts` that loops `computeMemberMonth` across the 12 months of a year and sums the existing `monthlyCost` field. The helper re-uses the canonical proration math already used by `computeMonthlySnapshot`, so the new row stays internally consistent with workforce-analytics totals. The employee page computes the value once via `useMemo`, pulls settings via the existing `useSettings` hook, and passes the result plus the year as required props into `ActualStateCard`.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Vitest, existing `src/lib/hr/compute.ts` and `src/lib/hr/resolve-events.ts` proration helpers.

**Spec:** `docs/superpowers/specs/2026-04-28-employee-prorated-annual-cost-design.md`

---

## File Structure

**Created:**
- `src/lib/hr/compute.test.ts` — Vitest tests for `computeMemberAnnualCost`. Sibling to existing `resolve.test.ts`, follows the same `makeMember` / `makeMemberEvent` factory pattern.

**Modified:**
- `src/lib/hr/compute.ts` — add the `computeMemberAnnualCost` named export. `computeMemberMonth` stays internal; we widen the surface by exactly one function.
- `src/components/workforce/ActualStateCard.tsx` — add two required props (`annualCost: number`, `year: number`) and one new `<FieldRow>` between Salary and the FT %/Chargeable Days row.
- `src/app/dashboard/workforce/[id]/page.tsx` — pull `settings` from `useSettings`, compute `annualCost` via `useMemo` keyed on the same inputs the resolver already depends on, pass `annualCost` and `year` into `<ActualStateCard/>`.

---

## Task 1: Add `computeMemberAnnualCost` helper with tests

**Files:**
- Create: `src/lib/hr/compute.test.ts`
- Modify: `src/lib/hr/compute.ts` (export new helper at end of file)

- [ ] **Step 1: Write failing test file**

Create `src/lib/hr/compute.test.ts` with the full content below. The factories mirror the patterns in `src/lib/hr/resolve.test.ts`.

```typescript
import { describe, it, expect } from 'vitest';
import { computeMemberAnnualCost } from './compute';
import { Member, MemberEvent } from '@/lib/optimizer/types';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm-1',
    user_id: 'u-1',
    first_name: 'Mario',
    last_name: 'Rossi',
    category: 'dipendente',
    seniority: 'middle',
    salary: 12000,
    chargeable_days: null,
    ft_percentage: 100,
    contract_start_date: '2024-01-01',
    contract_end_date: null,
    ...overrides,
  };
}

let _nextEventId = 0;
function makeSalaryEvent(partial: Partial<MemberEvent>): MemberEvent {
  return {
    id: partial.id ?? `me-${_nextEventId++}`,
    user_id: 'u-1',
    member_id: 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2026-01-01',
    end_date: null,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('computeMemberAnnualCost', () => {
  it('returns the full annual salary for a member employed all year with no events', () => {
    const member = makeMember({ salary: 12000, contract_start_date: '2020-01-01' });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(12000, 2);
  });

  it('prorates a late start (March 1) to 10/12 of salary', () => {
    const member = makeMember({ salary: 12000, contract_start_date: '2026-03-01' });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(10000, 2);
  });

  it('prorates an early end (August 31) to 8/12 of salary', () => {
    const member = makeMember({
      salary: 12000,
      contract_start_date: '2020-01-01',
      contract_end_date: '2026-08-31',
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(8000, 2);
  });

  it('reflects a mid-year salary raise from the event start month', () => {
    const member = makeMember({ salary: 12000, contract_start_date: '2020-01-01' });
    const raise = makeSalaryEvent({
      field: 'salary',
      value: '24000',
      start_date: '2026-07-01',
    });
    const cost = computeMemberAnnualCost(member, [raise], null, 2026);
    // Jan-Jun: 6 * 12000/12 = 6000; Jul-Dec: 6 * 24000/12 = 12000; total 18000
    expect(cost).toBeCloseTo(18000, 2);
  });

  it('returns 0 when the contract ends before the requested year', () => {
    const member = makeMember({
      salary: 12000,
      contract_start_date: '2020-01-01',
      contract_end_date: '2025-12-31',
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBe(0);
  });

  it('returns 0 when the contract starts after the requested year', () => {
    const member = makeMember({
      salary: 12000,
      contract_start_date: '2027-01-01',
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBe(0);
  });

  it('computes a non-zero cost for freelance category', () => {
    const member = makeMember({
      category: 'freelance',
      salary: 60000,
      contract_start_date: '2020-01-01',
      chargeable_days: 200,
      ft_percentage: null,
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(60000, 2);
  });

  it('computes a non-zero cost for segnalatore category', () => {
    const member = makeMember({
      category: 'segnalatore',
      seniority: null,
      salary: 5000,
      contract_start_date: '2020-01-01',
      ft_percentage: null,
    });
    const cost = computeMemberAnnualCost(member, [], null, 2026);
    expect(cost).toBeCloseTo(5000, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/hr/compute.test.ts`

Expected: FAIL — `computeMemberAnnualCost is not a function` (or similar import error).

- [ ] **Step 3: Implement `computeMemberAnnualCost`**

Append to `src/lib/hr/compute.ts` (after the existing `computeYearlyView` function, at the very bottom of the file):

```typescript
/**
 * Sum a single member's monthly cost across all 12 months of `year`,
 * yielding their actual annual cost prorated by contract dates and any
 * mid-year salary / FT% / category events.
 *
 * Re-uses `computeMemberMonth` so the result is the same number that
 * contributes to this member in `computeMonthlySnapshot`'s
 * `totalCompanyCost` for each month of the year.
 */
export function computeMemberAnnualCost(
  member: AnyMember,
  events: AnyEvent[],
  settings: Settings | null,
  year: number,
): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    total += computeMemberMonth(member, events, settings, month).monthlyCost;
  }
  return total;
}
```

Note: `AnyMember`, `AnyEvent`, `Settings`, and `computeMemberMonth` are already in scope at the top of the file. No new imports are required.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/hr/compute.test.ts`

Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/compute.ts src/lib/hr/compute.test.ts
git commit -m "$(cat <<'EOF'
feat(hr): computeMemberAnnualCost helper for prorated yearly cost

Sums computeMemberMonth across 12 months of a calendar year for a
single member. Reuses existing month proration so totals stay
consistent with computeMonthlySnapshot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `Cost (YYYY)` row to ActualStateCard

**Files:**
- Modify: `src/components/workforce/ActualStateCard.tsx`

This task has no automated test — it's a small JSX wiring change. Type-check will catch shape errors and Task 3 will exercise the rendering end-to-end.

- [ ] **Step 1: Widen `ActualStateCardProps` and render the new row**

Replace the `ActualStateCardProps` interface (currently lines 18-21) and the JSX section that renders the `Salary` row (currently around line 45) with the version below.

Read `src/components/workforce/ActualStateCard.tsx` first if you need the surrounding context, then apply these two edits:

**Edit A** — replace the props interface:

Find:
```typescript
interface ActualStateCardProps {
  resolved: ResolvedMember;
  costCenters: CostCenter[];
}
```

Replace with:
```typescript
interface ActualStateCardProps {
  resolved: ResolvedMember;
  costCenters: CostCenter[];
  annualCost: number;
  year: number;
}
```

**Edit B** — destructure the new props:

Find:
```typescript
export function ActualStateCard({ resolved, costCenters }: ActualStateCardProps) {
```

Replace with:
```typescript
export function ActualStateCard({ resolved, costCenters, annualCost, year }: ActualStateCardProps) {
```

**Edit C** — insert the Cost row immediately after the existing `Salary` `<FieldRow>`:

Find:
```typescript
        <FieldRow label="Salary" value={formatCurrency(resolved.salary)} />
        {resolved.category === 'dipendente' && (
```

Replace with:
```typescript
        <FieldRow label="Salary" value={formatCurrency(resolved.salary)} />
        <FieldRow label={`Cost (${year})`} value={formatCurrency(annualCost)} />
        {resolved.category === 'dipendente' && (
```

- [ ] **Step 2: Run typecheck and lint to verify nothing else broke**

Run: `npm run lint`

Expected: lint passes. (TypeScript errors will surface here because Next.js's lint uses `next lint`, which type-checks the file. If you want a stricter check separately, run `npx tsc --noEmit`.)

- [ ] **Step 3: Search for other callers of ActualStateCard**

Run: `grep -rn "ActualStateCard" src/`

Expected: exactly two references — the export in `src/components/workforce/ActualStateCard.tsx` (modified above), the re-export in `src/components/workforce/index.ts` (no change needed), and the import + usage in `src/app/dashboard/workforce/[id]/page.tsx` (which Task 3 updates).

If `grep` finds any other caller, that caller must also pass `annualCost` and `year` — handle it in Task 3 by updating that call site too.

- [ ] **Step 4: Commit**

```bash
git add src/components/workforce/ActualStateCard.tsx
git commit -m "$(cat <<'EOF'
feat(workforce): add Cost (YYYY) row to Actual State card

New required props annualCost and year render alongside the Salary
row. The next commit wires the employee page to compute and pass
the value.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Note: at this point the build is intentionally broken because the employee page hasn't been updated yet. Task 3 closes the loop in the next commit. This split keeps each commit small and reviewable.

---

## Task 3: Wire annual cost into the employee page

**Files:**
- Modify: `src/app/dashboard/workforce/[id]/page.tsx`

- [ ] **Step 1: Add imports**

Find the existing imports block at the top of `src/app/dashboard/workforce/[id]/page.tsx`. Add these two new imports.

Add to the existing hooks-import region (alongside `useResolvedScenario`, `useCostCenters`, `useMemberEvents`, `useHRScenarios`):
```typescript
import { useSettings } from '@/hooks/useSettings';
```

Add to the existing lib-import region (alongside `resolveMemberAtDate`):
```typescript
import { computeMemberAnnualCost } from '@/lib/hr/compute';
```

- [ ] **Step 2: Pull settings inside the component**

Inside `EmployeePage`, immediately after the existing `const { costCenters } = useCostCenters();` line, add:

```typescript
  const { settings } = useSettings();
```

- [ ] **Step 3: Compute `annualCost` and `year` via useMemo**

Inside `EmployeePage`, immediately after the existing `resolved` useMemo block (the one that ends with the dependency array `[member, bundle.baseAllocations, canonicalEventsForMember, scenarioEventsForMember, bundle.eventAllocations]`), add:

```typescript
  const year = new Date().getFullYear();

  const annualCost = useMemo(() => {
    if (!member) return 0;
    const events = [...canonicalEventsForMember, ...scenarioEventsForMember];
    return computeMemberAnnualCost(member as Member, events, settings, year);
  }, [member, canonicalEventsForMember, scenarioEventsForMember, settings, year]);
```

`useMemo` is already imported on line 3 of this file (`import { useMemo, useState } from 'react';`), so no import change is needed.

- [ ] **Step 4: Pass props to ActualStateCard**

Find:
```typescript
          {resolved && <ActualStateCard resolved={resolved} costCenters={costCenters} />}
```

Replace with:
```typescript
          {resolved && (
            <ActualStateCard
              resolved={resolved}
              costCenters={costCenters}
              annualCost={annualCost}
              year={year}
            />
          )}
```

- [ ] **Step 5: Run lint to verify the wiring**

Run: `npm run lint`

Expected: lint passes with no errors.

- [ ] **Step 6: Run the unit tests**

Run: `npx vitest run src/lib/hr/`

Expected: all hr tests still pass (compute + resolve), no regressions.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`

Open the app in a browser, navigate to `/dashboard/workforce`, click any employee.

Verify:
- The Actual State card shows a new `Cost (2026)` row beneath `Salary`.
- For an employee with `contract_start_date` set to a January-or-earlier date and no end date, `Cost (2026)` ≈ Salary (within a few euros, due to per-month proration rounding).
- For an employee with `contract_start_date` set to e.g. `2026-03-01` and salary €12,000, `Cost (2026)` ≈ €10,000.
- For a member whose contract ended in 2025 or earlier, `Cost (2026)` is `€0`.
- Switching between the baseline and a scenario in the global view changes the value when the scenario contains a salary event for this member.

Stop the dev server (Ctrl-C) when done.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/workforce/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(workforce): show prorated annual cost on employee page

Wires computeMemberAnnualCost into the employee page so the
Actual State card's new Cost (YYYY) row reflects late starts,
early ends, and mid-year salary changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done

At this point:
- `computeMemberAnnualCost` is exported and unit-tested in `src/lib/hr/compute.ts`.
- `ActualStateCard` requires `annualCost` and `year` props.
- The employee page computes them and renders a `Cost (YYYY)` row beneath `Salary`.
- All commits build and lint individually except the intentional gap between Task 2 and Task 3 (documented in Task 2's commit note).
