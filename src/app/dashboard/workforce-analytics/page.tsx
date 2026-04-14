'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCostCenters, useSettings } from '@/hooks';
import { useViewContext } from '@/contexts/ViewContext';
import { useResolvedScenario } from '@/hooks/useResolvedScenario';
import { resolveWorkforceAtDate } from '@/lib/hr/resolve';
import type { ResolvedMember } from '@/lib/hr/types';
import {
  Member,
  MemberEvent,
  ScenarioMemberEvent,
  CostCenter,
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
  const { year } = useViewContext();
  const { bundle, loading: scenarioLoading } = useResolvedScenario();
  const { settings, loading: settingsLoading } = useSettings();
  const { costCenters, loading: ccLoading } = useCostCenters();

  const loading = scenarioLoading || settingsLoading || ccLoading;

  // Resolve workforce at mid-year of the selected year.
  const resolved = useMemo(() => {
    const anchorDate = `${year}-06-01`;
    const canonicalEvents =
      bundle.source === 'baseline' ? (bundle.events as MemberEvent[]) : [];
    const scenarioEvents =
      bundle.source === 'scenario' ? (bundle.events as ScenarioMemberEvent[]) : [];
    return resolveWorkforceAtDate(
      bundle.members as Member[],
      bundle.baseAllocations,
      canonicalEvents,
      scenarioEvents,
      bundle.eventAllocations,
      anchorDate
    );
  }, [bundle, year]);

  const totalWorkforce = useMemo(
    () => computeTotalWorkforce(resolved, settings),
    [resolved, settings]
  );

  const groups = useMemo(
    () => computeByCostCenter(resolved, costCenters, settings),
    [resolved, costCenters, settings]
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

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

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
                </TabsList>

                <TabsContent value="breakdown">
                  <Tabs defaultValue="total">
                    <TabsList>
                      <TabsTrigger value="total">Totale</TabsTrigger>
                      <TabsTrigger value="cost-centers">Per Centro di Costo</TabsTrigger>
                    </TabsList>

                    {/* Total workforce tab */}
                    <TabsContent value="total">
                      {totalWorkforce.rows.length === 0 ? (
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
                      {groups.length === 0 ? (
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
