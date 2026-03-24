-- Add 'stage' and 'segnalatore' seniority levels

-- Update CHECK constraint on members
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_seniority_check;
ALTER TABLE members ADD CONSTRAINT members_seniority_check
  CHECK (seniority IN ('senior', 'middle_up', 'middle', 'junior', 'stage', 'segnalatore'));

-- Update CHECK constraint on scenario_members_data
ALTER TABLE scenario_members_data DROP CONSTRAINT IF EXISTS scenario_members_data_seniority_check;
ALTER TABLE scenario_members_data ADD CONSTRAINT scenario_members_data_seniority_check
  CHECK (seniority IN ('senior', 'middle_up', 'middle', 'junior', 'stage', 'segnalatore'));

-- Add stage_rate to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS stage_rate NUMERIC DEFAULT 80;

-- Add stage_days to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS stage_days NUMERIC DEFAULT 0;

-- Add stage_days to scenario_services_data
ALTER TABLE scenario_services_data ADD COLUMN IF NOT EXISTS stage_days NUMERIC DEFAULT 0;
