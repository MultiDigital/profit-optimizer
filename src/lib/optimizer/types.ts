// Seniority levels
export type SeniorityLevel = 'senior' | 'middle' | 'junior';

export const SENIORITY_LEVELS: SeniorityLevel[] = ['senior', 'middle', 'junior'];

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  senior: 'Senior',
  middle: 'Middle',
  junior: 'Junior',
};

// Database models
export interface Member {
  id: string;
  user_id: string;
  name: string;
  seniority: SeniorityLevel;
  days_per_month: number;
  utilization: number;
  salary: number;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  senior_days: number;
  middle_days: number;
  junior_days: number;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id: string;
  user_id: string;
  senior_rate: number;
  middle_rate: number;
  junior_rate: number;
  created_at?: string;
  updated_at?: string;
}

// Form input types (for creating/updating)
export interface MemberInput {
  name: string;
  seniority: SeniorityLevel;
  days_per_month: number;
  utilization: number;
  salary: number;
}

export interface ServiceInput {
  name: string;
  senior_days: number;
  middle_days: number;
  junior_days: number;
  price: number;
}

export interface SettingsInput {
  senior_rate: number;
  middle_rate: number;
  junior_rate: number;
}

// Optimization types
export interface ServiceVariant {
  id: string;
  variantId: string;
  variantName: string;
  baseId: string;
  name: string;
  seniorDays: number;
  middleDays: number;
  juniorDays: number;
  price: number;
  maxYear: number | null;
  cost: number;
  margin: number;
  totalDays: number;
  marginEfficiency: number;
  isSubstitution: boolean;
  substitutionInfo?: string;
}

export interface Capacity {
  senior: number;
  middle: number;
  junior: number;
}

export interface Allocation {
  [variantId: string]: number;
}

export interface ProjectBreakdown {
  name: string;
  count: number;
  revenue: number;
  margin: number;
  unitMargin: number;
  isSubstitution: boolean;
  isDemandCapped: boolean;
}

export interface OptimizationResult {
  allocation: Allocation;
  totalRevenue: number;
  totalMargin: number;
  totalCost: number;
  totalProjects: number;
  fixedCosts: number;
  trueProfit: number;
  contributionPct: number;
  profitMarginPct: number;
  breakEvenRevenue: number;
  usedDays: Capacity;
  capacity: Capacity;
  utilization: {
    senior: number;
    middle: number;
    junior: number;
  };
  bottleneck: string;
  bottleneckNote: string;
  projectBreakdown: ProjectBreakdown[];
  variants: ServiceVariant[];
}

// Default values
export const DEFAULT_SETTINGS: SettingsInput = {
  senior_rate: 296,
  middle_rate: 160,
  junior_rate: 128,
};

export const DEFAULT_MEMBER: MemberInput = {
  name: '',
  seniority: 'middle',
  days_per_month: 20,
  utilization: 80,
  salary: 50000,
};

export const DEFAULT_SERVICE: ServiceInput = {
  name: '',
  senior_days: 1,
  middle_days: 0,
  junior_days: 6,
  price: 10000,
};

// Scenario types
export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScenarioInput {
  name: string;
}

// Scenario member data - full copy with scenario-specific values
export interface ScenarioMemberData {
  id: string;
  scenario_id: string;
  source_member_id: string | null; // for resync, null if source deleted
  name: string;
  seniority: SeniorityLevel;
  days_per_month: number;
  salary: number;
  capacity_percentage: number; // percentage (1-100), scales available capacity/days
  cost_percentage: number; // percentage (1-100), scales salary cost contribution
  created_at?: string;
  updated_at?: string;
}

// Scenario service data - full copy with scenario-specific values
export interface ScenarioServiceData {
  id: string;
  scenario_id: string;
  source_service_id: string | null; // for resync, null if source deleted
  name: string;
  senior_days: number;
  middle_days: number;
  junior_days: number;
  price: number;
  max_year: number | null; // only exists at scenario level
  created_at?: string;
  updated_at?: string;
}

// Input types for scenario data
export interface ScenarioMemberDataInput {
  source_member_id?: string | null;
  name: string;
  seniority: SeniorityLevel;
  days_per_month: number;
  salary: number;
  capacity_percentage?: number; // percentage (1-100), defaults to 100
  cost_percentage?: number; // percentage (1-100), defaults to 100
}

export interface ScenarioServiceDataInput {
  source_service_id?: string | null;
  name: string;
  senior_days: number;
  middle_days: number;
  junior_days: number;
  price: number;
  max_year: number | null;
}

// Scenario with resolved members and services
export interface ScenarioWithData extends Scenario {
  members: ScenarioMemberData[];
  services: ScenarioServiceData[];
}

export const DEFAULT_SCENARIO: ScenarioInput = {
  name: '',
};
