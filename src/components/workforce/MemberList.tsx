'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Member,
  MemberInput,
  SENIORITY_LABELS,
  SENIORITY_LEVELS,
  SeniorityLevel,
} from '@/lib/optimizer/types';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

interface MemberListProps {
  members: Member[];
  onUpdate: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MemberList({ members, onUpdate, onDelete }: MemberListProps) {
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<MemberInput>({
    name: '',
    seniority: 'middle',
    days_per_month: 20,
    utilization: 80,
    salary: 50000,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingMember) {
      setFormData({
        name: editingMember.name,
        seniority: editingMember.seniority,
        days_per_month: editingMember.days_per_month,
        utilization: editingMember.utilization,
        salary: editingMember.salary,
      });
      setError(null);
    }
  }, [editingMember]);

  const handleSave = async () => {
    if (!editingMember) return;
    setError(null);

    if (!formData.name.trim()) {
      setError('Member name is required');
      return;
    }

    if (formData.days_per_month < 1 || formData.days_per_month > 31) {
      setError('Days per month must be between 1 and 31');
      return;
    }

    if (formData.utilization < 1 || formData.utilization > 100) {
      setError('Utilization must be between 1% and 100%');
      return;
    }

    if (formData.salary < 0) {
      setError('Salary must be a positive number');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(editingMember.id, formData);
      setEditingMember(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    await onDelete(deletingMember.id);
    setDeletingMember(null);
  };

  const columns = useMemo(
    () =>
      createColumns({
        onEdit: setEditingMember,
        onDelete: setDeletingMember,
      }),
    []
  );

  return (
    <>
      <DataTable columns={columns} data={members} />

      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Seniority</Label>
              <Select
                value={formData.seniority}
                onValueChange={(value) => setFormData({ ...formData, seniority: value as SeniorityLevel })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {SENIORITY_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {SENIORITY_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Days/Month</Label>
                <Input
                  type="number"
                  value={formData.days_per_month}
                  onChange={(e) => setFormData({ ...formData, days_per_month: parseFloat(e.target.value) || 20 })}
                  min={1}
                  max={31}
                />
              </div>
              <div className="space-y-2">
                <Label>Utilization %</Label>
                <Input
                  type="number"
                  value={formData.utilization}
                  onChange={(e) => setFormData({ ...formData, utilization: parseFloat(e.target.value) || 80 })}
                  min={1}
                  max={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Salary (EUR/year)</Label>
              <Input
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 50000 })}
                min={0}
                step={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deletingMember?.name}</strong> from the team?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
