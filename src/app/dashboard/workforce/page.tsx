'use client';

import { useMembers } from '@/hooks';
import { WorkforceCard } from '@/components/workforce';

export default function WorkforcePage() {
  const { members, loading, addMember, updateMember, deleteMember } = useMembers();

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <WorkforceCard
          members={members}
          loading={loading}
          onAddMember={addMember}
          onUpdateMember={updateMember}
          onDeleteMember={deleteMember}
        />
      </div>
    </div>
  );
}
