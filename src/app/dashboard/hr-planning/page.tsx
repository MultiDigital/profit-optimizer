'use client';

import { useState } from 'react';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios } from '@/hooks/useHRScenarios';
import { EventsLogList } from '@/components/hr/EventsLogList';
import { HREventDialog } from '@/components/hr/HREventDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge, Skeleton } from '@/components/ui';
import { Plus } from 'lucide-react';
import {
  MemberEvent,
  MemberEventInput,
  MemberEventField,
  ScenarioMemberEvent,
} from '@/lib/optimizer/types';

const FIELD_OPTIONS: { value: MemberEventField | 'all'; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'salary', label: 'Stipendio' },
  { value: 'ft_percentage', label: 'FT%' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'category', label: 'Categoria' },
  { value: 'capacity_percentage', label: 'Capacity %' },
  { value: 'chargeable_days', label: 'Giorni fatturabili' },
  { value: 'cost_center_allocations', label: 'Alloc. CdC' },
];

export default function PlannedChangesPage() {
  const { scenarioId } = useViewContext();
  const { bundle, loading: bundleLoading, refetch: refetchActive } = useResolvedScenario();
  const { costCenters } = useCostCenters();
  const {
    addEvent,
    addEventWithAllocations,
    updateEvent,
    updateEventAllocations,
    deleteEvent,
  } = useMemberEvents();
  const {
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEvent,
    updateScenarioEventAllocations,
    deleteScenarioEvent,
  } = useHRScenarios();

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState<MemberEventField | null>(null);
  const [windowFilter, setWindowFilter] = useState<'all' | '3m' | '12m'>('12m');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | ScenarioMemberEvent | null>(null);

  const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];

  const handleSaveEvent = async (
    input: MemberEventInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    const isScenario = scenarioId !== 'baseline';
    // Which pool does the selected member belong to?
    const isSynthetic = bundle.syntheticMembers.some((m) => m.id === input.member_id);

    if (editingEvent) {
      // Edit: dispatch by which table the event lives in
      if ('hr_scenario_id' in editingEvent) {
        await updateScenarioEvent(editingEvent.id, {
          hr_scenario_id: editingEvent.hr_scenario_id,
          scenario_member_id: isSynthetic ? input.member_id : null,
          member_id: isSynthetic ? null : input.member_id,
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
      // Add: choose table by global scenario mode
      if (isScenario) {
        const scenInput = {
          hr_scenario_id: scenarioId,
          scenario_member_id: isSynthetic ? input.member_id : null,
          member_id: isSynthetic ? null : input.member_id,
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

  const activeScenarioName = bundle.scenarioName;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Planned Changes
            {bundle.source === 'scenario' && activeScenarioName && (
              <Badge variant="outline" className="text-[10px]">
                scenario: {activeScenarioName}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological log of all dated changes across the workforce. Use the global scenario picker
            (top bar) to overlay a scenario&apos;s deltas.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEvent(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Change
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Employee:</span>
              <Select
                value={employeeFilter ?? 'all'}
                onValueChange={(v) => setEmployeeFilter(v === 'all' ? null : v)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {allMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Field:</span>
              <Select
                value={fieldFilter ?? 'all'}
                onValueChange={(v) =>
                  setFieldFilter(v === 'all' ? null : (v as MemberEventField))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Window:</span>
              <Select
                value={windowFilter}
                onValueChange={(v) => setWindowFilter(v as 'all' | '3m' | '12m')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Next 3 months</SelectItem>
                  <SelectItem value="12m">Next 12 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      <Card>
        <CardContent className="pt-6">
          {bundleLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <EventsLogList
              canonicalEvents={bundle.canonicalEvents}
              scenarioEvents={bundle.scenarioEvents}
              canonicalMembers={bundle.canonicalMembers}
              syntheticMembers={bundle.syntheticMembers}
              employeeFilter={employeeFilter}
              fieldFilter={fieldFilter}
              windowFilter={windowFilter}
              onEdit={(event) => {
                setEditingEvent(event);
                setDialogOpen(true);
              }}
              onDelete={handleDeleteEvent}
            />
          )}
        </CardContent>
      </Card>

      {/* Event dialog */}
      <HREventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={allMembers}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEvent={
          editingEvent
            ? {
                id: editingEvent.id,
                member_id:
                  'member_id' in editingEvent && editingEvent.member_id
                    ? editingEvent.member_id
                    : 'scenario_member_id' in editingEvent && editingEvent.scenario_member_id
                      ? editingEvent.scenario_member_id
                      : '',
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
            ? bundle.eventAllocations.filter(
                (a) =>
                  a.member_event_id === editingEvent.id ||
                  a.scenario_member_event_id === editingEvent.id,
              )
            : undefined
        }
      />
    </div>
  );
}
