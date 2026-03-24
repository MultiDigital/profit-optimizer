'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Infinity } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScenarioServiceData } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface ColumnActions {
  onEdit: (service: ScenarioServiceData) => void;
  onDelete: (service: ScenarioServiceData) => void;
}

export const createColumns = ({ onEdit, onDelete }: ColumnActions): ColumnDef<ScenarioServiceData>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'senior_days',
    header: () => <div className="text-right">Sr</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('senior_days')}</div>
    ),
  },
  {
    accessorKey: 'middle_up_days',
    header: () => <div className="text-right">MU</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('middle_up_days')}</div>
    ),
  },
  {
    accessorKey: 'middle_days',
    header: () => <div className="text-right">Mid</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('middle_days')}</div>
    ),
  },
  {
    accessorKey: 'junior_days',
    header: () => <div className="text-right">Jr</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('junior_days')}</div>
    ),
  },
  {
    accessorKey: 'stage_days',
    header: () => <div className="text-right">Stg</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue('stage_days')}</div>
    ),
  },
  {
    accessorKey: 'price',
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => (
      <div className="text-right text-primary font-medium">
        {formatCurrency(row.getValue('price'))}
      </div>
    ),
  },
  {
    accessorKey: 'max_year',
    header: () => <div className="text-right">Max/Yr</div>,
    cell: ({ row }) => {
      const maxYear = row.getValue('max_year') as number | null;
      return (
        <div className="text-right text-muted-foreground">
          {maxYear ?? <Infinity className="inline h-4 w-4" />}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const service = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(service)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(service)}
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
