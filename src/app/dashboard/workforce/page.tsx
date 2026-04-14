'use client';

import { useMemo } from 'react';
import { useMembers, useSettings, useCostCenters } from '@/hooks';
import { useMemberEvents } from '@/hooks/useMemberEvents';
import { WorkforceCard } from '@/components/workforce';
import { DEFAULT_SETTINGS, MemberInput } from '@/lib/optimizer/types';
import { countUpcomingEventsByMember } from '@/lib/workforce/upcoming-events';

export default function WorkforcePage() {
  const { members, loading: membersLoading, addMember, updateMember, deleteMember } = useMembers();
  const { settings } = useSettings();
  const { events, loading: eventsLoading } = useMemberEvents();
  const { costCenters, setAllocation } = useCostCenters();

  const upcomingCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return countUpcomingEventsByMember(events, today, 365);
  }, [events]);

  const addMemberWithCdc = async (
    input: MemberInput,
    cdcAllocations?: { cost_center_id: string; percentage: number }[],
  ) => {
    const created = await addMember(input);
    if (!created) return;
    if (cdcAllocations) {
      for (const a of cdcAllocations) {
        await setAllocation(created.id, a.cost_center_id, a.percentage);
      }
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <WorkforceCard
          members={members}
          loading={membersLoading || eventsLoading}
          capacitySettings={{
            yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
            festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
            ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
            malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
            formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
          }}
          upcomingCounts={upcomingCounts}
          costCenters={costCenters}
          onAddMember={addMemberWithCdc}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
        />
      </div>
    </div>
  );
}
