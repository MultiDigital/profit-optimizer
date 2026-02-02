'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { CapacityBars } from './CapacityBars';
import { ProjectBreakdown } from './ProjectBreakdown';
import { OptimizationResult } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface ResultsCardProps {
  result: OptimizationResult | null;
  isCalculating?: boolean;
}

export function ResultsCard({ result, isCalculating }: ResultsCardProps) {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📈</span> Optimized Revenue Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            {isCalculating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                Calculating...
              </div>
            ) : (
              'Add team members and services to optimize your revenue'
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    totalRevenue,
    totalProjects,
    bottleneck,
    trueProfit,
    profitMarginPct,
    fixedCosts,
    projectBreakdown,
  } = result;

  const monthlyRevenue = totalRevenue / 12;
  const monthlyProjects = totalProjects / 12;
  const demandCappedCount = projectBreakdown.filter((p) => p.isDemandCapped).length;

  const bottleneckIcon = bottleneck === 'Sales' ? '📈' : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📈</span> Optimized Revenue Analysis
          {isCalculating && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent ml-2" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Yearly Revenue</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">~{formatCurrency(monthlyRevenue)}/month</div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Fixed Costs</div>
            <div className="text-xl font-bold">{formatCurrency(fixedCosts)}</div>
            <div className="text-xs text-muted-foreground">Salaries/year</div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Profit</div>
            <div className={`text-xl font-bold ${trueProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(trueProfit)}</div>
            <div className="text-xs text-muted-foreground">{profitMarginPct.toFixed(1)}% of revenue</div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Projects/Year</div>
            <div className="text-xl font-bold text-purple-500">{totalProjects}</div>
            <div className="text-xs text-muted-foreground">~{monthlyProjects.toFixed(1)}/month</div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Bottleneck</div>
            <div className="text-xl font-bold text-yellow-500">
              {bottleneckIcon} {bottleneck}
            </div>
            <div className="text-xs text-muted-foreground">
              {demandCappedCount} capped / {projectBreakdown.length} total
            </div>
          </div>
        </div>

        {/* Capacity and Project Mix side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <CapacityBars result={result} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <ProjectBreakdown result={result} />
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
