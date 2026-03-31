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
import { Member, MemberEventField, MemberEventInput, HRScenarioMember } from '@/lib/optimizer/types';

type AnyMember = Member | HRScenarioMember;

interface HREventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: AnyMember[];
  onSave: (input: MemberEventInput) => Promise<void>;
  editingEvent?: {
    id: string;
    member_id: string;
    field: MemberEventField;
    value: string;
    start_date: string;
    end_date: string | null;
    note: string | null;
  } | null;
}

const FIELD_OPTIONS: { value: MemberEventField; label: string }[] = [
  { value: 'salary', label: 'Stipendio (RAL)' },
  { value: 'ft_percentage', label: 'FT%' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'category', label: 'Categoria' },
  { value: 'capacity_percentage', label: 'Capacity %' },
  { value: 'chargeable_days', label: 'Giorni fatturabili' },
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
}: HREventDialogProps) {
  const [memberId, setMemberId] = useState('');
  const [field, setField] = useState<MemberEventField>('salary');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingEvent) {
      setMemberId(editingEvent.member_id);
      setField(editingEvent.field);
      setValue(editingEvent.value);
      setStartDate(editingEvent.start_date);
      setEndDate(editingEvent.end_date || '');
      setNote(editingEvent.note || '');
    } else {
      setMemberId('');
      setField('salary');
      setValue('');
      setStartDate('');
      setEndDate('');
      setNote('');
    }
    setError(null);
  }, [editingEvent, open]);

  const handleSave = async () => {
    setError(null);
    if (!memberId) {
      setError('Select a team member');
      return;
    }
    if (!value.trim()) {
      setError('Value is required');
      return;
    }
    if (!startDate) {
      setError('Start date is required');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        member_id: memberId,
        field,
        value: value.trim(),
        start_date: startDate,
        end_date: endDate || null,
        note: note.trim() || null,
      });
      onOpenChange(false);
    } catch {
      // Error handled by hook toast
    } finally {
      setSaving(false);
    }
  };

  const renderValueInput = () => {
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
