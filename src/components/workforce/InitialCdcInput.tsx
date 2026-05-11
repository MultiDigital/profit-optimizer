'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CostCenter } from '@/lib/optimizer/types';

interface InitialCdcInputProps {
  costCenters: CostCenter[];
  value: Record<string, number>; // cost_center_id → percentage
  onChange: (next: Record<string, number>) => void;
}

/**
 * Compact CDC allocator used ONCE when creating a new member.
 * Shows one numeric input per cost center, and a live total.
 * The caller decides whether to enforce sum = 100 (we just display).
 */
export function InitialCdcInput({ costCenters, value, onChange }: InitialCdcInputProps) {
  const total = Object.values(value).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);

  if (costCenters.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        No cost centers defined yet. You can create them in the Cost Centers page and assign later.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Initial Cost Center Allocation</Label>
        <span
          className={
            Math.abs(total - 100) < 0.01
              ? 'text-xs text-green-500'
              : Math.abs(total) < 0.01
                ? 'text-xs text-muted-foreground'
                : 'text-xs text-orange-500'
          }
        >
          Total: {total}%
        </span>
      </div>
      <div className="grid grid-cols-[1fr_90px] gap-2">
        {costCenters.map((cc) => (
          <Row
            key={cc.id}
            label={`${cc.code} ${cc.name}`}
            value={value[cc.id] ?? 0}
            onChange={(n) => {
              const next = { ...value };
              if (n === 0) {
                delete next[cc.id];
              } else {
                next[cc.id] = n;
              }
              onChange(next);
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Set percentages totalling 100%. Leave all at 0 to skip — you can add allocations later via a planned change.
      </p>
    </div>
  );
}

function Row({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <>
      <div className="flex items-center text-sm">{label}</div>
      <Input
        type="number"
        min={0}
        max={100}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') {
            onChange(0);
            return;
          }
          const n = parseFloat(raw);
          if (Number.isFinite(n) && n >= 0 && n <= 100) {
            onChange(n);
          }
        }}
      />
    </>
  );
}
