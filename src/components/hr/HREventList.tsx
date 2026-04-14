'use client';

import { MemberEvent, ScenarioMemberEvent, MemberEventField } from '@/lib/optimizer/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type AnyEvent = MemberEvent | ScenarioMemberEvent;

interface HREventListProps {
  events: AnyEvent[];
  onEdit: (event: AnyEvent) => void;
  onDelete: (eventId: string) => void;
}

const FIELD_LABELS: Record<MemberEventField, string> = {
  salary: 'Stipendio',
  ft_percentage: 'FT%',
  seniority: 'Seniority',
  category: 'Categoria',
  capacity_percentage: 'Capacity %',
  chargeable_days: 'Giorni fatturabili',
  cost_center_allocations: 'Alloc. CdC',
};

function formatEventValue(field: MemberEventField, value: string): string {
  switch (field) {
    case 'salary':
      return formatCurrency(parseFloat(value));
    case 'ft_percentage':
    case 'capacity_percentage':
      return `${value}%`;
    case 'chargeable_days':
      return `${value} gg`;
    case 'seniority':
      return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');
    case 'category':
      return value.charAt(0).toUpperCase() + value.slice(1);
    case 'cost_center_allocations':
      return 'Cambio allocazione';
  }
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function HREventList({ events, onEdit, onDelete }: HREventListProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No planned changes</p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-3">
            <Badge variant="outline">{FIELD_LABELS[event.field]}</Badge>
            <span className="font-medium">{formatEventValue(event.field, event.value)}</span>
            <span className="text-muted-foreground">
              {formatDate(event.start_date)}
              {event.end_date ? ` - ${formatDate(event.end_date)}` : ' onwards'}
            </span>
            {event.note && (
              <span className="text-muted-foreground italic">{event.note}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(event)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(event.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
