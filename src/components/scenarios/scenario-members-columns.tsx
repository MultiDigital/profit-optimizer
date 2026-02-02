'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScenarioMemberData, SENIORITY_LABELS } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface ColumnActions {
  onEdit: (member: ScenarioMemberData) => void;
  onDelete: (member: ScenarioMemberData) => void;
}

export const createColumns = ({ onEdit, onDelete }: ColumnActions): ColumnDef<ScenarioMemberData>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'seniority',
    header: 'Seniority',
    cell: ({ row }) => (
      <div>{SENIORITY_LABELS[row.getValue('seniority') as keyof typeof SENIORITY_LABELS]}</div>
    ),
  },
  {
    accessorKey: 'days_per_month',
    header: () => <div className="text-right">Days/Mo</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('days_per_month')}</div>
    ),
  },
  {
    accessorKey: 'capacity_percentage',
    header: () => <div className="text-right">Cap %</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('capacity_percentage') ?? 100}%</div>
    ),
  },
  {
    accessorKey: 'cost_percentage',
    header: () => <div className="text-right">Cost %</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('cost_percentage') ?? 100}%</div>
    ),
  },
  {
    id: 'effectiveDays',
    header: () => <div className="text-right">Eff. Days/Yr</div>,
    cell: ({ row }) => {
      const days = row.original.days_per_month;
      const capacityPct = row.original.capacity_percentage ?? 100;
      const effective = days * (capacityPct / 100) * 12;
      return (
        <div className="text-right text-cyan-500">{effective.toFixed(0)}</div>
      );
    },
  },
  {
    accessorKey: 'salary',
    header: () => <div className="text-right">Salary/Yr</div>,
    cell: ({ row }) => (
      <div className="text-right text-red-500">
        {formatCurrency(row.getValue('salary'))}
      </div>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const member = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(member)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(member)}
              className="text-red-500 focus:text-red-500"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
