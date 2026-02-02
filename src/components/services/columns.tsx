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
import { Service, Settings } from '@/lib/optimizer/types';
import { formatCurrency } from '@/lib/utils';

interface ColumnActions {
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  settings: Settings | null;
}

export const createColumns = ({ onEdit, onDelete, settings }: ColumnActions): ColumnDef<Service>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'price',
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => (
      <div className="text-right">{formatCurrency(row.getValue('price'))}</div>
    ),
  },
  {
    accessorKey: 'senior_days',
    header: () => <div className="text-right">Sr</div>,
    cell: ({ row }) => (
      <div className="text-right text-purple-500">{row.getValue('senior_days')}</div>
    ),
  },
  {
    accessorKey: 'middle_days',
    header: () => <div className="text-right">Mid</div>,
    cell: ({ row }) => (
      <div className="text-right text-yellow-500">{row.getValue('middle_days')}</div>
    ),
  },
  {
    accessorKey: 'junior_days',
    header: () => <div className="text-right">Jr</div>,
    cell: ({ row }) => (
      <div className="text-right text-cyan-500">{row.getValue('junior_days')}</div>
    ),
  },
  {
    id: 'margin',
    header: () => <div className="text-right">Margin</div>,
    cell: ({ row }) => {
      const service = row.original;
      if (!settings) {
        return <div className="text-right text-muted-foreground">—</div>;
      }

      const cost =
        service.senior_days * settings.senior_rate +
        service.middle_days * settings.middle_rate +
        service.junior_days * settings.junior_rate;

      const margin = service.price - cost;
      const marginPct = service.price > 0 ? (margin / service.price) * 100 : 0;
      const marginColor = margin >= 0 ? 'text-green-500' : 'text-red-500';

      return (
        <div className={`text-right ${marginColor}`}>
          {formatCurrency(margin)} ({marginPct.toFixed(0)}%)
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
