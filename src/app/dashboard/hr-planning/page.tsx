'use client';

import { useState, useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { useHRScenarios } from '@/hooks/useHRScenarios';
import { useHRPlanning } from '@/hooks/useHRPlanning';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { HRKPICards } from '@/components/hr/HRKPICards';
import { HRYearlyTable } from '@/components/hr/HRYearlyTable';
import { HREventDialog } from '@/components/hr/HREventDialog';
import { HREventList } from '@/components/hr/HREventList';
import { HRScenarioSelector } from '@/components/hr/HRScenarioSelector';
import { HRComparisonView } from '@/components/hr/HRComparisonView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, GitCompareArrows } from 'lucide-react';
import { MemberEvent, MemberEventInput, ScenarioMemberEvent } from '@/lib/optimizer/types';

export default function HRPlanningPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [source, setSource] = useState('baseline');
  const [tab, setTab] = useState('planning');
  const [cdcFilter, setCdcFilter] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemberEvent | ScenarioMemberEvent | null>(null);

  // Catalog write hooks (still needed for event mutations)
  const { settings, loading: settingsLoading } = useSettings();
  const { costCenters, allocations, loading: costCentersLoading } = useCostCenters();
  const { addEvent, addEventWithAllocations, updateEvent, updateEventAllocations, deleteEvent, loading: eventsLoading } = useMemberEvents();

  // HR Scenarios (needed for scenario management actions)
  const {
    hrScenarios,
    addHRScenario,
    deleteHRScenario,
    duplicateHRScenario,
    fetchHRScenarioWithData,
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEvent,
    updateScenarioEventAllocations,
    deleteScenarioEvent,
  } = useHRScenarios();

  // Resolved data bundle for the active source
  const { bundle, loading: bundleLoading } = useResolvedScenario(source);

  const activeMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
  const activeEvents = [
    ...bundle.canonicalEvents,
    ...bundle.scenarioEvents,
  ] as MemberEvent[]; // Cast for useHRPlanning union-of-arrays signature; safe per compute.ts routing
  const activeEventAllocations = bundle.eventAllocations;

  // Computation
  const { yearlyView, isCalculating } = useHRPlanning(
    activeMembers,
    activeEvents,
    settings,
    allocations,
    activeEventAllocations,
    year
  );

  // Comparison state
  const [compareSource, setCompareSource] = useState<string | null>(null);

  // Resolved data bundle for the compare source
  const { bundle: compareBundle, loading: compareBundleLoading } = useResolvedScenario(compareSource || 'baseline');

  const compareMembers = [...compareBundle.canonicalMembers, ...compareBundle.syntheticMembers];
  const compareEvents = [
    ...compareBundle.canonicalEvents,
    ...compareBundle.scenarioEvents,
  ] as MemberEvent[];
  const compareEventAllocations = compareBundle.eventAllocations;

  const { yearlyView: compareYearlyView } = useHRPlanning(
    compareMembers,
    compareEvents,
    settings,
    allocations,
    compareEventAllocations,
    year
  );

  // Event handlers
  const handleSaveEvent = async (input: MemberEventInput, cdcAllocations?: { cost_center_id: string; percentage: number }[]) => {
    if (source === 'baseline') {
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
    } else {
      if (editingEvent) {
        await updateScenarioEvent(editingEvent.id, {
          scenario_member_id: input.member_id,
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
        if (input.field === 'cost_center_allocations' && cdcAllocations) {
          await addScenarioEventWithAllocations({
            scenario_member_id: input.member_id,
            field: input.field,
            value: '',
            start_date: input.start_date,
            end_date: input.end_date,
            note: input.note,
          }, cdcAllocations);
        } else {
          await addScenarioEvent({
            scenario_member_id: input.member_id,
            field: input.field,
            value: input.value,
            start_date: input.start_date,
            end_date: input.end_date,
            note: input.note,
          });
        }
      }
      await fetchHRScenarioWithData(source);
    }
    setEditingEvent(null);
  };

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (source === 'baseline') {
      await deleteEvent(eventId);
    } else {
      await deleteScenarioEvent(eventId);
      await fetchHRScenarioWithData(source);
    }
  }, [source, deleteEvent, deleteScenarioEvent, fetchHRScenarioWithData]);

  const handleCreateScenario = async (name: string) => {
    const scenario = await addHRScenario(name);
    setSource(scenario.id);
  };

  const handleDeleteScenario = async (id: string) => {
    await deleteHRScenario(id);
    setSource('baseline');
  };

  const loading = settingsLoading || costCentersLoading || eventsLoading || bundleLoading || compareBundleLoading;
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">HR Planning</h1>
        <div className="flex items-center gap-4">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cdcFilter ?? 'all'} onValueChange={(v) => setCdcFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All cost centers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i centri di costo</SelectItem>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HRScenarioSelector
            source={source}
            onSourceChange={setSource}
            hrScenarios={hrScenarios}
            onCreateScenario={handleCreateScenario}
            onDuplicateScenario={async (id) => { await duplicateHRScenario(id); }}
            onDeleteScenario={handleDeleteScenario}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <HRKPICards yearlyView={yearlyView} loading={loading || isCalculating} costCenterId={cdcFilter} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompareArrows className="mr-2 h-4 w-4" />
            Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-6">
          {/* Scenario limitation notice */}
          {source !== 'baseline' && bundle.syntheticMembers.length === 0 && (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              This scenario has no synthetic members yet. Canonical-member overrides in scenarios will be authored from the employee page (coming in a later PR). For now, add a what-if hire by using the HR Scenario management elsewhere.
            </div>
          )}

          {/* Event management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Planned Changes</CardTitle>
                <Button size="sm" onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Change
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <HREventList
                events={activeEvents}
                onEdit={(event) => {
                  setEditingEvent(event as MemberEvent);
                  setEventDialogOpen(true);
                }}
                onDelete={handleDeleteEvent}
              />
            </CardContent>
          </Card>

          {/* Yearly table */}
          <Card>
            <CardContent className="pt-6">
              <HRYearlyTable yearlyView={yearlyView} loading={loading || isCalculating} costCenterId={cdcFilter} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Compare with:</span>
            <Select value={compareSource ?? ''} onValueChange={(v) => setCompareSource(v || null)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select to compare" />
              </SelectTrigger>
              <SelectContent>
                {source !== 'baseline' && (
                  <SelectItem value="baseline">Catalogo</SelectItem>
                )}
                {hrScenarios
                  .filter((s) => s.id !== source)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {yearlyView && compareYearlyView && compareSource && (
            <HRComparisonView
              baseView={yearlyView}
              compareView={compareYearlyView}
              baseLabel={source === 'baseline' ? 'Catalogo' : (hrScenarios.find((s) => s.id === source)?.name ?? 'Scenario')}
              compareLabel={compareSource === 'baseline' ? 'Catalogo' : (hrScenarios.find((s) => s.id === compareSource)?.name ?? 'Scenario')}
              costCenterId={cdcFilter}
            />
          )}

          {!compareSource && (
            <p className="text-sm text-muted-foreground">Select a source to compare with.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Event dialog */}
      <HREventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        members={source === 'baseline' ? activeMembers : bundle.syntheticMembers}
        onSave={handleSaveEvent}
        costCenters={costCenters}
        editingEventAllocations={
          editingEvent && editingEvent.field === 'cost_center_allocations'
            ? activeEventAllocations.filter((a) =>
                'scenario_member_id' in editingEvent
                  ? a.scenario_member_event_id === editingEvent.id
                  : a.member_event_id === editingEvent.id
              )
            : undefined
        }
        editingEvent={editingEvent ? {
          id: editingEvent.id,
          member_id: 'scenario_member_id' in editingEvent ? ((editingEvent as ScenarioMemberEvent).scenario_member_id ?? (editingEvent as ScenarioMemberEvent).member_id ?? '') : editingEvent.member_id,
          field: editingEvent.field,
          value: editingEvent.value,
          start_date: editingEvent.start_date,
          end_date: editingEvent.end_date,
          note: editingEvent.note,
        } : null}
      />
    </div>
  );
}
