'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  Skeleton,
} from '@/components/ui';
import { MemberList } from './MemberList';
import {
  Member,
  MemberInput,
  DEFAULT_MEMBER,
  SENIORITY_LEVELS,
  SENIORITY_LABELS,
  SeniorityLevel,
} from '@/lib/optimizer/types';

interface WorkforceCardProps {
  members: Member[];
  loading?: boolean;
  onAddMember: (input: MemberInput) => Promise<void>;
  onUpdateMember: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}

export function WorkforceCard({
  members,
  loading,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}: WorkforceCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<MemberInput>(DEFAULT_MEMBER);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData(DEFAULT_MEMBER);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleSave = async () => {
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
      await onAddMember(formData);
      setIsOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>👥</span> Workforce
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm">+ Add Member</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
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
                    placeholder="e.g., Marco"
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
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Member'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <MemberList
            members={members}
            onUpdate={onUpdateMember}
            onDelete={onDeleteMember}
          />
        )}
      </CardContent>
    </Card>
  );
}
