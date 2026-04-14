'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  HRScenario,
  HRScenarioMember,
  HRScenarioMemberInput,
  Member,
  MemberEvent,
  ScenarioMemberEvent,
  ScenarioMemberEventInput,
  EventCostCenterAllocation,
} from '@/lib/optimizer/types';

export interface HRScenarioWithData {
  scenario: HRScenario;
  members: HRScenarioMember[];
  events: ScenarioMemberEvent[];
  eventAllocations: EventCostCenterAllocation[];
}

export function useHRScenarios() {
  const [hrScenarios, setHrScenarios] = useState<HRScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchHRScenarios = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('hr_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHrScenarios(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch HR scenarios');
    } finally {
      setLoading(false);
    }
  }, []);

  const addHRScenario = useCallback(async (
    name: string,
    catalogMembers: Member[],
    catalogEvents: MemberEvent[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create scenario
      const { data: scenario, error: scenarioError } = await supabase
        .from('hr_scenarios')
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // 2. Copy catalog members
      if (catalogMembers.length > 0) {
        const memberRows = catalogMembers.map((m) => ({
          user_id: user.id,
          hr_scenario_id: scenario.id,
          source_member_id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          category: m.category,
          seniority: m.seniority,
          salary: m.salary,
          ft_percentage: m.ft_percentage ?? 100,
          chargeable_days: m.chargeable_days,
          capacity_percentage: 100,
          cost_percentage: 100,
          contract_start_date: m.contract_start_date ?? null,
          contract_end_date: m.contract_end_date ?? null,
        }));

        const { data: insertedMembers, error: memberError } = await supabase
          .from('hr_scenario_members')
          .insert(memberRows)
          .select();

        if (memberError) throw memberError;

        // 3. Copy catalog events mapped to new scenario member IDs
        if (catalogEvents.length > 0 && insertedMembers) {
          const memberIdMap = new Map<string, string>();
          for (const inserted of insertedMembers) {
            if (inserted.source_member_id) {
              memberIdMap.set(inserted.source_member_id, inserted.id);
            }
          }

          const eventRows = catalogEvents
            .filter((e) => memberIdMap.has(e.member_id))
            .map((e) => ({
              user_id: user.id,
              scenario_member_id: memberIdMap.get(e.member_id)!,
              field: e.field,
              value: e.value,
              start_date: e.start_date,
              end_date: e.end_date,
              note: e.note,
            }));

          if (eventRows.length > 0) {
            const { error: eventError } = await supabase
              .from('scenario_member_events')
              .insert(eventRows);

            if (eventError) throw eventError;
          }

          // Copy CDC event allocations
          if (eventRows.length > 0) {
            const { data: insertedEvents } = await supabase
              .from('scenario_member_events')
              .select('*')
              .eq('user_id', user.id)
              .in('scenario_member_id', insertedMembers.map((m: HRScenarioMember) => m.id))
              .order('start_date', { ascending: true });

            if (insertedEvents) {
              const cdcCatalogEvents = catalogEvents.filter((e) => e.field === 'cost_center_allocations');
              if (cdcCatalogEvents.length > 0) {
                const catalogEventIds = cdcCatalogEvents.map((e) => e.id);
                const { data: srcAllocs } = await supabase
                  .from('event_cost_center_allocations')
                  .select('*')
                  .in('member_event_id', catalogEventIds);

                if (srcAllocs && srcAllocs.length > 0) {
                  for (const cdcEvent of cdcCatalogEvents) {
                    const newMemberId = memberIdMap.get(cdcEvent.member_id);
                    if (!newMemberId) continue;
                    const matchingNewEvent = insertedEvents.find(
                      (e: ScenarioMemberEvent) =>
                        e.scenario_member_id === newMemberId &&
                        e.field === 'cost_center_allocations' &&
                        e.start_date === cdcEvent.start_date
                    );
                    if (!matchingNewEvent) continue;
                    const eventAllocs = srcAllocs.filter((a: EventCostCenterAllocation) => a.member_event_id === cdcEvent.id);
                    if (eventAllocs.length > 0) {
                      await supabase.from('event_cost_center_allocations').insert(
                        eventAllocs.map((a: EventCostCenterAllocation) => ({
                          scenario_member_event_id: matchingNewEvent.id,
                          cost_center_id: a.cost_center_id,
                          percentage: a.percentage,
                        }))
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }

      setHrScenarios((prev) => [scenario, ...prev]);
      toast.success('HR scenario created', { description: `${name} has been created` });
      return scenario as HRScenario;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create HR scenario';
      setError(message);
      toast.error('Failed to create HR scenario', { description: message });
      throw err;
    }
  }, []);

  const deleteHRScenario = useCallback(async (id: string) => {
    const scenario = hrScenarios.find((s) => s.id === id);
    try {
      const { error } = await supabase
        .from('hr_scenarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setHrScenarios((prev) => prev.filter((s) => s.id !== id));
      toast.success('HR scenario deleted', {
        description: scenario ? `${scenario.name} has been deleted` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete HR scenario';
      setError(message);
      toast.error('Failed to delete HR scenario', { description: message });
      throw err;
    }
  }, [hrScenarios]);

  const fetchHRScenarioWithData = useCallback(async (scenarioId: string): Promise<HRScenarioWithData | null> => {
    try {
      const { data: scenario, error: scenarioError } = await supabase
        .from('hr_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      if (scenarioError) throw scenarioError;

      const { data: members, error: membersError } = await supabase
        .from('hr_scenario_members')
        .select('*')
        .eq('hr_scenario_id', scenarioId)
        .order('last_name', { ascending: true });

      if (membersError) throw membersError;

      const memberIds = (members || []).map((m: HRScenarioMember) => m.id);
      let events: ScenarioMemberEvent[] = [];
      if (memberIds.length > 0) {
        const { data: eventData, error: eventsError } = await supabase
          .from('scenario_member_events')
          .select('*')
          .in('scenario_member_id', memberIds)
          .order('start_date', { ascending: true });

        if (eventsError) throw eventsError;
        events = eventData || [];
      }

      // Fetch event CDC allocations
      const cdcEventIds = events
        .filter((e: ScenarioMemberEvent) => e.field === 'cost_center_allocations')
        .map((e: ScenarioMemberEvent) => e.id);

      let eventAllocations: EventCostCenterAllocation[] = [];
      if (cdcEventIds.length > 0) {
        const { data: allocData, error: allocError } = await supabase
          .from('event_cost_center_allocations')
          .select('*')
          .in('scenario_member_event_id', cdcEventIds);

        if (allocError) throw allocError;
        eventAllocations = allocData || [];
      }

      return { scenario, members: members || [], events, eventAllocations };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch HR scenario';
      setError(message);
      return null;
    }
  }, []);

  const duplicateHRScenario = useCallback(async (id: string) => {
    try {
      const source = await fetchHRScenarioWithData(id);
      if (!source) throw new Error('Scenario not found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create new scenario
      const { data: newScenario, error: scenarioError } = await supabase
        .from('hr_scenarios')
        .insert({ user_id: user.id, name: `${source.scenario.name} (Copy)` })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // Copy members
      if (source.members.length > 0) {
        const memberRows = source.members.map((m) => ({
          user_id: user.id,
          hr_scenario_id: newScenario.id,
          source_member_id: m.source_member_id,
          first_name: m.first_name,
          last_name: m.last_name,
          category: m.category,
          seniority: m.seniority,
          salary: m.salary,
          ft_percentage: m.ft_percentage,
          chargeable_days: m.chargeable_days,
          capacity_percentage: m.capacity_percentage,
          cost_percentage: m.cost_percentage,
          contract_start_date: m.contract_start_date,
          contract_end_date: m.contract_end_date,
        }));

        const { data: insertedMembers, error: memberError } = await supabase
          .from('hr_scenario_members')
          .insert(memberRows)
          .select();

        if (memberError) throw memberError;

        // Copy events
        if (source.events.length > 0 && insertedMembers) {
          const memberIdMap = new Map<string, string>();
          for (let i = 0; i < source.members.length; i++) {
            memberIdMap.set(source.members[i].id, insertedMembers[i].id);
          }

          const eventRows = source.events
            .filter((e) => e.scenario_member_id !== null && memberIdMap.has(e.scenario_member_id))
            .map((e) => ({
              user_id: user.id,
              scenario_member_id: memberIdMap.get(e.scenario_member_id!)!,
              field: e.field,
              value: e.value,
              start_date: e.start_date,
              end_date: e.end_date,
              note: e.note,
            }));

          if (eventRows.length > 0) {
            await supabase.from('scenario_member_events').insert(eventRows);
          }

          // Copy CDC event allocations from source scenario
          if (source.events.length > 0 && source.eventAllocations.length > 0) {
            const { data: insertedEvents } = await supabase
              .from('scenario_member_events')
              .select('*')
              .in('scenario_member_id', insertedMembers.map((m: HRScenarioMember) => m.id))
              .order('start_date', { ascending: true });

            if (insertedEvents) {
              for (const srcEvent of source.events.filter((e) => e.field === 'cost_center_allocations')) {
                const newMemberId = srcEvent.scenario_member_id !== null ? memberIdMap.get(srcEvent.scenario_member_id) : undefined;
                if (!newMemberId) continue;
                const matchingNewEvent = insertedEvents.find(
                  (e: ScenarioMemberEvent) =>
                    e.scenario_member_id === newMemberId &&
                    e.field === 'cost_center_allocations' &&
                    e.start_date === srcEvent.start_date
                );
                if (!matchingNewEvent) continue;
                const eventAllocs = source.eventAllocations.filter((a) => a.scenario_member_event_id === srcEvent.id);
                if (eventAllocs.length > 0) {
                  await supabase.from('event_cost_center_allocations').insert(
                    eventAllocs.map((a) => ({
                      scenario_member_event_id: matchingNewEvent.id,
                      cost_center_id: a.cost_center_id,
                      percentage: a.percentage,
                    }))
                  );
                }
              }
            }
          }
        }
      }

      setHrScenarios((prev) => [newScenario, ...prev]);
      toast.success('HR scenario duplicated', { description: `${newScenario.name} has been created` });
      return newScenario as HRScenario;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate HR scenario';
      setError(message);
      toast.error('Failed to duplicate', { description: message });
      throw err;
    }
  }, [fetchHRScenarioWithData]);

  const addHypotheticalMember = useCallback(async (scenarioId: string, input: HRScenarioMemberInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('hr_scenario_members')
        .insert({
          user_id: user.id,
          hr_scenario_id: scenarioId,
          source_member_id: null,
          first_name: input.first_name,
          last_name: input.last_name,
          category: input.category,
          seniority: input.seniority ?? null,
          salary: input.salary,
          ft_percentage: input.ft_percentage ?? 100,
          chargeable_days: input.chargeable_days ?? null,
          capacity_percentage: input.capacity_percentage ?? 100,
          cost_percentage: input.cost_percentage ?? 100,
          contract_start_date: input.contract_start_date ?? null,
          contract_end_date: input.contract_end_date ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Hypothetical member added', {
        description: `${input.first_name} ${input.last_name} added to scenario`,
      });
      return data as HRScenarioMember;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add hypothetical member';
      setError(message);
      toast.error('Failed to add member', { description: message });
      throw err;
    }
  }, []);

  const removeScenarioMember = useCallback(async (scenarioMemberId: string) => {
    try {
      const { error } = await supabase
        .from('hr_scenario_members')
        .delete()
        .eq('id', scenarioMemberId);

      if (error) throw error;
      toast.success('Member removed from scenario');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setError(message);
      toast.error('Failed to remove member', { description: message });
      throw err;
    }
  }, []);

  const addScenarioEvent = useCallback(async (input: ScenarioMemberEventInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('scenario_member_events')
        .insert({ user_id: user.id, ...input })
        .select()
        .single();

      if (error) throw error;
      toast.success('Planned change added to scenario');
      return data as ScenarioMemberEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add event';
      setError(message);
      toast.error('Failed to add planned change', { description: message });
      throw err;
    }
  }, []);

  const addScenarioEventWithAllocations = useCallback(async (
    input: ScenarioMemberEventInput,
    cdcAllocations: { cost_center_id: string; percentage: number }[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('scenario_member_events')
        .insert({ user_id: user.id, ...input, value: '' })
        .select()
        .single();

      if (error) throw error;

      if (cdcAllocations.length > 0) {
        const allocRows = cdcAllocations
          .filter((a) => a.percentage > 0)
          .map((a) => ({
            scenario_member_event_id: data.id,
            cost_center_id: a.cost_center_id,
            percentage: a.percentage,
          }));

        if (allocRows.length > 0) {
          await supabase.from('event_cost_center_allocations').insert(allocRows);
        }
      }

      toast.success('Planned change added to scenario');
      return data as ScenarioMemberEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add event';
      setError(message);
      toast.error('Failed to add planned change', { description: message });
      throw err;
    }
  }, []);

  const updateScenarioEventAllocations = useCallback(async (
    eventId: string,
    cdcAllocations: { cost_center_id: string; percentage: number }[]
  ) => {
    try {
      await supabase
        .from('event_cost_center_allocations')
        .delete()
        .eq('scenario_member_event_id', eventId);

      const allocRows = cdcAllocations
        .filter((a) => a.percentage > 0)
        .map((a) => ({
          scenario_member_event_id: eventId,
          cost_center_id: a.cost_center_id,
          percentage: a.percentage,
        }));

      if (allocRows.length > 0) {
        await supabase.from('event_cost_center_allocations').insert(allocRows);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update allocations';
      toast.error('Failed to update allocations', { description: message });
      throw err;
    }
  }, []);

  const updateScenarioEvent = useCallback(async (id: string, input: Partial<ScenarioMemberEventInput>) => {
    try {
      const { data, error } = await supabase
        .from('scenario_member_events')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Planned change updated');
      return data as ScenarioMemberEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
      toast.error('Failed to update', { description: message });
      throw err;
    }
  }, []);

  const deleteScenarioEvent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('scenario_member_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Planned change removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      toast.error('Failed to remove', { description: message });
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchHRScenarios();
  }, [fetchHRScenarios]);

  return {
    hrScenarios,
    loading,
    error,
    addHRScenario,
    deleteHRScenario,
    duplicateHRScenario,
    fetchHRScenarioWithData,
    addHypotheticalMember,
    removeScenarioMember,
    addScenarioEvent,
    addScenarioEventWithAllocations,
    updateScenarioEventAllocations,
    updateScenarioEvent,
    deleteScenarioEvent,
    refetch: fetchHRScenarios,
  };
}
