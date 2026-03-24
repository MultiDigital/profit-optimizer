'use client';

import { useMembers, useSettings } from '@/hooks';
import { WorkforceCard } from '@/components/workforce';
import { DEFAULT_SETTINGS } from '@/lib/optimizer/types';

export default function WorkforcePage() {
  const { members, loading, addMember, updateMember, deleteMember } = useMembers();
  const { settings } = useSettings();

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <WorkforceCard
          members={members}
          loading={loading}
          capacitySettings={{
            yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
            festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
            ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
            malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
            formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
          }}
          onAddMember={addMember}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
        />
      </div>
    </div>
  );
}
