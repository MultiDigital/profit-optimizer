'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Scenario,
  Member,
  Service,
  CostCenter,
  MemberCostCenterAllocation,
  SENIORITY_LABELS,
} from '@/lib/optimizer/types';
import {
  Button,
  Input,
  Label,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: Scenario | null;
  allMembers: Member[];
  allServices: Service[];
  costCenters?: CostCenter[];
  allocations?: MemberCostCenterAllocation[];
  initialMemberIds?: string[];
  initialServiceIds?: string[];
  onSave: (name: string, memberIds: string[], serviceIds: string[], costCenterId?: string | null) => Promise<void>;
  mode: 'create' | 'edit';
}

export function ScenarioDialog({
  open,
  onOpenChange,
  scenario,
  allMembers,
  allServices,
  costCenters = [],
  allocations = [],
  initialMemberIds = [],
  initialServiceIds = [],
  onSave,
  mode,
}: ScenarioDialogProps) {
  const [name, setName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Track previous open state to detect when dialog opens
  const prevOpen = useRef(open);

  // When a cost center is selected in create mode, pre-select members with allocation > 0
  const costCenterSelected = mode === 'create' && selectedCostCenterId;

  // Pre-select members when cost center changes
  useEffect(() => {
    if (mode !== 'create') return;
    if (selectedCostCenterId) {
      const memberIds = allocations
        .filter((a) => a.cost_center_id === selectedCostCenterId && a.percentage > 0)
        .map((a) => a.member_id);
      setSelectedMemberIds(memberIds);
    } else {
      setSelectedMemberIds([]);
    }
  }, [selectedCostCenterId, mode, allocations]);

  // In edit mode, only show items NOT already in the scenario
  const availableMembers = mode === 'edit'
    ? allMembers.filter(m => !initialMemberIds.includes(m.id))
    : allMembers;

  const availableServices = mode === 'edit'
    ? allServices.filter(s => !initialServiceIds.includes(s.id))
    : allServices;

  // Initialize form when dialog opens (transitions from closed to open)
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (mode === 'edit' && scenario) {
        setName(scenario.name);
        // In edit mode, start with empty selection (user picks items to add)
        setSelectedMemberIds([]);
        setSelectedServiceIds([]);
        setSelectedCostCenterId(null);
      } else {
        setName('');
        setSelectedMemberIds([]);
        setSelectedServiceIds([]);
        setSelectedCostCenterId(null);
      }
      setError(null);
    }
    prevOpen.current = open;
  }, [open, mode, scenario?.id, scenario?.name, initialMemberIds, initialServiceIds]);

  const handleMemberToggle = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Scenario name is required');
      return;
    }

    // In create mode, require at least one member and service
    if (mode === 'create') {
      if (selectedMemberIds.length === 0) {
        setError('Please select at least one team member');
        return;
      }

      if (selectedServiceIds.length === 0) {
        setError('Please select at least one service');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(name.trim(), selectedMemberIds, selectedServiceIds, selectedCostCenterId);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Scenario' : 'Edit Scenario'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Scenario Name</Label>
            <Input
              value={name}
              placeholder="e.g., Q1 2025 Plan"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Cost Center Selection (create mode only) */}
          {mode === 'create' && costCenters.length > 0 && (
            <div className="space-y-2">
              <Label>Cost Center (optional)</Label>
              <Select
                value={selectedCostCenterId ?? '_none'}
                onValueChange={(value) => setSelectedCostCenterId(value === '_none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No cost center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No cost center</SelectItem>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {costCenterSelected && (
                <p className="text-xs text-muted-foreground">
                  Members with allocation &gt; 0 for this cost center will be auto-selected.
                  Their capacity % and cost % will match their allocation.
                </p>
              )}
            </div>
          )}

          {/* Team Members Selection */}
          <div className="space-y-2">
            <Label>
              {mode === 'edit'
                ? `Add Team Members${selectedMemberIds.length > 0 ? ` (${selectedMemberIds.length} selected)` : ''}`
                : `Team Members (${selectedMemberIds.length} selected)`}
            </Label>
            {allMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                No team members available. Add members on the Workforce page first.
              </div>
            ) : availableMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                All team members are already in this scenario.
              </div>
            ) : (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {availableMembers.map((member) => {
                  const alloc = costCenterSelected
                    ? allocations.find(
                        (a) => a.cost_center_id === selectedCostCenterId && a.member_id === member.id && a.percentage > 0
                      )
                    : null;
                  return (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {SENIORITY_LABELS[member.seniority]} · {alloc ? `${alloc.percentage}% allocation` : `${formatCurrency(member.salary)}/yr`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Services Selection */}
          <div className="space-y-2">
            <Label>
              {mode === 'edit'
                ? `Add Services${selectedServiceIds.length > 0 ? ` (${selectedServiceIds.length} selected)` : ''}`
                : `Services (${selectedServiceIds.length} selected)`}
            </Label>
            {allServices.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                No services available. Add services on the Services page first.
              </div>
            ) : availableServices.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                All services are already in this scenario.
              </div>
            ) : (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {availableServices.map((service) => (
                  <label
                    key={service.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedServiceIds.includes(service.id)}
                      onCheckedChange={() => handleServiceToggle(service.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{service.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(service.price)} · {service.senior_days + service.middle_up_days + service.middle_days + service.junior_days} total days
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
              ? 'Create Scenario'
              : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
