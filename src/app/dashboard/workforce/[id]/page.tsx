'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMembers, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { InitialStateCard } from '@/components/workforce/InitialStateCard';
import { ActualStateCard } from '@/components/workforce/ActualStateCard';
import { HREventList } from '@/components/hr/HREventList';
import { HREventDialog } from '@/components/hr/HREventDialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
} from '@/components/ui';
import {
  MemberEvent,
  MemberEventInput,
  MEMBER_CATEGORY_LABELS,
} from '@/lib/optimizer/types';
import { resolveMemberAtDate } from '@/lib/hr/resolve';

export default function EmployeePage() {
  const params = useParams();
  const id = params.id as string;
  const { members, loading: membersLoading } = useMembers();
  const { costCenters, allocations, loading: ccLoading } = useCostCenters();
  const {
    events,
    eventAllocations,
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
    loading: eventsLoading,
  } = useMemberEvents(id);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | null>(null);

  const member = members.find((m) => m.id === id);
  const loading = membersLoading || ccLoading || eventsLoading;

  const resolved = useMemo(() => {
    if (!member) return null;
    const today = new Date().toISOString().slice(0, 10);
    return resolveMemberAtDate(member, allocations, events, [], eventAllocations, today);
  }, [member, allocations, events, eventAllocations]);

  const handleSaveEvent = async (
    input: MemberEventInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    if (editingEvent) {
      await updateEvent(editingEvent.id, input);
      if (input.field === 'cost_center_allocations' && cdcAllocations) {
        await updateEventAllocations(editingEvent.id, cdcAllocations);
      }
    } else {
      if (input.field === 'cost_center_allocations' && cdcAllocations) {
        await addEventWithAllocations(input, cdcAllocations);
      } else {
        await addEvent(input);
      }
    }
    setEditingEvent(null);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href="/dashboard/workforce"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workforce
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Employee not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/workforce"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workforce
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {member.first_name} {member.last_name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Badge variant="outline" className="text-xs">
                {MEMBER_CATEGORY_LABELS[member.category]}
              </Badge>
              <span>
                Contract {member.contract_start_date ?? '—'}
                {' → '}
                {member.contract_end_date ?? 'ongoing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
        {/* Left column: Initial + Actual */}
        <div className="space-y-4">
          <InitialStateCard
            member={member}
            baseAllocations={allocations}
            costCenters={costCenters}
          />
          {resolved && (
            <ActualStateCard resolved={resolved} costCenters={costCenters} />
          )}
        </div>

        {/* Right column: Planned Changes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Planned Changes</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setEditingEvent(null);
                  setEventDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Change
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <HREventList
              events={events}
              onEdit={(event) => {
                setEditingEvent(event as MemberEvent);
                setEventDialogOpen(true);
              }}
              onDelete={deleteEvent}
            />
          </CardContent>
        </Card>
      </div>

      {/* Event dialog */}
      <HREventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        members={[member]}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? eventAllocations.filter((a) => a.member_event_id === editingEvent.id)
            : undefined
        }
        editingEvent={
          editingEvent
            ? {
                id: editingEvent.id,
                member_id: editingEvent.member_id,
                field: editingEvent.field,
                value: editingEvent.value,
                start_date: editingEvent.start_date,
                end_date: editingEvent.end_date,
                note: editingEvent.note,
              }
            : null
        }
      />
    </div>
  );
}
