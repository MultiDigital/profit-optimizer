# PR 1 — Resolver Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a new pure-function resolver layer (`src/lib/hr/resolve.ts`) that computes an employee's state at a given date from initial fields, canonical events, and optional scenario overlay events — backed by a full unit test suite.

**Architecture:** The resolver is a new, self-contained module. It does not touch Supabase and has no React dependencies. The existing `src/lib/hr/resolve-events.ts` and `src/lib/hr/compute.ts` remain in place and continue to serve `/hr-planning`; they will be migrated and removed in later PRs. This keeps the diff small and the old HR-planning flow untouched.

**Tech Stack:**
- TypeScript (existing)
- Vitest (new — added in Task 1)
- No new runtime dependencies

**Parent spec:** `docs/superpowers/specs/2026-04-14-employee-page-and-timeline-resolver-design.md`

---

## File Structure

New files created by this PR:
- `vitest.config.ts` — Vitest config
- `src/lib/hr/resolve.ts` — pure resolver functions
- `src/lib/hr/resolve.test.ts` — unit tests
- `src/lib/hr/types.ts` — `ResolvedMember` type

Files modified:
- `package.json` — add vitest, `test` script

Files NOT touched:
- `src/lib/hr/resolve-events.ts` (kept, used by existing HR-planning)
- `src/lib/hr/compute.ts` (kept, used by existing HR-planning)
- Any UI / hook file

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/hr/resolve.test.ts` (trivial sanity test)

- [ ] **Step 1: Install vitest and related dev dependencies**

Run:
```bash
npm install --save-dev vitest @vitest/ui
```

Expected: dependencies appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Add `test` script to package.json**

Modify `package.json` `scripts` section to add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Full scripts section after change:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `vitest.config.ts` at the repo root:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Write a sanity test**

Create `src/lib/hr/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs a trivial test', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test to verify setup works**

Run: `npm test`
Expected: PASS — one test suite, one test, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/hr/resolve.test.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Define `ResolvedMember` type

**Files:**
- Create: `src/lib/hr/types.ts`

- [ ] **Step 1: Create the types file**

Create `src/lib/hr/types.ts`:

```ts
import { MemberCategory, SeniorityLevel } from '@/lib/optimizer/types';

/**
 * Snapshot of an employee's state resolved at a specific date.
 * All timed fields reflect the effective value at `resolvedAt`, considering
 * canonical events and any scenario overlay events.
 */
export interface ResolvedMember {
  id: string;
  first_name: string;
  last_name: string;
  contract_start_date: string | null;
  contract_end_date: string | null;

  // Resolved timed fields
  category: MemberCategory;
  seniority: SeniorityLevel | null;
  salary: number;
  ft_percentage: number;
  capacity_percentage: number;
  chargeable_days: number | null;

  // Resolved CDC allocations for this date. Each entry's `percentage`
  // is 0-100. May be empty if the member has no CDC assignment.
  costCenterAllocations: ResolvedCostCenterAllocation[];

  // Whether the member is within contract dates at `resolvedAt`.
  isActive: boolean;

  // The date this snapshot was resolved for ('YYYY-MM-DD').
  resolvedAt: string;
}

export interface ResolvedCostCenterAllocation {
  cost_center_id: string;
  percentage: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hr/types.ts
git commit -m "feat(hr): add ResolvedMember type"
```

---

## Task 3: `isMemberActiveAtDate`

**Files:**
- Create: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the sanity-test content in `src/lib/hr/resolve.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { isMemberActiveAtDate } from './resolve';

describe('isMemberActiveAtDate', () => {
  it('returns true when date is after contract_start and end is null', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2026-06-01')).toBe(true);
  });

  it('returns true when date equals contract_start', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2024-01-15')).toBe(true);
  });

  it('returns true when date equals contract_end', () => {
    expect(isMemberActiveAtDate('2024-01-15', '2026-12-31', '2026-12-31')).toBe(true);
  });

  it('returns false when date is before contract_start', () => {
    expect(isMemberActiveAtDate('2024-01-15', null, '2023-12-31')).toBe(false);
  });

  it('returns false when date is after contract_end', () => {
    expect(isMemberActiveAtDate('2024-01-15', '2026-12-31', '2027-01-01')).toBe(false);
  });

  it('returns true when contract_start is null (no start set)', () => {
    expect(isMemberActiveAtDate(null, null, '2000-01-01')).toBe(true);
  });

  it('returns true when both contract dates are null', () => {
    expect(isMemberActiveAtDate(null, null, '2026-06-01')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — all `isMemberActiveAtDate` tests fail with "is not a function" or similar import error (module doesn't exist yet).

- [ ] **Step 3: Implement `isMemberActiveAtDate`**

Create `src/lib/hr/resolve.ts`:

```ts
/**
 * Returns true if the member is within their contract window at `date`.
 * Bounds are inclusive on both ends.
 * Null start/end means "no bound" on that side.
 *
 * All dates are 'YYYY-MM-DD' strings. Lexical comparison is valid because
 * the ISO date format sorts correctly as strings.
 */
export function isMemberActiveAtDate(
  contractStart: string | null,
  contractEnd: string | null,
  date: string,
): boolean {
  if (contractStart !== null && date < contractStart) return false;
  if (contractEnd !== null && date > contractEnd) return false;
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 7 `isMemberActiveAtDate` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(hr): add isMemberActiveAtDate"
```

---

## Task 4: `resolveFieldAtDate` (private helper)

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/hr/resolve.test.ts`:

```ts
import { resolveFieldAtDate, AnyResolverEvent } from './resolve';

function canonicalEvent(partial: Partial<AnyResolverEvent>): AnyResolverEvent {
  return {
    id: partial.id ?? 'evt-' + Math.random(),
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    priority: 'canonical',
    ...partial,
  } as AnyResolverEvent;
}

function scenarioEvent(partial: Partial<AnyResolverEvent>): AnyResolverEvent {
  return canonicalEvent({ ...partial, priority: 'scenario' });
}

describe('resolveFieldAtDate', () => {
  it('returns undefined when no events match the field', () => {
    const events: AnyResolverEvent[] = [
      canonicalEvent({ field: 'ft_percentage', value: '80' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBeUndefined();
  });

  it('returns undefined when event has not started yet', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '50000', start_date: '2027-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBeUndefined();
  });

  it('returns undefined when event has already ended before date', () => {
    const events = [
      canonicalEvent({
        field: 'salary',
        value: '45000',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2025-06-01')).toBeUndefined();
  });

  it('returns value when date is exactly start_date (inclusive)', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2026-06-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('45000');
  });

  it('returns value when date is exactly end_date (inclusive)', () => {
    const events = [
      canonicalEvent({
        field: 'salary',
        value: '45000',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2024-12-31')).toBe('45000');
  });

  it('returns the most recent event among multiple active ones', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2024-01-01' }),
      canonicalEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });

  it('scenario event wins over canonical event with same start_date', () => {
    const events = [
      canonicalEvent({ field: 'salary', value: '45000', start_date: '2025-01-01' }),
      scenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('60000');
  });

  it('canonical event with later start_date still wins over earlier scenario event', () => {
    const events = [
      scenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
      canonicalEvent({ field: 'salary', value: '48000', start_date: '2025-07-01' }),
    ];
    expect(resolveFieldAtDate(events, 'salary', '2026-06-01')).toBe('48000');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolveFieldAtDate` is not exported.

- [ ] **Step 3: Implement `resolveFieldAtDate` and `AnyResolverEvent`**

Append to `src/lib/hr/resolve.ts`:

```ts
import { MemberEventField } from '@/lib/optimizer/types';

/**
 * Internal event shape used by the resolver.
 * Upstream code wraps canonical MemberEvent (priority='canonical') and
 * scenario ScenarioMemberEvent (priority='scenario') into this shape.
 *
 * The `priority` field controls tie-breaking: when two events have the
 * same start_date on the same field, 'scenario' wins over 'canonical'.
 */
export interface AnyResolverEvent {
  id: string;
  field: MemberEventField;
  value: string;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string | null; // 'YYYY-MM-DD' inclusive, null = ongoing
  priority: 'canonical' | 'scenario';
}

/**
 * Resolve the effective value of a field at a specific date.
 * Returns undefined if no event is active — caller should fall back to
 * the base (initial) value.
 *
 * Precedence:
 * 1. Most recent start_date wins.
 * 2. On tie, scenario events beat canonical.
 */
export function resolveFieldAtDate(
  events: AnyResolverEvent[],
  field: MemberEventField,
  date: string,
): string | undefined {
  const active = events.filter((e) => {
    if (e.field !== field) return false;
    if (e.start_date > date) return false;
    if (e.end_date !== null && e.end_date < date) return false;
    return true;
  });
  if (active.length === 0) return undefined;

  // Sort: start_date DESC, then priority (scenario before canonical) DESC.
  // 'scenario' > 'canonical' lexically works in our favor (s > c),
  // but to be explicit and robust we compare priority numerically.
  const priorityRank = (p: AnyResolverEvent['priority']) =>
    p === 'scenario' ? 1 : 0;
  active.sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return b.start_date.localeCompare(a.start_date);
    }
    return priorityRank(b.priority) - priorityRank(a.priority);
  });
  return active[0].value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `resolveFieldAtDate` tests pass, previous tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(hr): add resolveFieldAtDate with scenario tie-break"
```

---

## Task 5: `resolveCostCenterAllocationsAtDate` (private helper)

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/hr/resolve.test.ts`:

```ts
import { resolveCostCenterAllocationsAtDate } from './resolve';
import { EventCostCenterAllocation } from '@/lib/optimizer/types';

describe('resolveCostCenterAllocationsAtDate', () => {
  it('returns base allocations when no CDC events are active', () => {
    const base = [
      { cost_center_id: 'cc-a', percentage: 60 },
      { cost_center_id: 'cc-b', percentage: 40 },
    ];
    const result = resolveCostCenterAllocationsAtDate(base, [], [], '2026-06-01');
    expect(result).toEqual(base);
  });

  it('returns base allocations when all CDC events are in the future', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-1',
        field: 'cost_center_allocations',
        start_date: '2027-01-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
    ];
    expect(
      resolveCostCenterAllocationsAtDate(base, events, eventAllocs, '2026-06-01'),
    ).toEqual(base);
  });

  it('applies the most recent active CDC event (overrides base)', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-1',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 70,
      },
      {
        id: 'a-2',
        member_event_id: 'evt-1',
        scenario_member_event_id: null,
        cost_center_id: 'cc-c',
        percentage: 30,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(
      base,
      events,
      eventAllocs,
      '2026-06-01',
    );
    expect(result).toEqual([
      { cost_center_id: 'cc-b', percentage: 70 },
      { cost_center_id: 'cc-c', percentage: 30 },
    ]);
  });

  it('picks allocations from the most recent event when multiple active', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      canonicalEvent({
        id: 'evt-old',
        field: 'cost_center_allocations',
        start_date: '2026-01-01',
      }),
      canonicalEvent({
        id: 'evt-new',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: 'evt-old',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
      {
        id: 'a-2',
        member_event_id: 'evt-new',
        scenario_member_event_id: null,
        cost_center_id: 'cc-c',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(
      base,
      events,
      eventAllocs,
      '2026-06-01',
    );
    expect(result).toEqual([{ cost_center_id: 'cc-c', percentage: 100 }]);
  });

  it('resolves scenario event allocations via scenario_member_event_id', () => {
    const base = [{ cost_center_id: 'cc-a', percentage: 100 }];
    const events: AnyResolverEvent[] = [
      scenarioEvent({
        id: 'sevt-1',
        field: 'cost_center_allocations',
        start_date: '2026-05-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'a-1',
        member_event_id: null,
        scenario_member_event_id: 'sevt-1',
        cost_center_id: 'cc-z',
        percentage: 100,
      },
    ];
    const result = resolveCostCenterAllocationsAtDate(
      base,
      events,
      eventAllocs,
      '2026-06-01',
    );
    expect(result).toEqual([{ cost_center_id: 'cc-z', percentage: 100 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolveCostCenterAllocationsAtDate` is not exported.

- [ ] **Step 3: Implement `resolveCostCenterAllocationsAtDate`**

Append to `src/lib/hr/resolve.ts`:

```ts
import { EventCostCenterAllocation } from '@/lib/optimizer/types';
import { ResolvedCostCenterAllocation } from './types';

/**
 * Resolve cost center allocations at a date.
 *
 * Behavior:
 * - If no `cost_center_allocations` event is active, return base allocations.
 * - Otherwise, the most recent active CDC event's allocations completely
 *   replace the base (CDC events are total, not additive).
 * - Scenario tie-break applies, same as resolveFieldAtDate.
 */
export function resolveCostCenterAllocationsAtDate(
  baseAllocations: ResolvedCostCenterAllocation[],
  events: AnyResolverEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedCostCenterAllocation[] {
  const activeCdcEvents = events.filter((e) => {
    if (e.field !== 'cost_center_allocations') return false;
    if (e.start_date > date) return false;
    if (e.end_date !== null && e.end_date < date) return false;
    return true;
  });
  if (activeCdcEvents.length === 0) return baseAllocations;

  const priorityRank = (p: AnyResolverEvent['priority']) =>
    p === 'scenario' ? 1 : 0;
  activeCdcEvents.sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return b.start_date.localeCompare(a.start_date);
    }
    return priorityRank(b.priority) - priorityRank(a.priority);
  });
  const winner = activeCdcEvents[0];

  const winnerAllocations = eventAllocations.filter((a) => {
    if (winner.priority === 'canonical') return a.member_event_id === winner.id;
    return a.scenario_member_event_id === winner.id;
  });

  return winnerAllocations.map((a) => ({
    cost_center_id: a.cost_center_id,
    percentage: a.percentage,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all CDC resolver tests pass, prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(hr): add resolveCostCenterAllocationsAtDate"
```

---

## Task 6: `resolveMemberAtDate`

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/hr/resolve.test.ts`:

```ts
import { resolveMemberAtDate } from './resolve';
import { Member, MemberEvent, ScenarioMemberEvent, MemberCostCenterAllocation } from '@/lib/optimizer/types';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm-1',
    user_id: 'u-1',
    first_name: 'Mario',
    last_name: 'Rossi',
    category: 'dipendente',
    seniority: 'middle',
    salary: 42000,
    chargeable_days: null,
    ft_percentage: 100,
    contract_start_date: '2024-01-15',
    contract_end_date: null,
    ...overrides,
  };
}

function makeMemberEvent(partial: Partial<MemberEvent>): MemberEvent {
  return {
    id: 'e-' + Math.random(),
    user_id: 'u-1',
    member_id: 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    note: null,
    created_at: '2024-01-01T00:00:00Z',
    ...partial,
  };
}

function makeScenarioEvent(partial: Partial<ScenarioMemberEvent>): ScenarioMemberEvent {
  return {
    id: 's-' + Math.random(),
    user_id: 'u-1',
    scenario_member_id: 'm-1',
    field: 'salary',
    value: '0',
    start_date: '2024-01-01',
    end_date: null,
    note: null,
    created_at: '2024-01-01T00:00:00Z',
    ...partial,
  };
}

describe('resolveMemberAtDate', () => {
  it('returns initial state when there are no events', () => {
    const m = makeMember();
    const baseAllocs: MemberCostCenterAllocation[] = [
      { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
    ];
    const resolved = resolveMemberAtDate(m, baseAllocs, [], [], [], '2026-06-01');
    expect(resolved.salary).toBe(42000);
    expect(resolved.seniority).toBe('middle');
    expect(resolved.ft_percentage).toBe(100);
    expect(resolved.capacity_percentage).toBe(100);
    expect(resolved.category).toBe('dipendente');
    expect(resolved.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-a', percentage: 100 },
    ]);
    expect(resolved.isActive).toBe(true);
    expect(resolved.resolvedAt).toBe('2026-06-01');
  });

  it('applies a canonical salary event', () => {
    const m = makeMember();
    const events = [
      makeMemberEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], events, [], [], '2026-06-01');
    expect(resolved.salary).toBe(48000);
  });

  it('parses numeric fields as numbers', () => {
    const m = makeMember();
    const events = [
      makeMemberEvent({ field: 'ft_percentage', value: '80', start_date: '2025-01-01' }),
      makeMemberEvent({ field: 'capacity_percentage', value: '75', start_date: '2025-01-01' }),
      makeMemberEvent({ field: 'chargeable_days', value: '180', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], events, [], [], '2026-06-01');
    expect(resolved.ft_percentage).toBe(80);
    expect(resolved.capacity_percentage).toBe(75);
    expect(resolved.chargeable_days).toBe(180);
  });

  it('applies enum fields as strings (seniority, category)', () => {
    const m = makeMember();
    const events = [
      makeMemberEvent({ field: 'seniority', value: 'senior', start_date: '2025-01-01' }),
      makeMemberEvent({ field: 'category', value: 'freelance', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], events, [], [], '2026-06-01');
    expect(resolved.seniority).toBe('senior');
    expect(resolved.category).toBe('freelance');
  });

  it('scenario event overrides canonical event on same start_date', () => {
    const m = makeMember();
    const canonical = [
      makeMemberEvent({ field: 'salary', value: '48000', start_date: '2025-01-01' }),
    ];
    const scenario = [
      makeScenarioEvent({ field: 'salary', value: '60000', start_date: '2025-01-01' }),
    ];
    const resolved = resolveMemberAtDate(m, [], canonical, scenario, [], '2026-06-01');
    expect(resolved.salary).toBe(60000);
  });

  it('isActive=false when date is before contract_start', () => {
    const m = makeMember({ contract_start_date: '2025-01-01' });
    const resolved = resolveMemberAtDate(m, [], [], [], [], '2024-06-01');
    expect(resolved.isActive).toBe(false);
  });

  it('isActive=false when date is after contract_end', () => {
    const m = makeMember({ contract_start_date: '2024-01-01', contract_end_date: '2025-12-31' });
    const resolved = resolveMemberAtDate(m, [], [], [], [], '2026-06-01');
    expect(resolved.isActive).toBe(false);
  });

  it('uses event-level CDC allocations when a CDC event is active', () => {
    const m = makeMember();
    const baseAllocs: MemberCostCenterAllocation[] = [
      { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
    ];
    const event = makeMemberEvent({
      id: 'evt-cdc',
      field: 'cost_center_allocations',
      value: '',
      start_date: '2026-05-01',
    });
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'ea-1',
        member_event_id: 'evt-cdc',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 100,
      },
    ];
    const resolved = resolveMemberAtDate(m, baseAllocs, [event], [], eventAllocs, '2026-06-01');
    expect(resolved.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-b', percentage: 100 },
    ]);
  });

  it('ft_percentage defaults to 100 when member.ft_percentage is null', () => {
    const m = makeMember({ ft_percentage: null });
    const resolved = resolveMemberAtDate(m, [], [], [], [], '2026-06-01');
    expect(resolved.ft_percentage).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolveMemberAtDate` is not exported.

- [ ] **Step 3: Implement `resolveMemberAtDate`**

Append to `src/lib/hr/resolve.ts`:

```ts
import {
  Member,
  MemberEvent,
  ScenarioMemberEvent,
  MemberCostCenterAllocation,
  MemberCategory,
  SeniorityLevel,
} from '@/lib/optimizer/types';
import { ResolvedMember } from './types';

/**
 * Resolve an employee's full state at a specific date.
 *
 * Inputs:
 * - `member`: the canonical initial state.
 * - `baseAllocations`: initial CDC split (from member_cost_center_allocations).
 *   Only rows for this member should be passed; the caller filters.
 * - `canonicalEvents`: real planned changes for this member.
 * - `scenarioEvents`: optional scenario overlay events for this member
 *   (empty when viewing baseline).
 * - `eventAllocations`: CDC sidecar rows for any cost_center_allocations
 *   events among canonical + scenario. The caller passes the full set;
 *   the resolver filters by event id.
 * - `date`: the 'YYYY-MM-DD' date to resolve at.
 */
export function resolveMemberAtDate(
  member: Member,
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedMember {
  const all: AnyResolverEvent[] = [
    ...canonicalEvents.map((e) => ({
      id: e.id,
      field: e.field,
      value: e.value,
      start_date: e.start_date,
      end_date: e.end_date,
      priority: 'canonical' as const,
    })),
    ...scenarioEvents.map((e) => ({
      id: e.id,
      field: e.field,
      value: e.value,
      start_date: e.start_date,
      end_date: e.end_date,
      priority: 'scenario' as const,
    })),
  ];

  const salaryRaw = resolveFieldAtDate(all, 'salary', date);
  const ftRaw = resolveFieldAtDate(all, 'ft_percentage', date);
  const seniorityRaw = resolveFieldAtDate(all, 'seniority', date);
  const categoryRaw = resolveFieldAtDate(all, 'category', date);
  const capacityRaw = resolveFieldAtDate(all, 'capacity_percentage', date);
  const chargeableRaw = resolveFieldAtDate(all, 'chargeable_days', date);

  const baseForMember = baseAllocations
    .filter((a) => a.member_id === member.id)
    .map((a) => ({ cost_center_id: a.cost_center_id, percentage: a.percentage }));

  const resolvedAllocations = resolveCostCenterAllocationsAtDate(
    baseForMember,
    all,
    eventAllocations,
    date,
  );

  return {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    contract_start_date: member.contract_start_date,
    contract_end_date: member.contract_end_date,

    category: (categoryRaw as MemberCategory | undefined) ?? member.category,
    seniority: (seniorityRaw as SeniorityLevel | undefined) ?? member.seniority,
    salary: salaryRaw !== undefined ? parseFloat(salaryRaw) : member.salary,
    ft_percentage:
      ftRaw !== undefined ? parseFloat(ftRaw) : (member.ft_percentage ?? 100),
    capacity_percentage:
      capacityRaw !== undefined ? parseFloat(capacityRaw) : 100,
    chargeable_days:
      chargeableRaw !== undefined
        ? parseFloat(chargeableRaw)
        : (member.chargeable_days ?? null),

    costCenterAllocations: resolvedAllocations,
    isActive: isMemberActiveAtDate(
      member.contract_start_date,
      member.contract_end_date,
      date,
    ),
    resolvedAt: date,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `resolveMemberAtDate` tests pass, prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(hr): add resolveMemberAtDate combining field and CDC resolution"
```

---

## Task 7: `resolveWorkforceAtDate`

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/hr/resolve.test.ts`:

```ts
import { resolveWorkforceAtDate } from './resolve';

describe('resolveWorkforceAtDate', () => {
  it('resolves each member independently with their own events and allocations', () => {
    const m1 = makeMember({ id: 'm-1', first_name: 'Alice', salary: 40000 });
    const m2 = makeMember({ id: 'm-2', first_name: 'Bob', salary: 50000 });

    const baseAllocs: MemberCostCenterAllocation[] = [
      { id: 'a-1', member_id: 'm-1', cost_center_id: 'cc-a', percentage: 100 },
      { id: 'a-2', member_id: 'm-2', cost_center_id: 'cc-b', percentage: 100 },
    ];

    const canonicalEvents: MemberEvent[] = [
      makeMemberEvent({
        member_id: 'm-1',
        field: 'salary',
        value: '45000',
        start_date: '2025-01-01',
      }),
    ];

    const resolved = resolveWorkforceAtDate(
      [m1, m2],
      baseAllocs,
      canonicalEvents,
      [],
      [],
      '2026-06-01',
    );

    expect(resolved).toHaveLength(2);
    const aliceRes = resolved.find((r) => r.id === 'm-1')!;
    const bobRes = resolved.find((r) => r.id === 'm-2')!;

    expect(aliceRes.salary).toBe(45000);
    expect(aliceRes.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-a', percentage: 100 },
    ]);

    expect(bobRes.salary).toBe(50000);
    expect(bobRes.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-b', percentage: 100 },
    ]);
  });

  it('returns an empty array for empty members input', () => {
    expect(resolveWorkforceAtDate([], [], [], [], [], '2026-06-01')).toEqual([]);
  });

  it('correctly scopes scenario events to their target member', () => {
    const m1 = makeMember({ id: 'm-1', salary: 40000 });
    const m2 = makeMember({ id: 'm-2', salary: 50000 });
    const scenarioEvents: ScenarioMemberEvent[] = [
      makeScenarioEvent({
        scenario_member_id: 'm-1',
        field: 'salary',
        value: '99999',
        start_date: '2025-01-01',
      }),
    ];
    const resolved = resolveWorkforceAtDate(
      [m1, m2],
      [],
      [],
      scenarioEvents,
      [],
      '2026-06-01',
    );
    expect(resolved.find((r) => r.id === 'm-1')!.salary).toBe(99999);
    expect(resolved.find((r) => r.id === 'm-2')!.salary).toBe(50000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolveWorkforceAtDate` is not exported.

- [ ] **Step 3: Implement `resolveWorkforceAtDate`**

Append to `src/lib/hr/resolve.ts`:

```ts
/**
 * Batch resolve a full workforce at a date.
 *
 * Filters events per-member internally:
 * - canonicalEvents filtered by member_id === member.id
 * - scenarioEvents filtered by scenario_member_id === member.id
 *   (in PR 5 this changes to support scenario events referencing
 *   canonical members via member_id; until then, only synthetic
 *   members consume scenarioEvents via this path.)
 */
export function resolveWorkforceAtDate(
  members: Member[],
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedMember[] {
  return members.map((m) => {
    const mCanonical = canonicalEvents.filter((e) => e.member_id === m.id);
    const mScenario = scenarioEvents.filter((e) => e.scenario_member_id === m.id);
    return resolveMemberAtDate(
      m,
      baseAllocations,
      mCanonical,
      mScenario,
      eventAllocations,
      date,
    );
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `resolveWorkforceAtDate` tests pass, prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(hr): add resolveWorkforceAtDate batch resolver"
```

---

## Task 8: `resolveMemberAtYear`

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/hr/resolve.test.ts`:

```ts
import { resolveMemberAtYear } from './resolve';

describe('resolveMemberAtYear', () => {
  it('returns 12 snapshots, one per month', () => {
    const m = makeMember();
    const snaps = resolveMemberAtYear(m, [], [], [], [], 2026);
    expect(snaps).toHaveLength(12);
    expect(snaps[0].resolvedAt).toBe('2026-01-01');
    expect(snaps[11].resolvedAt).toBe('2026-12-01');
  });

  it('reflects mid-year salary change across the 12 monthly snapshots', () => {
    const m = makeMember({ salary: 40000 });
    const events = [
      makeMemberEvent({ field: 'salary', value: '45000', start_date: '2026-07-01' }),
    ];
    const snaps = resolveMemberAtYear(m, [], events, [], [], 2026);
    // Jan-Jun: 40000
    expect(snaps[0].salary).toBe(40000);
    expect(snaps[5].salary).toBe(40000);
    // Jul onwards: 45000
    expect(snaps[6].salary).toBe(45000);
    expect(snaps[11].salary).toBe(45000);
  });

  it('marks months outside contract window as inactive', () => {
    const m = makeMember({
      contract_start_date: '2026-03-15',
      contract_end_date: '2026-09-30',
    });
    const snaps = resolveMemberAtYear(m, [], [], [], [], 2026);
    expect(snaps[0].isActive).toBe(false); // Jan: before start
    expect(snaps[1].isActive).toBe(false); // Feb: before start
    expect(snaps[2].isActive).toBe(false); // Mar 1: still before start (start is Mar 15)
    expect(snaps[3].isActive).toBe(true);  // Apr 1: in range
    expect(snaps[8].isActive).toBe(true);  // Sep 1: in range
    expect(snaps[9].isActive).toBe(false); // Oct 1: after end
    expect(snaps[11].isActive).toBe(false); // Dec: after end
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolveMemberAtYear` is not exported.

- [ ] **Step 3: Implement `resolveMemberAtYear`**

Append to `src/lib/hr/resolve.ts`:

```ts
/**
 * Resolve 12 monthly snapshots for a member across a calendar year.
 * Each snapshot is resolved at the first day of the month.
 */
export function resolveMemberAtYear(
  member: Member,
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  year: number,
): ResolvedMember[] {
  const snapshots: ResolvedMember[] = [];
  for (let m = 1; m <= 12; m++) {
    const date = `${year}-${String(m).padStart(2, '0')}-01`;
    snapshots.push(
      resolveMemberAtDate(
        member,
        baseAllocations,
        canonicalEvents,
        scenarioEvents,
        eventAllocations,
        date,
      ),
    );
  }
  return snapshots;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `resolveMemberAtYear` tests pass, prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(hr): add resolveMemberAtYear (12 monthly snapshots)"
```

---

## Task 9: Public export surface + final integration test

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write an integration test that exercises all public exports together**

Append to `src/lib/hr/resolve.test.ts`:

```ts
describe('resolver integration', () => {
  it('models a realistic employee timeline correctly', () => {
    // Mario: hired 2024-01-15 as Middle @ 42k full-time, CDC A 100%.
    // 2026-05-01: salary bump to 45k.
    // 2026-07-01: CDC realloc to A 60 / B 40.
    // 2027-01-01: promoted to Senior.
    const mario = makeMember({
      id: 'mario',
      seniority: 'middle',
      salary: 42000,
      contract_start_date: '2024-01-15',
    });
    const baseAllocs: MemberCostCenterAllocation[] = [
      { id: 'a-1', member_id: 'mario', cost_center_id: 'cc-a', percentage: 100 },
    ];
    const events: MemberEvent[] = [
      makeMemberEvent({
        member_id: 'mario',
        field: 'salary',
        value: '45000',
        start_date: '2026-05-01',
      }),
      makeMemberEvent({
        id: 'evt-cdc',
        member_id: 'mario',
        field: 'cost_center_allocations',
        value: '',
        start_date: '2026-07-01',
      }),
      makeMemberEvent({
        member_id: 'mario',
        field: 'seniority',
        value: 'senior',
        start_date: '2027-01-01',
      }),
    ];
    const eventAllocs: EventCostCenterAllocation[] = [
      {
        id: 'ea-1',
        member_event_id: 'evt-cdc',
        scenario_member_event_id: null,
        cost_center_id: 'cc-a',
        percentage: 60,
      },
      {
        id: 'ea-2',
        member_event_id: 'evt-cdc',
        scenario_member_event_id: null,
        cost_center_id: 'cc-b',
        percentage: 40,
      },
    ];

    // On 2026-01-01 (before any event): initial state.
    const early = resolveMemberAtDate(mario, baseAllocs, events, [], eventAllocs, '2026-01-01');
    expect(early.salary).toBe(42000);
    expect(early.seniority).toBe('middle');
    expect(early.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-a', percentage: 100 },
    ]);

    // On 2026-06-15: salary bumped, CDC not yet changed.
    const mid = resolveMemberAtDate(mario, baseAllocs, events, [], eventAllocs, '2026-06-15');
    expect(mid.salary).toBe(45000);
    expect(mid.seniority).toBe('middle');
    expect(mid.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-a', percentage: 100 },
    ]);

    // On 2026-08-01: salary bumped AND CDC realloc applied, not yet senior.
    const late = resolveMemberAtDate(mario, baseAllocs, events, [], eventAllocs, '2026-08-01');
    expect(late.salary).toBe(45000);
    expect(late.seniority).toBe('middle');
    expect(late.costCenterAllocations).toEqual([
      { cost_center_id: 'cc-a', percentage: 60 },
      { cost_center_id: 'cc-b', percentage: 40 },
    ]);

    // On 2027-06-01: senior.
    const senior = resolveMemberAtDate(mario, baseAllocs, events, [], eventAllocs, '2027-06-01');
    expect(senior.seniority).toBe('senior');
    expect(senior.salary).toBe(45000);

    // 2026 yearly view: first 4 months initial, month 5 bumped, month 7 CDC realloc.
    const year2026 = resolveMemberAtYear(mario, baseAllocs, events, [], eventAllocs, 2026);
    expect(year2026[3].salary).toBe(42000); // Apr
    expect(year2026[4].salary).toBe(45000); // May
    expect(year2026[5].costCenterAllocations[0].cost_center_id).toBe('cc-a'); // Jun: still 100% A
    expect(year2026[5].costCenterAllocations).toHaveLength(1);
    expect(year2026[6].costCenterAllocations).toHaveLength(2); // Jul: CDC realloc
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — the integration test passes on the existing implementation; no new code should be needed.

If the integration test fails, the issue is in earlier tasks' implementations — fix them there, not by tweaking this test.

- [ ] **Step 3: Verify the full export surface matches the spec**

Open `src/lib/hr/resolve.ts` and confirm these symbols are exported (search for `^export ` lines in the file):

- `isMemberActiveAtDate` (function)
- `resolveFieldAtDate` (function)
- `resolveCostCenterAllocationsAtDate` (function)
- `resolveMemberAtDate` (function)
- `resolveWorkforceAtDate` (function)
- `resolveMemberAtYear` (function)
- `AnyResolverEvent` (interface)

Confirm `src/lib/hr/types.ts` exports:
- `ResolvedMember`
- `ResolvedCostCenterAllocation`

If any symbol is missing, add the `export` keyword in front of its declaration.

- [ ] **Step 4: Run the full test suite and the TypeScript check**

Run:
```bash
npm test && npx tsc --noEmit && npm run lint
```

Expected: all pass, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "test(hr): add integration test for resolver timeline"
```

---

## Done-definition for PR 1

- `npm test` passes with ≥ 30 tests.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes (no regressions in the rest of the app).
- `src/lib/hr/resolve-events.ts` and `src/lib/hr/compute.ts` are unchanged — existing `/hr-planning` flow still renders end-to-end in manual smoke test.
- No UI or hook code touched.

---

## Notes for later PRs (not in scope here)

- PR 2 (employee page) will be the first consumer of `resolveMemberAtDate`.
- PR 5 will widen `AnyResolverEvent.priority`/sourcing logic when scenario
  events gain a `member_id` column and can target canonical members; the
  internal `priority: 'scenario'` flag already supports this semantically.
- PR 6 will delete `resolve-events.ts` and `compute.ts` once the yearly table
  has been ported.
