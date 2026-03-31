'use client';

import { useMemo, useState } from 'react';
import { Settings } from '@/lib/optimizer/types';
import { computeYearlyView } from '@/lib/hr/compute';
import { HRKPICards } from './HRKPICards';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HRScenarioKPIsProps {
  members: Array<{
    id: string;
    first_name: string;
    last_name: string;
    category: string;
    seniority: string | null;
    salary: number;
    ft_percentage?: number | null;
    chargeable_days?: number | null;
    capacity_percentage?: number;
    cost_percentage?: number;
    contract_start_date?: string | null;
    contract_end_date?: string | null;
  }>;
  settings: Settings | null;
}

export function HRScenarioKPIs({ members, settings }: HRScenarioKPIsProps) {
  const [open, setOpen] = useState(false);
  const year = new Date().getFullYear();

  const yearlyView = useMemo(() => {
    if (members.length === 0) return null;
    return computeYearlyView(members as any, [], settings, [], year);
  }, [members, settings, year]);

  return (
    <div>
      <button
        className="flex items-center gap-2 text-sm font-medium hover:underline mb-4"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
        HR KPIs
      </button>
      {open && <HRKPICards yearlyView={yearlyView} />}
    </div>
  );
}
