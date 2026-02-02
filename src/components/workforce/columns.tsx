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
import { Member, SENIORITY_LABELS } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface ColumnActions {
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
}

export const createColumns = ({ onEdit, onDelete }: ColumnActions): ColumnDef<Member>[] => [
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
    accessorKey: 'utilization',
    header: () => <div className="text-right">Util %</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('utilization')}%</div>
    ),
  },
  {
    id: 'effectiveDays',
    header: () => <div className="text-right">Eff. Days/Yr</div>,
    cell: ({ row }) => {
      const days = row.original.days_per_month;
      const util = row.original.utilization;
      const effective = days * (util / 100) * 12;
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
