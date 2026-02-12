'use client';

import { useEffect, useState, useMemo } from 'react';
import { useScenarios, useSettings, useOptimizer } from '@/hooks';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui';
import { ScenarioWithData } from '@/lib/optimizer/types';
import { Loader2 } from 'lucide-react';

export default function ComparePage() {
  const { scenarios, loading: scenariosLoading, fetchScenarioWithData } = useScenarios();
  const { settings } = useSettings();

  const [scenarioAId, setScenarioAId] = useState<string>('');
  const [scenarioBId, setScenarioBId] = useState<string>('');
  const [scenarioAData, setScenarioAData] = useState<ScenarioWithData | null>(null);
  const [scenarioBData, setScenarioBData] = useState<ScenarioWithData | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  // Fetch scenario A data when selected
  useEffect(() => {
    if (!scenarioAId) {
      setScenarioAData(null);
      return;
    }
    let cancelled = false;
    setLoadingA(true);
    fetchScenarioWithData(scenarioAId).then((data) => {
      if (!cancelled) {
        setScenarioAData(data);
        setLoadingA(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingA(false);
    });
    return () => { cancelled = true; };
  }, [scenarioAId, fetchScenarioWithData]);

  // Fetch scenario B data when selected
  useEffect(() => {
    if (!scenarioBId) {
      setScenarioBData(null);
      return;
    }
    let cancelled = false;
    setLoadingB(true);
    fetchScenarioWithData(scenarioBId).then((data) => {
      if (!cancelled) {
        setScenarioBData(data);
        setLoadingB(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingB(false);
    });
    return () => { cancelled = true; };
  }, [scenarioBId, fetchScenarioWithData]);

  // Prepare optimizer inputs (memoized to prevent recalc loops)
  const membersA = useMemo(() =>
    scenarioAData?.members.map((m) => ({ ...m, user_id: '' })) ?? []
  , [scenarioAData?.members]);

  const servicesA = useMemo(() =>
    scenarioAData?.services.map((s) => ({ ...s, user_id: '' })) ?? []
  , [scenarioAData?.services]);

  const membersB = useMemo(() =>
    scenarioBData?.members.map((m) => ({ ...m, user_id: '' })) ?? []
  , [scenarioBData?.members]);

  const servicesB = useMemo(() =>
    scenarioBData?.services.map((s) => ({ ...s, user_id: '' })) ?? []
  , [scenarioBData?.services]);

  // Two optimizer calls (always called per Rules of Hooks)
  const { result: resultA, isCalculating: calcA } = useOptimizer(membersA, servicesA, settings);
  const { result: resultB, isCalculating: calcB } = useOptimizer(membersB, servicesB, settings);

  const scenarioAName = scenarios.find((s) => s.id === scenarioAId)?.name ?? 'Scenario A';
  const scenarioBName = scenarios.find((s) => s.id === scenarioBId)?.name ?? 'Scenario B';

  const isLoading = loadingA || loadingB || calcA || calcB;
  const bothSelected = !!scenarioAId && !!scenarioBId;
  const bothReady = bothSelected && resultA && resultB && !isLoading;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Compare Scenarios</h1>

        <Card>
          <CardHeader>
            <CardTitle>Select Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            {scenariosLoading ? (
              <div className="flex gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            ) : scenarios.length < 2 ? (
              <p className="text-muted-foreground text-sm">
                You need at least 2 scenarios to compare. Create scenarios from the Dashboard.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scenario A</Label>
                  <Select value={scenarioAId} onValueChange={setScenarioAId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarios.map((s) => (
                        <SelectItem key={s.id} value={s.id} disabled={s.id === scenarioBId}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scenario B</Label>
                  <Select value={scenarioBId} onValueChange={setScenarioBId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarios.map((s) => (
                        <SelectItem key={s.id} value={s.id} disabled={s.id === scenarioAId}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {bothSelected && isLoading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Calculating results...</span>
            </CardContent>
          </Card>
        )}

        {bothReady && (
          <Card>
            <CardHeader>
              <CardTitle>Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonTable
                resultA={resultA}
                resultB={resultB}
                nameA={scenarioAName}
                nameB={scenarioBName}
                membersA={scenarioAData?.members ?? []}
                membersB={scenarioBData?.members ?? []}
              />
            </CardContent>
          </Card>
        )}

        {!bothSelected && !scenariosLoading && scenarios.length >= 2 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select two scenarios above to see a side-by-side comparison.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
