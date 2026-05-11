'use client';

import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCostCenters, useSettings } from '@/hooks';
import { AllocationMatrix, CostCenterDialog } from '@/components/cost-centers';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { resolveWorkforceAtDate } from '@/lib/hr/resolve';
import type { ResolvedMember } from '@/lib/hr/types';
import { DeltaCell } from '@/components/analytics/DeltaCell';
import {
  CostCenter,
  DEFAULT_SETTINGS,
  Member,
  SENIORITY_LEVELS,
  SENIORITY_LABELS,
  MEMBER_CATEGORY_LABELS,
  SeniorityLevel,
  computeEffectiveDays,
} from '@/lib/optimizer/types';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';

function formatFte(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// --- Cost summary types & computation ---

interface CostRow {
  label: string;
  fte: number;
  totalCost: number;
}

interface CostCenterSummary {
  costCenter: CostCenter;
  rows: CostRow[];
  totalFte: number;
  totalCost: number;
}

function computeCostSummary(
  resolvedMembers: ResolvedMember[],
  costCenters: CostCenter[],
  effectiveDays: number,
  yearlyWorkableDays: number,
): CostCenterSummary[] {
  const groups: CostCenterSummary[] = [];

  for (const cc of costCenters) {
    const rowMap = new Map<string, CostRow>();

    for (const m of resolvedMembers) {
      if (!m.isActive) continue;
      const alloc = m.costCenterAllocations.find((a) => a.cost_center_id === cc.id);
      if (!alloc || alloc.percentage === 0) continue;
      const allocFraction = alloc.percentage / 100;

      let label: string;
      let memberFte: number;

      if (m.category === 'segnalatore') {
        label = MEMBER_CATEGORY_LABELS.segnalatore;
        memberFte = 1;
      } else {
        const seniority = m.seniority as SeniorityLevel;
        label = SENIORITY_LABELS[seniority];
        if (m.category === 'freelance') {
          memberFte = m.chargeable_days != null
            ? m.chargeable_days / effectiveDays
            : yearlyWorkableDays / effectiveDays;
        } else {
          memberFte = (m.ft_percentage ?? 100) / 100;
        }
      }

      const existing = rowMap.get(label) ?? { label, fte: 0, totalCost: 0 };
      existing.fte += memberFte * allocFraction;
      existing.totalCost += m.salary * allocFraction;
      rowMap.set(label, existing);
    }

    const seniorityOrder = SENIORITY_LEVELS.map((s) => SENIORITY_LABELS[s]);
    const rows = Array.from(rowMap.values()).sort((a, b) => {
      const ai = seniorityOrder.indexOf(a.label);
      const bi = seniorityOrder.indexOf(b.label);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    if (rows.length > 0) {
      groups.push({
        costCenter: cc,
        rows,
        totalFte: rows.reduce((s, r) => s + r.fte, 0),
        totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
      });
    }
  }

  return groups;
}

// --- Page component ---

export default function CostCentersPage() {
  const { asOfDate, compareDate } = useViewContext();
  const { bundle, loading: scenarioLoading } = useResolvedScenario();
  const { settings } = useSettings();
  const {
    costCenters,
    loading: ccLoading,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
  } = useCostCenters();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCc, setEditingCc] = useState<CostCenter | null>(null);
  const [deletingCc, setDeletingCc] = useState<CostCenter | null>(null);

  const loading = scenarioLoading || ccLoading;

  const s = settings ?? DEFAULT_SETTINGS;
  const effectiveDays = computeEffectiveDays(
    s.yearly_workable_days,
    s.festivita_nazionali,
    s.ferie,
    s.malattia,
    s.formazione,
  );

  // Resolve workforce at the selected as-of date.
  const resolved = useMemo(() => {
    const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
    return resolveWorkforceAtDate(
      allMembers,
      bundle.baseAllocations,
      bundle.canonicalEvents,
      bundle.scenarioEvents,
      bundle.eventAllocations,
      asOfDate,
    );
  }, [bundle, asOfDate]);

  // When compare mode is on, resolve a second snapshot at the compare date.
  const resolvedCompare = useMemo(() => {
    if (!compareDate) return null;
    const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
    return resolveWorkforceAtDate(
      allMembers,
      bundle.baseAllocations,
      bundle.canonicalEvents,
      bundle.scenarioEvents,
      bundle.eventAllocations,
      compareDate,
    );
  }, [bundle, compareDate]);

  const resolvedByMember = useMemo(() => {
    const map = new Map<string, ResolvedMember>();
    for (const m of resolved) map.set(m.id, m);
    return map;
  }, [resolved]);

  const resolveCellPercentage = (memberId: string, costCenterId: string): number => {
    const m = resolvedByMember.get(memberId);
    if (!m) return 0;
    const alloc = m.costCenterAllocations.find((a) => a.cost_center_id === costCenterId);
    return alloc?.percentage ?? 0;
  };

  const summaryGroups = useMemo(
    () => computeCostSummary(resolved, costCenters, effectiveDays, s.yearly_workable_days),
    [resolved, costCenters, effectiveDays, s.yearly_workable_days],
  );

  const summaryGroupsCompare = useMemo(
    () =>
      resolvedCompare
        ? computeCostSummary(resolvedCompare, costCenters, effectiveDays, s.yearly_workable_days)
        : null,
    [resolvedCompare, costCenters, effectiveDays, s.yearly_workable_days],
  );

  const grandTotal = useMemo(
    () => ({
      fte: summaryGroups.reduce((s, g) => s + g.totalFte, 0),
      totalCost: summaryGroups.reduce((s, g) => s + g.totalCost, 0),
    }),
    [summaryGroups],
  );

  const grandTotalCompare = useMemo(() => {
    if (!summaryGroupsCompare) return null;
    return {
      fte: summaryGroupsCompare.reduce((s, g) => s + g.totalFte, 0),
      totalCost: summaryGroupsCompare.reduce((s, g) => s + g.totalCost, 0),
    };
  }, [summaryGroupsCompare]);

  // Merge primary + compare summaries by cost-center id, then by row label,
  // so the comparison table can render rows that exist only on one side.
  const mergedSummary = useMemo(() => {
    if (!summaryGroupsCompare) return null;
    const byId = new Map<string, { cc: CostCenter; primary?: CostCenterSummary; compare?: CostCenterSummary }>();
    for (const g of summaryGroups) {
      byId.set(g.costCenter.id, { cc: g.costCenter, primary: g });
    }
    for (const g of summaryGroupsCompare) {
      const entry = byId.get(g.costCenter.id);
      if (entry) entry.compare = g;
      else byId.set(g.costCenter.id, { cc: g.costCenter, compare: g });
    }
    return Array.from(byId.values());
  }, [summaryGroups, summaryGroupsCompare]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleCreate = async (input: { code: string; name: string }) => {
    await addCostCenter(input);
  };

  const handleEdit = async (input: { code: string; name: string }) => {
    if (!editingCc) return;
    await updateCostCenter(editingCc.id, input);
    setEditingCc(null);
  };

  const handleDelete = async () => {
    if (!deletingCc) return;
    await deleteCostCenter(deletingCc.id);
    setDeletingCc(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Cost Centers
                {bundle.source === 'scenario' && bundle.scenarioName && (
                  <Badge variant="outline" className="text-[10px]">
                    scenario: {bundle.scenarioName}
                  </Badge>
                )}
              </CardTitle>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Add Cost Center
              </Button>
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
              <Tabs defaultValue="allocations">
                <TabsList>
                  <TabsTrigger value="allocations">Allocazioni</TabsTrigger>
                  <TabsTrigger value="summary">Riepilogo Costi</TabsTrigger>
                </TabsList>

                <TabsContent value="allocations">
                  {costCenters.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {costCenters.map((cc) => (
                        <Badge
                          key={cc.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 text-sm py-1 px-3 gap-2"
                          onClick={() => setEditingCc(cc)}
                        >
                          <span className="font-bold">{cc.code}</span>
                          <span className="text-muted-foreground">{cc.name}</span>
                          <button
                            className="ml-1 text-muted-foreground hover:text-red-500 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCc(cc);
                            }}
                          >
                            &times;
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <AllocationMatrix
                    members={[...bundle.canonicalMembers, ...bundle.syntheticMembers] as Member[]}
                    costCenters={costCenters}
                    allocations={bundle.baseAllocations}
                    capacitySettings={{
                      yearly_workable_days: settings?.yearly_workable_days ?? DEFAULT_SETTINGS.yearly_workable_days,
                      festivita_nazionali: settings?.festivita_nazionali ?? DEFAULT_SETTINGS.festivita_nazionali,
                      ferie: settings?.ferie ?? DEFAULT_SETTINGS.ferie,
                      malattia: settings?.malattia ?? DEFAULT_SETTINGS.malattia,
                      formazione: settings?.formazione ?? DEFAULT_SETTINGS.formazione,
                    }}
                    readOnly
                    resolveCellPercentage={resolveCellPercentage}
                  />
                </TabsContent>

                <TabsContent value="summary">
                  {summaryGroups.length === 0 && !mergedSummary ? (
                    <p className="text-muted-foreground text-sm py-4">
                      No data to display. Make sure you have members assigned to cost centers.
                    </p>
                  ) : mergedSummary && grandTotalCompare ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]"></TableHead>
                          <TableHead className="text-right">FTE @ {asOfDate}</TableHead>
                          <TableHead className="text-right">FTE @ {compareDate}</TableHead>
                          <TableHead className="text-right">Δ FTE</TableHead>
                          <TableHead className="text-right">Costo @ {asOfDate}</TableHead>
                          <TableHead className="text-right">Costo @ {compareDate}</TableHead>
                          <TableHead className="text-right">Δ Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedSummary.map((entry) => (
                          <CostCenterCompareSection
                            key={entry.cc.id}
                            costCenter={entry.cc}
                            primary={entry.primary}
                            compare={entry.compare}
                            isCollapsed={collapsed[entry.cc.id] ?? false}
                            onToggle={() => toggle(entry.cc.id)}
                          />
                        ))}
                        <TableRow className="border-t-2 border-foreground/20 font-bold">
                          <TableCell>Totale</TableCell>
                          <TableCell className="text-right">{formatFte(grandTotal.fte)}</TableCell>
                          <TableCell className="text-right">{formatFte(grandTotalCompare.fte)}</TableCell>
                          <TableCell className="text-right">
                            <DeltaCell value={grandTotalCompare.fte - grandTotal.fte} format={formatFte} />
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(grandTotal.totalCost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(grandTotalCompare.totalCost)}</TableCell>
                          <TableCell className="text-right">
                            <DeltaCell
                              value={grandTotalCompare.totalCost - grandTotal.totalCost}
                              format={formatCurrency}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]"></TableHead>
                          <TableHead className="text-right">FTE</TableHead>
                          <TableHead className="text-right">Totale Costo Personale</TableHead>
                          <TableHead className="text-right">% Incidenza</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryGroups.map((g) => (
                          <CostCenterSummarySection
                            key={g.costCenter.id}
                            group={g}
                            isCollapsed={collapsed[g.costCenter.id] ?? false}
                            onToggle={() => toggle(g.costCenter.id)}
                            grandTotalCost={grandTotal.totalCost}
                          />
                        ))}
                        <TableRow className="border-t-2 border-foreground/20 font-bold">
                          <TableCell>Totale</TableCell>
                          <TableCell className="text-right">{formatFte(grandTotal.fte)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(grandTotal.totalCost)}</TableCell>
                          <TableCell className="text-right"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <CostCenterDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSave={handleCreate}
          mode="create"
        />

        {/* Edit Dialog */}
        <CostCenterDialog
          open={!!editingCc}
          onOpenChange={(open) => !open && setEditingCc(null)}
          costCenter={editingCc}
          onSave={handleEdit}
          mode="edit"
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingCc} onOpenChange={(open) => !open && setDeletingCc(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete cost center?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deletingCc?.code} - {deletingCc?.name}</strong>?
                All allocations for this cost center will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// --- Cost center summary collapsible section ---

function CostCenterSummarySection({
  group,
  isCollapsed,
  onToggle,
  grandTotalCost,
}: {
  group: CostCenterSummary;
  isCollapsed: boolean;
  onToggle: () => void;
  grandTotalCost: number;
}) {
  return (
    <>
      <TableRow
        className="bg-muted/50 cursor-pointer hover:bg-muted font-semibold"
        onClick={onToggle}
      >
        <TableCell>
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                !isCollapsed && 'rotate-90'
              )}
            />
            {group.costCenter.code}
          </span>
        </TableCell>
        <TableCell className="text-right">{formatFte(group.totalFte)}</TableCell>
        <TableCell className="text-right">{formatCurrency(group.totalCost)}</TableCell>
        <TableCell className="text-right">
          {grandTotalCost > 0
            ? `${((group.totalCost / grandTotalCost) * 100).toFixed(1)}%`
            : '-'}
        </TableCell>
      </TableRow>

      {!isCollapsed &&
        group.rows.map((row) => (
          <TableRow key={`${group.costCenter.id}-${row.label}`}>
            <TableCell className="pl-10 text-muted-foreground">{row.label}</TableCell>
            <TableCell className="text-right">{formatFte(row.fte)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.totalCost)}</TableCell>
            <TableCell className="text-right">
              {group.totalCost > 0
                ? `${((row.totalCost / group.totalCost) * 100).toFixed(1)}%`
                : '-'}
              </TableCell>
          </TableRow>
        ))}
    </>
  );
}

// --- Compare-mode section: same cost center at two dates with deltas ---

function CostCenterCompareSection({
  costCenter,
  primary,
  compare,
  isCollapsed,
  onToggle,
}: {
  costCenter: CostCenter;
  primary?: CostCenterSummary;
  compare?: CostCenterSummary;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const primaryFte = primary?.totalFte ?? 0;
  const compareFte = compare?.totalFte ?? 0;
  const primaryCost = primary?.totalCost ?? 0;
  const compareCost = compare?.totalCost ?? 0;

  // Union of row labels across both sides, preserving seniority order where possible.
  const rowLabels = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const push = (label: string) => {
      if (!seen.has(label)) {
        seen.add(label);
        ordered.push(label);
      }
    };
    primary?.rows.forEach((r) => push(r.label));
    compare?.rows.forEach((r) => push(r.label));
    const seniorityOrder = SENIORITY_LEVELS.map((s) => SENIORITY_LABELS[s]);
    return ordered.sort((a, b) => {
      const ai = seniorityOrder.indexOf(a);
      const bi = seniorityOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [primary, compare]);

  const getRow = (label: string, group?: CostCenterSummary): CostRow | undefined =>
    group?.rows.find((r) => r.label === label);

  return (
    <>
      <TableRow
        className="bg-muted/50 cursor-pointer hover:bg-muted font-semibold"
        onClick={onToggle}
      >
        <TableCell>
          <span className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                !isCollapsed && 'rotate-90'
              )}
            />
            {costCenter.code}
          </span>
        </TableCell>
        <TableCell className="text-right">{formatFte(primaryFte)}</TableCell>
        <TableCell className="text-right">{formatFte(compareFte)}</TableCell>
        <TableCell className="text-right">
          <DeltaCell value={compareFte - primaryFte} format={formatFte} />
        </TableCell>
        <TableCell className="text-right">{formatCurrency(primaryCost)}</TableCell>
        <TableCell className="text-right">{formatCurrency(compareCost)}</TableCell>
        <TableCell className="text-right">
          <DeltaCell value={compareCost - primaryCost} format={formatCurrency} />
        </TableCell>
      </TableRow>

      {!isCollapsed &&
        rowLabels.map((label) => {
          const p = getRow(label, primary);
          const c = getRow(label, compare);
          const pFte = p?.fte ?? 0;
          const cFte = c?.fte ?? 0;
          const pCost = p?.totalCost ?? 0;
          const cCost = c?.totalCost ?? 0;
          return (
            <TableRow key={`${costCenter.id}-${label}`}>
              <TableCell className="pl-10 text-muted-foreground">{label}</TableCell>
              <TableCell className="text-right">{formatFte(pFte)}</TableCell>
              <TableCell className="text-right">{formatFte(cFte)}</TableCell>
              <TableCell className="text-right">
                <DeltaCell value={cFte - pFte} format={formatFte} />
              </TableCell>
              <TableCell className="text-right">{formatCurrency(pCost)}</TableCell>
              <TableCell className="text-right">{formatCurrency(cCost)}</TableCell>
              <TableCell className="text-right">
                <DeltaCell value={cCost - pCost} format={formatCurrency} />
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}

