'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Member,
  MemberCostCenterAllocation,
  CostCenter,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
  SeniorityLevel,
} from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface InitialStateCardProps {
  member: Member;
  baseAllocations: MemberCostCenterAllocation[]; // full table; filtered internally
  costCenters: CostCenter[];
}

export function InitialStateCard({ member, baseAllocations, costCenters }: InitialStateCardProps) {
  const memberAllocations = baseAllocations.filter((a) => a.member_id === member.id);
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));

  const capturedLabel = 'initial values set at creation';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Initial State</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">view only</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{capturedLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <FieldRow label="Category" value={MEMBER_CATEGORY_LABELS[member.category]} />
        {member.category !== 'segnalatore' && (
          <FieldRow
            label="Seniority"
            value={member.seniority ? SENIORITY_LABELS[member.seniority as SeniorityLevel] : '—'}
          />
        )}
        <FieldRow label="Salary" value={formatCurrency(member.salary)} />
        {member.category === 'dipendente' && (
          <FieldRow label="FT %" value={`${member.ft_percentage ?? 100}%`} />
        )}
        {member.category === 'freelance' && (
          <FieldRow
            label="Chargeable Days"
            value={member.chargeable_days != null ? `${member.chargeable_days} gg` : '—'}
          />
        )}
        <FieldRow label="Capacity %" value="100%" />

        <div className="pt-2">
          <div className="text-xs text-muted-foreground mb-1">Cost Center Allocations</div>
          {memberAllocations.length === 0 ? (
            <div className="text-xs text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5">
              {memberAllocations.map((a) => {
                const cc = costCenterById.get(a.cost_center_id);
                return (
                  <li key={a.id} className="flex justify-between text-xs">
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
