'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Skeleton,
} from '@/components/ui';
import { ScenarioList } from './ScenarioList';
import { ScenarioDialog } from './ScenarioDialog';
import { Scenario, Member, Service, CostCenter, MemberCostCenterAllocation } from '@/lib/optimizer/types';

interface ScenarioCardProps {
  scenarios: Scenario[];
  allMembers: Member[];
  allServices: Service[];
  costCenters?: CostCenter[];
  allocations?: MemberCostCenterAllocation[];
  loading?: boolean;
  onAddScenario: (name: string, memberIds: string[], serviceIds: string[], costCenterId?: string | null) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
  onDuplicateScenario: (id: string) => Promise<unknown>;
}

export function ScenarioCard({
  scenarios,
  allMembers,
  allServices,
  costCenters = [],
  allocations = [],
  loading,
  onAddScenario,
  onDeleteScenario,
  onDuplicateScenario,
}: ScenarioCardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (name: string, memberIds: string[], serviceIds: string[], costCenterId?: string | null) => {
    await onAddScenario(name, memberIds, serviceIds, costCenterId);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>📊</span> Scenarios
          </CardTitle>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            + Add Scenario
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : (
          <ScenarioList
            scenarios={scenarios}
            costCenters={costCenters}
            onDelete={onDeleteScenario}
            onDuplicate={onDuplicateScenario}
          />
        )}
      </CardContent>

      {/* Create Dialog */}
      <ScenarioDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        allMembers={allMembers}
        allServices={allServices}
        costCenters={costCenters}
        allocations={allocations}
        onSave={handleCreate}
        mode="create"
      />
    </Card>
  );
}
