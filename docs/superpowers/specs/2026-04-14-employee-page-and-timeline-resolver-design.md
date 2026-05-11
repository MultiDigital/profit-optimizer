# Employee Page & Timeline Resolver — Design

Date: 2026-04-14
Status: approved, ready for implementation planning

## Problem

Today, authoring "planned changes" (salary reviews, capacity changes, CDC
redistributions) is mixed with HR-scenario what-if exploration inside
`/hr-planning`. Meanwhile `/workforce`, `/cost-centers`, and
`/workforce-analytics` are static "today only" views: they read base fields
from `members` and the static CDC allocation matrix and ignore events
entirely. This means a real, already-decided change cannot be reflected in
any analysis except the HR-planning yearly table, and it forces users to
model real changes as scenarios — conflating real vs. maybe.

We want:

1. A dedicated per-employee page where real planned changes are authored.
2. Analysis pages (cost-centers, workforce-analytics, optimizer) that
   resolve member state at a chosen year using those real changes.
3. Scenarios kept as a clean delta overlay on top of the real baseline —
   for maybe changes only.

## Goals

- One authoring surface per employee for real changes over time.
- One canonical resolver that computes "member state at date D, under
  scenario S" used everywhere.
- Global year + scenario controls in the shell so every analysis page
  shows a consistent point in time.
- Scenarios become pure deltas: no copying canonical members.

## Non-goals

- Timeline-awareness for services (out of scope; services stay as-is
  with their existing `max_year` on optimizer scenarios).
- Deleting HR-planning's "Compare" functionality — it moves to
  workforce-analytics where it fits better.
- A visual CDC allocation timeline on the employee page — CDC changes
  appear as ordinary events in the changes list.

## Decisions made during brainstorming

| # | Decision | Choice |
|---|----------|--------|
| 1 | Employee page relation to `/workforce` list | Keep `/workforce` as the list; add `/workforce/[id]` detail page; all dated changes live there. |
| 2 | Year selector scope | **Global** picker in the dashboard shell. |
| 3 | Initial state editability | **Frozen at creation.** Corrections are backdated events. |
| 4 | CDC allocation model | Matrix disappears. CDC split captured at employee creation (initial state) + dated events for changes. |
| 5 | HR-scenario model | **Delta overlay** with optional scenario-only synthetic members. |
| 6 | `/hr-planning` page | **Kept**, repurposed as cross-employee events log. Yearly table moves to workforce-analytics. |
| 7 | Scenario source selector scope | Global default in shell + per-page override for comparison views. |
| 8 | Optimizer scope | **In scope.** Optimizer reads resolved workforce at (target_year, hr_scenario_id) — no more member copy. |
| 9 | Employee page layout | Option A simplified: header + (Initial / Actual state cards on left) + (Planned Changes list on right). No CDC timeline visual. |

## Data model

### Unchanged tables, reinterpreted

- `members` — now "initial state, frozen at creation." Stable identity
  fields (first name, last name, category, contract_start, contract_end)
  remain freely editable. The timed fields (`salary`, `ft_percentage`,
  `seniority`, `capacity_percentage`, `chargeable_days`) are treated as
  initial values, not edited through ordinary workflows once the member
  exists. An admin-only affordance in the Actions menu may allow editing
  them, but the default UI doesn't surface it.

- `member_events` — unchanged schema. Holds canonical dated changes with
  start/end dates.

- `event_cost_center_allocations` — unchanged. Sidecar for CDC events.

- `member_cost_center_allocations` — reinterpreted as the **initial CDC
  split** captured at employee creation. Immutable after creation.

### Changed tables

- `hr_scenarios_members` — becomes **optional**, storing only
  scenario-only synthetic members (e.g., "hypothetical Senior hire").
  Canonical members are no longer duplicated. Add boolean `is_synthetic`
  column defaulted to `true` for clarity during migration.

- `hr_scenarios_events` — becomes the **delta overlay**. Add nullable
  `member_id uuid references members(id) on delete cascade` alongside
  existing `scenario_member_id`. Add CHECK constraint: exactly one of
  the two is set. A scenario event either overrides/extends a canonical
  employee's timeline, or belongs to a synthetic scenario-only employee.

- `scenarios` (optimizer) — gains two nullable columns: `target_year int`
  and `hr_scenario_id uuid references hr_scenarios(id) on delete set null`.

### Dropped tables

- `scenario_members_data` — optimizer's copy of members. Replaced by
  resolving from live `members` at `target_year` + `hr_scenario_id`.
  Dropped in the cleanup PR.

## Resolver layer

New file: `src/lib/hr/resolve.ts`, consolidating today's
`src/lib/hr/resolve-events.ts` and parts of `src/lib/hr/compute.ts`.

```ts
resolveMemberAtDate(
  member: Member,
  baseAllocations: MemberCostCenterAllocation[],
  canonicalEvents: MemberEvent[],
  scenarioEvents: ScenarioMemberEvent[], // empty for baseline
  eventAllocations: EventCostCenterAllocation[],
  date: string, // YYYY-MM-DD
): ResolvedMember
```

`ResolvedMember` mirrors `Member` but with all timed fields resolved at
the date, plus a resolved CDC allocation map.

Resolution rule: most-recent-start-date wins among active events; on
ties, scenario events win over canonical (explicit override).

Derived helpers:

- `resolveMemberAtYear(member, ..., year)` → 12 monthly snapshots for
  yearly-table views.
- `resolveWorkforceAtDate(members[], ...)` → batch resolver for analysis
  pages.
- `isMemberActiveAtDate(member, date)` → contract-date + category check.

Design properties:

- Pure functions, no Supabase dependency — unit-testable in isolation.
- Scenario events layered by concatenation + scenario-wins-on-tie rule.
- Scenario-only members appear as synthetic `Member` rows resolved from
  their scenario events only.

## Employee page `/workforce/[id]`

Route: `src/app/dashboard/workforce/[id]/page.tsx`.

Layout:

```
┌───────────────────────────────────────────────────────────────┐
│ ← Back to Workforce    Mario Rossi                 [Actions ▾]│
│ Dipendente Full-Time · Contract 2024-01-15 → ongoing          │
├──────────────────────────┬────────────────────────────────────┤
│ INITIAL STATE            │ PLANNED CHANGES          [+ Add]   │
│ (captured 2024-01-15)    │                                    │
│ Seniority: Middle        │ 2026-05-01  Salary €42k → €45k  ⋯  │
│ Salary: €42,000          │ 2026-07-01  CDC realloc         ⋯  │
│ FT %: 100%               │ 2027-01-01  Seniority → Senior  ⋯  │
│ Capacity %: 90%          │                                    │
│ CDC: A 60% · B 40%       │ Filter: [All fields ▾]             │
│                          │                                    │
│ ACTUAL STATE (today)     │                                    │
│ Seniority: Middle        │                                    │
│ Salary: €45,000          │                                    │
│ FT %: 100%               │                                    │
│ Capacity %: 90%          │                                    │
│ CDC: A 50% · B 50%       │                                    │
└──────────────────────────┴────────────────────────────────────┘
```

- **Header**: name, category badge, contract dates (editable — stable
  identity), Actions dropdown (deactivate / delete / admin-only edit of
  initial state).
- **Initial State card**: read-only fields frozen at creation. Includes
  initial CDC split. "View only" badge.
- **Actual State card**: same fields, computed via
  `resolveMemberAtDate(..., today)`. Read-only. Updates reactively.
- **Planned Changes panel**: chronological list scoped to this employee.
  Reuses existing `HREventList` + `HREventDialog` with `member_id` prop.
  Field-type filter.

In scenario mode (global scenario picker = X), an additional panel
"Scenario-only changes (scenario: X)" appears under Planned Changes,
showing overlay events, and the Actual State card is resolved with the
overlay applied. New events added in scenario mode write to
`hr_scenarios_events`; in baseline mode, they write to `member_events`.

New components: `InitialStateCard`, `ActualStateCard`. All other
components are existing ones rewired.

## Global shell controls

Added to `DashboardShell` top bar:

- **Year picker** — current year − 1 through current year + 4. Default:
  current year.
- **Scenario source picker** — "Baseline" plus all HR scenarios. Default:
  Baseline.

Both backed by a `ViewContext` provider, persisted to `localStorage`:

```ts
type ViewContext = {
  year: number;
  scenarioId: string | 'baseline';
  setYear(y: number): void;
  setScenarioId(id: string | 'baseline'): void;
};
```

Pages that need a local override (HR-planning compare, workforce-analytics
compare tab) accept `year` / `scenarioId` as props shadowing the context.

Pages that ignore both controls — `/workforce`, `/workforce/[id]`,
`/settings`, `/services` — render them muted or hidden based on route.

Edge case: if the selected scenario is deleted while viewing it, the
context falls back to Baseline automatically.

## Analysis page migrations

### `/cost-centers`

- **Allocazioni tab** → read-only, shows year-resolved member × CDC
  matrix. Remove add/edit/delete per-row. CDC definition CRUD (the
  CDC entities themselves) stays.
- **Riepilogo Costi tab** → computes from resolved workforce at selected
  year. `useMemo` keyed on `(year, scenarioId)`.

### `/workforce-analytics`

- Existing **per-CDC breakdown** → year-resolved.
- **New tab: "Monthly Timeline"** — ports today's `HRYearlyTable`
  (month × totals), built on `resolveMemberAtYear`.
- **New tab: "Compare scenarios"** — picks two sources (baseline or any
  HR scenario) independent of the global picker, renders the existing
  `HRComparisonView`.

### `/scenarios/[id]` (optimizer)

- Schema: `scenarios` gains `target_year` + `hr_scenario_id`.
- Scenario creation flow prompts for year and HR scenario source.
- Reads live `members` + calls resolver at `target_year` +
  `hr_scenario_id`; drops `scenario_members_data` usage.
- `scenario_services_data` + `max_year` untouched.
- Migration: existing scenarios get `target_year = extract(year from
  created_at)`, `hr_scenario_id = NULL`; `scenario_members_data` remains
  readable until the first save under the new model, then dropped.

### `/workforce` list page

- Stays a plain identity list (name, category, contract dates,
  deactivated flag).
- Rows become clickable → `/workforce/[id]`.
- Adds "Upcoming changes (next 12 months)" column as a compact summary.
- **Add Member dialog** is extended to capture the **initial CDC
  allocation** (the only place to author CDC for a new member, since
  the cost-centers Allocazioni tab is read-only). Fields: the existing
  member fields plus a compact CDC split input (same component as
  today's allocation row editor, used once at creation).

## `/hr-planning` repurposed — Planned Changes log

Repurposed into a cross-employee review surface. Sidebar label renamed
to "Planned Changes".

Layout: one chronological feed of all events across all employees, with
filters (employee multi-select, field multi-select, time-window
preset). Respects global scenario picker: when scenario is active, scenario
events appended with a "scenario" badge.

Row actions: edit (existing `HREventDialog`), delete, go-to-employee.
"+ Add Change" opens the dialog with no member pre-selected.

Removed from this page: yearly aggregate table (moved to workforce-
analytics), in-page scenario switcher (now global), compare tab (moved
to workforce-analytics).

## Scenario delta semantics

At resolve time for scenario S:

1. For each canonical member, gather
   `member_events WHERE member_id = m.id` (baseline).
2. Append `hr_scenarios_events WHERE member_id = m.id AND scenario_id = S`.
3. Append synthetic members: rows from `hr_scenarios_members WHERE
   scenario_id = S`, each paired with `hr_scenarios_events WHERE
   scenario_member_id = syn.id`.
4. Apply `resolveMemberAtDate(...)` uniformly across the combined set.
5. Tie-break: equal `start_date` → scenario event wins over canonical.

UX touchpoints:

- Employee page in scenario mode: second panel "Scenario-only changes",
  Actual State card reflects overlay, visual markers on scenario rows.
- `/workforce` in scenario mode: synthetic members appear in a collapsed
  "Scenario-only employees" section at the bottom.
- "+ Add Change" writes to the right table based on current `scenarioId`.

## Migration

### Member fields + CDC allocations (no auto-generated events)

- Existing `members` table rows are interpreted as initial state in
  place. No events generated.
- Existing `member_cost_center_allocations` rows are interpreted as
  initial CDC split. No events generated.

### Contract dates

- `contract_start` / `contract_end` remain editable fields on
  `members`. They're facts about the person, not timed changes, and
  gate month activity in the resolver.

### `hr_scenarios_events` one-time migration script

1. Map each `scenario_member_id` in events → the canonical `members.id`
   it was copied from (via name+contract matching or an explicit map
   built from `hr_scenarios_members`).
2. Rewrite matched events: set `member_id`, null `scenario_member_id`.
3. Drop events byte-identical to the canonical event (member_id, field,
   start_date, value, dates).
4. Drop `hr_scenarios_members` rows that are copies of canonical
   members; keep rows that were genuine synthetic hires
   (`is_synthetic = true`).
5. Ambiguous rows (cannot reliably tell copy vs. synthetic) are dumped
   to a review list for manual decision before the flip.

## Rollout sequence

Six PRs, each independently shippable.

1. **Resolver layer.** Consolidate resolver functions into
   `src/lib/hr/resolve.ts`. Unit-tested. No UI changes. Existing
   `/hr-planning` keeps working via existing helpers.

2. **Employee page.** `src/app/dashboard/workforce/[id]/page.tsx` with
   `InitialStateCard` + `ActualStateCard`. Reuse `HREventList` +
   `HREventDialog` scoped by `member_id`. `/workforce` rows become
   clickable. Adds "Upcoming changes" column. Extends the Add Member
   dialog to capture the initial CDC split. No schema change.

3. **Global shell controls.** `ViewContext` provider + localStorage
   persistence. Year + scenario-source pickers in `DashboardShell`.
   Muted/hidden on routes that don't consume them.

4. **Cost-centers + workforce-analytics migration.** Both pages read
   `useViewContext()` and call resolver. Cost-centers Allocazioni tab
   becomes read-only. Workforce-analytics gains "Monthly Timeline" and
   "Compare scenarios" tabs.

5. **HR-planning repurpose + scenario delta model.** Rebuild
   `/hr-planning` as events log, rename sidebar label. Schema migration
   for `hr_scenarios_events` + one-time data migration script.
   Resolver starts layering scenario events. Employee page gains
   scenario overlay panel.

6. **Optimizer migration + cleanup.** `scenarios` gets `target_year` +
   `hr_scenario_id`. Optimizer reads via resolver. Drop
   `scenario_members_data` and dead code from the old HR-planning
   authoring flow.

## Risks and mitigations

- **Resolver off-by-one on month boundaries.** Covered by unit tests in
  PR 1, including month-end events, cross-year events, null-end events.
- **Ambiguous rows in scenario migration.** Script dumps to review list;
  no automated destructive decisions.
- **Users mid-edit during rollout.** Each PR is non-destructive on old
  tables; rollback = revert PR without DB reset.
- **Data integrity: scenario event referencing deleted canonical
  member.** Handled by `ON DELETE CASCADE` on the new `member_id` FK.

## Open points

None at design time. All major architectural decisions were made during
brainstorming.
