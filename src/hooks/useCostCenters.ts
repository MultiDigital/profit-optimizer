'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { CostCenter, CostCenterInput, MemberCostCenterAllocation } from '@/lib/optimizer/types';

export function useCostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [allocations, setAllocations] = useState<MemberCostCenterAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchCostCenters = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [ccResult, allocResult] = await Promise.all([
        supabase
          .from('cost_centers')
          .select('*')
          .eq('user_id', user.id)
          .order('code', { ascending: true }),
        supabase
          .from('member_cost_center_allocations')
          .select('*'),
      ]);

      if (ccResult.error) throw ccResult.error;
      if (allocResult.error) throw allocResult.error;

      setCostCenters(ccResult.data || []);
      setAllocations(allocResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cost centers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCostCenter = useCallback(async (input: CostCenterInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('cost_centers')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      setCostCenters((prev) => [...prev, data].sort((a, b) => a.code.localeCompare(b.code)));
      toast.success('Cost center added', {
        description: `${input.code} - ${input.name} has been added`,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add cost center';
      setError(message);
      toast.error('Failed to add cost center', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCostCenter = useCallback(async (id: string, input: Partial<CostCenterInput>) => {
    try {
      const { data, error } = await supabase
        .from('cost_centers')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setCostCenters((prev) => prev.map((cc) => (cc.id === id ? data : cc)));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update cost center';
      setError(message);
      toast.error('Failed to update cost center', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteCostCenter = useCallback(async (id: string) => {
    const cc = costCenters.find((c) => c.id === id);
    try {
      const { error } = await supabase
        .from('cost_centers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCostCenters((prev) => prev.filter((c) => c.id !== id));
      setAllocations((prev) => prev.filter((a) => a.cost_center_id !== id));
      toast.success('Cost center removed', {
        description: cc ? `${cc.code} - ${cc.name} has been removed` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete cost center';
      setError(message);
      toast.error('Failed to remove cost center', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costCenters]);

  const setAllocation = useCallback(async (memberId: string, costCenterId: string, percentage: number) => {
    try {
      if (percentage === 0) {
        // Delete allocation if percentage is 0
        const existing = allocations.find(
          (a) => a.member_id === memberId && a.cost_center_id === costCenterId
        );
        if (existing) {
          const { error } = await supabase
            .from('member_cost_center_allocations')
            .delete()
            .eq('id', existing.id);

          if (error) throw error;
          setAllocations((prev) => prev.filter((a) => a.id !== existing.id));
        }
        return;
      }

      // Upsert allocation
      const { data, error } = await supabase
        .from('member_cost_center_allocations')
        .upsert(
          {
            member_id: memberId,
            cost_center_id: costCenterId,
            percentage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id,cost_center_id' }
        )
        .select()
        .single();

      if (error) throw error;
      setAllocations((prev) => {
        const idx = prev.findIndex(
          (a) => a.member_id === memberId && a.cost_center_id === costCenterId
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [...prev, data];
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update allocation';
      toast.error('Failed to update allocation', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocations]);

  const getAllocationsForCostCenter = useCallback(
    (costCenterId: string) => {
      return allocations.filter((a) => a.cost_center_id === costCenterId);
    },
    [allocations]
  );

  const getAllocationsForMember = useCallback(
    (memberId: string) => {
      return allocations.filter((a) => a.member_id === memberId);
    },
    [allocations]
  );

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  return {
    costCenters,
    allocations,
    loading,
    error,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    setAllocation,
    getAllocationsForCostCenter,
    getAllocationsForMember,
    refetch: fetchCostCenters,
  };
}
