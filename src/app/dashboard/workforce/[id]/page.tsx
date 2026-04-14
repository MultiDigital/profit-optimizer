'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios } from '@/hooks/useHRScenarios';
import { InitialStateCard } from '@/components/workforce/InitialStateCard';
import { ActualStateCard } from '@/components/workforce/ActualStateCard';
import { ScenarioOverlayPanel } from '@/components/workforce/ScenarioOverlayPanel';
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
  ScenarioMemberEvent,
  MEMBER_CATEGORY_LABELS,
} from '@/lib/optimizer/types';
import { resolveMemberAtDate } from '@/lib/hr/resolve';

export default function EmployeePage() {
  const params = useParams();
  const id = params.id as string;

  const { scenarioId } = useViewContext();
  const { bundle, loading: bundleLoading, refetch: refetchActive } = useResolvedScenario();
  const { costCenters } = useCostCenters();

  // Direct member-events hook for THIS employee (baseline authoring path)
  const {
    events: canonicalEventsForMember,
    eventAllocations: canonicalEventAllocations,
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
    loading: canonicalEventsLoading,
  } = useMemberEvents(id);

  const {
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEvent,
    updateScenarioEventAllocations,
    deleteScenarioEvent,
  } = useHRScenarios();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | ScenarioMemberEvent | null>(null);
  // Whether the next "Add" click opens the baseline or scenario dialog.
  // Driven by which panel's + button was pressed.
  const [dialogTarget, setDialogTarget] = useState<'baseline' | 'scenario'>('baseline');

  const member = bundle.canonicalMembers.find((m) => m.id === id);
  const loading = bundleLoading || canonicalEventsLoading;

  // Scenario events scoped to THIS canonical member
  const scenarioEventsForMember = useMemo(
    () => bundle.scenarioEvents.filter((e) => e.member_id === id),
    [bundle.scenarioEvents, id],
  );

  // Resolved state TODAY (scenario overlay applied if a scenario is active)
  const resolved = useMemo(() => {
    if (!member) return null;
    const today = new Date().toISOString().slice(0, 10);
    return resolveMemberAtDate(
      member,
      bundle.baseAllocations,
      canonicalEventsForMember,
      scenarioEventsForMember,
      bundle.eventAllocations,
      today,
    );
  }, [member, bundle.baseAllocations, canonicalEventsForMember, scenarioEventsForMember, bundle.eventAllocations]);

  const handleSaveEvent = async (
    input: MemberEventInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    if (editingEvent) {
      // Dispatch edit based on which table the event lives in
      if ('hr_scenario_id' in editingEvent) {
        await updateScenarioEvent(editingEvent.id, {
          hr_scenario_id: editingEvent.hr_scenario_id,
          member_id: input.member_id,
          scenario_member_id: null,
          field: input.field,
          value: input.value,
          start_date: input.start_date,
          end_date: input.end_date,
          note: input.note,
        });
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await updateScenarioEventAllocations(editingEvent.id, cdcAllocations);
        }
      } else {
        await updateEvent(editingEvent.id, input);
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await updateEventAllocations(editingEvent.id, cdcAllocations);
        }
      }
    } else {
      // Add: route based on dialogTarget
      if (dialogTarget === 'scenario') {
        if (scenarioId === 'baseline') return; // safety; panel is hidden in baseline mode
        const scenInput = {
          hr_scenario_id: scenarioId,
          member_id: id,
          scenario_member_id: null,
          field: input.field,
          value: input.value,
          start_date: input.start_date,
          end_date: input.end_date,
          note: input.note,
        };
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addScenarioEventWithAllocations(scenInput, cdcAllocations);
        } else {
          await addScenarioEvent(scenInput);
        }
      } else {
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addEventWithAllocations(input, cdcAllocations);
        } else {
          await addEvent(input);
        }
      }
    }

    await refetchActive();
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (event: MemberEvent | ScenarioMemberEvent) => {
    if ('hr_scenario_id' in event) {
      await deleteScenarioEvent(event.id);
    } else {
      await deleteEvent(event.id);
    }
    await refetchActive();
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
        <Link href="/dashboard/workforce" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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

  const scenarioActive = scenarioId !== 'baseline' && bundle.source === 'scenario';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/workforce" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workforce
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {member.first_name} {member.last_name}
              {scenarioActive && bundle.scenarioName && (
                <Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-500 border-purple-500/20">
                  scenario: {bundle.scenarioName}
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Badge variant="outline" className="text-xs">{MEMBER_CATEGORY_LABELS[member.category]}</Badge>
              <span>
                Contract {member.contract_start_date ?? '—'}{' → '}{member.contract_end_date ?? 'ongoing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
        {/* Left column: Initial + Actual */}
        <div className="space-y-4">
          <InitialStateCard member={member} baseAllocations={bundle.baseAllocations} costCenters={costCenters} />
          {resolved && <ActualStateCard resolved={resolved} costCenters={costCenters} />}
        </div>

        {/* Right column: canonical timeline + optional scenario overlay */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Planned Changes (baseline)</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingEvent(null);
                    setDialogTarget('baseline');
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Change
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <HREventList
                events={canonicalEventsForMember}
                onEdit={(event) => {
                  setEditingEvent(event as MemberEvent);
                  setDialogTarget('baseline');
                  setDialogOpen(true);
                }}
                onDelete={(eventId) => {
                  const target = canonicalEventsForMember.find((e) => e.id === eventId);
                  if (target) handleDeleteEvent(target);
                }}
              />
            </CardContent>
          </Card>

          {scenarioActive && bundle.scenarioName && (
            <ScenarioOverlayPanel
              scenarioName={bundle.scenarioName}
              events={scenarioEventsForMember}
              onAdd={() => {
                setEditingEvent(null);
                setDialogTarget('scenario');
                setDialogOpen(true);
              }}
              onEdit={(event) => {
                setEditingEvent(event);
                setDialogTarget('scenario');
                setDialogOpen(true);
              }}
              onDelete={(eventId) => {
                const target = scenarioEventsForMember.find((e) => e.id === eventId);
                if (target) handleDeleteEvent(target);
              }}
            />
          )}
        </div>
      </div>

      {/* Event dialog */}
      <HREventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={[member]}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEvent={
          editingEvent
            ? {
                id: editingEvent.id,
                member_id: member.id,
                field: editingEvent.field,
                value: editingEvent.value,
                start_date: editingEvent.start_date,
                end_date: editingEvent.end_date,
                note: editingEvent.note,
              }
            : null
        }
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? (canonicalEventAllocations.filter((a) => a.member_event_id === editingEvent.id)).concat(
                bundle.eventAllocations.filter((a) => a.scenario_member_event_id === editingEvent.id),
              )
            : undefined
        }
      />
    </div>
  );
}
