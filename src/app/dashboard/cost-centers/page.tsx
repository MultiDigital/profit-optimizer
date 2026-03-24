'use client';

import { useState } from 'react';
import { useMembers, useCostCenters, useSettings } from '@/hooks';
import { AllocationMatrix, CostCenterDialog } from '@/components/cost-centers';
import { CostCenter, DEFAULT_SETTINGS } from '@/lib/optimizer/types';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
} from '@/components/ui';

export default function CostCentersPage() {
  const { members, loading: membersLoading } = useMembers();
  const { settings } = useSettings();
  const {
    costCenters,
    allocations,
    loading: ccLoading,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    setAllocation,
  } = useCostCenters();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCc, setEditingCc] = useState<CostCenter | null>(null);
  const [deletingCc, setDeletingCc] = useState<CostCenter | null>(null);

  const loading = membersLoading || ccLoading;

  const handleCreate = async (input: { code: string; name: string }) => {
    await addCostCenter(input);
  };

  const handleEdit = async (input: { code: string; name: string }) => {
    if (!editingCc) return;
    await updateCostCenter(editingCc.id, input);
    setEditingCc(null);
  };

  const handleDelete = async () => {
    if (!deletingCc) return;
    await deleteCostCenter(deletingCc.id);
    setDeletingCc(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Cost Centers
              </CardTitle>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Add Cost Center
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
              <>
                {/* Cost center pills for quick edit/delete */}
                {costCenters.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {costCenters.map((cc) => (
                      <Badge
                        key={cc.id}
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80 text-sm py-1 px-3 gap-2"
                        onClick={() => setEditingCc(cc)}
                      >
                        <span className="font-bold">{cc.code}</span>
                        <span className="text-muted-foreground">{cc.name}</span>
                        <button
                          className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingCc(cc);
                          }}
                        >
                          &times;
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <AllocationMatrix
                  members={members}
                  costCenters={costCenters}
                  allocations={allocations}
                  capacitySettings={{
                    yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
                    festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
                    ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
                    malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
                    formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
                  }}
                  onSetAllocation={setAllocation}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <CostCenterDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSave={handleCreate}
          mode="create"
        />

        {/* Edit Dialog */}
        <CostCenterDialog
          open={!!editingCc}
          onOpenChange={(open) => !open && setEditingCc(null)}
          costCenter={editingCc}
          onSave={handleEdit}
          mode="edit"
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingCc} onOpenChange={(open) => !open && setDeletingCc(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete cost center?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingCc?.code} - {deletingCc?.name}</strong>?
                All allocations for this cost center will be removed.
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
      </div>
    </div>
  );
}
