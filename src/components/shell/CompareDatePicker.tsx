'use client';

import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useViewContext,
  AS_OF_DATE_MIN,
  AS_OF_DATE_MAX,
} from '@/contexts/ViewContext';

export function CompareDatePicker() {
  const { compareDate, setCompareDate } = useViewContext();

  return (
    <div className="flex items-center gap-1">
      <Input
        type="date"
        value={compareDate ?? ''}
        min={AS_OF_DATE_MIN}
        max={AS_OF_DATE_MAX}
        onChange={(e) => setCompareDate(e.target.value || null)}
        className="h-8 w-[150px]"
        aria-label="Compare-with date"
      />
      {compareDate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCompareDate(null)}
          aria-label="Clear compare date"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
