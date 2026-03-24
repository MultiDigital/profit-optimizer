// Member categories
export type MemberCategory = 'dipendente' | 'segnalatore' | 'freelance';

export const MEMBER_CATEGORIES: MemberCategory[] = ['dipendente', 'segnalatore', 'freelance'];

export const MEMBER_CATEGORY_LABELS: Record<MemberCategory, string> = {
  dipendente: 'Dipendente',
  segnalatore: 'Segnalatore',
  freelance: 'Freelance',
};

export const DEFAULT_MEMBER_CATEGORY: MemberCategory = 'dipendente';

// Seniority levels
export type SeniorityLevel = 'senior' | 'middle_up' | 'middle' | 'junior' | 'stage';

export const SENIORITY_LEVELS: SeniorityLevel[] = ['senior', 'middle_up', 'middle', 'junior', 'stage'];

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  senior: 'Senior',
  middle_up: 'Middle Up',
  middle: 'Middle',
  junior: 'Junior',
  stage: 'Stage',
};

export const SENIORITY_SHORT_LABELS: Record<SeniorityLevel, string> = {
  senior: 'Sen',
  middle_up: 'MUp',
  middle: 'Mid',
  junior: 'Jun',
  stage: 'Stg',
};

// Database models
export interface Member {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  category: MemberCategory;
  seniority: SeniorityLevel | null;
  salary: number;
  chargeable_days?: number | null;
  ft_percentage?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  senior_days: number;
  middle_up_days: number;
  middle_days: number;
  junior_days: number;
  stage_days: number;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id: string;
  user_id: string;
  senior_rate: number;
  middle_up_rate: number;
  middle_rate: number;
  junior_rate: number;
  stage_rate: number;
  festivita_nazionali: number;
  yearly_workable_days: number;
  ferie: number;
  malattia: number;
  formazione: number;
  created_at?: string;
  updated_at?: string;
}

// Form input types (for creating/updating)
export interface MemberInput {
  first_name: string;
  last_name: string;
  category?: MemberCategory;
  seniority: SeniorityLevel | null;
  salary: number;
  chargeable_days?: number | null;
  ft_percentage?: number | null;
}

export interface ServiceInput {
  name: string;
  senior_days: number;
  middle_up_days: number;
  middle_days: number;
  junior_days: number;
  stage_days: number;
  price: number;
}

export interface SettingsInput {
  senior_rate: number;
  middle_up_rate: number;
  middle_rate: number;
  junior_rate: number;
  stage_rate: number;
  festivita_nazionali: number;
  yearly_workable_days: number;
  ferie: number;
  malattia: number;
  formazione: number;
}

// Optimization types
export interface ServiceVariant {
  id: string;
  variantId: string;
  variantName: string;
  baseId: string;
  name: string;
  seniorDays: number;
  middleUpDays: number;
  middleDays: number;
  juniorDays: number;
  stageDays: number;
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
  middle_up: number;
  middle: number;
  junior: number;
  stage: number;
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
    middle_up: number;
    middle: number;
    junior: number;
    stage: number;
  };
  bottleneck: string;
  bottleneckNote: string;
  projectBreakdown: ProjectBreakdown[];
  variants: ServiceVariant[];
}

// Default values
export const DEFAULT_SETTINGS: SettingsInput = {
  senior_rate: 296,
  middle_up_rate: 192,
  middle_rate: 160,
  junior_rate: 128,
  stage_rate: 80,
  festivita_nazionali: 8,
  yearly_workable_days: 261,
  ferie: 25,
  malattia: 3,
  formazione: 6,
};

export const DEFAULT_MEMBER: MemberInput = {
  first_name: '',
  last_name: '',
  category: 'dipendente',
  seniority: 'middle',
  salary: 50000,
  chargeable_days: null,
  ft_percentage: 100,
};

export const DEFAULT_SERVICE: ServiceInput = {
  name: '',
  senior_days: 1,
  middle_up_days: 0,
  middle_days: 0,
  junior_days: 6,
  stage_days: 0,
  price: 10000,
};

// Cost Center types
export interface CostCenter {
  id: string;
  user_id: string;
  code: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface CostCenterInput {
  code: string;
  name: string;
}

export interface MemberCostCenterAllocation {
  id: string;
  member_id: string;
  cost_center_id: string;
  percentage: number;
  created_at?: string;
  updated_at?: string;
}

// Scenario types
export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  cost_center_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScenarioInput {
  name: string;
  cost_center_id?: string | null;
}

// Scenario member data - full copy with scenario-specific values
export interface ScenarioMemberData {
  id: string;
  scenario_id: string;
  source_member_id: string | null; // for resync, null if source deleted
  first_name: string;
  last_name: string;
  category: MemberCategory;
  seniority: SeniorityLevel | null;
  salary: number;
  chargeable_days?: number | null;
  ft_percentage?: number | null;
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
  middle_up_days: number;
  middle_days: number;
  junior_days: number;
  stage_days: number;
  price: number;
  max_year: number | null; // only exists at scenario level
  created_at?: string;
  updated_at?: string;
}

// Input types for scenario data
export interface ScenarioMemberDataInput {
  source_member_id?: string | null;
  first_name: string;
  last_name: string;
  category?: MemberCategory;
  seniority: SeniorityLevel | null;
  salary: number;
  chargeable_days?: number | null;
  ft_percentage?: number | null;
  capacity_percentage?: number; // percentage (1-100), defaults to 100
  cost_percentage?: number; // percentage (1-100), defaults to 100
}

export interface ScenarioServiceDataInput {
  source_service_id?: string | null;
  name: string;
  senior_days: number;
  middle_up_days: number;
  middle_days: number;
  junior_days: number;
  stage_days: number;
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

// Helper function to compute effective days from capacity components
export function computeEffectiveDays(
  yearlyWorkableDays: number,
  festivitaNazionali: number,
  ferie: number,
  malattia: number,
  formazione: number
): number {
  return yearlyWorkableDays - festivitaNazionali - ferie - malattia - formazione;
}

// Convenience type for passing capacity settings around
export interface CapacitySettings {
  yearly_workable_days: number;
  festivita_nazionali: number;
  ferie: number;
  malattia: number;
  formazione: number;
}
