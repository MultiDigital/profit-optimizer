'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCostCenters, useSettings } from '@/hooks';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { useHRPlanning } from '@/hooks/useHRPlanning';
import { useHRScenarios } from '@/hooks/useHRScenarios';
import { HRComparisonView } from '@/components/hr/HRComparisonView';
import { DeltaCell } from '@/components/analytics/DeltaCell';
import { resolveWorkforceAtDate } from '@/lib/hr/resolve';
import type { ResolvedMember } from '@/lib/hr/types';
import {
  CostCenter,
  MemberEvent,
  Settings,
  SeniorityLevel,
  SENIORITY_LEVELS,
  SENIORITY_LABELS,
  DEFAULT_SETTINGS,
  computeEffectiveDays,
} from '@/lib/optimizer/types';
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';

function formatFte(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// --- Computation types ---

interface SeniorityRow {
  seniority: SeniorityLevel;
  fte: number;
  productiveDays: number;
  productiveHours: number;
  hourlyCost: number;
  totalCost: number;
}

interface CostCenterGroup {
  costCenter: CostCenter;
  rows: SeniorityRow[];
  totalFte: number;
  totalProductiveDays: number;
  totalProductiveHours: number;
  totalCost: number;
}

interface TotalSummary {
  rows: SeniorityRow[];
  totalFte: number;
  totalProductiveDays: number;
  totalProductiveHours: number;
  totalCost: number;
}

// --- Shared helpers ---

function getEffectiveSettings(settings: Settings | null) {
  const s = settings ?? (DEFAULT_SETTINGS as unknown as Settings);
  const effectiveDays = computeEffectiveDays(
    s.yearly_workable_days,
    s.festivita_nazionali,
    s.ferie,
    s.malattia,
    s.formazione
  );
  return { s, effectiveDays };
}

function getMemberFte(
  m: ResolvedMember,
  effectiveDays: number,
  yearlyWorkableDays: number
): number {
  if (m.category === 'freelance') {
    return m.chargeable_days != null
      ? m.chargeable_days / effectiveDays
      : yearlyWorkableDays / effectiveDays;
  }
  return m.ft_percentage / 100;
}

function getMemberProductiveDays(
  m: ResolvedMember,
  effectiveDays: number,
  yearlyWorkableDays: number
): number {
  if (m.category === 'freelance') {
    return m.chargeable_days ?? yearlyWorkableDays;
  }
  return effectiveDays * (m.ft_percentage / 100);
}

// --- Compute total workforce (no cost center proration) ---

function computeTotalWorkforce(
  resolvedMembers: ResolvedMember[],
  settings: Settings | null
): TotalSummary {
  const { s, effectiveDays } = getEffectiveSettings(settings);
  const eligible = resolvedMembers.filter(
    (m) => m.isActive && m.category !== 'segnalatore'
  );

  const rows: SeniorityRow[] = [];

  for (const seniority of SENIORITY_LEVELS) {
    let fte = 0;
    let productiveDays = 0;
    let totalCost = 0;

    for (const m of eligible) {
      if (m.seniority !== seniority) continue;
      fte += getMemberFte(m, effectiveDays, s.yearly_workable_days);
      productiveDays += getMemberProductiveDays(m, effectiveDays, s.yearly_workable_days);
      totalCost += m.salary;
    }

    if (fte > 0) {
      const productiveHours = productiveDays * 8;
      rows.push({
        seniority,
        fte,
        productiveDays,
        productiveHours,
        hourlyCost: productiveHours > 0 ? totalCost / productiveHours : 0,
        totalCost,
      });
    }
  }

  return {
    rows,
    totalFte: rows.reduce((s, r) => s + r.fte, 0),
    totalProductiveDays: rows.reduce((s, r) => s + r.productiveDays, 0),
    totalProductiveHours: rows.reduce((s, r) => s + r.productiveHours, 0),
    totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
  };
}

// --- Compute by cost center ---

function computeByCostCenter(
  resolvedMembers: ResolvedMember[],
  costCenters: CostCenter[],
  settings: Settings | null
): CostCenterGroup[] {
  const { s, effectiveDays } = getEffectiveSettings(settings);
  const eligible = resolvedMembers.filter(
    (m) => m.isActive && m.category !== 'segnalatore'
  );

  const groups: CostCenterGroup[] = [];

  for (const cc of costCenters) {
    const rows: SeniorityRow[] = [];

    for (const seniority of SENIORITY_LEVELS) {
      let fte = 0;
      let productiveDays = 0;
      let totalCost = 0;

      for (const m of eligible) {
        if (m.seniority !== seniority) continue;
        const alloc = m.costCenterAllocations.find(
          (a) => a.cost_center_id === cc.id
        );
        const allocPct = alloc?.percentage ?? 0;
        if (allocPct === 0) continue;

        const allocFraction = allocPct / 100;
        fte += getMemberFte(m, effectiveDays, s.yearly_workable_days) * allocFraction;
        productiveDays +=
          getMemberProductiveDays(m, effectiveDays, s.yearly_workable_days) * allocFraction;
        totalCost += m.salary * allocFraction;
      }

      if (fte > 0) {
        const productiveHours = productiveDays * 8;
        rows.push({
          seniority,
          fte,
          productiveDays,
          productiveHours,
          hourlyCost: productiveHours > 0 ? totalCost / productiveHours : 0,
          totalCost,
        });
      }
    }

    if (rows.length > 0) {
      groups.push({
        costCenter: cc,
        rows,
        totalFte: rows.reduce((s, r) => s + r.fte, 0),
        totalProductiveDays: rows.reduce((s, r) => s + r.productiveDays, 0),
        totalProductiveHours: rows.reduce((s, r) => s + r.productiveHours, 0),
        totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
      });
    }
  }

  return groups;
}

// --- Shared table header ---

function AnalyticsTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[200px]"></TableHead>
        <TableHead className="text-right">FTE</TableHead>
        <TableHead className="text-right">Giorni produttivi</TableHead>
        <TableHead className="text-right">Ore produttive</TableHead>
        <TableHead className="text-right">Costo orario</TableHead>
        <TableHead className="text-right">Totale Costo Personale</TableHead>
        <TableHead className="text-right">% Incidenza</TableHead>
      </TableRow>
    </TableHeader>
  );
}

// --- Totals row ---

function TotalsRow({
  label,
  fte,
  productiveDays,
  productiveHours,
  totalCost,
  className,
}: {
  label: string;
  fte: number;
  productiveDays: number;
  productiveHours: number;
  totalCost: number;
  className?: string;
}) {
  return (
    <TableRow className={cn('font-bold', className)}>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right">{formatFte(fte)}</TableCell>
      <TableCell className="text-right">
        {formatNumber(Math.round(productiveDays))}
      </TableCell>
      <TableCell className="text-right">
        {formatNumber(Math.round(productiveHours))}
      </TableCell>
      <TableCell className="text-right">
        {productiveHours > 0
          ? formatNumber(Math.round(totalCost / productiveHours))
          : '-'}
      </TableCell>
      <TableCell className="text-right">{formatCurrency(totalCost)}</TableCell>
      <TableCell className="text-right"></TableCell>
    </TableRow>
  );
}

// --- Page component ---

export default function WorkforceAnalyticsPage() {
  const { asOfDate, compareDate } = useViewContext();
  const { bundle, loading: scenarioLoading } = useResolvedScenario();
  const { settings, loading: settingsLoading } = useSettings();
  const { costCenters, loading: ccLoading } = useCostCenters();

  const loading = scenarioLoading || settingsLoading || ccLoading;

  // Resolve workforce at the selected as-of date.
  const resolved = useMemo(() => {
    const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
    return resolveWorkforceAtDate(
      allMembers,
      bundle.baseAllocations,
      bundle.canonicalEvents,
      bundle.scenarioEvents,
      bundle.eventAllocations,
      asOfDate
    );
  }, [bundle, asOfDate]);

  // Second snapshot at the compare date, only when compare mode is on.
  const resolvedCompare = useMemo(() => {
    if (!compareDate) return null;
    const allMembers = [...bundle.canonicalMembers, ...bundle.syntheticMembers];
    return resolveWorkforceAtDate(
      allMembers,
      bundle.baseAllocations,
      bundle.canonicalEvents,
      bundle.scenarioEvents,
      bundle.eventAllocations,
      compareDate
    );
  }, [bundle, compareDate]);

  const totalWorkforce = useMemo(
    () => computeTotalWorkforce(resolved, settings),
    [resolved, settings]
  );

  const totalWorkforceCompare = useMemo(
    () => (resolvedCompare ? computeTotalWorkforce(resolvedCompare, settings) : null),
    [resolvedCompare, settings]
  );

  const groups = useMemo(
    () => computeByCostCenter(resolved, costCenters, settings),
    [resolved, costCenters, settings]
  );

  const groupsCompare = useMemo(
    () =>
      resolvedCompare ? computeByCostCenter(resolvedCompare, costCenters, settings) : null,
    [resolvedCompare, costCenters, settings]
  );

  const ccTotals = useMemo(
    () => ({
      fte: groups.reduce((s, g) => s + g.totalFte, 0),
      productiveDays: groups.reduce((s, g) => s + g.totalProductiveDays, 0),
      productiveHours: groups.reduce((s, g) => s + g.totalProductiveHours, 0),
      totalCost: groups.reduce((s, g) => s + g.totalCost, 0),
    }),
    [groups]
  );

  const ccTotalsCompare = useMemo(() => {
    if (!groupsCompare) return null;
    return {
      fte: groupsCompare.reduce((s, g) => s + g.totalFte, 0),
      productiveDays: groupsCompare.reduce((s, g) => s + g.totalProductiveDays, 0),
      productiveHours: groupsCompare.reduce((s, g) => s + g.totalProductiveHours, 0),
      totalCost: groupsCompare.reduce((s, g) => s + g.totalCost, 0),
    };
  }, [groupsCompare]);

  // Merge primary + compare CC groups by cost-center id so the compare table
  // can render rows that exist only on one side (e.g., a CC with no
  // allocations at one date).
  const mergedGroups = useMemo(() => {
    if (!groupsCompare) return null;
    const byId = new Map<
      string,
      { cc: CostCenter; primary?: CostCenterGroup; compare?: CostCenterGroup }
    >();
    for (const g of groups) byId.set(g.costCenter.id, { cc: g.costCenter, primary: g });
    for (const g of groupsCompare) {
      const entry = byId.get(g.costCenter.id);
      if (entry) entry.compare = g;
      else byId.set(g.costCenter.id, { cc: g.costCenter, compare: g });
    }
    return Array.from(byId.values());
  }, [groups, groupsCompare]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  // Compare Scenarios tab still renders a 12-month comparison; derive the
  // calendar year from the as-of date to feed the year-based HR planning hook.
  const comparisonYear = parseInt(asOfDate.slice(0, 4), 10);

  // Compare scenarios tab (Task 7)
  const [sideAId, setSideAId] = useState<string>('baseline');
  const [sideBId, setSideBId] = useState<string>('baseline');

  const { hrScenarios } = useHRScenarios();
  const { bundle: sideABundle } = useResolvedScenario(sideAId);
  const { bundle: sideBBundle } = useResolvedScenario(sideBId);

  const sideAMembers = [...sideABundle.canonicalMembers, ...sideABundle.syntheticMembers];
  const sideAEvents = [...sideABundle.canonicalEvents, ...sideABundle.scenarioEvents] as MemberEvent[];
  const { yearlyView: yearlyViewA } = useHRPlanning(
    sideAMembers,
    sideAEvents,
    settings,
    sideABundle.baseAllocations,
    sideABundle.eventAllocations,
    comparisonYear,
  );
  const sideBMembers = [...sideBBundle.canonicalMembers, ...sideBBundle.syntheticMembers];
  const sideBEvents = [...sideBBundle.canonicalEvents, ...sideBBundle.scenarioEvents] as MemberEvent[];
  const { yearlyView: yearlyViewB } = useHRPlanning(
    sideBMembers,
    sideBEvents,
    settings,
    sideBBundle.baseAllocations,
    sideBBundle.eventAllocations,
    comparisonYear,
  );

  const sideALabel = sideAId === 'baseline' ? 'Baseline' : (hrScenarios.find((s) => s.id === sideAId)?.name ?? 'Scenario');
  const sideBLabel = sideBId === 'baseline' ? 'Baseline' : (hrScenarios.find((s) => s.id === sideBId)?.name ?? 'Scenario');

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Workforce Analytics
              {bundle.source === 'scenario' && bundle.scenarioName && (
                <Badge variant="outline" className="text-[10px]">
                  scenario: {bundle.scenarioName}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Tabs defaultValue="breakdown">
                <TabsList>
                  <TabsTrigger value="breakdown">Per CDC</TabsTrigger>
                  <TabsTrigger value="compare">Compare scenarios</TabsTrigger>
                </TabsList>

                <TabsContent value="breakdown">
                  <Tabs defaultValue="total">
                    <TabsList>
                      <TabsTrigger value="total">Totale</TabsTrigger>
                      <TabsTrigger value="cost-centers">Per Centro di Costo</TabsTrigger>
                    </TabsList>

                    {/* Total workforce tab */}
                    <TabsContent value="total">
                      {totalWorkforceCompare ? (
                        <TotalWorkforceCompareTable
                          primary={totalWorkforce}
                          compare={totalWorkforceCompare}
                          asOfDate={asOfDate}
                          compareDate={compareDate!}
                        />
                      ) : totalWorkforce.rows.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-4">
                          No members to display.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]"></TableHead>
                              <TableHead className="text-right">FTE</TableHead>
                              <TableHead className="text-right">Giorni produttivi</TableHead>
                              <TableHead className="text-right">Ore produttive</TableHead>
                              <TableHead className="text-right">Costo orario</TableHead>
                              <TableHead className="text-right">Totale Costo Personale</TableHead>
                              <TableHead className="text-right">% Incidenza</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {totalWorkforce.rows.map((row) => (
                              <TableRow key={row.seniority}>
                                <TableCell className="text-muted-foreground">
                                  {SENIORITY_LABELS[row.seniority]}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatFte(row.fte)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(Math.round(row.productiveDays))}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(Math.round(row.productiveHours))}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(Math.round(row.hourlyCost))}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.totalCost)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {totalWorkforce.totalCost > 0
                                    ? `${((row.totalCost / totalWorkforce.totalCost) * 100).toFixed(1)}%`
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="border-t-2 border-foreground/20 font-bold">
                              <TableCell>Totale</TableCell>
                              <TableCell className="text-right">{formatFte(totalWorkforce.totalFte)}</TableCell>
                              <TableCell className="text-right">{formatNumber(Math.round(totalWorkforce.totalProductiveDays))}</TableCell>
                              <TableCell className="text-right">{formatNumber(Math.round(totalWorkforce.totalProductiveHours))}</TableCell>
                              <TableCell className="text-right">
                                {totalWorkforce.totalProductiveHours > 0
                                  ? formatNumber(Math.round(totalWorkforce.totalCost / totalWorkforce.totalProductiveHours))
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(totalWorkforce.totalCost)}</TableCell>
                              <TableCell className="text-right">100%</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>

                    {/* By cost center tab */}
                    <TabsContent value="cost-centers">
                      {mergedGroups && ccTotalsCompare ? (
                        <CostCenterCompareTable
                          entries={mergedGroups}
                          ccTotals={ccTotals}
                          ccTotalsCompare={ccTotalsCompare}
                          asOfDate={asOfDate}
                          compareDate={compareDate!}
                          collapsed={collapsed}
                          onToggle={toggle}
                        />
                      ) : groups.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-4">
                          No data to display. Make sure you have members assigned to
                          cost centers.
                        </p>
                      ) : (
                        <Table>
                          <AnalyticsTableHeader />
                          <TableBody>
                            {groups.map((g) => (
                              <CostCenterSection
                                key={g.costCenter.id}
                                group={g}
                                isCollapsed={collapsed[g.costCenter.id] ?? false}
                                onToggle={() => toggle(g.costCenter.id)}
                                grandTotalCost={ccTotals.totalCost}
                              />
                            ))}
                            <TotalsRow
                              label="Totale"
                              className="border-t-2 border-foreground/20"
                              fte={ccTotals.fte}
                              productiveDays={ccTotals.productiveDays}
                              productiveHours={ccTotals.productiveHours}
                              totalCost={ccTotals.totalCost}
                            />
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="compare" className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Side A:</span>
                      <Select value={sideAId} onValueChange={setSideAId}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baseline">Baseline</SelectItem>
                          {hrScenarios.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Side B:</span>
                      <Select value={sideBId} onValueChange={setSideBId}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baseline">Baseline</SelectItem>
                          {hrScenarios.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {yearlyViewA && yearlyViewB && (
                    <HRComparisonView
                      baseView={yearlyViewA}
                      compareView={yearlyViewB}
                      baseLabel={sideALabel}
                      compareLabel={sideBLabel}
                    />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Cost center collapsible section ---

function CostCenterSection({
  group,
  isCollapsed,
  onToggle,
  grandTotalCost,
}: {
  group: CostCenterGroup;
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
        <TableCell className="text-right">
          {formatFte(group.totalFte)}
        </TableCell>
        <TableCell className="text-right">
          {formatNumber(Math.round(group.totalProductiveDays))}
        </TableCell>
        <TableCell className="text-right">
          {formatNumber(Math.round(group.totalProductiveHours))}
        </TableCell>
        <TableCell className="text-right">
          {group.totalProductiveHours > 0
            ? formatNumber(Math.round(group.totalCost / group.totalProductiveHours))
            : '-'}
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(group.totalCost)}
        </TableCell>
        <TableCell className="text-right">
          {grandTotalCost > 0
            ? `${((group.totalCost / grandTotalCost) * 100).toFixed(1)}%`
            : '-'}
        </TableCell>
      </TableRow>

      {!isCollapsed &&
        group.rows.map((row) => (
          <TableRow key={`${group.costCenter.id}-${row.seniority}`}>
            <TableCell className="pl-10 text-muted-foreground">
              {SENIORITY_LABELS[row.seniority]}
            </TableCell>
            <TableCell className="text-right">
              {formatFte(row.fte)}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(Math.round(row.productiveDays))}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(Math.round(row.productiveHours))}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(Math.round(row.hourlyCost))}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(row.totalCost)}
            </TableCell>
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

// --- Compare-mode shared helpers ---

const formatDays = (v: number) => formatNumber(Math.round(v));
const formatHours = (v: number) => formatNumber(Math.round(v));
const formatHourly = (v: number) => formatNumber(Math.round(v));

function safeHourlyCost(totalCost: number, productiveHours: number): number {
  return productiveHours > 0 ? totalCost / productiveHours : 0;
}

/** Header trio for one metric: "Label @ asOf", "Label @ compare", "Δ Label". */
function CompareMetricHeader({
  label,
  asOfDate,
  compareDate,
}: {
  label: string;
  asOfDate: string;
  compareDate: string;
}) {
  return (
    <>
      <TableHead className="text-right whitespace-nowrap">{label} @ {asOfDate}</TableHead>
      <TableHead className="text-right whitespace-nowrap">{label} @ {compareDate}</TableHead>
      <TableHead className="text-right whitespace-nowrap">Δ {label}</TableHead>
    </>
  );
}

/** Body cell trio for one metric: primary value, compare value, signed delta. */
function CompareMetric({
  primary,
  compare,
  format,
}: {
  primary: number;
  compare: number;
  format: (v: number) => string;
}) {
  return (
    <>
      <TableCell className="text-right">{format(primary)}</TableCell>
      <TableCell className="text-right">{format(compare)}</TableCell>
      <TableCell className="text-right">
        <DeltaCell value={compare - primary} format={format} />
      </TableCell>
    </>
  );
}

function CompareHeader({ asOfDate, compareDate }: { asOfDate: string; compareDate: string }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-[200px]"></TableHead>
        <CompareMetricHeader label="FTE" asOfDate={asOfDate} compareDate={compareDate} />
        <CompareMetricHeader label="Giorni" asOfDate={asOfDate} compareDate={compareDate} />
        <CompareMetricHeader label="Ore" asOfDate={asOfDate} compareDate={compareDate} />
        <CompareMetricHeader label="Costo orario" asOfDate={asOfDate} compareDate={compareDate} />
        <CompareMetricHeader label="Costo totale" asOfDate={asOfDate} compareDate={compareDate} />
      </TableRow>
    </TableHeader>
  );
}

function TotalWorkforceCompareTable({
  primary,
  compare,
  asOfDate,
  compareDate,
}: {
  primary: TotalSummary;
  compare: TotalSummary;
  asOfDate: string;
  compareDate: string;
}) {
  // Union of seniority levels across both sides, ordered by canonical list.
  const seniorities = useMemo(() => {
    const seen = new Set<SeniorityLevel>();
    for (const r of primary.rows) seen.add(r.seniority);
    for (const r of compare.rows) seen.add(r.seniority);
    return SENIORITY_LEVELS.filter((s) => seen.has(s));
  }, [primary, compare]);

  if (seniorities.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No members to display.
      </p>
    );
  }

  const getRow = (side: TotalSummary, seniority: SeniorityLevel) =>
    side.rows.find((r) => r.seniority === seniority);

  return (
    <div className="overflow-x-auto">
      <Table>
        <CompareHeader asOfDate={asOfDate} compareDate={compareDate} />
        <TableBody>
          {seniorities.map((seniority) => {
            const p = getRow(primary, seniority);
            const c = getRow(compare, seniority);
            return (
              <TableRow key={seniority}>
                <TableCell className="text-muted-foreground">
                  {SENIORITY_LABELS[seniority]}
                </TableCell>
                <CompareMetric primary={p?.fte ?? 0} compare={c?.fte ?? 0} format={formatFte} />
                <CompareMetric
                  primary={p?.productiveDays ?? 0}
                  compare={c?.productiveDays ?? 0}
                  format={formatDays}
                />
                <CompareMetric
                  primary={p?.productiveHours ?? 0}
                  compare={c?.productiveHours ?? 0}
                  format={formatHours}
                />
                <CompareMetric
                  primary={p?.hourlyCost ?? 0}
                  compare={c?.hourlyCost ?? 0}
                  format={formatHourly}
                />
                <CompareMetric
                  primary={p?.totalCost ?? 0}
                  compare={c?.totalCost ?? 0}
                  format={formatCurrency}
                />
              </TableRow>
            );
          })}
          <TableRow className="border-t-2 border-foreground/20 font-bold">
            <TableCell>Totale</TableCell>
            <CompareMetric
              primary={primary.totalFte}
              compare={compare.totalFte}
              format={formatFte}
            />
            <CompareMetric
              primary={primary.totalProductiveDays}
              compare={compare.totalProductiveDays}
              format={formatDays}
            />
            <CompareMetric
              primary={primary.totalProductiveHours}
              compare={compare.totalProductiveHours}
              format={formatHours}
            />
            <CompareMetric
              primary={safeHourlyCost(primary.totalCost, primary.totalProductiveHours)}
              compare={safeHourlyCost(compare.totalCost, compare.totalProductiveHours)}
              format={formatHourly}
            />
            <CompareMetric
              primary={primary.totalCost}
              compare={compare.totalCost}
              format={formatCurrency}
            />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// --- Compare-mode: Per Centro di Costo ---

function CostCenterCompareTable({
  entries,
  ccTotals,
  ccTotalsCompare,
  asOfDate,
  compareDate,
  collapsed,
  onToggle,
}: {
  entries: { cc: CostCenter; primary?: CostCenterGroup; compare?: CostCenterGroup }[];
  ccTotals: { fte: number; productiveDays: number; productiveHours: number; totalCost: number };
  ccTotalsCompare: {
    fte: number;
    productiveDays: number;
    productiveHours: number;
    totalCost: number;
  };
  asOfDate: string;
  compareDate: string;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No data to display. Make sure you have members assigned to cost centers.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <CompareHeader asOfDate={asOfDate} compareDate={compareDate} />
        <TableBody>
          {entries.map((entry) => (
            <CostCenterCompareSection
              key={entry.cc.id}
              costCenter={entry.cc}
              primary={entry.primary}
              compare={entry.compare}
              isCollapsed={collapsed[entry.cc.id] ?? false}
              onToggle={() => onToggle(entry.cc.id)}
            />
          ))}
          <TableRow className="border-t-2 border-foreground/20 font-bold">
            <TableCell>Totale</TableCell>
            <CompareMetric
              primary={ccTotals.fte}
              compare={ccTotalsCompare.fte}
              format={formatFte}
            />
            <CompareMetric
              primary={ccTotals.productiveDays}
              compare={ccTotalsCompare.productiveDays}
              format={formatDays}
            />
            <CompareMetric
              primary={ccTotals.productiveHours}
              compare={ccTotalsCompare.productiveHours}
              format={formatHours}
            />
            <CompareMetric
              primary={safeHourlyCost(ccTotals.totalCost, ccTotals.productiveHours)}
              compare={safeHourlyCost(ccTotalsCompare.totalCost, ccTotalsCompare.productiveHours)}
              format={formatHourly}
            />
            <CompareMetric
              primary={ccTotals.totalCost}
              compare={ccTotalsCompare.totalCost}
              format={formatCurrency}
            />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function CostCenterCompareSection({
  costCenter,
  primary,
  compare,
  isCollapsed,
  onToggle,
}: {
  costCenter: CostCenter;
  primary?: CostCenterGroup;
  compare?: CostCenterGroup;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const pDays = primary?.totalProductiveDays ?? 0;
  const cDays = compare?.totalProductiveDays ?? 0;
  const pHours = primary?.totalProductiveHours ?? 0;
  const cHours = compare?.totalProductiveHours ?? 0;
  const pCost = primary?.totalCost ?? 0;
  const cCost = compare?.totalCost ?? 0;

  const seniorities = useMemo(() => {
    const seen = new Set<SeniorityLevel>();
    primary?.rows.forEach((r) => seen.add(r.seniority));
    compare?.rows.forEach((r) => seen.add(r.seniority));
    return SENIORITY_LEVELS.filter((s) => seen.has(s));
  }, [primary, compare]);

  const getRow = (group: CostCenterGroup | undefined, seniority: SeniorityLevel) =>
    group?.rows.find((r) => r.seniority === seniority);

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
        <CompareMetric
          primary={primary?.totalFte ?? 0}
          compare={compare?.totalFte ?? 0}
          format={formatFte}
        />
        <CompareMetric primary={pDays} compare={cDays} format={formatDays} />
        <CompareMetric primary={pHours} compare={cHours} format={formatHours} />
        <CompareMetric
          primary={safeHourlyCost(pCost, pHours)}
          compare={safeHourlyCost(cCost, cHours)}
          format={formatHourly}
        />
        <CompareMetric primary={pCost} compare={cCost} format={formatCurrency} />
      </TableRow>

      {!isCollapsed &&
        seniorities.map((seniority) => {
          const p = getRow(primary, seniority);
          const c = getRow(compare, seniority);
          return (
            <TableRow key={`${costCenter.id}-${seniority}`}>
              <TableCell className="pl-10 text-muted-foreground">
                {SENIORITY_LABELS[seniority]}
              </TableCell>
              <CompareMetric
                primary={p?.fte ?? 0}
                compare={c?.fte ?? 0}
                format={formatFte}
              />
              <CompareMetric
                primary={p?.productiveDays ?? 0}
                compare={c?.productiveDays ?? 0}
                format={formatDays}
              />
              <CompareMetric
                primary={p?.productiveHours ?? 0}
                compare={c?.productiveHours ?? 0}
                format={formatHours}
              />
              <CompareMetric
                primary={p?.hourlyCost ?? 0}
                compare={c?.hourlyCost ?? 0}
                format={formatHourly}
              />
              <CompareMetric
                primary={p?.totalCost ?? 0}
                compare={c?.totalCost ?? 0}
                format={formatCurrency}
              />
            </TableRow>
          );
        })}
    </>
  );
}
