'use client';

import { useMemo } from 'react';
import {
  MemberEvent,
  ScenarioMemberEvent,
  MemberEventField,
  Member,
  HRScenarioMember,
} from '@/lib/optimizer/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Pencil, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

type AnyEvent = MemberEvent | ScenarioMemberEvent;

interface EventsLogListProps {
  canonicalEvents: MemberEvent[];
  scenarioEvents: ScenarioMemberEvent[];
  canonicalMembers: Member[];
  syntheticMembers: HRScenarioMember[];
  employeeFilter: string | null; // member_id or scenario_member_id; null = all
  fieldFilter: MemberEventField | null; // null = all
  windowFilter: 'all' | '3m' | '12m'; // all-time / next 3 months / next 12 months
  onEdit: (event: AnyEvent) => void;
  onDelete: (event: AnyEvent) => void;
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
    case 'salary': return formatCurrency(parseFloat(value));
    case 'ft_percentage':
    case 'capacity_percentage':
      return `${value}%`;
    case 'chargeable_days': return `${value} gg`;
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

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function EventsLogList({
  canonicalEvents,
  scenarioEvents,
  canonicalMembers,
  syntheticMembers,
  employeeFilter,
  fieldFilter,
  windowFilter,
  onEdit,
  onDelete,
}: EventsLogListProps) {
  const today = new Date().toISOString().slice(0, 10);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of canonicalMembers) {
      map.set(m.id, `${m.first_name} ${m.last_name}`);
    }
    for (const s of syntheticMembers) {
      map.set(s.id, `${s.first_name} ${s.last_name}`);
    }
    return map;
  }, [canonicalMembers, syntheticMembers]);

  const windowEnd = useMemo(() => {
    if (windowFilter === '3m') return addDays(today, 90);
    if (windowFilter === '12m') return addDays(today, 365);
    return null;
  }, [windowFilter, today]);

  // Unified, filtered, chronologically sorted list
  const rows = useMemo(() => {
    type Row = {
      event: AnyEvent;
      source: 'canonical' | 'scenario';
      memberName: string;
      memberId: string; // for go-to-employee link (canonical events always; scenario events use member_id if set)
    };
    const all: Row[] = [];

    for (const e of canonicalEvents) {
      all.push({
        event: e,
        source: 'canonical',
        memberName: memberNameById.get(e.member_id) ?? '—',
        memberId: e.member_id,
      });
    }
    for (const e of scenarioEvents) {
      const targetId = e.member_id ?? e.scenario_member_id ?? '';
      all.push({
        event: e,
        source: 'scenario',
        memberName: memberNameById.get(targetId) ?? '—',
        memberId: targetId,
      });
    }

    // Filter
    const filtered = all.filter((row) => {
      if (employeeFilter && row.memberId !== employeeFilter) return false;
      if (fieldFilter && row.event.field !== fieldFilter) return false;
      if (windowEnd) {
        if (row.event.start_date <= today) return false;
        if (row.event.start_date > windowEnd) return false;
      }
      return true;
    });

    // Chronological: earliest first
    filtered.sort((a, b) => a.event.start_date.localeCompare(b.event.start_date));
    return filtered;
  }, [canonicalEvents, scenarioEvents, memberNameById, employeeFilter, fieldFilter, windowEnd, today]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No planned changes match the current filters.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map(({ event, source, memberName, memberId }) => (
        <div
          key={event.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
              {formatDate(event.start_date)}
            </span>
            <Link
              href={`/dashboard/workforce/${memberId}`}
              className="font-medium hover:underline whitespace-nowrap"
            >
              {memberName}
            </Link>
            <Badge variant="outline" className="text-[10px]">{FIELD_LABELS[event.field]}</Badge>
            <span className="truncate">{formatEventValue(event.field, event.value)}</span>
            {source === 'scenario' && (
              <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-500 border-purple-500/20">
                scenario
              </Badge>
            )}
            {event.note && (
              <span className="text-muted-foreground italic truncate">{event.note}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/dashboard/workforce/${memberId}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Go to employee">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(event)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onDelete(event)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
