'use client';

import { useState, useEffect, useRef } from 'react';
import { CostCenter, CostCenterInput } from '@/lib/optimizer/types';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui';

interface CostCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenter | null;
  onSave: (input: CostCenterInput) => Promise<void>;
  mode: 'create' | 'edit';
}

export function CostCenterDialog({
  open,
  onOpenChange,
  costCenter,
  onSave,
  mode,
}: CostCenterDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const prevOpen = useRef(open);

  useEffect(() => {
    if (open && !prevOpen.current) {
      if (mode === 'edit' && costCenter) {
        setCode(costCenter.code);
        setName(costCenter.name);
      } else {
        setCode('');
        setName('');
      }
      setError(null);
    }
    prevOpen.current = open;
  }, [open, mode, costCenter]);

  const handleSave = async () => {
    setError(null);

    if (!code.trim()) {
      setError('Code is required');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    try {
      await onSave({ code: code.trim().toUpperCase(), name: name.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Cost Center' : 'Edit Cost Center'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              value={code}
              placeholder="e.g., BE"
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              placeholder="e.g., Business Expander"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? mode === 'create' ? 'Adding...' : 'Saving...'
              : mode === 'create' ? 'Add Cost Center' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
