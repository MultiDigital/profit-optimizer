'use client';

import { useState, useEffect, useMemo } from 'react';
import { Service, ServiceInput, Settings } from '@/lib/optimizer/types';
import {
  Button,
  Input,
  Label,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui';
import { DataTable } from './data-table';
import { createColumns } from './columns';

interface ServiceListProps {
  services: Service[];
  settings: Settings | null;
  onUpdate: (id: string, input: Partial<ServiceInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ServiceList({ services, settings, onUpdate, onDelete }: ServiceListProps) {
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceInput>({
    name: '',
    senior_days: 0,
    middle_days: 0,
    junior_days: 0,
    price: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingService) {
      setFormData({
        name: editingService.name,
        senior_days: editingService.senior_days,
        middle_days: editingService.middle_days,
        junior_days: editingService.junior_days,
        price: editingService.price,
      });
      setError(null);
    }
  }, [editingService]);

  const handleSave = async () => {
    if (!editingService) return;
    setError(null);

    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }

    const totalDays =
      formData.senior_days + formData.middle_days + formData.junior_days;
    if (totalDays === 0) {
      setError('Service must require at least 1 day of work');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(editingService.id, formData);
      setEditingService(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingService) return;
    await onDelete(deletingService.id);
    setDeletingService(null);
  };

  const columns = useMemo(
    () =>
      createColumns({
        onEdit: setEditingService,
        onDelete: setDeletingService,
        settings,
      }),
    [settings]
  );

  return (
    <>
      <DataTable columns={columns} data={services} />

      <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Service Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Price (EUR)</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                min={0}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Senior Days</Label>
                <Input
                  type="number"
                  value={formData.senior_days}
                  onChange={(e) => setFormData({ ...formData, senior_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Middle Days</Label>
                <Input
                  type="number"
                  value={formData.middle_days}
                  onChange={(e) => setFormData({ ...formData, middle_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Junior Days</Label>
                <Input
                  type="number"
                  value={formData.junior_days}
                  onChange={(e) => setFormData({ ...formData, junior_days: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingService(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingService} onOpenChange={(open) => !open && setDeletingService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingService?.name}</strong>?
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
