# Profit Optimizer

Capacity planning and revenue maximization tool for professional service businesses (agencies, consultancies, studios).

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (dark theme)
- **Auth & Database**: Supabase (PostgreSQL with RLS)
- **Deployment**: Netlify

## Project Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx              # Main dashboard (workforce, services, results)
│   │   ├── settings/page.tsx     # Rate settings page
│   │   ├── workforce/page.tsx    # Workforce management page
│   │   ├── services/page.tsx     # Services catalog page
│   │   ├── scenarios/[id]/page.tsx # Scenario detail with optimizer
│   │   └── layout.tsx            # Protected layout with auth check
│   ├── login/
│   └── signup/
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── workforce/                # Team management
│   │   ├── WorkforceCard.tsx     # Card wrapper with add dialog
│   │   ├── MemberList.tsx        # Edit/delete dialogs
│   │   ├── data-table.tsx        # Reusable DataTable component
│   │   └── columns.tsx           # Column definitions
│   ├── services/                 # Service configuration (same pattern)
│   ├── scenarios/                # Scenario management (same pattern)
│   ├── results/                  # Analytics (ResultsCard, CapacityBars, etc.)
│   ├── AppSidebar.tsx            # Main sidebar navigation
│   └── DashboardShell.tsx        # Layout wrapper with sidebar
├── hooks/
│   ├── useMembers.ts             # CRUD for team members
│   ├── useServices.ts            # CRUD for service catalog
│   ├── useScenarios.ts           # Scenario data management
│   ├── useSettings.ts            # Rate settings
│   └── useOptimizer.ts           # ILP optimization hook
├── lib/
│   ├── optimizer/
│   │   ├── solver.ts             # ILP optimization algorithm
│   │   ├── variants.ts           # Seniority substitution logic
│   │   └── types.ts              # All TypeScript types
│   ├── supabase/                 # Database clients
│   └── utils.ts                  # Helpers (cn, formatCurrency, etc.)
└── proxy.ts                      # Next.js 16 middleware
```

## Development Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx supabase db push # Push schema to Supabase
```

## Layout Architecture

### Dashboard Shell
- `DashboardShell.tsx` wraps all dashboard pages
- Uses `SidebarProvider` + `SidebarInset` from shadcn/ui
- Sidebar is collapsible (default behavior)

### Sidebar (`AppSidebar.tsx`)
- `SidebarHeader` - App branding with gradient icon
- `SidebarContent` - Navigation group (Dashboard, Workforce, Services, Settings)
- `SidebarFooter` - Sign out button

## Database Architecture

### Catalog Tables (user's master data)
- `members` - Team members with seniority, days/month, utilization, salary
- `services` - Service catalog with days by seniority level, price
- `settings` - Rate card (daily rates per seniority level)

### Scenario Tables (copies for what-if analysis)
- `scenarios` - Named scenarios
- `scenario_members_data` - Full copy of member data per scenario
- `scenario_services_data` - Full copy of service data per scenario, includes `max_year`

**Important**: `max_year` only exists at scenario level, not in the services catalog.

When creating a scenario, data is copied from catalog. Each scenario can then independently modify its member/service properties without affecting the catalog or other scenarios.

## Coding Conventions

### Data Tables (TanStack React Table)
Each list uses a consistent pattern:
- `data-table.tsx` - Reusable DataTable with optional `onRowClick`
- `columns.tsx` - Column definitions with `createColumns()` factory for actions

```typescript
// columns.tsx pattern
export function createColumns({ onEdit, onDelete }: ColumnActions): ColumnDef<Item>[] {
  return [
    { accessorKey: 'name', header: 'Name' },
    // ... more columns
    {
      id: 'actions',
      cell: ({ row }) => <DropdownMenu>...</DropdownMenu>,
    },
  ];
}
```

### UI Components
- Import from `@/components/ui` (shadcn/ui components)
- Use `Label` + `Input` pattern (not input with label prop)
- Use `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` pattern

### Dialog-based CRUD
- Creation: Dialog triggered by "+ Add" button in card header
- Editing: Dialog triggered from row actions dropdown
- Deletion: `AlertDialog` for confirmation
- See `WorkforceCard.tsx` and `ServicesCard.tsx` for patterns

### Loading States
- Pass `loading` prop to cards from hooks
- Use `Skeleton` component for loading placeholders

### Notifications
- Use `toast` from `sonner` for success/error feedback
- Already integrated in hooks (useMembers, useServices, useScenarios)

### Data Hooks Pattern
```typescript
const { items, loading, addItem, updateItem, deleteItem } = useHook();
// All mutations show toast on success/error
```

## Key Files

- `src/lib/optimizer/solver.ts` - ILP optimization algorithm
- `src/lib/optimizer/variants.ts` - Seniority substitution logic
- `src/lib/optimizer/types.ts` - All TypeScript types including scenario data types
- `src/hooks/useOptimizer.ts` - React hook for optimization
- `src/hooks/useScenarios.ts` - Scenario CRUD with data copying
- `supabase/migrations/` - Database migrations

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
