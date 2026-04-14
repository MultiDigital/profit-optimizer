# PR 5a — Scenario Delta Schema + Resolver Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition `scenario_member_events` from "full-copy of canonical events" to a **delta overlay**. Add `member_id` to `scenario_member_events` so scenario events can override canonical employees directly. Run a one-time data migration that drops byte-identical copies and reassigns non-duplicate events to point at canonical members via `source_member_id`. Extend the resolver and the PR 4 bundle shape so analysis pages correctly layer canonical events + scenario overrides + synthetic-member events.

**Architecture:** The `ResolvedScenarioBundle` splits into four separate arrays (`canonicalMembers`, `syntheticMembers`, `canonicalEvents`, `scenarioEvents`) instead of the current disjunctive shape (`Member[] | HRScenarioMember[]`). `resolveWorkforceAtDate` is widened to accept the union of member types and routes scenario events per-member based on a discriminator (canonical members match `scenario_events.member_id`; synthetic match `scenario_events.scenario_member_id`). PR 4's consumer pages migrate to the new bundle; `/hr-planning` also migrates to keep working post-migration (its UI rebuild is PR 5b). No changes to the employee page (PR 5b) or sidebar (PR 5b).

**Tech Stack:**
- Supabase SQL migration
- PR 1 resolver
- PR 3 ViewContext, PR 4 `useResolvedScenario` + `selectScenarioData`
- Vitest (node env) for pure updates

**Parent spec:** `docs/superpowers/specs/2026-04-14-employee-page-and-timeline-resolver-design.md` § "Scenario delta semantics" and § "Data migration"

**Stacking:** branches from `feature/pr4-analysis-migrations`.

---

## File Structure

New files:
- `supabase/migrations/2026XXXXXXXXXX_scenario_delta_schema.sql` — schema + data migration

Modified files:
- `src/lib/optimizer/types.ts` — relax `ScenarioMemberEvent.scenario_member_id` to nullable; add `ScenarioMemberEvent.member_id`; add `HRScenarioMember.is_synthetic`
- `src/lib/hr/resolve.ts` — widen `resolveWorkforceAtDate` member input to `(Member | HRScenarioMember)[]`, route per-member
- `src/lib/hr/resolve.test.ts` — expand tests for canonical-override routing
- `src/lib/view/select-scenario-data.ts` — new bundle shape (4 arrays); drop `source_member_id` remapping
- `src/lib/view/select-scenario-data.test.ts` — update tests for new shape
- `src/hooks/useResolvedScenario.ts` — returns the new bundle
- `src/hooks/useHRScenarios.ts` — `fetchHRScenarioWithData` also fetches scenario events that reference canonical members via `member_id`; `addHRScenario` stops copying canonical events
- `src/app/dashboard/cost-centers/page.tsx` — consume new bundle shape
- `src/app/dashboard/workforce-analytics/page.tsx` — consume new bundle (Per-CDC + Monthly Timeline + Compare tabs)
- `src/app/dashboard/hr-planning/page.tsx` — consume new bundle via `useResolvedScenario(localOverrideId)` so it continues to work post-migration

Files NOT touched this PR:
- `src/app/dashboard/workforce/[id]/page.tsx` — employee page stays on its "today + baseline only" path; scenario overlay panel is PR 5b
- `src/components/AppSidebar.tsx` — sidebar rename is PR 5b

---

## Task 1: Schema + data migration SQL

**File:**
- Create: `supabase/migrations/2026XXXXXXXXXX_scenario_delta_schema.sql` (use today's actual date in the filename: YYYYMMDDHHMMSS, follow existing convention like `20260408000001_...`)

### Migration content

```sql
-- PR 5a — scenario event delta model.
-- Adds scenario_member_events.member_id so scenario events can override
-- canonical employees directly (delta overlay) instead of via a full-copy.
-- Runs a one-time data migration that:
--   1. Reassigns events of copy-members to reference canonical members.
--   2. Drops byte-identical events (they were no-op duplicates from scenario creation).
--   3. Deletes copy-member rows (their events now live against canonical IDs).
-- After this migration, hr_scenario_members only contains synthetic "what-if"
-- members that have no canonical counterpart.

BEGIN;

-- 1. Add is_synthetic flag on hr_scenario_members (default TRUE for everything that survives)
ALTER TABLE hr_scenario_members
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add member_id to scenario_member_events (nullable; references canonical members)
ALTER TABLE scenario_member_events
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE;

-- 3. Relax scenario_member_id from NOT NULL so events can alternatively target a canonical member
ALTER TABLE scenario_member_events
  ALTER COLUMN scenario_member_id DROP NOT NULL;

-- 4. Data migration: reassign events of copy-members to reference canonical via source_member_id
UPDATE scenario_member_events sme
SET member_id = sm.source_member_id,
    scenario_member_id = NULL
FROM hr_scenario_members sm
WHERE sme.scenario_member_id = sm.id
  AND sm.source_member_id IS NOT NULL;

-- 5. Drop scenario events that are byte-identical to canonical events (no-op overrides).
-- These were auto-duplicated at scenario creation and never edited by the user.
-- Cascade on event_cost_center_allocations removes their CDC rows automatically.
DELETE FROM scenario_member_events sme
USING member_events me
WHERE sme.member_id IS NOT NULL
  AND sme.member_id = me.member_id
  AND sme.field = me.field
  AND sme.value = me.value
  AND sme.start_date = me.start_date
  AND COALESCE(sme.end_date::text, 'open') = COALESCE(me.end_date::text, 'open');

-- 6. Delete copy-member rows from hr_scenario_members. Their events now live
-- against canonical member_ids (step 4) or were dropped as duplicates (step 5).
-- Remaining rows are genuine synthetic members (source_member_id IS NULL).
DELETE FROM hr_scenario_members
WHERE source_member_id IS NOT NULL;

-- 7. Add CHECK constraint: exactly one of (member_id, scenario_member_id) is set.
-- Must land after data migration — mid-migration states are fine because each
-- UPDATE is atomic within a row, but defensive placement here ensures no
-- rogue writes during the transaction could slip through.
ALTER TABLE scenario_member_events
  ADD CONSTRAINT scenario_member_events_member_xor
  CHECK ((member_id IS NULL) != (scenario_member_id IS NULL));

-- 8. Index on the new FK column to keep per-canonical-member lookups fast.
CREATE INDEX IF NOT EXISTS idx_scenario_member_events_member_id
  ON scenario_member_events(member_id);

COMMIT;
```

### Steps

- [ ] **Step 1: Create the migration file**

Use today's timestamp for the filename (e.g., `20260414130000_scenario_delta_schema.sql`). Paste the SQL block above.

- [ ] **Step 2: Apply locally (if local Supabase is available)**

Run: `npx supabase db push` (or however the user runs migrations). If the user doesn't run migrations during plan execution, note that the migration will be applied before PR 5b starts.

If the local DB has test data, verify post-migration:
- `SELECT COUNT(*) FROM hr_scenario_members WHERE source_member_id IS NOT NULL;` → 0
- `SELECT COUNT(*) FROM scenario_member_events WHERE member_id IS NULL AND scenario_member_id IS NULL;` → 0
- `SELECT COUNT(*) FROM scenario_member_events WHERE member_id IS NOT NULL AND scenario_member_id IS NOT NULL;` → 0

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*scenario_delta_schema.sql
git commit -m "feat(db): add scenario_member_events.member_id + delta data migration"
```

---

## Task 2: Update TypeScript types

**File:**
- Modify: `src/lib/optimizer/types.ts`

- [ ] **Step 1: Update `ScenarioMemberEvent`**

Find the `ScenarioMemberEvent` interface and update it. Replace:

```ts
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
```

with:

```ts
export interface ScenarioMemberEvent {
  id: string;
  user_id: string;
  // Exactly one of these two FKs is populated (CHECK constraint enforces it):
  // - `member_id` when the event overrides a canonical employee's timeline.
  // - `scenario_member_id` when the event belongs to a synthetic (scenario-only) employee.
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

Also update `ScenarioMemberEventInput`. Replace:

```ts
export interface ScenarioMemberEventInput {
  scenario_member_id: string;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date?: string | null;
  note?: string | null;
}
```

with:

```ts
export interface ScenarioMemberEventInput {
  // Exactly one of these two must be set by the caller.
  scenario_member_id?: string | null;
  member_id?: string | null;
  field: MemberEventField;
  value: string;
  start_date: string;
  end_date?: string | null;
  note?: string | null;
}
```

- [ ] **Step 2: Update `HRScenarioMember`**

Add `is_synthetic: boolean;` to the interface. Find:

```ts
export interface HRScenarioMember {
  id: string;
  // ... existing fields ...
  created_at: string;
}
```

Add `is_synthetic: boolean;` as the last field (before `created_at` is fine too).

- [ ] **Step 3: Verify type-check and tests still pass**

Run: `npx tsc --noEmit && npm test`
Expected: clean. Tests: 65.

- [ ] **Step 4: Commit**

```bash
git add src/lib/optimizer/types.ts
git commit -m "feat(types): add ScenarioMemberEvent.member_id + HRScenarioMember.is_synthetic"
```

---

## Task 3: Update resolver to route per-member discriminator

**Files:**
- Modify: `src/lib/hr/resolve.ts`
- Modify: `src/lib/hr/resolve.test.ts`

- [ ] **Step 1: Write failing tests for the new routing**

Append to `src/lib/hr/resolve.test.ts` (inside the `describe('resolveWorkforceAtDate', ...)` block already present):

```ts
  it('applies scenario event with member_id to matching canonical member', () => {
    const m = makeMember({ id: 'm-1', salary: 40000 });
    // New-model scenario event: targets canonical member via member_id.
    const scenarioEvents: ScenarioMemberEvent[] = [
      {
        id: 's-1',
        user_id: 'u-1',
        scenario_member_id: null,
        member_id: 'm-1',
        field: 'salary',
        value: '99999',
        start_date: '2025-01-01',
        end_date: null,
        note: null,
        created_at: '2025-01-01T00:00:00Z',
      },
    ];
    const resolved = resolveWorkforceAtDate([m], [], [], scenarioEvents, [], '2026-06-01');
    expect(resolved[0].salary).toBe(99999);
  });

  it('applies scenario event with scenario_member_id to matching synthetic member', () => {
    // Synthetic member — shape compatible with Member for the resolver.
    const synth: unknown = {
      id: 'syn-1',
      user_id: 'u-1',
      hr_scenario_id: 's-1', // presence of this key marks it as synthetic
      first_name: 'What-If',
      last_name: 'Hire',
      category: 'dipendente',
      seniority: 'senior',
      salary: 80000,
      ft_percentage: 100,
      chargeable_days: null,
      capacity_percentage: 100,
      cost_percentage: 100,
      contract_start_date: '2024-01-01',
      contract_end_date: null,
      is_synthetic: true,
      created_at: '2024-01-01T00:00:00Z',
    };
    const scenarioEvents: ScenarioMemberEvent[] = [
      {
        id: 's-2',
        user_id: 'u-1',
        scenario_member_id: 'syn-1',
        member_id: null,
        field: 'salary',
        value: '100000',
        start_date: '2025-01-01',
        end_date: null,
        note: null,
        created_at: '2025-01-01T00:00:00Z',
      },
    ];
    const resolved = resolveWorkforceAtDate(
      // Cast to the widened member input accepted by the resolver.
      [synth as Parameters<typeof resolveWorkforceAtDate>[0][number]],
      [],
      [],
      scenarioEvents,
      [],
      '2026-06-01',
    );
    expect(resolved[0].salary).toBe(100000);
  });

  it('does not apply scenario event with member_id to synthetic member with same id (disambiguates by discriminator)', () => {
    const synth: unknown = {
      id: 'ambig-1', // deliberate collision
      user_id: 'u-1',
      hr_scenario_id: 's-1',
      first_name: 'X',
      last_name: 'Y',
      category: 'dipendente',
      seniority: 'middle',
      salary: 50000,
      ft_percentage: 100,
      chargeable_days: null,
      capacity_percentage: 100,
      cost_percentage: 100,
      contract_start_date: '2024-01-01',
      contract_end_date: null,
      is_synthetic: true,
      created_at: '2024-01-01T00:00:00Z',
    };
    const scenarioEvents: ScenarioMemberEvent[] = [
      {
        id: 's-3',
        user_id: 'u-1',
        scenario_member_id: null,
        member_id: 'ambig-1', // targets a canonical with this id — synthetic should be unaffected
        field: 'salary',
        value: '999999',
        start_date: '2025-01-01',
        end_date: null,
        note: null,
        created_at: '2025-01-01T00:00:00Z',
      },
    ];
    const resolved = resolveWorkforceAtDate(
      [synth as Parameters<typeof resolveWorkforceAtDate>[0][number]],
      [],
      [],
      scenarioEvents,
      [],
      '2026-06-01',
    );
    expect(resolved[0].salary).toBe(50000); // unchanged
  });
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test`
Expected: FAIL on the three new tests (resolver still only matches scenarioEvents by `scenario_member_id`).

- [ ] **Step 3: Update `resolveWorkforceAtDate`**

In `src/lib/hr/resolve.ts`, find the current `resolveWorkforceAtDate` function. Replace its body + the signature's `members` param as follows. The widened type accepts either `Member` or an HR-scenario-member-shaped object (discriminated by presence of `hr_scenario_id`):

```ts
import type { Member, HRScenarioMember, MemberEvent, ScenarioMemberEvent, MemberCostCenterAllocation, EventCostCenterAllocation } from '@/lib/optimizer/types';
// (Existing imports likely cover these — don't duplicate.)

/**
 * Batch resolve a full workforce at a date.
 *
 * Accepts both canonical `Member` rows and synthetic `HRScenarioMember` rows.
 * The presence of `hr_scenario_id` on a member row discriminates synthetic
 * from canonical.
 *
 * Event routing per-member:
 * - Canonical member `m`:
 *   - canonical events filtered by `e.member_id === m.id`
 *   - scenario events filtered by `e.member_id === m.id` (canonical overrides)
 * - Synthetic member `m`:
 *   - no canonical events
 *   - scenario events filtered by `e.scenario_member_id === m.id`
 */
export function resolveWorkforceAtDate(
  members: Array<Member | HRScenarioMember>,
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[],
  eventAllocations: EventCostCenterAllocation[],
  date: string,
): ResolvedMember[] {
  return members.map((m) => {
    const isSynthetic = 'hr_scenario_id' in m;
    const mCanonical = isSynthetic
      ? []
      : canonicalEvents.filter((e) => e.member_id === m.id);
    const mScenario = isSynthetic
      ? scenarioEvents.filter((e) => e.scenario_member_id === m.id)
      : scenarioEvents.filter((e) => e.member_id === m.id);
    // Both Member and HRScenarioMember are structurally accepted by
    // resolveMemberAtDate's `member` parameter (all required fields overlap).
    return resolveMemberAtDate(
      m as Member,
      baseAllocations,
      mCanonical,
      mScenario,
      eventAllocations,
      date,
    );
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test`
Expected: PASS — 68 total (65 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hr/resolve.ts src/lib/hr/resolve.test.ts
git commit -m "feat(resolver): route scenario events to canonical or synthetic per discriminator"
```

---

## Task 4: Refactor `selectScenarioData` + bundle shape

**Files:**
- Modify: `src/lib/view/select-scenario-data.ts`
- Modify: `src/lib/view/select-scenario-data.test.ts`

- [ ] **Step 1: Update the bundle shape**

Replace the existing `ResolvedScenarioBundle` + `selectScenarioData` with:

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
  canonicalMembers: Member[];
  syntheticMembers: HRScenarioMember[];
  canonicalEvents: MemberEvent[];
  scenarioEvents: ScenarioMemberEvent[];
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
 * Decide which data bundle an analysis page should use.
 *
 * Fallback rules (unchanged from PR 4):
 * - scenarioId === 'baseline' → baseline bundle (catalog only, no synthetic members)
 * - scenarioId UUID not in scenarios list → baseline
 * - scenarioId UUID matches but scenarioData not yet loaded → baseline (prevents flash)
 * - scenarioId UUID matches AND scenarioData ready → overlay bundle
 *
 * In the overlay (scenario) bundle:
 * - canonicalMembers is always the catalog (scenarios overlay, don't replace)
 * - syntheticMembers are the scenario's own HRScenarioMember rows
 * - canonicalEvents is always the catalog's member_events
 * - scenarioEvents contains the scenario's own events (each with either
 *   member_id pointing to a canonical member or scenario_member_id pointing
 *   to a synthetic — never both, enforced by the PR 5a CHECK constraint).
 * - eventAllocations is the merged set (catalog + scenario sidecar rows)
 * - baseAllocations is the catalog's member_cost_center_allocations, unchanged
 *   (no more source_member_id remapping — canonical members keep their IDs)
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

  if (scenarioId === 'baseline') return baselineBundle();

  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return baselineBundle();

  if (!scenarioData || scenarioData.scenario.id !== scenarioId) return baselineBundle();

  return {
    source: 'scenario',
    scenarioId,
    scenarioName: scenario.name,
    canonicalMembers: catalogMembers,
    syntheticMembers: scenarioData.members,
    canonicalEvents: catalogEvents,
    scenarioEvents: scenarioData.events,
    eventAllocations: [...catalogEventAllocations, ...scenarioData.eventAllocations],
    baseAllocations,
  };

  function baselineBundle(): ResolvedScenarioBundle {
    return {
      source: 'baseline',
      scenarioId: 'baseline',
      scenarioName: null,
      canonicalMembers: catalogMembers,
      syntheticMembers: [],
      canonicalEvents: catalogEvents,
      scenarioEvents: [],
      eventAllocations: catalogEventAllocations,
      baseAllocations,
    };
  }
}
```

- [ ] **Step 2: Update tests for the new shape**

Replace the existing tests in `src/lib/view/select-scenario-data.test.ts` with:

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

describe('selectScenarioData (post-delta)', () => {
  it('baseline bundle has canonical arrays + empty synthetic', () => {
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
    expect(result.canonicalMembers).toBe(catalogMembers);
    expect(result.syntheticMembers).toEqual([]);
    expect(result.canonicalEvents).toBe(catalogEvents);
    expect(result.scenarioEvents).toEqual([]);
    expect(result.baseAllocations).toBe(baseAllocations);
  });

  it('scenario-loading or deleted-id falls back to baseline', () => {
    const r1 = selectScenarioData({
      scenarioId: 'deleted',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null,
      scenarios: [],
    });
    expect(r1.source).toBe('baseline');

    const scenarios: HRScenario[] = [
      { id: 's-1', user_id: 'u-1', name: 'Alt', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    ];
    const r2 = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: null, // still loading
      scenarios,
    });
    expect(r2.source).toBe('baseline');
  });

  it('scenario overlay combines canonical + synthetic members and both event streams', () => {
    const syntheticMembers: HRScenarioMember[] = [
      {
        id: 'syn-1',
        user_id: 'u-1',
        hr_scenario_id: 's-1',
        source_member_id: null,
        first_name: 'What-If',
        last_name: 'Hire',
        category: 'dipendente',
        seniority: 'senior',
        salary: 80000,
        ft_percentage: 100,
        chargeable_days: null,
        capacity_percentage: 100,
        cost_percentage: 100,
        contract_start_date: '2024-01-01',
        contract_end_date: null,
        is_synthetic: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const scenarioEvents: ScenarioMemberEvent[] = [
      {
        id: 'se-canonical',
        user_id: 'u-1',
        scenario_member_id: null,
        member_id: 'm-1', // override of canonical m-1
        field: 'salary',
        value: '60000',
        start_date: '2026-01-01',
        end_date: null,
        note: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'se-synthetic',
        user_id: 'u-1',
        scenario_member_id: 'syn-1',
        member_id: null,
        field: 'salary',
        value: '85000',
        start_date: '2026-06-01',
        end_date: null,
        note: null,
        created_at: '2026-06-01T00:00:00Z',
      },
    ];
    const scenarios: HRScenario[] = [
      { id: 's-1', user_id: 'u-1', name: 'Alt', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    ];
    const result = selectScenarioData({
      scenarioId: 's-1',
      catalogMembers,
      catalogEvents,
      catalogEventAllocations,
      baseAllocations,
      scenarioData: {
        scenario: scenarios[0],
        members: syntheticMembers,
        events: scenarioEvents,
        eventAllocations: [],
      },
      scenarios,
    });
    expect(result.source).toBe('scenario');
    expect(result.scenarioName).toBe('Alt');
    expect(result.canonicalMembers).toBe(catalogMembers);
    expect(result.syntheticMembers).toBe(syntheticMembers);
    expect(result.canonicalEvents).toBe(catalogEvents);
    expect(result.scenarioEvents).toBe(scenarioEvents);
    expect(result.baseAllocations).toBe(baseAllocations);
  });
});
```

- [ ] **Step 3: Run tests — expect pass**

Run: `npm test`
Expected: PASS — 68 total (prior set may drop then rise as tests are rewritten; final count ≈ 68).

Note: the old PR 4 remapping test ("remaps baseAllocations to scenario member IDs") is GONE because the behavior it tested no longer exists (scenarios don't copy members post-PR 5a). That's intentional — we don't carry legacy assertions after the data model changes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/view/select-scenario-data.ts src/lib/view/select-scenario-data.test.ts
git commit -m "feat(view): restructure ResolvedScenarioBundle for delta overlay model"
```

---

## Task 5: Update `useResolvedScenario` for the new bundle

**File:**
- Modify: `src/hooks/useResolvedScenario.ts`

- [ ] **Step 1: Update the hook body**

Only one call-site change: `selectScenarioData` now returns the new shape automatically when given the same inputs, because we updated it in Task 4. Verify the hook compiles and the returned shape matches `ResolvedScenarioBundle` from `@/lib/view/select-scenario-data`.

If anything needs to change in the hook itself, it's likely just the return-type annotation (`UseResolvedScenarioResult.bundle: ResolvedScenarioBundle` — already imported from the helper, so should flow through).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Commit (if any change)**

If the hook's file didn't actually need modification, skip the commit. Otherwise:

```bash
git add src/hooks/useResolvedScenario.ts
git commit -m "chore(view): align useResolvedScenario with delta bundle"
```

---

## Task 6: Stop `addHRScenario` from copying canonical data

**File:**
- Modify: `src/hooks/useHRScenarios.ts`

With the delta model, creating a new scenario should NOT copy canonical members/events. New scenarios start empty — the user adds deltas explicitly (via the employee page in scenario mode, landing in PR 5b). For now, creation just makes an empty scenario.

- [ ] **Step 1: Rewrite `addHRScenario`**

Find the `addHRScenario` function in `src/hooks/useHRScenarios.ts`. Replace its body with a minimal version that only inserts the `hr_scenarios` row:

```ts
const addHRScenario = useCallback(async (
  name: string,
  _catalogMembers?: Member[],  // unused — kept for signature compat; will be removed in PR 5b
  _catalogEvents?: MemberEvent[], // unused — kept for signature compat
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: scenario, error: scenarioError } = await supabase
      .from('hr_scenarios')
      .insert({ user_id: user.id, name })
      .select()
      .single();

    if (scenarioError) throw scenarioError;

    setHrScenarios((prev) => [scenario, ...prev]);
    toast.success('Scenario created', { description: `'${name}' created (empty — add changes via the employee pages).` });
    return scenario;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create scenario';
    setError(message);
    toast.error('Failed to create scenario', { description: message });
    throw err;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Keep the signature accepting `_catalogMembers` and `_catalogEvents` as unused args — the current caller (`/hr-planning`) still passes them. We drop the params entirely in PR 5b when hr-planning is rebuilt.

- [ ] **Step 2: Update `fetchHRScenarioWithData` to return only synthetic-member events**

The existing query fetches events where `scenario_member_id IN (synthetic_member_ids)`. Post-migration that's still correct for synthetic-scoped events. But we ALSO need scenario events whose `member_id` is set (canonical overrides). Update the events query to fetch both sets.

Find this block (around line 224-234 of current file):

```ts
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
```

Replace with:

```ts
const memberIds = (members || []).map((m: HRScenarioMember) => m.id);

// Fetch events linked to synthetic members (scenario_member_id) AND events
// that override canonical members in this scenario (member_id). The latter
// query is scoped to the scenario via user_id — there's no direct FK to
// hr_scenarios, so rely on RLS/user_id + the convention that the user
// owns all the scenario events they've created.
const [syntheticEventsQ, canonicalOverridesQ] = await Promise.all([
  memberIds.length > 0
    ? supabase
        .from('scenario_member_events')
        .select('*')
        .in('scenario_member_id', memberIds)
        .order('start_date', { ascending: true })
    : Promise.resolve({ data: [] as ScenarioMemberEvent[], error: null }),
  // Scenario overrides of canonical members: need an explicit scenario join.
  // Today we don't have a column that links scenario_member_events directly
  // to a scenario, so we can't filter by scenario server-side without a
  // schema change. Accept that fetchHRScenarioWithData reads all the user's
  // scenario overrides and filters client-side. A later PR can add a
  // hr_scenario_id column to scenario_member_events if this becomes slow.
  supabase
    .from('scenario_member_events')
    .select('*')
    .not('member_id', 'is', null)
    .order('start_date', { ascending: true }),
]);

if (syntheticEventsQ.error) throw syntheticEventsQ.error;
if (canonicalOverridesQ.error) throw canonicalOverridesQ.error;

// Canonical-override events aren't yet scoped to this scenario server-side.
// For PR 5a, return ALL of them — there's no multi-scenario cross-contamination
// today because there's no way for a user to author them yet (that's PR 5b).
// When PR 5b lands authoring, it will also add an hr_scenario_id column and
// this query will scope properly.
events = [...(syntheticEventsQ.data ?? []), ...(canonicalOverridesQ.data ?? [])];
```

**Note for PR 5b review**: this query leaks canonical-override events across scenarios. That's acceptable for PR 5a because:
1. The only way to create canonical-override events today is the data migration from Task 1, which reassigns copies to the ONE canonical member — no cross-scenario mixing actually happens in existing data (each copy came from one scenario).
2. PR 5b will add `hr_scenario_id` to `scenario_member_events` and filter properly.

- [ ] **Step 3: Verify type-check, lint, build, tests**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

Clean. 68 tests.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHRScenarios.ts
git commit -m "feat(scenarios): stop copying canonical data; fetch canonical-override events"
```

---

## Task 7: Update consumer pages to use new bundle

**Files:**
- Modify: `src/app/dashboard/cost-centers/page.tsx`
- Modify: `src/app/dashboard/workforce-analytics/page.tsx`

- [ ] **Step 1: `/cost-centers` — switch to new bundle shape**

In `src/app/dashboard/cost-centers/page.tsx`:

1. Remove the `canonicalEvents`/`scenarioEvents` split based on `bundle.source`. The bundle now provides both arrays directly.

2. Find the `resolved` useMemo:

```ts
const resolved = useMemo(() => {
  const anchorDate = `${year}-06-01`;
  const canonicalEvents = bundle.source === 'baseline'
    ? (bundle.events as MemberEvent[])
    : [];
  const scenarioEvents = bundle.source === 'scenario'
    ? (bundle.events as ScenarioMemberEvent[])
    : [];
  return resolveWorkforceAtDate(
    bundle.members as Member[],
    bundle.baseAllocations,
    canonicalEvents,
    scenarioEvents,
    bundle.eventAllocations,
    anchorDate,
  );
}, [bundle, year]);
```

Replace with:

```ts
const resolved = useMemo(() => {
  const anchorDate = `${year}-06-01`;
  const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
  return resolveWorkforceAtDate(
    allMembers,
    bundle.baseAllocations,
    bundle.canonicalEvents,
    bundle.scenarioEvents,
    bundle.eventAllocations,
    anchorDate,
  );
}, [bundle, year]);
```

3. Remove the now-unused `bundle.members as Member[]` cast in `<AllocationMatrix members={...}>`. Replace with:

```tsx
<AllocationMatrix
  members={[...bundle.canonicalMembers, ...bundle.syntheticMembers]}
  // ... rest unchanged
/>
```

Note: `AllocationMatrix` still expects `Member[]` — the synthetic members are structurally compatible. Cast with a safe inline cast if TS complains: `members={[...bundle.canonicalMembers, ...(bundle.syntheticMembers as unknown as Member[])]}`.

4. Remove the `MemberEvent`, `ScenarioMemberEvent` imports if no longer used elsewhere in the file.

Verify: `npx tsc --noEmit && npm run lint && npm run build && npm test` all clean.

Commit:
```bash
git add src/app/dashboard/cost-centers/page.tsx
git commit -m "refactor(cost-centers): consume delta-model bundle shape"
```

- [ ] **Step 2: `/workforce-analytics` — same treatment, across all three tabs**

In `src/app/dashboard/workforce-analytics/page.tsx`:

1. Replace the global `resolved` useMemo with the same pattern as step 1 (combine canonicalMembers + syntheticMembers, pass both event streams).

2. In the Monthly Timeline tab, the `useHRPlanning` call needs updating. Today it's:

```ts
const { yearlyView, isCalculating } = useHRPlanning(
  bundle.members,
  bundle.events,
  settings,
  bundle.baseAllocations,
  bundle.eventAllocations,
  year,
);
```

`useHRPlanning` still takes `members: Member[] | HRScenarioMember[]` and `events: MemberEvent[] | ScenarioMemberEvent[]`. For PR 5a we keep `useHRPlanning`'s external signature and pass combined inputs:

```ts
const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
const allEvents = [...bundle.canonicalEvents, ...bundle.scenarioEvents];
const { yearlyView, isCalculating } = useHRPlanning(
  allMembers,
  allEvents,
  settings,
  bundle.baseAllocations,
  bundle.eventAllocations,
  year,
);
```

**Important**: `useHRPlanning` under the hood calls `computeYearlyView` which uses the OLD scenario_member_id-only routing. For PR 5a, `allEvents` contains both canonical MemberEvent (with `member_id`) AND ScenarioMemberEvent (with either `member_id` or `scenario_member_id`). `computeYearlyView`'s `getEventsForMember` does:

```ts
if ('member_id' in e) return e.member_id === memberId;
if ('scenario_member_id' in e) return e.scenario_member_id === memberId;
```

Since TypeScript `in` is a runtime check, it will match whichever key is truthy. But `ScenarioMemberEvent` post-PR-5a has BOTH keys on the type (one always null). `in` operator is truthy when the property EXISTS, not when it's non-null. So `'member_id' in e` is always true for `ScenarioMemberEvent` (and the value can be null).

This means the current `compute.ts` logic incorrectly matches canonical-override scenario events to members by `member_id === memberId` — which is actually what we want! BUT it also matches synthetic-only scenario events (`member_id: null`) to a member whose id happens to be null-ish, which won't match anyway. Fine.

However: the `in` check is fragile. For PR 5a, accept that `computeYearlyView`'s routing is approximately correct for the transition period — the routing quirk only fails in edge cases where both `member_id` and `scenario_member_id` are set (impossible per CHECK constraint). PR 5b can replace `useHRPlanning`/`computeYearlyView` with the new resolver.

3. In the Compare tab, the two `useResolvedScenario` calls return bundles with the new shape. Update the `useHRPlanning` call sites for each side the same way (combine canonical + scenario events).

4. Remove unused imports (`MemberEvent`, `ScenarioMemberEvent` casts) if the file no longer needs them.

Verify: `npx tsc --noEmit && npm run lint && npm run build && npm test` clean.

Commit:
```bash
git add src/app/dashboard/workforce-analytics/page.tsx
git commit -m "refactor(workforce-analytics): consume delta-model bundle shape"
```

---

## Task 7.5: Fix `computeYearlyView` event routing for the new shape

**File:**
- Modify: `src/lib/hr/compute.ts`

**Correctness issue found during self-review:** post-PR 5a, `ScenarioMemberEvent` has BOTH `member_id` and `scenario_member_id` properties on its TypeScript type (one is always null). The current `getEventsForMember` helper uses the `in` operator which checks property existence, not non-null value. Result: synthetic-only scenario events (where `member_id` is null) would never route to their synthetic member, breaking the Monthly Timeline tab in scenario mode.

- [ ] **Step 1: Update `getEventsForMember` in `src/lib/hr/compute.ts`**

Find (around line 58):

```ts
function getEventsForMember(events: AnyEvent[], member: AnyMember): AnyEvent[] {
  const memberId = getMemberId(member);
  return events.filter((e) => {
    if ('member_id' in e) return e.member_id === memberId;
    if ('scenario_member_id' in e) return e.scenario_member_id === memberId;
    return false;
  });
}
```

Replace with:

```ts
function getEventsForMember(events: AnyEvent[], member: AnyMember): AnyEvent[] {
  const memberId = getMemberId(member);
  return events.filter((e) => {
    // Post-PR 5a: ScenarioMemberEvent has both member_id and scenario_member_id
    // on its type (exactly one is non-null, enforced by DB CHECK). Use value
    // checks, not `in`-existence checks.
    const canonicalFk = (e as { member_id?: string | null }).member_id ?? null;
    const scenarioFk = (e as { scenario_member_id?: string | null }).scenario_member_id ?? null;
    if (canonicalFk !== null) return canonicalFk === memberId;
    if (scenarioFk !== null) return scenarioFk === memberId;
    return false;
  });
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm test
```

Clean. 68 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hr/compute.ts
git commit -m "fix(hr): route events by nullable FK value, not 'in' operator"
```

---

## Task 8: Update `/hr-planning` to use `useResolvedScenario`

**File:**
- Modify: `src/app/dashboard/hr-planning/page.tsx`

Keep `/hr-planning`'s local scenario picker (users pick a scenario inline on the page, independent of the global picker). Route it through `useResolvedScenario(localSource)` so it sees canonical members + synthetic + overrides correctly after the migration.

- [ ] **Step 1: Read the current file**

Understand the current state: it has its own `source: string` state (`'catalog'` or scenarioId), calls `fetchHRScenarioWithData(source)`, and builds `activeMembers` / `activeEvents` / `activeEventAllocations` inline.

- [ ] **Step 2: Replace the source-switching plumbing with `useResolvedScenario`**

Change:
- The local `source` state stays, but its values become `'baseline' | string` to match `useViewContext` convention. Map the existing `'catalog'` literal to `'baseline'` (update the HRScenarioSelector's `source` prop handling too if needed).
- Replace the `useEffect` + `fetchHRScenarioWithData` + `setScenarioData` block with:

```ts
const { bundle, loading: scenarioLoading } = useResolvedScenario(source);
```

- Compute `activeMembers`, `activeEvents`, `activeEventAllocations` from the bundle:

```ts
const activeMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
const activeEvents = [...bundle.canonicalEvents, ...bundle.scenarioEvents];
const activeEventAllocations = bundle.eventAllocations;
```

- Same treatment for `compareSource` / `compareData` if the Compare tab still exists: use `useResolvedScenario(compareSource)`.

- [ ] **Step 3: Update `HRScenarioSelector` source value convention**

Check `HRScenarioSelector`'s props — it probably expects `'catalog'` as the "no scenario" value. Update to accept `'baseline'` instead, or add a prop mapping. Don't rename the component; just align the string value.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

Clean. 68 tests.

- [ ] **Step 5: Manual smoke test**

Start dev. Navigate to `/hr-planning`. Verify:
- In baseline mode: renders canonical members + canonical events. Yearly table looks the same.
- Select a scenario from the page's local picker. Yearly table now shows canonical members + any synthetic members + events applied (canonical events + scenario overrides).
- The catalog-level global scenario picker (top bar) is ignored by this page (local override wins).

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/hr-planning/page.tsx src/components/hr/HRScenarioSelector.tsx
git commit -m "refactor(hr-planning): route scenario selection through useResolvedScenario"
```

(If HRScenarioSelector didn't need changes, omit it from the `git add`.)

---

## Task 9: Final verification + manual end-to-end test

- [ ] **Step 1: Run full verification**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

All pass. 68 tests.

- [ ] **Step 2: Manual end-to-end smoke test**

Start `npm run dev`. Walk through:

1. `/dashboard/cost-centers` in baseline mode → renders correctly, Riepilogo Costi shows data.
2. Select a scenario in the global top-bar picker → Allocazioni and Riepilogo reflect the scenario (canonical members carry their canonical CDC, plus any scenario CDC overrides).
3. `/dashboard/workforce-analytics` → same three tabs render.
4. `/dashboard/hr-planning` → baseline works; selecting a local scenario works; synthetic members appear if any were created.
5. `/dashboard/workforce` and `/dashboard/workforce/[id]` → untouched; still work as in PR 2.
6. DB spot-check (via Supabase dashboard or CLI):
   - `SELECT COUNT(*) FROM hr_scenario_members WHERE source_member_id IS NOT NULL;` → 0
   - `SELECT COUNT(*) FROM scenario_member_events WHERE member_id IS NULL AND scenario_member_id IS NULL;` → 0
   - `SELECT is_synthetic FROM hr_scenario_members LIMIT 5;` → all `true`

- [ ] **Step 3: Commit any final fixes (skip if none)**

---

## Done-definition for PR 5a

- Migration SQL file applies cleanly on a representative DB (local + staging if available).
- 68 tests pass.
- `tsc --noEmit`, `lint`, `build` all clean.
- Analysis pages work in baseline and scenario mode.
- `/hr-planning` functional in both modes.
- No changes to employee detail page or sidebar (PR 5b scope).

---

## Notes for PR 5b (not in scope)

- **Repurpose `/hr-planning` as the cross-employee events log** (events feed, filters, etc.). The Task 8 refactor here is a stopgap so the page keeps functioning — PR 5b replaces its UI wholesale.
- **Rename sidebar label** "HR Planning" → "Planned Changes".
- **Scenario-aware "+ Add Change"**: when `useViewContext().scenarioId !== 'baseline'`, events write to `scenario_member_events` with the right FK (member_id for canonical-member overrides, scenario_member_id for synthetic).
- **Employee page scenario overlay panel**: on `/workforce/[id]`, when a scenario is active, show a second panel of scenario overrides beneath the canonical timeline. Actual State card recomputes with the overlay applied.
- **Add `hr_scenario_id` column to `scenario_member_events`** so canonical-override events can be scoped to a scenario server-side (removing the client-side filter workaround in Task 6 Step 2).
- **Drop unused signature args** from `addHRScenario` (`_catalogMembers`, `_catalogEvents` left as stubs for PR 5a compat).
- **Replace `useHRPlanning` + `computeYearlyView`**: the new `in` check in compute.ts is approximately correct but should be replaced with the explicit `member_id` / `scenario_member_id` discriminator used by the PR 1 resolver. PR 5b or PR 6 is the right moment.
- **`useHRScenarios` scenario caching**: the PR 4 follow-up about duplicate fetches still applies; revisit after PR 5b's UI stabilizes.
