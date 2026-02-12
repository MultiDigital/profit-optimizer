'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMembers, useServices, useScenarios, useCostCenters } from '@/hooks';
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
    duplicateScenario,
    addMemberToScenario,
    addServiceToScenario,
  } = useScenarios();
  const { costCenters, allocations } = useCostCenters();

  // Handle adding a new scenario with members and services
  const handleAddScenario = useCallback(async (
    name: string,
    memberIds: string[],
    serviceIds: string[],
    costCenterId?: string | null,
  ) => {
    const scenario = await addScenario({ name, cost_center_id: costCenterId ?? null });

    // Add members to scenario (copy from catalog)
    for (const memberId of memberIds) {
      const member = members.find((m) => m.id === memberId);
      if (member) {
        // If cost center is selected, use the member's allocation % for that cost center
        let allocationPct: number | undefined;
        if (costCenterId) {
          const alloc = allocations.find(
            (a) => a.member_id === memberId && a.cost_center_id === costCenterId
          );
          allocationPct = alloc?.percentage;
        }
        await addMemberToScenario(scenario.id, member, allocationPct);
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
  }, [addScenario, addMemberToScenario, addServiceToScenario, members, services, allocations, router]);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl">
        <ScenarioCard
          scenarios={scenarios}
          allMembers={members}
          allServices={services}
          costCenters={costCenters}
          allocations={allocations}
          loading={scenariosLoading}
          onAddScenario={handleAddScenario}
          onDeleteScenario={deleteScenario}
          onDuplicateScenario={duplicateScenario}
        />
      </div>
    </div>
  );
}
