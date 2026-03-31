'use client';

import { YearlyView } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface HRComparisonViewProps {
  baseView: YearlyView;
  compareView: YearlyView;
  baseLabel: string;
  compareLabel: string;
}

interface ComparisonRow {
  label: string;
  baseValue: number;
  compareValue: number;
  format: 'currency' | 'days' | 'number' | 'decimal';
}

function formatValue(value: number, format: ComparisonRow['format']): string {
  switch (format) {
    case 'currency': return formatCurrency(value);
    case 'days': return `${Math.round(value).toLocaleString('it-IT')} gg`;
    case 'number': return Math.round(value).toString();
    case 'decimal': return value.toFixed(1);
  }
}

function DeltaIndicator({ base, compare, format }: { base: number; compare: number; format: ComparisonRow['format'] }) {
  const delta = compare - base;
  const pct = base > 0 ? ((delta / base) * 100) : 0;

  if (Math.abs(delta) < 0.01) {
    return <span className="flex items-center gap-1 text-muted-foreground"><Minus className="h-3 w-3" /> -</span>;
  }

  const isPositive = delta > 0;
  return (
    <span className={cn('flex items-center gap-1', isPositive ? 'text-green-500' : 'text-red-500')}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{formatValue(delta, format)} ({isPositive ? '+' : ''}{pct.toFixed(1)}%)
    </span>
  );
}

export function HRComparisonView({ baseView, compareView, baseLabel, compareLabel }: HRComparisonViewProps) {
  const rows: ComparisonRow[] = [
    {
      label: 'Costo Azienda',
      baseValue: baseView.annualTotals.totalCompanyCost,
      compareValue: compareView.annualTotals.totalCompanyCost,
      format: 'currency',
    },
    {
      label: 'Capacita Produttiva',
      baseValue: baseView.annualTotals.productiveCapacity,
      compareValue: compareView.annualTotals.productiveCapacity,
      format: 'days',
    },
    {
      label: 'FTE',
      baseValue: baseView.annualTotals.fte,
      compareValue: compareView.annualTotals.fte,
      format: 'decimal',
    },
    {
      label: 'Headcount',
      baseValue: baseView.annualTotals.headcount,
      compareValue: compareView.annualTotals.headcount,
      format: 'number',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">KPI</th>
              <th className="px-4 py-3 text-right font-medium">{baseLabel}</th>
              <th className="px-4 py-3 text-right font-medium">{compareLabel}</th>
              <th className="px-4 py-3 text-right font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatValue(row.baseValue, row.format)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatValue(row.compareValue, row.format)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <DeltaIndicator base={row.baseValue} compare={row.compareValue} format={row.format} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monthly comparison */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">{baseLabel}</th>
              <th className="px-3 py-2 text-right font-medium">{compareLabel}</th>
              <th className="px-3 py-2 text-right font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            {baseView.monthlySnapshots.map((baseSnap, i) => {
              const compareSnap = compareView.monthlySnapshots[i];
              const monthName = new Date(2026, i, 1).toLocaleDateString('it-IT', { month: 'long' });
              return (
                <tr key={i} className="border-b">
                  <td className="sticky left-0 bg-background px-3 py-2 font-medium capitalize">{monthName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(baseSnap.totalCompanyCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(compareSnap.totalCompanyCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <DeltaIndicator base={baseSnap.totalCompanyCost} compare={compareSnap.totalCompanyCost} format="currency" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
