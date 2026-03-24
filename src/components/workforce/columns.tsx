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
import { Member, SENIORITY_LABELS, MEMBER_CATEGORY_LABELS, MemberCategory, CapacitySettings, computeEffectiveDays } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface ColumnActions {
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  capacitySettings: CapacitySettings;
}

export const createColumns = ({ onEdit, onDelete, capacitySettings }: ColumnActions): ColumnDef<Member>[] => [
  {
    accessorKey: 'last_name',
    header: 'Last Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('last_name')}</div>
    ),
  },
  {
    accessorKey: 'first_name',
    header: 'First Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('first_name')}</div>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <div>{MEMBER_CATEGORY_LABELS[row.getValue('category') as MemberCategory]}</div>
    ),
  },
  {
    accessorKey: 'seniority',
    header: 'Seniority',
    cell: ({ row }) => {
      const seniority = row.getValue('seniority') as keyof typeof SENIORITY_LABELS | null;
      return <div>{seniority ? SENIORITY_LABELS[seniority] : '-'}</div>;
    },
  },
  {
    id: 'effectiveDays',
    header: () => <div className="text-right">Eff. Days/Yr</div>,
    cell: ({ row }) => {
      const member = row.original;
      if (member.category === 'segnalatore') {
        return <div className="text-right text-muted-foreground">-</div>;
      }
      const effective = (member.category === 'freelance' && member.chargeable_days != null)
        ? member.chargeable_days
        : member.category === 'freelance'
        ? capacitySettings.yearly_workable_days
        : computeEffectiveDays(
            capacitySettings.yearly_workable_days,
            capacitySettings.festivita_nazionali,
            capacitySettings.ferie,
            capacitySettings.malattia,
            capacitySettings.formazione
          ) * ((member.ft_percentage ?? 100) / 100);
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
