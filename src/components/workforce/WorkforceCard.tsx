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
  MEMBER_CATEGORIES,
  MEMBER_CATEGORY_LABELS,
  MemberCategory,
  CapacitySettings,
} from '@/lib/optimizer/types';

interface WorkforceCardProps {
  members: Member[];
  loading?: boolean;
  capacitySettings: CapacitySettings;
  onAddMember: (input: MemberInput) => Promise<void>;
  onUpdateMember: (id: string, input: Partial<MemberInput>) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
}

export function WorkforceCard({
  members,
  loading,
  capacitySettings,
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={formData.first_name}
                      placeholder="e.g., Marco"
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={formData.last_name}
                      placeholder="e.g., Rossi"
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
            capacitySettings={capacitySettings}
            onUpdate={onUpdateMember}
            onDelete={onDeleteMember}
          />
        )}
      </CardContent>
    </Card>
  );
}
