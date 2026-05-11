'use client';

import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DatePicker } from './DatePicker';
import { CompareDatePicker } from './CompareDatePicker';
import { ScenarioSourcePicker } from './ScenarioSourcePicker';
import { Separator } from '@/components/ui/separator';

/**
 * Paths where the date + scenario pickers should NOT render.
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
  // Optimizer scenario pages pin their own target_year + hr_scenario_id at
  // scenario creation time (see spec § "/scenarios/[id] (optimizer)"), so
  // the global pickers would mislead users.
  'prefix:/dashboard/scenarios/',
];

// Cost Centers shows a scenario badge in its card header and inherits the
// scenarioId from ViewContext, so the picker is redundant here — but the
// date picker still matters (workforce is day-precise).
const HIDE_SCENARIO_PICKER_ON: readonly string[] = [
  '/dashboard/cost-centers',
];

// Pages that consume `compareDate` from ViewContext to render side-by-side
// comparison views. The compare picker only renders on these — showing it
// elsewhere would mislead users into thinking it affects what they see.
const SHOW_COMPARE_PICKER_ON: readonly string[] = [
  '/dashboard/cost-centers',
  '/dashboard/workforce-analytics',
];

function matchesPathRule(pathname: string, rules: readonly string[]): boolean {
  for (const rule of rules) {
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
  const hideControls = matchesPathRule(pathname, HIDE_CONTROLS_ON);
  const hideScenarioPicker = matchesPathRule(pathname, HIDE_SCENARIO_PICKER_ON);
  const showComparePicker = matchesPathRule(pathname, SHOW_COMPARE_PICKER_ON);

  return (
    <div className="flex h-12 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      {!hideControls && (
        <>
          <Separator orientation="vertical" className="h-5" />
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Data</span>
              <DatePicker />
            </div>
            {showComparePicker && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confronta</span>
                <CompareDatePicker />
              </div>
            )}
            {!hideScenarioPicker && <ScenarioSourcePicker />}
          </div>
        </>
      )}
    </div>
  );
}
