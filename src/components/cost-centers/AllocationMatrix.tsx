'use client';

import { useState, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Badge,
} from '@/components/ui';
import {
  Member,
  CostCenter,
  MemberCostCenterAllocation,
  SENIORITY_LABELS,
} from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface AllocationMatrixProps {
  members: Member[];
  costCenters: CostCenter[];
  allocations: MemberCostCenterAllocation[];
  onSetAllocation: (memberId: string, costCenterId: string, percentage: number) => Promise<void>;
}

export function AllocationMatrix({
  members,
  costCenters,
  allocations,
  onSetAllocation,
}: AllocationMatrixProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const getAllocation = useCallback(
    (memberId: string, costCenterId: string): number => {
      const alloc = allocations.find(
        (a) => a.member_id === memberId && a.cost_center_id === costCenterId
      );
      return alloc?.percentage ?? 0;
    },
    [allocations]
  );

  const getMemberTotal = useCallback(
    (memberId: string): number => {
      return allocations
        .filter((a) => a.member_id === memberId)
        .reduce((sum, a) => sum + a.percentage, 0);
    },
    [allocations]
  );

  const getCostCenterTotals = useCallback(
    (costCenterId: string) => {
      let totalDays = 0;
      let totalCost = 0;

      for (const member of members) {
        const pct = getAllocation(member.id, costCenterId);
        if (pct > 0) {
          const annualDays = member.days_per_month * 12 * (member.utilization / 100) * (pct / 100);
          const annualCost = member.salary * (pct / 100);
          totalDays += annualDays;
          totalCost += annualCost;
        }
      }

      return { totalDays, totalCost };
    },
    [members, getAllocation]
  );

  const cellKey = (memberId: string, ccId: string) => `${memberId}-${ccId}`;

  const handleCellClick = (memberId: string, ccId: string) => {
    const key = cellKey(memberId, ccId);
    const current = getAllocation(memberId, ccId);
    setEditingCell(key);
    setEditValue(current > 0 ? String(current) : '');
  };

  const handleCellBlur = async (memberId: string, ccId: string) => {
    const key = cellKey(memberId, ccId);
    if (editingCell !== key) return;

    const newValue = editValue === '' ? 0 : parseFloat(editValue);
    const current = getAllocation(memberId, ccId);

    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      setEditingCell(null);
      return;
    }

    if (newValue !== current) {
      setSaving(true);
      try {
        await onSetAllocation(memberId, ccId, newValue);
      } finally {
        setSaving(false);
      }
    }

    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, memberId: string, ccId: string) => {
    if (e.key === 'Enter') {
      handleCellBlur(memberId, ccId);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  if (costCenters.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No cost centers yet. Add one to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Member</TableHead>
            <TableHead className="text-center min-w-[60px]">Level</TableHead>
            {costCenters.map((cc) => (
              <TableHead key={cc.id} className="text-center min-w-[70px]">
                {cc.code}
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[60px]">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const total = getMemberTotal(member.id);
            const isOver = total > 100;

            return (
              <TableRow key={member.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  {member.name}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {SENIORITY_LABELS[member.seniority]?.substring(0, 3)}
                  </Badge>
                </TableCell>
                {costCenters.map((cc) => {
                  const key = cellKey(member.id, cc.id);
                  const pct = getAllocation(member.id, cc.id);
                  const isEditing = editingCell === key;

                  return (
                    <TableCell
                      key={cc.id}
                      className="text-center p-1"
                    >
                      {isEditing ? (
                        <Input
                          type="number"
                          className="h-7 w-16 mx-auto text-center text-xs"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleCellBlur(member.id, cc.id)}
                          onKeyDown={(e) => handleKeyDown(e, member.id, cc.id)}
                          min={0}
                          max={100}
                          autoFocus
                          disabled={saving}
                        />
                      ) : (
                        <button
                          className="h-7 w-16 mx-auto text-xs rounded border border-transparent hover:border-muted-foreground/20 hover:bg-muted transition-colors cursor-pointer inline-flex items-center justify-center"
                          onClick={() => handleCellClick(member.id, cc.id)}
                        >
                          {pct > 0 ? `${pct}%` : '-'}
                        </button>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-medium">
                  <span className={isOver ? 'text-red-500' : total === 100 ? 'text-green-500' : ''}>
                    {total}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })}

          {/* Days/year totals row */}
          <TableRow className="border-t-2 font-medium bg-muted/50">
            <TableCell className="sticky left-0 bg-muted/50 z-10">Days/Year</TableCell>
            <TableCell />
            {costCenters.map((cc) => {
              const { totalDays } = getCostCenterTotals(cc.id);
              return (
                <TableCell key={cc.id} className="text-center text-xs">
                  {totalDays > 0 ? Math.round(totalDays) : '-'}
                </TableCell>
              );
            })}
            <TableCell />
          </TableRow>

          {/* Cost totals row */}
          <TableRow className="font-medium bg-muted/50">
            <TableCell className="sticky left-0 bg-muted/50 z-10">Cost/Year</TableCell>
            <TableCell />
            {costCenters.map((cc) => {
              const { totalCost } = getCostCenterTotals(cc.id);
              return (
                <TableCell key={cc.id} className="text-center text-xs">
                  {totalCost > 0 ? formatCurrency(Math.round(totalCost)) : '-'}
                </TableCell>
              );
            })}
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
