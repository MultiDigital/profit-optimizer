# PR 3 — Global Shell Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two global controls to the dashboard shell — a year picker and a scenario source picker — backed by a `ViewContext` React provider with localStorage persistence. This PR only installs the plumbing; downstream analysis pages continue to ignore the context until PR 4.

**Architecture:** `ViewContext` holds `{ year, scenarioId, setYear, setScenarioId }`. The provider initializes with server-safe defaults (current year, `'baseline'`), then hydrates from localStorage on mount. A `DashboardTopBar` component renders the sidebar trigger, year picker, and scenario source picker. The scenario picker reads `useHRScenarios()` and auto-falls-back to baseline if the selected scenario is deleted. Controls are hidden on routes that don't consume them (workforce list, employee detail, settings, services, home) to keep the chrome lean.

**Tech Stack:**
- Next.js 16 App Router (client context)
- Vitest (node env) for pure helpers
- shadcn/ui `Select` and `SidebarTrigger` (existing)

**Parent spec:** `docs/superpowers/specs/2026-04-14-employee-page-and-timeline-resolver-design.md` § "PR 3 — Global shell controls"

**Stacking:** branches from `feature/pr2-employee-page`. Depends on `useHRScenarios` (existing) but not on any PR 2 surface.

---

## File Structure

New files:
- `src/lib/view/storage.ts` — pure helpers: `clampYear`, `readStored`, `writeStored`
- `src/lib/view/storage.test.ts` — unit tests for the pure helpers
- `src/contexts/ViewContext.tsx` — React context, provider, `useViewContext` hook
- `src/components/shell/DashboardTopBar.tsx` — top-bar component with trigger + pickers
- `src/components/shell/YearPicker.tsx` — year dropdown
- `src/components/shell/ScenarioSourcePicker.tsx` — scenario dropdown (reads `useHRScenarios`, handles deletion fallback)

Files modified:
- `src/components/DashboardShell.tsx` — wrap children in `ViewProvider`, render `DashboardTopBar` above content

Files NOT touched:
- Any analysis page — PR 4 migrates them to consume the context.
- `useHRScenarios.ts` — reuse as-is.
- `AppSidebar.tsx` — the top bar lives in `SidebarInset`, not in the sidebar.

---

## Task 1: Pure storage helpers + tests

**Files:**
- Create: `src/lib/view/storage.ts`
- Create: `src/lib/view/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/view/storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clampYear, parseStoredView } from './storage';

describe('clampYear', () => {
  it('returns input when inside [min, max]', () => {
    expect(clampYear(2026, 2025, 2030)).toBe(2026);
  });

  it('clamps below min to min', () => {
    expect(clampYear(2020, 2025, 2030)).toBe(2025);
  });

  it('clamps above max to max', () => {
    expect(clampYear(2040, 2025, 2030)).toBe(2030);
  });

  it('returns min when value is NaN', () => {
    expect(clampYear(Number.NaN, 2025, 2030)).toBe(2025);
  });
});

describe('parseStoredView', () => {
  it('returns null for null input', () => {
    expect(parseStoredView(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseStoredView('not json')).toBeNull();
  });

  it('parses a valid payload', () => {
    expect(parseStoredView('{"year":2026,"scenarioId":"baseline"}')).toEqual({
      year: 2026,
      scenarioId: 'baseline',
    });
  });

  it('returns null when year is missing or wrong type', () => {
    expect(parseStoredView('{"scenarioId":"baseline"}')).toBeNull();
    expect(parseStoredView('{"year":"2026","scenarioId":"baseline"}')).toBeNull();
  });

  it('returns null when scenarioId is missing or wrong type', () => {
    expect(parseStoredView('{"year":2026}')).toBeNull();
    expect(parseStoredView('{"year":2026,"scenarioId":42}')).toBeNull();
  });

  it('rejects extra/unknown shape cleanly (forward-compat)', () => {
    // Future versions may add keys; unknown keys are fine as long as required keys are present.
    expect(parseStoredView('{"year":2026,"scenarioId":"baseline","extra":true}')).toEqual({
      year: 2026,
      scenarioId: 'baseline',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module `./storage` does not exist. Prior 50 tests still pass.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/view/storage.ts`:

```ts
/**
 * Shape of the persisted view state (year + scenario selection).
 * Versioning: no version field today. If the shape changes, bump the
 * localStorage key instead of migrating.
 */
export interface StoredView {
  year: number;
  scenarioId: string; // 'baseline' or an HR scenario UUID
}

/**
 * Clamp a year to [min, max]. NaN maps to min.
 */
export function clampYear(year: number, min: number, max: number): number {
  if (!Number.isFinite(year)) return min;
  if (year < min) return min;
  if (year > max) return max;
  return year;
}

/**
 * Parse a localStorage string into a StoredView, or null if it's missing
 * or malformed. The caller decides whether to fall back to defaults.
 */
export function parseStoredView(raw: string | null): StoredView | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.year !== 'number') return null;
  if (typeof obj.scenarioId !== 'string') return null;
  return { year: obj.year, scenarioId: obj.scenarioId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 60 total (50 prior + 10 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/view/storage.ts src/lib/view/storage.test.ts
git commit -m "feat(view): add pure storage helpers for ViewContext persistence"
```

---

## Task 2: `ViewContext` provider + `useViewContext` hook

**Files:**
- Create: `src/contexts/ViewContext.tsx`

- [ ] **Step 1: Create the context**

Create `src/contexts/ViewContext.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { clampYear, parseStoredView } from '@/lib/view/storage';

const STORAGE_KEY = 'profit-optimizer.view.v1';

/**
 * Year range shown in the picker: [current - 1, current + 4].
 * Pinned at import time — acceptable because the app reloads on day change.
 */
const NOW_YEAR = new Date().getFullYear();
export const YEAR_MIN = NOW_YEAR - 1;
export const YEAR_MAX = NOW_YEAR + 4;

export type ScenarioId = 'baseline' | string; // 'baseline' or a scenario UUID

interface ViewContextValue {
  year: number;
  scenarioId: ScenarioId;
  setYear: (year: number) => void;
  setScenarioId: (id: ScenarioId) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<number>(NOW_YEAR);
  const [scenarioId, setScenarioIdState] = useState<ScenarioId>('baseline');

  // Hydrate from localStorage on mount (client only; SSR renders defaults).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = parseStoredView(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setYearState(clampYear(stored.year, YEAR_MIN, YEAR_MAX));
      setScenarioIdState(stored.scenarioId);
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ year, scenarioId }),
    );
  }, [year, scenarioId]);

  const setYear = useCallback((y: number) => {
    setYearState(clampYear(y, YEAR_MIN, YEAR_MAX));
  }, []);

  const setScenarioId = useCallback((id: ScenarioId) => {
    setScenarioIdState(id);
  }, []);

  return (
    <ViewContext.Provider value={{ year, scenarioId, setYear, setScenarioId }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useViewContext(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) {
    throw new Error('useViewContext must be used inside <ViewProvider>');
  }
  return ctx;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/ViewContext.tsx
git commit -m "feat(view): add ViewContext provider with localStorage persistence"
```

---

## Task 3: `YearPicker` component

**Files:**
- Create: `src/components/shell/YearPicker.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/shell/YearPicker.tsx`:

```tsx
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useViewContext, YEAR_MIN, YEAR_MAX } from '@/contexts/ViewContext';

export function YearPicker() {
  const { year, setYear } = useViewContext();

  const years: number[] = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) years.push(y);

  return (
    <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
      <SelectTrigger className="h-8 w-[90px]" aria-label="Year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/YearPicker.tsx
git commit -m "feat(shell): add YearPicker component bound to ViewContext"
```

---

## Task 4: `ScenarioSourcePicker` component

**Files:**
- Create: `src/components/shell/ScenarioSourcePicker.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/shell/ScenarioSourcePicker.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useViewContext } from '@/contexts/ViewContext';
import { useHRScenarios } from '@/hooks/useHRScenarios';

export function ScenarioSourcePicker() {
  const { scenarioId, setScenarioId } = useViewContext();
  const { hrScenarios, loading } = useHRScenarios();

  // Fallback: if the selected scenario was deleted while we were selecting
  // it, revert to baseline. Only runs once scenarios have loaded.
  useEffect(() => {
    if (loading) return;
    if (scenarioId === 'baseline') return;
    const exists = hrScenarios.some((s) => s.id === scenarioId);
    if (!exists) {
      setScenarioId('baseline');
    }
  }, [loading, scenarioId, hrScenarios, setScenarioId]);

  return (
    <Select value={scenarioId} onValueChange={setScenarioId}>
      <SelectTrigger className="h-8 w-[180px]" aria-label="Scenario source">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="baseline">Baseline</SelectItem>
        {hrScenarios.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/ScenarioSourcePicker.tsx
git commit -m "feat(shell): add ScenarioSourcePicker with deletion fallback"
```

---

## Task 5: `DashboardTopBar` component with route-based visibility

**Files:**
- Create: `src/components/shell/DashboardTopBar.tsx`

- [ ] **Step 1: Create the top-bar component**

Create `src/components/shell/DashboardTopBar.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { YearPicker } from './YearPicker';
import { ScenarioSourcePicker } from './ScenarioSourcePicker';
import { Separator } from '@/components/ui/separator';

/**
 * Paths where the year + scenario pickers should NOT render.
 * These pages don't consume ViewContext — showing the controls would
 * mislead users into thinking they affect what they see.
 *
 * Match rules:
 * - Exact match → exact pathname
 * - 'prefix:' sentinel → pathname.startsWith after stripping the prefix
 */
const HIDE_CONTROLS_ON: readonly string[] = [
  '/dashboard',
  '/dashboard/settings',
  '/dashboard/services',
  '/dashboard/workforce',
  'prefix:/dashboard/workforce/',
];

function shouldHideControls(pathname: string): boolean {
  for (const rule of HIDE_CONTROLS_ON) {
    if (rule.startsWith('prefix:')) {
      if (pathname.startsWith(rule.slice('prefix:'.length))) return true;
    } else if (pathname === rule) {
      return true;
    }
  }
  return false;
}

export function DashboardTopBar() {
  const pathname = usePathname();
  const hideControls = shouldHideControls(pathname);

  return (
    <div className="flex h-12 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      {!hideControls && (
        <>
          <Separator orientation="vertical" className="h-5" />
          <div className="ml-auto flex items-center gap-2">
            <YearPicker />
            <ScenarioSourcePicker />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/DashboardTopBar.tsx
git commit -m "feat(shell): add DashboardTopBar with route-scoped controls"
```

---

## Task 6: Wire ViewProvider + DashboardTopBar into `DashboardShell`

**Files:**
- Modify: `src/components/DashboardShell.tsx`

- [ ] **Step 1: Update the shell**

Replace the ENTIRE content of `src/components/DashboardShell.tsx` with:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ViewProvider } from '@/contexts/ViewContext';
import { DashboardTopBar } from './shell/DashboardTopBar';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <ViewProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar onSignOut={handleSignOut} />
        <SidebarInset>
          <DashboardTopBar />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </ViewProvider>
  );
}
```

- [ ] **Step 2: Verify type-check, lint, build, tests**

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

All pass. Tests: 60 total (no test changes in this task).

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardShell.tsx
git commit -m "feat(shell): wire ViewProvider + DashboardTopBar into DashboardShell"
```

---

## Task 7: Final verification + manual smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full verification suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Paste final lines of each in the report.

- [ ] **Step 2: Manual smoke test**

Start `npm run dev`, open the app in a browser, and verify:

1. **Top bar renders** on `/dashboard/cost-centers`, `/dashboard/workforce-analytics`, `/dashboard/hr-planning`, `/dashboard/compare`.
2. **Top bar hides controls** on `/dashboard`, `/dashboard/settings`, `/dashboard/services`, `/dashboard/workforce`, `/dashboard/workforce/[id]` — only the sidebar trigger remains.
3. **Year picker** shows current year − 1 through current year + 4. Default: current year. Selecting a different year updates the UI immediately.
4. **Scenario picker** shows "Baseline" + all existing HR scenarios. Default: "Baseline". Selecting a scenario persists it.
5. **Page reload preserves** both selections (localStorage hydration works).
6. **Delete scenario while selected** → navigate to `/hr-planning`, open Manage Scenarios, delete the scenario you had selected in the global picker. The picker should auto-fall-back to "Baseline" on its next render cycle (or refresh the page if the cycle hasn't fired).
7. **No analysis page behavior changes** — cost-centers, workforce-analytics, hr-planning should look identical to before. The pickers are currently cosmetic until PR 4.
8. **localStorage key**: in DevTools → Application → Local Storage, confirm the key `profit-optimizer.view.v1` is present with `{ "year": <n>, "scenarioId": "..." }`.

Note any issues. If anything is broken, fix and re-verify before the next step.

- [ ] **Step 3: Commit any final fixes (if needed)**

Only if step 2 surfaced fixes.

```bash
git add -A
git commit -m "fix(shell): post-manual-test adjustments"
```

If no fixes, skip this step.

---

## Done-definition for PR 3

- `npm test` passes ≥ 57 tests (50 from prior PRs + 7 new in `storage.test.ts`).
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
- `DashboardTopBar` renders the sidebar trigger plus the two pickers on analysis routes, trigger only on non-analysis routes.
- `ViewContext` persists `{ year, scenarioId }` to `localStorage` under key `profit-optimizer.view.v1` and re-hydrates on load.
- Deleting the currently-selected scenario auto-reverts the picker to "Baseline" once `useHRScenarios` refetches (or on next page load).
- No analysis page has been changed to consume the context — that's PR 4's scope.
- Prior-PR surfaces (`/workforce`, `/workforce/[id]`) still work end-to-end.

---

## Notes for later PRs (not in scope here)

- **PR 4 page migrations** (cost-centers + workforce-analytics) will read `year` and `scenarioId` via `useViewContext()`. The picker visibility list in `DashboardTopBar` already includes those routes (they're NOT in `HIDE_CONTROLS_ON`), so no shell change is needed there.
- **Per-page override** (spec decision C) is still a future concern. The pattern is: analysis components accept optional `year?` / `scenarioId?` props that shadow the context. Design it when the first comparison view lands.
- **Scenario picker refresh-on-open** — today we rely on `useHRScenarios`'s initial fetch. If users create a scenario in one tab and switch to another, the picker may not see it until refresh. Revisit with broadcast channels or React Query if it becomes a friction point.
- **Employee detail page (PR 2 surface)** currently shows "today" state ignoring the context. Intentionally hidden from the top-bar controls via `HIDE_CONTROLS_ON` prefix rule. Revisit after PR 4 to decide whether the detail page should adopt the year picker too.
- **SSR vs. CSR default year** — `NOW_YEAR` is pinned at module import time, which is fine for SPAs but stale on long-lived server processes. If SSR'd pages ever render the year value, switch to `new Date().getFullYear()` inside the component. Not an issue today because the top bar is `'use client'`.
- **`useHRScenarios` double-fetch on `/hr-planning`** — `ScenarioSourcePicker` (mounted globally in the shell) and the HR-planning page each instantiate their own `useHRScenarios` state. Two round-trips for the same read-only list on that route. Small and read-only, but worth consolidating via a shared cache (React Query/SWR) or lifting the fetch into `ViewProvider` if the scenario catalog grows. Low priority.
- **`useResolvedScenario()` adapter for PR 4** — today every analysis page that wants to branch on `scenarioId` must re-implement the baseline-vs-scenario fork (see the mess on `/hr-planning/page.tsx:58-78`). Consider introducing a hook like `useResolvedScenario(): { source: 'baseline' | 'scenario', data: HRScenarioWithData | null, loading }` as part of PR 4's first page migration so subsequent migrations stay DRY.
- **Flash of baseline trigger on hydration with a selected scenario** — if localStorage has a non-baseline `scenarioId` but `useHRScenarios` hasn't loaded yet, `ScenarioSourcePicker` briefly shows an unmatched UUID (blank trigger) before the items arrive. Minor visual glitch, noticeable only on slow networks. Acceptable today.
