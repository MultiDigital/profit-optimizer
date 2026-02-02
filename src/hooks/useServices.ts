'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Service, ServiceInput } from '@/lib/optimizer/types';

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchServices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addService = useCallback(async (input: ServiceInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('services')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      setServices((prev) => [...prev, data]);
      toast.success('Service added', {
        description: `${input.name} has been added`,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add service';
      setError(message);
      toast.error('Failed to add service', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateService = useCallback(async (id: string, input: Partial<ServiceInput>) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setServices((prev) => prev.map((s) => (s.id === id ? data : s)));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update service';
      setError(message);
      toast.error('Failed to update', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteService = useCallback(async (id: string) => {
    const service = services.find((s) => s.id === id);
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.success('Service deleted', {
        description: service ? `${service.name} has been deleted` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete service';
      setError(message);
      toast.error('Failed to delete service', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return {
    services,
    loading,
    error,
    addService,
    updateService,
    deleteService,
    refetch: fetchServices,
  };
}
