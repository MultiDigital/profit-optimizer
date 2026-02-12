-- Migration: Re-add "Middle Up" seniority level
-- Seniority hierarchy: Senior > Middle Up > Middle > Junior

-- Step 1: Update seniority CHECK constraint on members
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_seniority_check;
ALTER TABLE members ADD CONSTRAINT members_seniority_check CHECK (seniority IN ('senior', 'middle_up', 'middle', 'junior'));

-- Step 2: Update seniority CHECK constraint on scenario_members_data
ALTER TABLE scenario_members_data DROP CONSTRAINT IF EXISTS scenario_members_data_seniority_check;
ALTER TABLE scenario_members_data ADD CONSTRAINT scenario_members_data_seniority_check CHECK (seniority IN ('senior', 'middle_up', 'middle', 'junior'));

-- Step 3: Add middle_up_rate to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS middle_up_rate NUMERIC DEFAULT 192;

-- Step 4: Add middle_up_days to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS middle_up_days NUMERIC DEFAULT 0;

-- Step 5: Add middle_up_days to scenario_services_data
ALTER TABLE scenario_services_data ADD COLUMN IF NOT EXISTS middle_up_days NUMERIC DEFAULT 0;
