'use client';

import { OptimizationResult } from '@/lib/optimizer/types';
import { Progress } from '@/components/ui';

interface CapacityBarsProps {
  result: OptimizationResult;
}

interface ProgressItemProps {
  label: string;
  subLabel: string;
  value: number;
}

function ProgressItem({ label, subLabel, value }: ProgressItemProps) {
  const percentage = Math.min(value, 100);

  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-28 text-sm text-muted-foreground">
        {label}
        <span className="text-muted-foreground/60"> ({subLabel})</span>
      </div>
      <div className="flex-1">
        <Progress value={percentage} className="h-2" />
      </div>
      <div className="w-12 text-right text-sm font-semibold">
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}

export function CapacityBars({ result }: CapacityBarsProps) {
  const { capacity, utilization } = result;

  return (
    <div>
      <h3 className="text-sm text-muted-foreground mb-3">Yearly Capacity Utilization</h3>

      {capacity.senior > 0 && (
        <ProgressItem
          label="Senior"
          subLabel={`${capacity.senior.toFixed(0)}d`}
          value={utilization.senior}
        />
      )}
      {capacity.middle > 0 && (
        <ProgressItem
          label="Middle"
          subLabel={`${capacity.middle.toFixed(0)}d`}
          value={utilization.middle}
        />
      )}
      {capacity.junior > 0 && (
        <ProgressItem
          label="Junior"
          subLabel={`${capacity.junior.toFixed(0)}d`}
          value={utilization.junior}
        />
      )}
    </div>
  );
}
