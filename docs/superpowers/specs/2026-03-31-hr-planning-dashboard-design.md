# HR Planning Dashboard — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Stakeholder:** HR Manager

## Overview

A dedicated HR Planning dashboard with real-time KPI reactivity, time-based event planning, and scenario comparison. Enables the HR Manager to see the impact on total company cost, personnel cost, and productive capacity whenever any workforce variable changes — including future-dated modifications.

## Requirements

### Core KPIs (real-time, reactive to any change)

1. **Totale Costo Azienda** — sum of all member salaries (annual)
2. **Costo del Personale** — broken down by seniority and cost center
3. **Capacita Produttiva** — total available days
4. **FTE** — full-time equivalents
5. **Headcount** — number of active members
6. **Costo Orario Medio** — weighted average hourly cost by seniority
7. **% Incidenza per Centro di Costo** — cost center weight

### Monitored Variables (levers)

**Member-level:**
- Stipendio (RAL)
- FT% (full-time percentage)
- Seniority
- Categoria (dipendente/freelance/segnalatore)
- Giorni fatturabili (freelance only)

**Global (Settings):**
- Giorni lavorativi annui
- Festivita nazionali
- Ferie
- Malattia
- Formazione
- Tariffe giornaliere per seniority

**Scenario-level:**
- capacity_percentage per member
- cost_percentage per member

### Time-based Events

Every modification can have a `start_date` and optional `end_date`:
- **Without end_date** → modification persists permanently (e.g., salary increase)
- **With end_date** → temporary modification, returns to base value after (e.g., maternity leave)

### Contract Dates

Members gain `contract_start_date` and `contract_end_date` fields:
- `contract_start_date` — when the member starts (optional, for existing members)
- `contract_end_date` — NULL for permanent contracts; filled when resignation/termination occurs
- Outside contract range → member contributes 0 cost and 0 capacity

### Scenario Comparison

- **HR-only scenarios** — separate from optimization scenarios, focused on personnel changes
- **Hypothetical members** — can create members that exist only in a scenario (planned hires)
- **Comparison view** — Catalog vs Scenario or Scenario vs Scenario, with delta display

### Integration with Existing Scenarios

Existing optimization scenarios gain a read-only "KPI HR" section showing the same metrics. No changes to existing functionality.

---

## Data Model

### Schema Changes to `members`

```sql
ALTER TABLE members ADD COLUMN contract_start_date DATE;
ALTER TABLE members ADD COLUMN contract_end_date DATE;
```

Same fields added to `scenario_members_data`.

### New Table: `member_events`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, default gen_random_uuid() |
| `user_id` | UUID | FK → auth.users (for RLS) |
| `member_id` | UUID | FK → members ON DELETE CASCADE |
| `field` | TEXT NOT NULL | One of: `salary`, `ft_percentage`, `seniority`, `category`, `capacity_percentage`, `chargeable_days` |
| `value` | TEXT NOT NULL | New value serialized as string |
| `start_date` | DATE NOT NULL | When the modification begins |
| `end_date` | DATE | NULL = permanent, with date = temporary |
| `note` | TEXT | Optional, e.g., "Maternita", "Promozione" |
| `created_at` | TIMESTAMPTZ | default now() |

RLS: `user_id = auth.uid()`.

### New Table: `hr_scenarios`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `name` | TEXT NOT NULL | Scenario name |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### New Table: `hr_scenario_members`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `hr_scenario_id` | UUID | FK → hr_scenarios ON DELETE CASCADE |
| `source_member_id` | UUID | FK → members, NULL for hypothetical members |
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `category` | TEXT | dipendente/freelance/segnalatore |
| `seniority` | TEXT | nullable (NULL for segnalatori) |
| `salary` | NUMERIC | Annual salary |
| `ft_percentage` | NUMERIC | Default 100 |
| `chargeable_days` | NUMERIC | Nullable, freelance only |
| `capacity_percentage` | NUMERIC | Default 100 |
| `cost_percentage` | NUMERIC | Default 100 |
| `contract_start_date` | DATE | |
| `contract_end_date` | DATE | Nullable |
| `created_at` | TIMESTAMPTZ | |

For hypothetical members (planned hires), `source_member_id` is NULL.

### New Table: `scenario_member_events`

Same structure as `member_events` but with `scenario_member_id` FK → `hr_scenario_members` instead of `member_id`.

### Precedence Rule for Overlapping Events

For a given variable in a given month:
1. Collect all active events where `start_date <= month` AND (`end_date >= month` OR `end_date IS NULL`)
2. The event with the most recent `start_date` wins
3. If no active event → use member's base value
4. If member is outside contract date range → 0 for cost and capacity

---

## Computation Engine

### `computeMonthlySnapshot(members, events, settings, costCenterAllocations, month)`

For each member in the given month:

1. **Contract check** — skip if outside `contract_start_date`..`contract_end_date` range
2. **Resolve events** — for each variable, apply precedence rule to get effective value
3. **Compute monthly capacity** — annual capacity (existing formula) / 12. Pro-rata for partial months (contract start/end mid-month)
4. **Compute monthly cost** — effective annual salary / 12. Same pro-rata logic
5. **Apply cost center allocations** — distribute cost and capacity by allocation percentages

Output per month:
```typescript
{
  totalCompanyCost: number
  personnelCostBySeniority: Record<Seniority, number>
  personnelCostByCostCenter: Record<string, number>
  productiveCapacity: number
  capacityBySeniority: Record<Seniority, number>
  fte: number
  headcount: number
  avgHourlyCostBySeniority: Record<Seniority, number>
  costCenterBreakdown: Record<string, number> // percentages
  memberDetails: MemberMonthDetail[]
}
```

### `computeYearlyView(members, events, settings, allocations, year)`

Calls `computeMonthlySnapshot` for 12 months, then aggregates:
- **Annual totals** = sum of 12 months
- **Annual averages** = where applicable (hourly cost)
- **Monthly drill-down** = all 12 snapshots available for expansion

### Performance

Client-side computation (same as existing optimizer). ~50 members x 12 months x few events = instant. Debounced at 500ms on input change.

---

## UI Design

### New Page: `/dashboard/hr-planning`

**Sidebar entry:** "HR Planning" — between Workforce and Settings.

#### Header

- Page title: "HR Planning"
- Year selector (default: current year)
- Source toggle: "Catalogo" / scenario selector dropdown

#### KPI Cards Row (always visible, real-time)

| Card | Value | Subtitle |
|------|-------|----------|
| Costo Azienda | EUR XXX.XXX | Totale annuo |
| Costo Personale | EUR XXX.XXX | Expand for seniority detail |
| Capacita Produttiva | X.XXX gg | Giorni totali |
| FTE | XX,X | Full-time equivalent |
| Headcount | XX | Active members |
| Costo Orario Medio | EUR XX/h | Weighted average |

#### Yearly Table with Monthly Drill-down

Metric selector: Cost / Capacity (days) / FTE

| Member | RAL | Seniority | FTE | Jan | Feb | ... | Dec | Year Total |
|--------|-----|-----------|-----|-----|-----|-----|-----|------------|
| Mario Rossi | 40k | Senior | 1.0 | 3.333 | 3.333 | ... | 3.333 | 40.000 |
| > events list | | | | | | | | |

- Monthly cells with active events highlighted visually (different background color)
- Click row to expand and show member's planned events
- Total row at bottom

#### Event Management Panel

- Button "+ Modifica pianificata" opens dialog
- Dialog fields: member selector, variable, new value, start date, end date (optional), note
- Existing events listed below table with edit/delete actions

### Scenario Management (from HR Planning page)

- Button "+ Nuovo scenario HR" — copies catalog members + events
- Scenario actions: rename, duplicate, delete
- Within scenario: add/edit/delete events, create hypothetical members, remove members

### Comparison View

Triggered by "Confronta" button. Select two sources (Catalog/Scenario).

**KPI comparison:**

| KPI | Base | Scenario | Delta |
|-----|------|----------|-------|
| Costo Azienda | EUR 500k | EUR 540k | +EUR 40k (+8%) |
| Capacita | 4.400 gg | 4.620 gg | +220 gg (+5%) |

**Monthly comparison table:**
Same structure with delta highlighting. Members only in one source marked green (new hire) or red (departure).

### Integration: Existing Scenario Detail Pages

Add a collapsible "KPI HR" section to `/dashboard/scenarios/[id]` showing the same KPI cards computed from the scenario's members. Read-only, no event management.

---

## Hooks

### `useMemberEvents(memberId?: string)`

CRUD for `member_events`. Same pattern as `useMembers`.

```typescript
{
  events: MemberEvent[]
  loading: boolean
  addEvent(input: MemberEventInput): Promise<MemberEvent>
  updateEvent(id: string, input: Partial<MemberEventInput>): Promise<MemberEvent>
  deleteEvent(id: string): Promise<void>
}
```

### `useHRPlanning(source: 'catalog' | string, year: number)`

Core computation hook.

```typescript
{
  yearlyView: YearlyView | null
  monthlySnapshots: MonthlySnapshot[]
  loading: boolean
  error: string | null
}
```

Recalculates with 500ms debounce on any input change.

### `useHRScenarios()`

CRUD for HR scenarios.

```typescript
{
  hrScenarios: HRScenario[]
  loading: boolean
  addHRScenario(name: string): Promise<HRScenario>  // copies catalog + events
  deleteHRScenario(id: string): Promise<void>
  duplicateHRScenario(id: string): Promise<HRScenario>
  addHypotheticalMember(scenarioId: string, input: MemberInput): Promise<HRScenarioMember>
  removeScenarioMember(scenarioId: string, memberId: string): Promise<void>
}
```

### `useScenarioMemberEvents(scenarioMemberId?: string)`

Same interface as `useMemberEvents`, operates on `scenario_member_events`.

---

## Components

| Component | Responsibility |
|-----------|----------------|
| `HRPlanningPage` | Page component, orchestrates hooks and layout |
| `HRKPICards` | Row of KPI cards with real-time values |
| `HRYearlyTable` | Members x months table with drill-down |
| `HREventDialog` | Dialog for creating/editing an event |
| `HREventList` | List of events for a member (in expanded row) |
| `HRScenarioSelector` | Toggle catalog/scenario + scenario management |
| `HRComparisonView` | Side-by-side comparison with delta display |
| `HRScenarioKPIs` | Embeddable KPI section for existing scenario pages |

---

## What Does NOT Change

- Workforce page (`/dashboard/workforce`)
- Workforce Analytics page (`/dashboard/workforce-analytics`)
- Cost Centers page (`/dashboard/cost-centers`)
- Existing scenarios and optimization logic
- Optimizer/solver (`solver.ts`, `variants.ts`)
- All existing hooks (`useMembers`, `useServices`, `useScenarios`, `useSettings`, `useOptimizer`)
