'use client';

import { useState } from 'react';
import { YearlyView, SeniorityLevel } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Metric = 'cost' | 'capacity' | 'fte';

interface HRYearlyTableProps {
  yearlyView: YearlyView | null;
  loading?: boolean;
  onMemberClick?: (memberId: string) => void;
}

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function formatCell(value: number, metric: Metric): string {
  switch (metric) {
    case 'cost':
      return value > 0 ? formatCurrency(value) : '-';
    case 'capacity':
      return value > 0 ? value.toFixed(1) : '-';
    case 'fte':
      return value > 0 ? value.toFixed(2) : '-';
  }
}

export function HRYearlyTable({ yearlyView, loading, onMemberClick }: HRYearlyTableProps) {
  const [metric, setMetric] = useState<Metric>('cost');
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  if (loading || !yearlyView) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { monthlySnapshots } = yearlyView;

  // Get unique members from first snapshot that has members
  const allMemberIds = new Set<string>();
  const memberInfo = new Map<string, { firstName: string; lastName: string; seniority: SeniorityLevel | null }>();
  for (const snapshot of monthlySnapshots) {
    for (const detail of snapshot.memberDetails) {
      if (!allMemberIds.has(detail.memberId)) {
        allMemberIds.add(detail.memberId);
        memberInfo.set(detail.memberId, {
          firstName: detail.firstName,
          lastName: detail.lastName,
          seniority: detail.effectiveSeniority,
        });
      }
    }
  }

  const memberIds = Array.from(allMemberIds);

  const toggleMember = (memberId: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const getMemberMonthValue = (memberId: string, monthIndex: number): number => {
    const snapshot = monthlySnapshots[monthIndex];
    const detail = snapshot.memberDetails.find((d) => d.memberId === memberId);
    if (!detail || !detail.isActive) return 0;
    switch (metric) {
      case 'cost': return detail.monthlyCost;
      case 'capacity': return detail.monthlyCapacity;
      case 'fte': return detail.fte;
    }
  };

  const getMemberYearTotal = (memberId: string): number => {
    return monthlySnapshots.reduce((sum, _, i) => sum + getMemberMonthValue(memberId, i), 0);
  };

  const getMonthTotal = (monthIndex: number): number => {
    const snapshot = monthlySnapshots[monthIndex];
    switch (metric) {
      case 'cost': return snapshot.totalCompanyCost;
      case 'capacity': return snapshot.productiveCapacity;
      case 'fte': return snapshot.fte;
    }
  };

  const hasActiveEvents = (memberId: string, monthIndex: number): boolean => {
    const snapshot = monthlySnapshots[monthIndex];
    const detail = snapshot.memberDetails.find((d) => d.memberId === memberId);
    return (detail?.activeEvents?.length ?? 0) > 0;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Detail by Member</h3>
        <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cost">Cost (EUR)</SelectItem>
            <SelectItem value="capacity">Capacity (days)</SelectItem>
            <SelectItem value="fte">FTE</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium min-w-[180px]">Member</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-3 py-2 text-right font-medium min-w-[80px]">{m}</th>
              ))}
              <th className="px-3 py-2 text-right font-medium min-w-[100px] bg-muted/80">Total</th>
            </tr>
          </thead>
          <tbody>
            {memberIds.map((memberId) => {
              const info = memberInfo.get(memberId)!;
              const isExpanded = expandedMembers.has(memberId);
              return (
                <tr
                  key={memberId}
                  className="border-b hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggleMember(memberId)}
                >
                  <td className="sticky left-0 bg-background px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                      {info.firstName} {info.lastName}
                    </div>
                  </td>
                  {MONTHS.map((_, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        hasActiveEvents(memberId, i) && 'bg-yellow-500/10'
                      )}
                    >
                      {formatCell(getMemberMonthValue(memberId, i), metric)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums bg-muted/30">
                    {formatCell(getMemberYearTotal(memberId), metric)}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 bg-muted/50 font-bold">
              <td className="sticky left-0 bg-muted/50 px-3 py-2">Total</td>
              {MONTHS.map((_, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums">
                  {formatCell(getMonthTotal(i), metric)}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums bg-muted/80">
                {formatCell(monthlySnapshots.reduce((sum, _, i) => sum + getMonthTotal(i), 0), metric)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
