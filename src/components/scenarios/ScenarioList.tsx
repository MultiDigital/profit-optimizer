'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Scenario } from '@/lib/optimizer/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui';
import { DataTable } from './data-table';
import { createColumns } from './columns';
import { useState } from 'react';

interface ScenarioListProps {
  scenarios: Scenario[];
  onDelete: (id: string) => Promise<void>;
}

export function ScenarioList({
  scenarios,
  onDelete,
}: ScenarioListProps) {
  const router = useRouter();
  const [deletingScenario, setDeletingScenario] = useState<Scenario | null>(null);

  const handleDelete = async () => {
    if (!deletingScenario) return;
    await onDelete(deletingScenario.id);
    setDeletingScenario(null);
  };

  const handleRowClick = (scenario: Scenario) => {
    router.push(`/dashboard/scenarios/${scenario.id}`);
  };

  const columns = useMemo(
    () =>
      createColumns({
        onDelete: setDeletingScenario,
      }),
    []
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={scenarios}
        onRowClick={handleRowClick}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingScenario} onOpenChange={(open) => !open && setDeletingScenario(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingScenario?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
