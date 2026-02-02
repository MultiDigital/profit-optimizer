'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMembers, useServices, useScenarios } from '@/hooks';
import { ScenarioCard } from '@/components/scenarios';

export default function DashboardPage() {
  const router = useRouter();
  const { members } = useMembers();
  const { services } = useServices();
  const {
    scenarios,
    loading: scenariosLoading,
    addScenario,
    deleteScenario,
    addMemberToScenario,
    addServiceToScenario,
  } = useScenarios();

  // Handle adding a new scenario with members and services
  const handleAddScenario = useCallback(async (name: string, memberIds: string[], serviceIds: string[]) => {
    const scenario = await addScenario({ name });

    // Add members to scenario (copy from catalog)
    for (const memberId of memberIds) {
      const member = members.find((m) => m.id === memberId);
      if (member) {
        await addMemberToScenario(scenario.id, member);
      }
    }

    // Add services to scenario (copy from catalog)
    for (const serviceId of serviceIds) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        await addServiceToScenario(scenario.id, service);
      }
    }

    // Navigate to the new scenario
    router.push(`/dashboard/scenarios/${scenario.id}`);
  }, [addScenario, addMemberToScenario, addServiceToScenario, members, services, router]);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <ScenarioCard
          scenarios={scenarios}
          allMembers={members}
          allServices={services}
          loading={scenariosLoading}
          onAddScenario={handleAddScenario}
          onDeleteScenario={deleteScenario}
        />
      </div>
    </div>
  );
}
