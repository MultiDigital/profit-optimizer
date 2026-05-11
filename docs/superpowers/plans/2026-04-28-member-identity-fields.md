# Member Identity Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three nullable identity fields (`gender`, `contract_type`, `livello`) to every member, persisted across the canonical `members` table and both scenario member tables, surfaced in the Add/Edit dialogs and the Initial State card.

**Architecture:** Pure metadata addition — no event versioning, no optimizer/cost-math changes. Each field is a TypeScript literal-union backed by a Postgres `TEXT` column with a CHECK constraint allowing `NULL`. Existing rows stay legal because all three columns default to `NULL`. Mirrored across `members`, `scenario_members_data`, `hr_scenario_members`. Inserts / copy sites in `useScenarios.ts` and `useHRScenarios.ts` are extended to propagate the new fields; update sites already spread the input and need no change.

**Tech Stack:** Next.js 16 + TypeScript, Supabase Postgres, shadcn/ui Selects, vitest.

**Reference spec:** `docs/superpowers/specs/2026-04-28-member-identity-fields-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260428000001_add_member_identity_fields.sql` — adds 3 nullable TEXT columns + CHECK constraints to each of 3 tables.
- `src/lib/optimizer/types.test.ts` — vitest exhaustiveness tests for the three new enum/label pairs.

**Modify:**
- `src/lib/optimizer/types.ts` — add 3 enums + label records, extend 6 interfaces, extend `DEFAULT_MEMBER`.
- `src/hooks/useScenarios.ts` — extend 3 copy sites (insert ~line 133, resync ~line 281, duplicate ~line 387).
- `src/hooks/useHRScenarios.ts` — extend 2 copy sites (duplicate ~line 180, synthetic create ~line 349).
- `src/components/workforce/WorkforceCard.tsx` — add 3 Selects to the create dialog.
- `src/components/workforce/MemberList.tsx` — add 3 Selects to the edit dialog and seed `formData` from the editing member.
- `src/components/workforce/InitialStateCard.tsx` — add 3 `<FieldRow>` rows.

`useMembers.ts` requires NO changes: `addMember` and `updateMember` spread `MemberInput` so they pick up new keys automatically once `MemberInput` is extended.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260428000001_add_member_identity_fields.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add identity / contract metadata fields to members and both scenario member tables.
-- All three columns are nullable; existing rows get NULL and remain legal.

ALTER TABLE members
  ADD COLUMN gender TEXT
    CHECK (gender IS NULL OR gender IN ('maschio', 'femmina')),
  ADD COLUMN contract_type TEXT
    CHECK (contract_type IS NULL OR contract_type IN (
      'indeterminato', 'determinato', 'stage',
      'prestazione_occasionale', 'piva',
      'apprendistato', 'amministratore'
    )),
  ADD COLUMN livello TEXT
    CHECK (livello IS NULL OR livello IN ('6', '5', '4', '3', '2', '1', 'Q'));

ALTER TABLE scenario_members_data
  ADD COLUMN gender TEXT
    CHECK (gender IS NULL OR gender IN ('maschio', 'femmina')),
  ADD COLUMN contract_type TEXT
    CHECK (contract_type IS NULL OR contract_type IN (
      'indeterminato', 'determinato', 'stage',
      'prestazione_occasionale', 'piva',
      'apprendistato', 'amministratore'
    )),
  ADD COLUMN livello TEXT
    CHECK (livello IS NULL OR livello IN ('6', '5', '4', '3', '2', '1', 'Q'));

ALTER TABLE hr_scenario_members
  ADD COLUMN gender TEXT
    CHECK (gender IS NULL OR gender IN ('maschio', 'femmina')),
  ADD COLUMN contract_type TEXT
    CHECK (contract_type IS NULL OR contract_type IN (
      'indeterminato', 'determinato', 'stage',
      'prestazione_occasionale', 'piva',
      'apprendistato', 'amministratore'
    )),
  ADD COLUMN livello TEXT
    CHECK (livello IS NULL OR livello IN ('6', '5', '4', '3', '2', '1', 'Q'));
```

- [ ] **Step 2: Apply the migration to Supabase**

Run: `npx supabase db push`
Expected: migration applies cleanly. If your local Supabase is unreachable, skip the push — the migration will run on the next normal deploy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428000001_add_member_identity_fields.sql
git commit -m "feat(db): add gender, contract_type, livello to member tables"
```

---

## Task 2: TypeScript enums, label records, exhaustiveness tests (TDD)

**Files:**
- Modify: `src/lib/optimizer/types.ts` (add ~50 lines after the `SENIORITY_SHORT_LABELS` block ending at line 33, before `// Database models` at line 35).
- Create: `src/lib/optimizer/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/optimizer/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  GENDERS,
  GENDER_LABELS,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  LIVELLI,
  LIVELLO_LABELS,
} from './types';

describe('identity field enums are exhaustive', () => {
  it('every Gender has a label', () => {
    for (const g of GENDERS) expect(GENDER_LABELS[g]).toBeDefined();
    expect(Object.keys(GENDER_LABELS)).toHaveLength(GENDERS.length);
  });

  it('every ContractType has a label', () => {
    for (const c of CONTRACT_TYPES) expect(CONTRACT_TYPE_LABELS[c]).toBeDefined();
    expect(Object.keys(CONTRACT_TYPE_LABELS)).toHaveLength(CONTRACT_TYPES.length);
  });

  it('every Livello has a label', () => {
    for (const l of LIVELLI) expect(LIVELLO_LABELS[l]).toBeDefined();
    expect(Object.keys(LIVELLO_LABELS)).toHaveLength(LIVELLI.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/optimizer/types.test.ts`
Expected: FAIL — imports `GENDERS`, `GENDER_LABELS`, etc. do not exist yet.

- [ ] **Step 3: Add the enums and labels to `types.ts`**

In `src/lib/optimizer/types.ts`, insert this block immediately after line 33 (the `};` that closes `SENIORITY_SHORT_LABELS`) and before line 35 (`// Database models`):

```ts

// Gender
export type Gender = 'maschio' | 'femmina';

export const GENDERS: Gender[] = ['maschio', 'femmina'];

export const GENDER_LABELS: Record<Gender, string> = {
  maschio: 'Maschio',
  femmina: 'Femmina',
};

// Contract type
export type ContractType =
  | 'indeterminato'
  | 'determinato'
  | 'stage'
  | 'prestazione_occasionale'
  | 'piva'
  | 'apprendistato'
  | 'amministratore';

export const CONTRACT_TYPES: ContractType[] = [
  'indeterminato',
  'determinato',
  'stage',
  'prestazione_occasionale',
  'piva',
  'apprendistato',
  'amministratore',
];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  indeterminato: 'Indeterminato',
  determinato: 'Determinato',
  stage: 'Stage',
  prestazione_occasionale: 'Prestazione occasionale',
  piva: 'PIVA',
  apprendistato: 'Apprendistato',
  amministratore: 'Amministratore',
};

// Livello (CCNL level)
export type Livello = '6' | '5' | '4' | '3' | '2' | '1' | 'Q';

export const LIVELLI: Livello[] = ['6', '5', '4', '3', '2', '1', 'Q'];

export const LIVELLO_LABELS: Record<Livello, string> = {
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
  '1': '1',
  Q: 'Q',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/optimizer/types.test.ts`
Expected: PASS — all three test cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/optimizer/types.ts src/lib/optimizer/types.test.ts
git commit -m "feat(types): add Gender, ContractType, Livello enums with exhaustiveness tests"
```

---

## Task 3: Extend interfaces and `DEFAULT_MEMBER`

**Files:**
- Modify: `src/lib/optimizer/types.ts`

This task adds three optional nullable fields — `gender`, `contract_type`, `livello` — to the six member-shaped interfaces, and three `null` keys to `DEFAULT_MEMBER`.

- [ ] **Step 1: Extend `Member` interface (around line 36-50)**

Add the three fields to `Member` after `ft_percentage` and before `contract_start_date`:

```ts
  ft_percentage?: number | null;
  gender?: Gender | null;
  contract_type?: ContractType | null;
  livello?: Livello | null;
  contract_start_date: string | null;
```

- [ ] **Step 2: Extend `MemberInput` interface (around line 84-94)**

Add the same three fields to `MemberInput` in the same position (after `ft_percentage`, before `contract_start_date`):

```ts
  ft_percentage?: number | null;
  gender?: Gender | null;
  contract_type?: ContractType | null;
  livello?: Livello | null;
  contract_start_date?: string | null;
```

- [ ] **Step 3: Extend `DEFAULT_MEMBER` (around line 203-213)**

Add three keys, all `null`, before the closing brace:

```ts
export const DEFAULT_MEMBER: MemberInput = {
  first_name: '',
  last_name: '',
  category: 'dipendente',
  seniority: 'middle',
  salary: 50000,
  chargeable_days: null,
  ft_percentage: 100,
  gender: null,
  contract_type: null,
  livello: null,
  contract_start_date: null,
  contract_end_date: null,
};
```

- [ ] **Step 4: Extend `ScenarioMemberData` interface (around line 273-288)**

Add the three fields after `ft_percentage` and before `capacity_percentage`:

```ts
  ft_percentage?: number | null;
  gender?: Gender | null;
  contract_type?: ContractType | null;
  livello?: Livello | null;
  capacity_percentage: number;
```

- [ ] **Step 5: Extend `ScenarioMemberDataInput` interface (around line 308-319)**

Same three fields, same position (after `ft_percentage`, before `capacity_percentage`):

```ts
  ft_percentage?: number | null;
  gender?: Gender | null;
  contract_type?: ContractType | null;
  livello?: Livello | null;
  capacity_percentage?: number;
```

- [ ] **Step 6: Extend `HRScenarioMember` interface (around line 400-418)**

Add the three fields after `chargeable_days` and before `capacity_percentage`:

```ts
  chargeable_days: number | null;
  gender?: Gender | null;
  contract_type?: ContractType | null;
  livello?: Livello | null;
  capacity_percentage: number;
```

- [ ] **Step 7: Extend `HRScenarioMemberInput` interface (around line 420-432)**

Same three fields, same position:

```ts
  chargeable_days?: number | null;
  gender?: Gender | null;
  contract_type?: ContractType | null;
  livello?: Livello | null;
  capacity_percentage?: number;
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no new type errors. (Existing errors unrelated to this change can be ignored, but a fresh error in `types.ts`, `useScenarios.ts`, `useHRScenarios.ts`, `useMembers.ts`, or any workforce component is a regression — diagnose and fix before committing.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/optimizer/types.ts
git commit -m "feat(types): extend Member/Scenario/HR interfaces and DEFAULT_MEMBER with identity fields"
```

---

## Task 4: Propagate fields through `useScenarios.ts`

**Files:**
- Modify: `src/hooks/useScenarios.ts` (3 sites: ~line 133, ~line 281, ~line 387)

`updateScenarioMember` already spreads `Partial<ScenarioMemberDataInput>` so it auto-picks up the new keys. Only the 3 explicit copy sites need editing.

- [ ] **Step 1: Update `addMemberToScenario` (around line 126-140)**

In the `input` object inside `addMemberToScenario`, add the three fields immediately after `ft_percentage`:

```ts
      const input: ScenarioMemberDataInput = {
        source_member_id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        category: member.category,
        seniority: member.seniority,
        salary: member.salary,
        chargeable_days: member.chargeable_days ?? null,
        ft_percentage: member.ft_percentage ?? 100,
        gender: member.gender ?? null,
        contract_type: member.contract_type ?? null,
        livello: member.livello ?? null,
        capacity_percentage: capCost,
        cost_percentage: capCost,
      };
```

- [ ] **Step 2: Update `resyncMemberFromCatalog` (around line 276-285)**

Add the three fields to the `updateScenarioMember` call:

```ts
  const resyncMemberFromCatalog = useCallback(async (scenarioMemberId: string, catalogMember: Member) => {
    return updateScenarioMember(scenarioMemberId, {
      source_member_id: catalogMember.id,
      first_name: catalogMember.first_name,
      last_name: catalogMember.last_name,
      category: catalogMember.category,
      seniority: catalogMember.seniority,
      salary: catalogMember.salary,
      gender: catalogMember.gender ?? null,
      contract_type: catalogMember.contract_type ?? null,
      livello: catalogMember.livello ?? null,
    });
  }, [updateScenarioMember]);
```

- [ ] **Step 3: Update `duplicateScenario` member-row mapper (around line 381-394)**

In the `memberRows` map inside `duplicateScenario`, add the three fields after `ft_percentage`:

```ts
        const memberRows = source.members.map((m) => ({
          scenario_id: newScenario.id,
          source_member_id: m.source_member_id,
          first_name: m.first_name,
          last_name: m.last_name,
          category: m.category,
          seniority: m.seniority,
          salary: m.salary,
          chargeable_days: m.chargeable_days ?? null,
          ft_percentage: m.ft_percentage ?? 100,
          gender: m.gender ?? null,
          contract_type: m.contract_type ?? null,
          livello: m.livello ?? null,
          capacity_percentage: m.capacity_percentage,
          cost_percentage: m.cost_percentage,
        }));
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useScenarios.ts
git commit -m "feat(scenarios): propagate identity fields through scenario member copy sites"
```

---

## Task 5: Propagate fields through `useHRScenarios.ts`

**Files:**
- Modify: `src/hooks/useHRScenarios.ts` (2 sites: ~line 174 duplicate flow, ~line 342 synthetic create)

The HR scenario `addHRScenario` no longer materializes canonical members (the catalog-snapshot was removed and the comment at line 56 marks the unused params). The remaining insert sites are the duplicate flow and the hypothetical/synthetic add.

- [ ] **Step 1: Update duplicate-scenario member-row mapper (around line 173-189)**

In the `memberRows.map` inside the HR scenario duplicate flow, add the three fields after `chargeable_days`:

```ts
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
          gender: m.gender ?? null,
          contract_type: m.contract_type ?? null,
          livello: m.livello ?? null,
          capacity_percentage: m.capacity_percentage,
          cost_percentage: m.cost_percentage,
          contract_start_date: m.contract_start_date,
          contract_end_date: m.contract_end_date,
        }));
```

- [ ] **Step 2: Update `addHypotheticalMember` insert (around line 336-360)**

Inside the `.insert({ ... })` body, add the three fields after `chargeable_days`:

```ts
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
          gender: input.gender ?? null,
          contract_type: input.contract_type ?? null,
          livello: input.livello ?? null,
          capacity_percentage: input.capacity_percentage ?? 100,
          cost_percentage: input.cost_percentage ?? 100,
          contract_start_date: input.contract_start_date ?? null,
          contract_end_date: input.contract_end_date ?? null,
        })
        .select()
        .single();
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHRScenarios.ts
git commit -m "feat(hr): propagate identity fields through HR scenario member copy sites"
```

---

## Task 6: Add Selects to the create dialog (`WorkforceCard.tsx`)

**Files:**
- Modify: `src/components/workforce/WorkforceCard.tsx`

Three Selects are added between the Salary input (line ~234-243) and the Contract Start/End grid (line ~245-262). Each Select uses an empty string `''` to represent `null` in the underlying typed field. The `Non specificato` option's `value` is the empty string; `onValueChange` converts `''` back to `null`.

- [ ] **Step 1: Extend imports**

In the `import { ... } from '@/lib/optimizer/types';` block (line 26-38), add the new symbols:

```ts
import {
  Member,
  MemberInput,
  DEFAULT_MEMBER,
  SENIORITY_LEVELS,
  SENIORITY_LABELS,
  SeniorityLevel,
  MEMBER_CATEGORIES,
  MEMBER_CATEGORY_LABELS,
  MemberCategory,
  CapacitySettings,
  CostCenter,
  GENDERS,
  GENDER_LABELS,
  Gender,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  ContractType,
  LIVELLI,
  LIVELLO_LABELS,
  Livello,
} from '@/lib/optimizer/types';
```

- [ ] **Step 2: Insert the three Selects after the Salary block**

Find this block (around line 234-243):

```tsx
                <div className="space-y-2">
                  <Label>Salary (EUR/year)</Label>
                  <Input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 50000 })}
                    min={0}
                    step={1000}
                  />
                </div>
```

Immediately after this `</div>` (still inside `<div className="grid gap-4 py-4">`), insert:

```tsx
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender ?? ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value === '' ? null : (value as Gender) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Non specificato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Non specificato</SelectItem>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {GENDER_LABELS[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo di contratto</Label>
                  <Select
                    value={formData.contract_type ?? ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, contract_type: value === '' ? null : (value as ContractType) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Non specificato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Non specificato</SelectItem>
                      {CONTRACT_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CONTRACT_TYPE_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Livello</Label>
                  <Select
                    value={formData.livello ?? ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, livello: value === '' ? null : (value as Livello) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Non specificato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Non specificato</SelectItem>
                      {LIVELLI.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LIVELLO_LABELS[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
```

- [ ] **Step 3: Sanity-check in the browser**

Run: `npm run dev`
- Open `/dashboard/workforce`, click `+ Add Member`.
- Verify the three new Selects render between Salary and Contract Start.
- Each defaults to `Non specificato`; selecting an option commits.
- Save a member with all three fields set; reopen the workforce page and confirm no error.

- [ ] **Step 4: Commit**

```bash
git add src/components/workforce/WorkforceCard.tsx
git commit -m "feat(workforce): add identity field Selects to create-member dialog"
```

---

## Task 7: Add Selects to the edit dialog (`MemberList.tsx`)

**Files:**
- Modify: `src/components/workforce/MemberList.tsx`

Two changes here: extend `formData`'s seed in the `useEffect` so existing values populate the Selects, and insert the same three Selects into the edit dialog body (mirror of Task 6).

- [ ] **Step 1: Extend imports**

In the `import { ... } from '@/lib/optimizer/types';` block (line 5-15), add:

```ts
import {
  Member,
  MemberInput,
  SENIORITY_LABELS,
  SENIORITY_LEVELS,
  SeniorityLevel,
  MEMBER_CATEGORIES,
  MEMBER_CATEGORY_LABELS,
  MemberCategory,
  CapacitySettings,
  GENDERS,
  GENDER_LABELS,
  Gender,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  ContractType,
  LIVELLI,
  LIVELLO_LABELS,
  Livello,
} from '@/lib/optimizer/types';
```

- [ ] **Step 2: Seed `formData` from the editing member (line 67-82 useEffect)**

Add three keys to the `setFormData({ ... })` call:

```ts
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
        gender: editingMember.gender ?? null,
        contract_type: editingMember.contract_type ?? null,
        livello: editingMember.livello ?? null,
        contract_start_date: editingMember.contract_start_date ?? null,
        contract_end_date: editingMember.contract_end_date ?? null,
      });
      setError(null);
    }
  }, [editingMember]);
```

- [ ] **Step 3: Insert the three Selects after the Salary input**

Find the Salary `<div>` block (around line 237-246):

```tsx
            <div className="space-y-2">
              <Label>Salary (EUR/year)</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 50000 })}
                min={0}
                step={1000}
              />
            </div>
```

Immediately after this `</div>` (and before the Contract grid), insert:

```tsx
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={formData.gender ?? ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value === '' ? null : (value as Gender) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Non specificato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Non specificato</SelectItem>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo di contratto</Label>
              <Select
                value={formData.contract_type ?? ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, contract_type: value === '' ? null : (value as ContractType) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Non specificato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Non specificato</SelectItem>
                  {CONTRACT_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CONTRACT_TYPE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Livello</Label>
              <Select
                value={formData.livello ?? ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, livello: value === '' ? null : (value as Livello) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Non specificato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Non specificato</SelectItem>
                  {LIVELLI.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LIVELLO_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
```

- [ ] **Step 4: Sanity-check in the browser**

With `npm run dev` running:
- Open `/dashboard/workforce`, click any row's edit action.
- Verify the three Selects appear between Salary and Contract Start, pre-populated with the member's current values (or `Non specificato` if `null`).
- Change values, save, reopen — confirm the new values persist.

- [ ] **Step 5: Commit**

```bash
git add src/components/workforce/MemberList.tsx
git commit -m "feat(workforce): add identity field Selects to edit-member dialog"
```

---

## Task 8: Add identity rows to `InitialStateCard.tsx`

**Files:**
- Modify: `src/components/workforce/InitialStateCard.tsx`

Three new `<FieldRow>`s, immediately after the Salary row (line 49) and before the category-conditional FT % / Chargeable Days block (line 50-58). Render `—` (em dash) when the value is `null`.

- [ ] **Step 1: Extend imports**

Update the `import { ... } from '@/lib/optimizer/types';` block (line 10-17) to include the new label records:

```ts
import {
  Member,
  MemberCostCenterAllocation,
  CostCenter,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
  SeniorityLevel,
  GENDER_LABELS,
  CONTRACT_TYPE_LABELS,
  LIVELLO_LABELS,
} from '@/lib/optimizer/types';
```

- [ ] **Step 2: Insert the three FieldRows**

Find the Salary row (line 49):

```tsx
        <FieldRow label="Salary" value={formatCurrency(member.salary)} />
```

Immediately after it (and before the `{member.category === 'dipendente' && (` block), insert:

```tsx
        <FieldRow
          label="Gender"
          value={member.gender ? GENDER_LABELS[member.gender] : '—'}
        />
        <FieldRow
          label="Tipo contratto"
          value={member.contract_type ? CONTRACT_TYPE_LABELS[member.contract_type] : '—'}
        />
        <FieldRow
          label="Livello"
          value={member.livello ? LIVELLO_LABELS[member.livello] : '—'}
        />
```

- [ ] **Step 3: Sanity-check in the browser**

With `npm run dev` running:
- Navigate to `/dashboard/workforce/<member-id>` for an existing member with `NULL` identity fields.
- Confirm the Initial State card shows three new rows (`Gender`, `Tipo contratto`, `Livello`) each with `—`.
- Edit the member via the workforce page, set all three fields, save, then reload the detail page.
- Confirm the Initial State card now shows the chosen values with their proper Italian labels.

- [ ] **Step 4: Commit**

```bash
git add src/components/workforce/InitialStateCard.tsx
git commit -m "feat(workforce): show gender, contract type, livello on Initial State card"
```

---

## Final verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: PASS — all suites green, including the new `src/lib/optimizer/types.test.ts`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no new errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS — no new warnings or errors in the touched files.

- [ ] **Step 4: End-to-end smoke**

With `npm run dev`:
1. Add a brand-new member with all three identity fields set; confirm row appears in `/dashboard/workforce`.
2. Open detail page; confirm Initial State card shows the values (and the `Cost (YYYY)` row remains on Actual State, untouched).
3. Edit the member, change a field, save; reload detail page; confirm new value reflected.
4. If you have HR scenarios: open one, add a hypothetical member with the new fields, confirm it persists.
5. If you have optimizer scenarios: duplicate one and confirm member identity fields carry over.
