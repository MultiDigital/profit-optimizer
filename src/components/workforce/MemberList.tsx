'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Member,
  MemberInput,
  SENIORITY_LABELS,
  SENIORITY_LEVELS,
  SeniorityLevel,
  MEMBER_CATEGORIES,
  MEMBER_CATEGORY_LABELS,
  MemberCategory,
  CapacitySettings,
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
  capacitySettings: CapacitySettings;
  onUpdate: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MemberList({ members, capacitySettings, onUpdate, onDelete }: MemberListProps) {
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<MemberInput>({
    first_name: '',
    last_name: '',
    category: 'dipendente',
    seniority: 'middle',
    salary: 50000,
    chargeable_days: null,
    ft_percentage: 100,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (editingMember) {
      setFormData({
        first_name: editingMember.first_name,
        last_name: editingMember.last_name,
        category: editingMember.category,
        seniority: editingMember.seniority,
        salary: editingMember.salary,
        chargeable_days: editingMember.chargeable_days ?? null,
        ft_percentage: editingMember.ft_percentage ?? 100,
        contract_start_date: editingMember.contract_start_date ?? null,
        contract_end_date: editingMember.contract_end_date ?? null,
      });
      setError(null);
    }
  }, [editingMember]);

  const handleSave = async () => {
    if (!editingMember) return;
    setError(null);

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required');
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
        capacitySettings,
      }),
    [capacitySettings]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        onRowClick={(m) => router.push(`/dashboard/workforce/${m.id}`)}
      />

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category ?? 'dipendente'}
                onValueChange={(value) => {
                  const category = value as MemberCategory;
                  setFormData({
                    ...formData,
                    category,
                    seniority: category === 'segnalatore' ? null : (formData.seniority ?? 'middle'),
                    chargeable_days: category === 'freelance' ? formData.chargeable_days : null,
                    ft_percentage: category === 'dipendente' ? (formData.ft_percentage ?? 100) : 100,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {MEMBER_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formData.category ?? 'dipendente') !== 'segnalatore' && (
              <div className="space-y-2">
                <Label>Seniority</Label>
                <Select
                  value={formData.seniority ?? 'middle'}
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
            )}

            {(formData.category ?? 'dipendente') === 'dipendente' && (
              <div className="space-y-2">
                <Label>Full-Time %</Label>
                <Input
                  type="number"
                  value={formData.ft_percentage ?? 100}
                  onChange={(e) => setFormData({ ...formData, ft_percentage: parseFloat(e.target.value) || 100 })}
                  min={1}
                  max={100}
                />
              </div>
            )}

            {(formData.category ?? 'dipendente') === 'freelance' && (
              <div className="space-y-2">
                <Label>Chargeable Days/Year</Label>
                <Input
                  type="number"
                  value={formData.chargeable_days ?? ''}
                  onChange={(e) => setFormData({ ...formData, chargeable_days: e.target.value ? parseFloat(e.target.value) : null })}
                  min={0}
                  placeholder="Auto (uses yearly workable days)"
                />
              </div>
            )}

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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contract Start</Label>
                <Input
                  type="date"
                  value={formData.contract_start_date || ''}
                  onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value || null })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Contract End</Label>
                <Input
                  type="date"
                  value={formData.contract_end_date || ''}
                  onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value || null })}
                />
              </div>
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
              Are you sure you want to remove <strong>{deletingMember?.first_name} {deletingMember?.last_name}</strong> from the team?
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
