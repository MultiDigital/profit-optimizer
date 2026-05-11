'use client';

import { Input } from '@/components/ui/input';
import {
  useViewContext,
  AS_OF_DATE_MIN,
  AS_OF_DATE_MAX,
} from '@/contexts/ViewContext';

export function DatePicker() {
  const { asOfDate, setAsOfDate } = useViewContext();

  return (
    <Input
      type="date"
      value={asOfDate}
      min={AS_OF_DATE_MIN}
      max={AS_OF_DATE_MAX}
      onChange={(e) => {
        if (e.target.value) setAsOfDate(e.target.value);
      }}
      className="h-8 w-[150px]"
      aria-label="As-of date"
    />
  );
}
