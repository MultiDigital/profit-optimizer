'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Member, MemberInput } from '@/lib/optimizer/types';

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchMembers = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMember = useCallback(async (input: MemberInput) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('members')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      setMembers((prev) => [...prev, data]);
      toast.success('Team member added', {
        description: `${input.name} has been added to the team`,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add member';
      setError(message);
      toast.error('Failed to add member', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMember = useCallback(async (id: string, input: Partial<MemberInput>) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setMembers((prev) => prev.map((m) => (m.id === id ? data : m)));
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update member';
      setError(message);
      toast.error('Failed to update', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteMember = useCallback(async (id: string) => {
    const member = members.find((m) => m.id === id);
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success('Team member removed', {
        description: member ? `${member.name} has been removed` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete member';
      setError(message);
      toast.error('Failed to remove member', { description: message });
      throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    addMember,
    updateMember,
    deleteMember,
    refetch: fetchMembers,
  };
}
