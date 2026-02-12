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
import { Scenario, CostCenter } from '@/lib/optimizer/types';

interface ColumnActions {
  onDelete: (scenario: Scenario) => void;
  onDuplicate: (id: string) => Promise<unknown>;
  costCenters?: CostCenter[];
}

export const createColumns = ({ onDelete, onDuplicate, costCenters = [] }: ColumnActions): ColumnDef<Scenario>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    id: 'cost_center',
    header: 'Cost Center',
    cell: ({ row }) => {
      const ccId = row.original.cost_center_id;
      if (!ccId) return <div className="text-muted-foreground">-</div>;
      const cc = costCenters.find((c) => c.id === ccId);
      return <div className="text-muted-foreground">{cc?.code ?? '-'}</div>;
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => {
      const createdAt = row.getValue('created_at') as string | undefined;
      if (!createdAt) return <div className="text-muted-foreground">—</div>;

      const date = new Date(createdAt);
      return (
        <div className="text-muted-foreground">
          {date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const scenario = row.original;

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDuplicate(scenario.id)}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(scenario)}
                className="text-red-500 focus:text-red-500"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
