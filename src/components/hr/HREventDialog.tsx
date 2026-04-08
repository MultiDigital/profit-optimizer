'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Member, MemberEventField, MemberEventInput, HRScenarioMember, CostCenter, EventCostCenterAllocation } from '@/lib/optimizer/types';
import { cn } from '@/lib/utils';

type AnyMember = Member | HRScenarioMember;

interface HREventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: AnyMember[];
  onSave: (input: MemberEventInput, cdcAllocations?: { cost_center_id: string; percentage: number }[]) => Promise<void>;
  editingEvent?: {
    id: string;
    member_id: string;
    field: MemberEventField;
    value: string;
    start_date: string;
    end_date: string | null;
    note: string | null;
  } | null;
  costCenters?: CostCenter[];
  editingEventAllocations?: EventCostCenterAllocation[];
}

const FIELD_OPTIONS: { value: MemberEventField; label: string }[] = [
  { value: 'salary', label: 'Stipendio (RAL)' },
  { value: 'ft_percentage', label: 'FT%' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'category', label: 'Categoria' },
  { value: 'capacity_percentage', label: 'Capacity %' },
  { value: 'chargeable_days', label: 'Giorni fatturabili' },
  { value: 'cost_center_allocations' as MemberEventField, label: 'Allocazione Centri di Costo' },
];

const SENIORITY_OPTIONS = [
  { value: 'senior', label: 'Senior' },
  { value: 'middle_up', label: 'Middle Up' },
  { value: 'middle', label: 'Middle' },
  { value: 'junior', label: 'Junior' },
  { value: 'stage', label: 'Stage' },
];

const CATEGORY_OPTIONS = [
  { value: 'dipendente', label: 'Dipendente' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'segnalatore', label: 'Segnalatore' },
];

export function HREventDialog({
  open,
  onOpenChange,
  members,
  onSave,
  editingEvent,
  costCenters,
  editingEventAllocations,
}: HREventDialogProps) {
  const [memberId, setMemberId] = useState('');
  const [field, setField] = useState<MemberEventField>('salary');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cdcAllocations, setCdcAllocations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (editingEvent) {
      setMemberId(editingEvent.member_id);
      setField(editingEvent.field);
      setValue(editingEvent.value);
      setStartDate(editingEvent.start_date);
      setEndDate(editingEvent.end_date || '');
      setNote(editingEvent.note || '');
      if (editingEvent.field === 'cost_center_allocations' && editingEventAllocations) {
        const allocMap: Record<string, number> = {};
        for (const a of editingEventAllocations) {
          allocMap[a.cost_center_id] = a.percentage;
        }
        setCdcAllocations(allocMap);
      } else {
        setCdcAllocations({});
      }
    } else {
      setMemberId('');
      setField('salary');
      setValue('');
      setStartDate('');
      setEndDate('');
      setNote('');
      setCdcAllocations({});
    }
    setError(null);
  }, [editingEvent, editingEventAllocations, open]);

  const handleSave = async () => {
    setError(null);
    if (!memberId) {
      setError('Select a team member');
      return;
    }
    if (field !== 'cost_center_allocations' && !value.trim()) {
      setError('Value is required');
      return;
    }
    if (field === 'cost_center_allocations') {
      const total = Object.values(cdcAllocations).reduce((s, v) => s + v, 0);
      if (total === 0) {
        setError('At least one cost center must have an allocation');
        return;
      }
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }

    setSaving(true);
    try {
      const allocsArray = field === 'cost_center_allocations'
        ? Object.entries(cdcAllocations).map(([ccId, pct]) => ({ cost_center_id: ccId, percentage: pct }))
        : undefined;

      await onSave(
        {
          member_id: memberId,
          field,
          value: field === 'cost_center_allocations' ? '' : value.trim(),
          start_date: startDate,
          end_date: endDate || null,
          note: note.trim() || null,
        },
        allocsArray
      );
      onOpenChange(false);
    } catch {
      // Error handled by hook toast
    } finally {
      setSaving(false);
    }
  };

  const renderValueInput = () => {
    if (field === 'cost_center_allocations') {
      const centers = costCenters ?? [];
      if (centers.length === 0) {
        return <p className="text-sm text-muted-foreground">No cost centers configured. Add cost centers first.</p>;
      }
      const total = Object.values(cdcAllocations).reduce((s, v) => s + v, 0);
      return (
        <div className="space-y-2">
          {centers.map((cc) => (
            <div key={cc.id} className="flex items-center gap-3">
              <span className="text-sm min-w-[120px]">{cc.code} - {cc.name}</span>
              <Input
                type="number"
                className="w-[100px]"
                value={cdcAllocations[cc.id] ?? 0}
                onChange={(e) => setCdcAllocations((prev) => ({
                  ...prev,
                  [cc.id]: parseFloat(e.target.value) || 0,
                }))}
                min={0}
                max={100}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          ))}
          <div className={cn(
            'text-sm font-medium pt-1 border-t',
            Math.abs(total - 100) > 0.01 ? 'text-yellow-500' : 'text-muted-foreground'
          )}>
            Total: {total.toFixed(0)}%
            {Math.abs(total - 100) > 0.01 && ' (expected 100%)'}
          </div>
        </div>
      );
    }
    if (field === 'seniority') {
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select seniority" />
          </SelectTrigger>
          <SelectContent>
            {SENIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (field === 'category') {
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={field === 'salary' ? 'e.g. 45000' : 'e.g. 100'}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Edit Planned Change' : 'New Planned Change'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label>Team Member</Label>
            <Select value={memberId} onValueChange={setMemberId} disabled={!!editingEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Variable</Label>
            <Select value={field} onValueChange={(v) => { setField(v as MemberEventField); setValue(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>New Value</Label>
            {renderValueInput()}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End Date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Maternita, Promozione" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editingEvent ? 'Update' : 'Add Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
