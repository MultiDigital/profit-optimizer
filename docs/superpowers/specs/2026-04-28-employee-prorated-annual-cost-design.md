# Employee page: prorated annual cost in Actual State card

## Problem

The employee detail page (`src/app/dashboard/workforce/[id]/page.tsx`) shows
the resolved annual `Salary` in the **Actual State** card, but never shows the
actual cost the company will incur for that person across the calendar year.
When somebody starts late or leaves early, the gross annual figure is
misleading: a €12,000 salary for a person who started in March costs €10,000
this year, not €12,000.

## Goal

Add one row to the **Actual State** card that shows the prorated annual cost
for the current calendar year, alongside the existing annual salary.

The salary row stays unchanged — it answers "what is their salary right now?".
The new row answers "what does this person actually cost the company in
calendar year N?".

## Out of scope

- No date-range picker, no "lookup" UI. The period is always the current
  calendar year.
- No changes to the Initial State card.
- No changes to scenario authoring or the Planned Changes timeline.
- No new aggregate views (workforce-analytics already shows annual totals).
- No backend / database changes. Pure read-side rendering.

## UX

In `ActualStateCard.tsx`, between the existing `Salary` row and the
category-specific row that follows it (FT % for `dipendente`, Chargeable Days
for `freelance`), add:

```
Cost (2026)         €10,000
```

- The label is literally `Cost (YYYY)` where `YYYY` is the current calendar
  year. Tagging the year inline keeps the figure self-documenting and matches
  the page's existing convention of showing absolute dates rather than
  relative phrasing.
- Value is formatted via the existing `formatCurrency` helper.
- The row renders for **every** member category (`dipendente`, `freelance`,
  `segnalatore`). Salary applies to all three, so cost does too.
- If the computed cost is `0` (member not employed at all this year), the row
  still renders showing `€0`. Hiding it would be a worse signal — the user
  needs to know the company spends nothing on this person this year.

## Calculation

For the current calendar year `Y = new Date().getFullYear()`:

```
annualCost = Σ (m=1..12) computeMemberMonth(member, events, settings, `${Y}-${MM}`).monthlyCost
```

`computeMemberMonth` is the existing internal function in
`src/lib/hr/compute.ts`. It already handles every relevant case:

- Contract proration via `monthProRataFraction` — months outside the contract
  bounds contribute `0`, the start/end months contribute fractional days.
- Mid-year salary changes — `resolveEffectiveValues` walks the event list per
  month, so a salary event with `start_date = 2026-07-01` flips the rate from
  August on (the month in which the event's start_date sits gets the new
  value, per existing `resolveFieldForMonth` semantics).
- `cost_percentage` for synthetic scenario members.
- Inactive members → `monthlyCost = 0`.

Re-using this function keeps the new row internally consistent with the
totals shown in workforce-analytics; the same person's contribution to the
yearly company cost there is the same number shown here.

## Code changes

### 1. `src/lib/hr/compute.ts`

Export a new helper:

```ts
export function computeMemberAnnualCost(
  member: AnyMember,
  events: AnyEvent[],
  settings: Settings | null,
  year: number,
): number
```

Implementation: loop `m = 1..12`, build the `YYYY-MM` string, call the
existing private `computeMemberMonth`, accumulate `monthlyCost`. Return the
sum.

`computeMemberMonth` itself stays private. We only widen the surface by one
focused export.

### 2. `src/components/workforce/ActualStateCard.tsx`

Extend the props:

```ts
interface ActualStateCardProps {
  resolved: ResolvedMember;
  costCenters: CostCenter[];
  annualCost: number;   // new
  year: number;         // new
}
```

Render a new `FieldRow` immediately after the existing `Salary` row:

```tsx
<FieldRow label={`Cost (${year})`} value={formatCurrency(annualCost)} />
```

Both new props are required (not optional). Required props avoid silent
omissions in callers and keep the type honest — every caller must compute the
value.

### 3. `src/app/dashboard/workforce/[id]/page.tsx`

- Pull settings via the existing `useSettings` hook.
- Compute the merged event list (canonical + scenario) the same way the
  resolver already consumes them — concatenation, no de-duping needed because
  `getEventsForMember` inside `compute.ts` filters by the right id field
  depending on event shape.
- Wrap the call in `useMemo` keyed on `member`, the canonical events, the
  scenario events, and `settings`. Year is a constant for the render.
- Pass `annualCost` and `year` into `<ActualStateCard …/>`.

The hook call must be unconditional (React rules). If `member` is null
(loading / not-found path), the existing early returns short-circuit before
we reach the `<ActualStateCard/>`, so the memo can return `0` safely when
member is absent.

## Tests

Create `src/lib/hr/compute.test.ts` (does not exist yet) covering
`computeMemberAnnualCost`:

1. **Full-year `dipendente`, no events** — annual cost equals salary
   (allowing for the documented per-month rounding behavior of
   `monthProRataFraction`; the test asserts within `±€1`).
2. **Late start (March 1)** — €12,000 annual salary → €10,000 cost
   (10 months active). This is the literal user example and is the
   regression-anchor for the feature.
3. **Early end (August 31)** — €12,000 annual salary → €8,000 cost.
4. **Mid-year salary change** — €12,000 from Jan, raised to €24,000 starting
   July 1 → 6 × (12k/12) + 6 × (24k/12) = €18,000.
5. **Contract entirely before the requested year** — `0`.
6. **Contract entirely after the requested year** — `0`.
7. **Freelance and segnalatore** — both compute non-zero costs by the same
   path, guarding against a future regression where a category branch
   silently zeroes the salary numerator.

Tests use the existing `Member`/`MemberEvent` shapes from
`src/lib/optimizer/types.ts` and `null` settings (defaults are fine for cost
math; `getEffectiveDays` only affects capacity).

## Risks and trade-offs

- **Salary changes mid-month**: `resolveFieldForMonth` snaps to month
  boundaries, so a raise on July 15 is reflected from July (not weighted
  half-and-half). This matches every other view in the app, so it's a feature
  not a bug; the user has confirmed month-level math is acceptable.
- **`year` is fixed at render-time**: if the user keeps the page open across
  midnight on Dec 31, the label and value won't recompute until a remount.
  Acceptable; no auto-refresh needed.
- **No memoization across members**: each render of one employee page
  recomputes 12 months for one member only. Cheap (sub-millisecond). No need
  for cache.
