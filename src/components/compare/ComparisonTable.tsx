'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { OptimizationResult, ScenarioMemberData, SENIORITY_LEVELS, SENIORITY_LABELS, MEMBER_CATEGORIES, MEMBER_CATEGORY_LABELS } from '@/lib/optimizer/types';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface ComparisonTableProps {
  resultA: OptimizationResult;
  resultB: OptimizationResult;
  nameA: string;
  nameB: string;
  membersA: ScenarioMemberData[];
  membersB: ScenarioMemberData[];
}

type MetricRow = {
  label: string;
  valueA: string;
  valueB: string;
  delta: string | null;
  favorable: boolean | null; // null = neutral (text metric)
};

type SectionRow = {
  section: string;
};

type Row = MetricRow | SectionRow;

function isSection(row: Row): row is SectionRow {
  return 'section' in row;
}

function buildRows(a: OptimizationResult, b: OptimizationResult, membersA: ScenarioMemberData[], membersB: ScenarioMemberData[]): Row[] {
  const rows: Row[] = [];

  function addSection(label: string) {
    rows.push({ section: label });
  }

  // For numeric metrics: positive delta = favorable unless inverted
  function addCurrency(label: string, valA: number, valB: number, lowerIsBetter = false) {
    const diff = valB - valA;
    const favorable = lowerIsBetter ? diff < 0 : diff > 0;
    rows.push({
      label,
      valueA: formatCurrency(valA),
      valueB: formatCurrency(valB),
      delta: diff === 0 ? null : (diff >= 0 ? '+' : '') + formatCurrency(diff),
      favorable: diff === 0 ? null : favorable,
    });
  }

  function addPercent(label: string, valA: number, valB: number, lowerIsBetter = false) {
    const diff = valB - valA;
    const favorable = lowerIsBetter ? diff < 0 : diff > 0;
    rows.push({
      label,
      valueA: formatPercent(valA),
      valueB: formatPercent(valB),
      delta: diff === 0 ? null : (diff >= 0 ? '+' : '') + formatPercent(diff),
      favorable: diff === 0 ? null : favorable,
    });
  }

  function addNumber(label: string, valA: number, valB: number, lowerIsBetter = false) {
    const diff = valB - valA;
    const favorable = lowerIsBetter ? diff < 0 : diff > 0;
    rows.push({
      label,
      valueA: String(valA),
      valueB: String(valB),
      delta: diff === 0 ? null : (diff >= 0 ? '+' : '') + String(diff),
      favorable: diff === 0 ? null : favorable,
    });
  }

  function addNeutralNumber(label: string, valA: number, valB: number) {
    const diff = valB - valA;
    rows.push({
      label,
      valueA: String(valA),
      valueB: String(valB),
      delta: diff === 0 ? null : (diff >= 0 ? '+' : '') + String(diff),
      favorable: null,
    });
  }

  function addText(label: string, valA: string, valB: string) {
    rows.push({
      label,
      valueA: valA,
      valueB: valB,
      delta: null,
      favorable: null,
    });
  }

  // Pre-compute member counts per seniority level for reuse
  const levelCounts = new Map(
    SENIORITY_LEVELS.map((level) => [
      level,
      {
        a: membersA.filter((m) => m.seniority === level).length,
        b: membersB.filter((m) => m.seniority === level).length,
      },
    ])
  );

  // Pre-compute member counts per category
  const categoryCounts = new Map(
    MEMBER_CATEGORIES.map((cat) => [
      cat,
      {
        a: membersA.filter((m) => m.category === cat).length,
        b: membersB.filter((m) => m.category === cat).length,
      },
    ])
  );

  // Financial
  addSection('Financial');
  addCurrency('Yearly Revenue', a.totalRevenue, b.totalRevenue);
  addCurrency('Fixed Costs', a.fixedCosts, b.fixedCosts, true);
  addPercent('Contribution Margin %', a.contributionPct, b.contributionPct);
  addCurrency('True Profit', a.trueProfit, b.trueProfit);
  addPercent('Profit Margin %', a.profitMarginPct, b.profitMarginPct);
  addCurrency('Break-even Revenue', a.breakEvenRevenue, b.breakEvenRevenue, true);

  // Capacity
  addSection('Capacity');
  addNumber('Total Projects/Year', a.totalProjects, b.totalProjects);
  for (const level of SENIORITY_LEVELS) {
    const { a: countA, b: countB } = levelCounts.get(level)!;
    if (countA === 0 && countB === 0) continue;
    addPercent(`${SENIORITY_LABELS[level]} Utilization`, a.utilization[level], b.utilization[level]);
  }
  addText('Bottleneck', a.bottleneck, b.bottleneck);

  // Workforce
  addSection('Workforce');
  for (const cat of MEMBER_CATEGORIES) {
    const { a: countA, b: countB } = categoryCounts.get(cat)!;
    if (countA === 0 && countB === 0) continue;
    addNeutralNumber(MEMBER_CATEGORY_LABELS[cat], countA, countB);
  }
  for (const level of SENIORITY_LEVELS) {
    const { a: countA, b: countB } = levelCounts.get(level)!;
    if (countA === 0 && countB === 0) continue;
    addNeutralNumber(SENIORITY_LABELS[level], countA, countB);
  }
  addNeutralNumber('Total Members', membersA.length, membersB.length);

  return rows;
}

export function ComparisonTable({ resultA, resultB, nameA, nameB, membersA, membersB }: ComparisonTableProps) {
  const rows = buildRows(resultA, resultB, membersA, membersB);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Metric</TableHead>
          <TableHead>{nameA}</TableHead>
          <TableHead>{nameB}</TableHead>
          <TableHead>Delta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          if (isSection(row)) {
            return (
              <TableRow key={i}>
                <TableCell
                  colSpan={4}
                  className="bg-muted/50 font-semibold text-xs uppercase tracking-wider text-muted-foreground py-2"
                >
                  {row.section}
                </TableCell>
              </TableRow>
            );
          }

          return (
            <TableRow key={i}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className={row.favorable === false ? 'text-green-500' : undefined}>{row.valueA}</TableCell>
              <TableCell className={row.favorable === true ? 'text-green-500' : undefined}>{row.valueB}</TableCell>
              <TableCell
                className={
                  row.delta === null
                    ? 'text-muted-foreground'
                    : row.favorable === null
                      ? ''
                      : row.favorable
                        ? 'text-green-500'
                        : 'text-red-500'
                }
              >
                {row.delta ?? '--'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
