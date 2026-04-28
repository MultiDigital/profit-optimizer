# Member identity fields: gender, contract type, livello

## Problem

Today the `members` schema captures who a person is in optimizer terms
(`category`, `seniority`, `salary`, `ft_percentage`, etc.) but nothing about
their contractual identity in Italian labor terms. Users need to record three
additional pieces of metadata for every employee:

1. **Gender** — `Maschio` / `Femmina`
2. **Contract type** — `Indeterminato`, `Determinato`, `Stage`,
   `Prestazione occasionale`, `PIVA`, `Apprendistato`, `Amministratore`
3. **Livello** (Italian CCNL level) — `6`, `5`, `4`, `3`, `2`, `1`, `Q`
   (where `Q` = `Quadro`, displayed in the user-supplied order).

These are static identity / contract metadata, not numeric optimizer inputs.
They must persist alongside members in every place member state lives:
the canonical catalog and both scenario copies.

## Goal

For every member, store and let the user set/edit:

- `gender` — `Gender | null`
- `contract_type` — `ContractType | null`
- `livello` — `Livello | null`

Surface them in the create/edit dialogs and on the Initial State card of the
employee detail page. Propagate them through scenario duplication.

## Out of scope

- **No event-versioning.** These fields are not added to `MemberEventField`.
  Promotions and contract conversions are handled by editing the field
  directly when they happen.
- **No optimizer or cost-math changes.** Pure identity metadata.
- **No workforce list columns.** The list at `/dashboard/workforce` keeps its
  current columns. (Future: optionally add a `Livello` column if the user
  asks; not now.)
- **No backfill.** Existing rows get `NULL` for all three fields and stay
  legal until the user edits them.
- **No category-conditional UI gating.** The user explicitly chose option A
  during brainstorming: every category sees every option, even when an
  Italian-labor-law purist would call the combination unusual
  (e.g. `freelance` + `Apprendistato`). The data model accepts it; reality is
  messier than a closed enum can express.
- **No translation/i18n infrastructure.** Labels are inline Italian strings,
  matching the rest of the app.

## Data model

Three nullable TEXT columns on each of three tables:

```sql
-- Migration file: supabase/migrations/20260428000001_add_member_identity_fields.sql

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
  ADD COLUMN gender TEXT CHECK (...),
  ADD COLUMN contract_type TEXT CHECK (...),
  ADD COLUMN livello TEXT CHECK (...);

ALTER TABLE hr_scenario_members
  ADD COLUMN gender TEXT CHECK (...),
  ADD COLUMN contract_type TEXT CHECK (...),
  ADD COLUMN livello TEXT CHECK (...);
```

CHECK constraints (each column gets the same constraint shape on all three
tables) reject invalid values at the DB layer, complementing the TS literal
union types. The `IS NULL OR` part keeps the `NULL` default legal.

DB values are lowercase snake_case (`prestazione_occasionale`); display
labels are properly cased Italian (`Prestazione occasionale`). This matches
the existing convention for `category` (`dipendente` → `Dipendente`) and
`seniority` (`middle_up` → `Middle Up`).

## TypeScript types

In `src/lib/optimizer/types.ts`, add three new literal-union types alongside
the existing `MemberCategory` / `SeniorityLevel` patterns. Place them
immediately after the `SENIORITY_SHORT_LABELS` block (around line 33), before
the `Member` interface.

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

Then add the three optional nullable fields to:

- `Member` interface (after `ft_percentage`, before `contract_start_date`)
- `MemberInput` interface (same position)
- `ScenarioMemberData` interface (after `ft_percentage`, before
  `capacity_percentage`)
- `ScenarioMemberDataInput` interface (same position)
- `HRScenarioMember` interface (after `chargeable_days`, before
  `capacity_percentage`)
- `HRScenarioMemberInput` interface (same position)

Each addition has the same shape:

```ts
gender?: Gender | null;
contract_type?: ContractType | null;
livello?: Livello | null;
```

`DEFAULT_MEMBER` gets three new keys, all `null`:

```ts
export const DEFAULT_MEMBER: MemberInput = {
  // ...existing...
  gender: null,
  contract_type: null,
  livello: null,
};
```

## UI

### Create dialog — `WorkforceCard.tsx`

Add three `Select` controls to the create form, between Salary and Cost
Center allocations. Each Select has a "Non specificato" option that sets
the field to `null`.

```
[label] Gender
[Select]
  Non specificato (default)
  Maschio
  Femmina

[label] Tipo di contratto
[Select]
  Non specificato (default)
  Indeterminato
  Determinato
  Stage
  Prestazione occasionale
  PIVA
  Apprendistato
  Amministratore

[label] Livello
[Select]
  Non specificato (default)
  6
  5
  4
  3
  2
  1
  Q
```

Wire each Select to `formData` like the existing `category` and `seniority`
Selects. The "Non specificato" option corresponds to the empty string at the
Select layer; `setFormData` writes `null` to the typed field.

### Edit dialog — `MemberList.tsx`

Same three Selects in the edit dialog, in the same position relative to the
existing fields. Reuses the same `Select`/`SelectContent`/`SelectItem`
imports already present in the file. Same null-mapping logic.

### Initial State card — `InitialStateCard.tsx`

Add three new `<FieldRow>` rows, immediately after the existing `Salary`
row and before the category-specific FT %/Chargeable Days block. Each row
shows the labelled value or `—` when null:

```
Category         Dipendente
Seniority        Middle
Salary           €60,000
Gender           Maschio
Tipo contratto   Indeterminato
Livello          3
FT %             100%
Capacity %       100%
Cost Center Allocations
  ...
```

When the field is `null`, render `—` (em dash) on the right side, same
pattern used elsewhere in the file for unset values.

The Initial State card does NOT contain the `Cost (YYYY)` row — that lives
only on the Actual State card (added by a prior feature). The Actual State
card is unchanged by this feature: no identity fields shown there. Identity
metadata is captured-at-creation, so it belongs on the Initial card only.

### Workforce list — unchanged

The table at `/dashboard/workforce` is not modified. Adding columns would
crowd it; the user explicitly chose against this during brainstorming.

## Scenario propagation

Three `useScenarios.ts` call sites copy member fields when materializing
into `scenario_members_data` (insert at line ~133, refresh from catalog at
line ~281, duplicate at line ~387). Each copy site must include the three
new fields:

```ts
gender: member.gender ?? null,
contract_type: member.contract_type ?? null,
livello: member.livello ?? null,
```

Two `useHRScenarios.ts` call sites copy member fields:

- The catalog-snapshot insert (around line ~180) where canonical members
  get materialized as `hr_scenario_members` rows. Must include all three
  new fields, copying from the source `Member`.
- The synthetic-member create (around line ~349) where the user adds a
  brand-new employee directly to an HR scenario. The new fields come from
  the `HRScenarioMemberInput` form (allowed `null`).

The `updateScenarioMember` in `useScenarios.ts` and the equivalent in
`useHRScenarios.ts` already pass through `Partial<...Input>` shapes — they
will pick up the new fields automatically without code change because they
spread the input. No code change needed at the update sites; only the
insert/copy sites.

## Tests

Two narrow tests, both in `src/lib/optimizer/types.test.ts` (create the file
if it does not exist). The point is to catch enum drift, not to test the
type system itself.

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

These trip when someone adds a variant to the union (e.g. a new contract
type `tirocinio`) but forgets the array or label record. They do not test
DB CHECK constraints — those are validated by Supabase when the migration
applies.

No new tests for `useMembers`, `useScenarios`, or `useHRScenarios`. The
changes there are pure mechanical pass-through (new keys spread alongside
existing ones), and the existing schema would reject an invalid value at
runtime via the DB CHECK constraint anyway.

## Risks

- **Existing rows are NULL** for all three fields. The Initial State card
  must render `—` for `null`, never crash. The Selects must default to "Non
  specificato" when the underlying value is `null`.
- **Catalog-to-scenario drift if someone forgets a copy site.** Mitigated by
  the spec listing all five copy sites and the implementation plan walking
  through them in order. A future maintainer who adds a fourth field has to
  remember to update the same five sites — a known sharp edge of this
  schema, not introduced by this feature.
- **CHECK constraint mismatches between TS and DB** would surface as
  Supabase errors at write time. The exhaustiveness test above prevents the
  TS half of that drift; reviewing the migration alongside `types.ts`
  prevents the DB half.

## File touch summary

- **Create:**
  - `supabase/migrations/20260428000001_add_member_identity_fields.sql`
  - `src/lib/optimizer/types.test.ts`
- **Modify:**
  - `src/lib/optimizer/types.ts` — add 3 enums + label records, extend 6
    interfaces, extend `DEFAULT_MEMBER`.
  - `src/components/workforce/WorkforceCard.tsx` — add 3 Selects to create
    dialog.
  - `src/components/workforce/MemberList.tsx` — add 3 Selects to edit
    dialog.
  - `src/components/workforce/InitialStateCard.tsx` — add 3 FieldRows.
  - `src/hooks/useScenarios.ts` — extend 3 copy sites.
  - `src/hooks/useHRScenarios.ts` — extend 1 catalog-copy site (line ~180);
    confirm synthetic-member insert (line ~349) flows through the input.
