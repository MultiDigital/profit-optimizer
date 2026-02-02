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
import { Scenario, Member, Service } from '@/lib/optimizer/types';

interface ScenarioCardProps {
  scenarios: Scenario[];
  allMembers: Member[];
  allServices: Service[];
  loading?: boolean;
  onAddScenario: (name: string, memberIds: string[], serviceIds: string[]) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
}

export function ScenarioCard({
  scenarios,
  allMembers,
  allServices,
  loading,
  onAddScenario,
  onDeleteScenario,
}: ScenarioCardProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (name: string, memberIds: string[], serviceIds: string[]) => {
    await onAddScenario(name, memberIds, serviceIds);
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
            onDelete={onDeleteScenario}
          />
        )}
      </CardContent>

      {/* Create Dialog */}
      <ScenarioDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        allMembers={allMembers}
        allServices={allServices}
        onSave={handleCreate}
        mode="create"
      />
    </Card>
  );
}
