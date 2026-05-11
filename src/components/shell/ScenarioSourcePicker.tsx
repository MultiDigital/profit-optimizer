'use client';

import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useViewContext } from '@/contexts/ViewContext';
import { useHRScenarios } from '@/hooks/useHRScenarios';

export function ScenarioSourcePicker() {
  const { scenarioId, setScenarioId } = useViewContext();
  const { hrScenarios, loading } = useHRScenarios();

  // Fallback: if the selected scenario was deleted while we were selecting
  // it, revert to baseline. Only runs once scenarios have loaded.
  useEffect(() => {
    if (loading) return;
    if (scenarioId === 'baseline') return;
    const exists = hrScenarios.some((s) => s.id === scenarioId);
    if (!exists) {
      setScenarioId('baseline');
    }
  }, [loading, scenarioId, hrScenarios, setScenarioId]);

  return (
    <Select value={scenarioId} onValueChange={setScenarioId}>
      <SelectTrigger className="h-8 w-[180px]" aria-label="Scenario source">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="baseline">Baseline</SelectItem>
        {hrScenarios.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
