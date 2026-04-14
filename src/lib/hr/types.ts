import { MemberCategory, SeniorityLevel } from '@/lib/optimizer/types';

/**
 * Snapshot of an employee's state resolved at a specific date.
 * All timed fields reflect the effective value at `resolvedAt`, considering
 * canonical events and any scenario overlay events.
 */
export interface ResolvedMember {
  id: string;
  first_name: string;
  last_name: string;
  contract_start_date: string | null;
  contract_end_date: string | null;

  // Resolved timed fields
  category: MemberCategory;
  seniority: SeniorityLevel | null;
  salary: number;
  ft_percentage: number;
  capacity_percentage: number;
  chargeable_days: number | null;

  // Resolved CDC allocations for this date. Each entry's `percentage`
  // is 0-100. May be empty if the member has no CDC assignment.
  costCenterAllocations: ResolvedCostCenterAllocation[];

  // Whether the member is within contract dates at `resolvedAt`.
  isActive: boolean;

  // The date this snapshot was resolved for ('YYYY-MM-DD').
  resolvedAt: string;
}

export interface ResolvedCostCenterAllocation {
  cost_center_id: string;
  percentage: number;
}
