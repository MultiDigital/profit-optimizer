'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { MemberEvent, MemberEventInput } from '@/lib/optimizer/types';

export function useMemberEvents(memberId?: string) {
  const [events, setEvents] = useState<MemberEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('member_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (memberId) {
        query = query.eq('member_id', memberId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  const addEvent = useCallback(async (input: MemberEventInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('member_events')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      setEvents((prev) => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      toast.success('Planned change added');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add event';
      setError(message);
      toast.error('Failed to add planned change', { description: message });
      throw err;
    }
  }, []);

  const updateEvent = useCallback(async (id: string, input: Partial<MemberEventInput>) => {
    try {
      const { data, error } = await supabase
        .from('member_events')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === id ? data : e)).sort((a, b) => a.start_date.localeCompare(b.start_date)));
      toast.success('Planned change updated');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
      toast.error('Failed to update planned change', { description: message });
      throw err;
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('member_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Planned change removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      toast.error('Failed to remove planned change', { description: message });
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    refetch: fetchEvents,
  };
}
