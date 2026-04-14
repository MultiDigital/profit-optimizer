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
  // Optimizer scenario pages pin their own target_year + hr_scenario_id at
  // scenario creation time (see spec § "/scenarios/[id] (optimizer)"), so
  // the global pickers would mislead users.
  'prefix:/dashboard/scenarios/',
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
