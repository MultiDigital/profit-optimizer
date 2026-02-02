# Profit Optimizer

Capacity planning and revenue maximization tool for professional service businesses (agencies, consultancies, studios). Uses mathematical optimization to determine the optimal mix of projects to maximize profitability.

## Features

- **Team Management**: Define workforce with seniority levels, utilization rates, and salaries
- **Service Definition**: Configure services with staffing requirements and pricing
- **Optimization Engine**: Integer Linear Programming solver with seniority substitution
- **Scenario Planning**: Named scenarios for what-if analysis with independent data copies
- **Two-Layer Profit Model**: Contribution margin vs true profit analysis
- **Bottleneck Detection**: Identify capacity vs sales constraints
- **Real-time Sync**: Supabase-powered data persistence
- **Toast Notifications**: Success/error feedback for all actions
- **Delete Confirmations**: AlertDialog prompts for destructive actions

## Tech Stack

- **Next.js 16** with App Router
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **shadcn/ui** for UI components (dark theme)
- **Supabase** for auth and database
- **Sonner** for toast notifications
- **Netlify** for deployment

## Getting Started

### 1. Clone and Install

```bash
git clone <repo>
cd revenue-optimizer
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Copy your project URL and anon key from Settings > API

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Development Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx supabase db push # Push schema to Supabase
```

## Deployment to Netlify

1. Push to GitHub
2. Connect repo to Netlify
3. Add environment variables in Netlify dashboard
4. Deploy!

The `netlify.toml` is already configured.

## How It Works

### Optimization Algorithm

The tool uses Integer Linear Programming (ILP) with branch-and-bound to maximize yearly contribution margin subject to:

- **Capacity constraints**: Days available per seniority level
- **Demand constraints**: Max projects per service type

### Seniority Substitution

Higher seniority can do lower-level work with efficiency gains:
- 1 level down: 5% faster
- 2 levels down: 10% faster
- 3 levels down: 20% faster

### Two-Layer Profitability

1. **Contribution Margin** = Revenue - Variable Costs (day rates)
2. **True Profit** = Contribution - Fixed Costs (salaries)

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
└── lib/
    ├── optimizer/
    │   ├── solver.ts             # ILP optimization algorithm
    │   ├── variants.ts           # Seniority substitution logic
    │   └── types.ts              # All TypeScript types
    ├── supabase/                 # Database clients
    └── utils.ts                  # Helpers (cn, formatCurrency, etc.)
```

## Database Architecture

### Catalog Tables (user's master data)
- **members** - Team members with seniority, days/month, utilization, salary
- **services** - Service catalog with days by seniority level, price
- **settings** - Rate card (daily rates per seniority level)

### Scenario Tables (copies for what-if analysis)
- **scenarios** - Named scenarios
- **scenario_members_data** - Full copy of member data per scenario
- **scenario_services_data** - Full copy of service data per scenario, includes `max_year`

**Note**: `max_year` only exists at scenario level, not in the services catalog. When creating a scenario, data is copied from catalog. Each scenario can then independently modify its member/service properties without affecting the catalog or other scenarios.

## Layout Architecture

### Dashboard Shell
- `DashboardShell.tsx` wraps all dashboard pages
- Uses `SidebarProvider` + `SidebarInset` from shadcn/ui
- Sidebar is collapsible (default behavior)

### Sidebar (`AppSidebar.tsx`)
- **SidebarHeader** - App branding with gradient icon
- **SidebarContent** - Navigation group (Dashboard, Workforce, Services, Settings)
- **SidebarFooter** - Sign out button

## Key Files

| File | Description |
|------|-------------|
| `src/lib/optimizer/solver.ts` | ILP optimization algorithm |
| `src/lib/optimizer/variants.ts` | Seniority substitution logic |
| `src/lib/optimizer/types.ts` | All TypeScript types including scenario data types |
| `src/hooks/useOptimizer.ts` | React hook for optimization |
| `src/hooks/useScenarios.ts` | Scenario CRUD with data copying |
| `supabase/migrations/` | Database migrations |

## License

MIT
