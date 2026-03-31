'use client';

import { Card, CardContent } from '@/components/ui/card';
import { YearlyView, SeniorityLevel } from '@/lib/optimizer/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HRKPICardsProps {
  yearlyView: YearlyView | null;
  loading?: boolean;
}

const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  senior: 'Senior',
  middle_up: 'Middle Up',
  middle: 'Middle',
  junior: 'Junior',
  stage: 'Stage',
};

export function HRKPICards({ yearlyView, loading }: HRKPICardsProps) {
  if (loading || !yearlyView) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { annualTotals } = yearlyView;

  const seniorityDetail = Object.entries(annualTotals.personnelCostBySeniority)
    .filter(([, cost]) => cost > 0)
    .map(([sen, cost]) => `${SENIORITY_LABELS[sen as SeniorityLevel]}: ${formatCurrency(cost)}`)
    .join('\n');

  const cards = [
    {
      label: 'Costo Azienda',
      value: formatCurrency(annualTotals.totalCompanyCost),
      subtitle: 'Totale annuo',
    },
    {
      label: 'Costo Personale',
      value: formatCurrency(annualTotals.totalCompanyCost),
      subtitle: 'Per seniority',
      tooltip: seniorityDetail,
    },
    {
      label: 'Capacita Produttiva',
      value: `${Math.round(annualTotals.productiveCapacity).toLocaleString('it-IT')} gg`,
      subtitle: 'Giorni totali',
    },
    {
      label: 'FTE',
      value: annualTotals.fte.toFixed(1),
      subtitle: 'Full-time equivalent',
    },
    {
      label: 'Headcount',
      value: annualTotals.headcount.toString(),
      subtitle: 'Membri attivi',
    },
    {
      label: 'Costo Orario Medio',
      value: formatCurrency(
        Object.values(annualTotals.avgHourlyCostBySeniority).reduce((sum, v) => sum + v, 0) /
        Object.values(annualTotals.avgHourlyCostBySeniority).filter((v) => v > 0).length || 0
      ) + '/h',
      subtitle: 'Media ponderata',
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              {card.tooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xl font-bold cursor-help">{card.value}</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <pre className="text-xs whitespace-pre">{card.tooltip}</pre>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <p className="text-xl font-bold">{card.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
