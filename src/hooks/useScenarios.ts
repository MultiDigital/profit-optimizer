'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  Scenario,
  ScenarioInput,
  ScenarioWithData,
  ScenarioMemberData,
  ScenarioServiceData,
  ScenarioMemberDataInput,
  ScenarioServiceDataInput,
  Member,
  Service,
} from '@/lib/optimizer/types';

export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchScenarios = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScenarios(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scenarios');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addScenario = useCallback(async (input: ScenarioInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('scenarios')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      setScenarios((prev) => [data, ...prev]);
      toast.success('Scenario created', {
        description: `${input.name} has been created`,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create scenario';
      setError(message);
      toast.error('Failed to create scenario', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateScenario = useCallback(async (id: string, input: Partial<ScenarioInput>) => {
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setScenarios((prev) => prev.map((s) => (s.id === id ? data : s)));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update scenario';
      setError(message);
      toast.error('Failed to update scenario', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteScenario = useCallback(async (id: string) => {
    const scenario = scenarios.find((s) => s.id === id);
    try {
      const { error } = await supabase
        .from('scenarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      toast.success('Scenario deleted', {
        description: scenario ? `${scenario.name} has been deleted` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete scenario';
      setError(message);
      toast.error('Failed to delete scenario', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios]);

  // Add member data to scenario (copy from catalog)
  const addMemberToScenario = useCallback(async (scenarioId: string, member: Member) => {
    try {
      const input: ScenarioMemberDataInput = {
        source_member_id: member.id,
        name: member.name,
        seniority: member.seniority,
        days_per_month: member.days_per_month,
        salary: member.salary,
        capacity_percentage: 100, // default to 100%
        cost_percentage: 100, // default to 100%
      };

      const { data, error } = await supabase
        .from('scenario_members_data')
        .insert({
          scenario_id: scenarioId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ScenarioMemberData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member to scenario';
      toast.error('Failed to add member', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add service data to scenario (copy from catalog)
  const addServiceToScenario = useCallback(async (scenarioId: string, service: Service) => {
    try {
      const input: ScenarioServiceDataInput = {
        source_service_id: service.id,
        name: service.name,
        senior_days: service.senior_days,
        middle_days: service.middle_days,
        junior_days: service.junior_days,
        price: service.price,
        max_year: null, // default to unlimited at scenario level
      };

      const { data, error } = await supabase
        .from('scenario_services_data')
        .insert({
          scenario_id: scenarioId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ScenarioServiceData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add service to scenario';
      toast.error('Failed to add service', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update member data in scenario
  const updateScenarioMember = useCallback(async (id: string, input: Partial<ScenarioMemberDataInput>) => {
    try {
      const { data, error } = await supabase
        .from('scenario_members_data')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ScenarioMemberData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update member';
      toast.error('Failed to update member', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update service data in scenario
  const updateScenarioService = useCallback(async (id: string, input: Partial<ScenarioServiceDataInput>) => {
    try {
      const { data, error } = await supabase
        .from('scenario_services_data')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ScenarioServiceData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update service';
      toast.error('Failed to update service', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove member from scenario
  const removeMemberFromScenario = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('scenario_members_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member from scenario';
      toast.error('Failed to remove member', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove service from scenario
  const removeServiceFromScenario = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('scenario_services_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove service from scenario';
      toast.error('Failed to remove service', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resync member from catalog
  const resyncMemberFromCatalog = useCallback(async (scenarioMemberId: string, catalogMember: Member) => {
    return updateScenarioMember(scenarioMemberId, {
      source_member_id: catalogMember.id,
      name: catalogMember.name,
      seniority: catalogMember.seniority,
      days_per_month: catalogMember.days_per_month,
      salary: catalogMember.salary,
    });
  }, [updateScenarioMember]);

  // Resync service from catalog
  const resyncServiceFromCatalog = useCallback(async (scenarioServiceId: string, catalogService: Service, keepMaxYear = true) => {
    // Get current max_year if we want to keep it
    let maxYear: number | null = null;
    if (keepMaxYear) {
      const { data } = await supabase
        .from('scenario_services_data')
        .select('max_year')
        .eq('id', scenarioServiceId)
        .single();
      maxYear = data?.max_year ?? null;
    }

    return updateScenarioService(scenarioServiceId, {
      source_service_id: catalogService.id,
      name: catalogService.name,
      senior_days: catalogService.senior_days,
      middle_days: catalogService.middle_days,
      junior_days: catalogService.junior_days,
      price: catalogService.price,
      max_year: maxYear,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateScenarioService]);

  // Fetch scenario with all data
  const fetchScenarioWithData = useCallback(async (scenarioId: string): Promise<ScenarioWithData | null> => {
    try {
      // Fetch the scenario
      const { data: scenario, error: scenarioError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      if (scenarioError) throw scenarioError;
      if (!scenario) return null;

      // Fetch member data for this scenario
      const { data: members, error: membersError } = await supabase
        .from('scenario_members_data')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

      // Fetch service data for this scenario
      const { data: services, error: servicesError } = await supabase
        .from('scenario_services_data')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('created_at', { ascending: true });

      if (servicesError) throw servicesError;

      return {
        ...scenario,
        members: members || [],
        services: services || [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch scenario data';
      toast.error('Failed to load scenario', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch existing member/service IDs in a scenario (for the add dialog to know what's already added)
  const fetchScenarioSourceIds = useCallback(async (scenarioId: string) => {
    try {
      const [memberResult, serviceResult] = await Promise.all([
        supabase
          .from('scenario_members_data')
          .select('source_member_id')
          .eq('scenario_id', scenarioId),
        supabase
          .from('scenario_services_data')
          .select('source_service_id')
          .eq('scenario_id', scenarioId),
      ]);

      if (memberResult.error) throw memberResult.error;
      if (serviceResult.error) throw serviceResult.error;

      return {
        memberIds: (memberResult.data || [])
          .map((r) => r.source_member_id)
          .filter((id): id is string => id !== null),
        serviceIds: (serviceResult.data || [])
          .map((r) => r.source_service_id)
          .filter((id): id is string => id !== null),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch scenario data';
      toast.error('Failed to load scenario', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  return {
    scenarios,
    loading,
    error,
    addScenario,
    updateScenario,
    deleteScenario,
    addMemberToScenario,
    addServiceToScenario,
    updateScenarioMember,
    updateScenarioService,
    removeMemberFromScenario,
    removeServiceFromScenario,
    resyncMemberFromCatalog,
    resyncServiceFromCatalog,
    fetchScenarioWithData,
    fetchScenarioSourceIds,
    refetch: fetchScenarios,
  };
}
