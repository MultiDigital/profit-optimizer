'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CostCenter,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
} from '@/lib/optimizer/types';
import { ResolvedMember } from '@/lib/hr/types';
import { formatCurrency } from '@/lib/utils';

interface ActualStateCardProps {
  resolved: ResolvedMember;
  costCenters: CostCenter[];
}

export function ActualStateCard({ resolved, costCenters }: ActualStateCardProps) {
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Actual State</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">today</Badge>
        </div>
        {!resolved.isActive && (
          <p className="text-xs text-orange-500">Not active today (outside contract dates)</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <FieldRow label="Category" value={MEMBER_CATEGORY_LABELS[resolved.category]} />
        {resolved.category !== 'segnalatore' && (
          <FieldRow
            label="Seniority"
            value={resolved.seniority ? SENIORITY_LABELS[resolved.seniority] : '—'}
          />
        )}
        <FieldRow label="Salary" value={formatCurrency(resolved.salary)} />
        {resolved.category === 'dipendente' && (
          <FieldRow label="FT %" value={`${resolved.ft_percentage}%`} />
        )}
        {resolved.category === 'freelance' && (
          <FieldRow
            label="Chargeable Days"
            value={resolved.chargeable_days != null ? `${resolved.chargeable_days} gg` : '—'}
          />
        )}
        <FieldRow label="Capacity %" value={`${resolved.capacity_percentage}%`} />

        <div className="pt-2">
          <div className="text-xs text-muted-foreground mb-1">Cost Center Allocations</div>
          {resolved.costCenterAllocations.length === 0 ? (
            <div className="text-xs text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {resolved.costCenterAllocations.map((a) => {
                const cc = costCenterById.get(a.cost_center_id);
                return (
                  <li key={a.cost_center_id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{cc ? `${cc.code} ${cc.name}` : a.cost_center_id}</span>
                    <span>{a.percentage}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
