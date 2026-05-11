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
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';

interface ColumnActions {
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  capacitySettings: CapacitySettings;
  upcomingCounts: Map<string, number>;
}

export const createColumns = ({ onEdit, onDelete, capacitySettings, upcomingCounts }: ColumnActions): ColumnDef<Member>[] => [
  {
    accessorKey: 'last_name',
    header: 'Last Name',
    cell: ({ row }) => {
      const member = row.original;
      const today = new Date().toISOString().split('T')[0];
      const sixMonths = new Date();
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      const sixMonthsStr = sixMonths.toISOString().split('T')[0];

      let badge: { label: string; className: string } | null = null;

      if (member.contract_end_date && member.contract_end_date <= today) {
        badge = { label: 'Terminato', className: 'bg-muted text-muted-foreground' };
      } else if (member.contract_start_date && member.contract_start_date > today) {
        badge = { label: 'Da assumere', className: 'bg-blue-500/15 text-blue-500 border-blue-500/20' };
      } else if (member.contract_end_date && member.contract_end_date <= sixMonthsStr) {
        badge = { label: 'In uscita', className: 'bg-orange-500/15 text-orange-500 border-orange-500/20' };
      }

      return (
        <div className={cn('flex items-center gap-2 font-medium', member.contract_end_date && member.contract_end_date <= today && 'opacity-50')}>
          {row.getValue('last_name')}
          {badge && <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', badge.className)}>{badge.label}</Badge>}
        </div>
      );
    },
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
    id: 'upcoming',
    header: () => <div className="text-right">Upcoming</div>,
    cell: ({ row }) => {
      const count = upcomingCounts.get(row.original.id) ?? 0;
      if (count === 0) {
        return <div className="text-right text-muted-foreground">—</div>;
      }
      return (
        <div className="text-right">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-500 border-blue-500/20">
            {count} change{count === 1 ? '' : 's'}
          </Badge>
        </div>
      );
    },
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
