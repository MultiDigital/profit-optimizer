'use client';

import { OptimizationResult } from '@/lib/optimizer/types';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface FinancialSummaryProps {
  result: OptimizationResult;
}

export function FinancialSummary({ result }: FinancialSummaryProps) {
  const {
    totalRevenue,
    totalMargin,
    fixedCosts,
    trueProfit,
    contributionPct,
    profitMarginPct,
    breakEvenRevenue,
  } = result;

  const profitColor = trueProfit >= 0 ? 'text-green-500' : 'text-red-500';
  const profitIcon = trueProfit >= 0 ? '✓' : '⚠';
  const breakEvenProgress = breakEvenRevenue > 0 ? (totalRevenue / breakEvenRevenue) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span>💰</span> Financial Summary
      </h3>

      <div className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
        <span className="text-muted-foreground">Revenue</span>
        <span className="text-right text-blue-500">{formatCurrency(totalRevenue)}</span>

        <span className="text-muted-foreground">Fixed Costs (Salaries)</span>
        <span className="text-right text-red-500">- {formatCurrency(fixedCosts)}</span>

        <div className="col-span-2 border-t border-border my-1" />

        <span className="font-semibold">{profitIcon} True Profit</span>
        <span className={`text-right font-semibold ${profitColor}`}>
          {formatCurrency(trueProfit)}{' '}
          <span className="text-muted-foreground">({formatPercent(profitMarginPct)})</span>
        </span>
      </div>

      {breakEvenRevenue > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-border text-xs text-muted-foreground">
          Break-even revenue: {formatCurrency(breakEvenRevenue)} · You are at{' '}
          {breakEvenProgress.toFixed(0)}% of break-even
        </div>
      )}
    </div>
  );
}
