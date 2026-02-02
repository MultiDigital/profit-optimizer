-- Migration: Remove "Middle Up" seniority level
-- This simplifies seniority management to 3 levels: Senior, Middle, Junior

-- Step 1: Migrate existing middleup members to middle BEFORE dropping constraints
UPDATE members SET seniority = 'middle' WHERE seniority = 'middleup';
UPDATE scenario_members_data SET seniority = 'middle' WHERE seniority = 'middleup';

-- Step 2: Update seniority CHECK constraint on members
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_seniority_check;
ALTER TABLE members ADD CONSTRAINT members_seniority_check CHECK (seniority IN ('senior', 'middle', 'junior'));

-- Step 3: Update seniority CHECK constraint on scenario_members_data
ALTER TABLE scenario_members_data DROP CONSTRAINT IF EXISTS scenario_members_data_seniority_check;
ALTER TABLE scenario_members_data ADD CONSTRAINT scenario_members_data_seniority_check CHECK (seniority IN ('senior', 'middle', 'junior'));

-- Step 4: Remove middle_up_rate from settings
ALTER TABLE settings DROP COLUMN IF EXISTS middle_up_rate;

-- Step 5: Remove middle_up_days from services
ALTER TABLE services DROP COLUMN IF EXISTS middle_up_days;

-- Step 6: Remove middle_up_days from scenario_services_data
ALTER TABLE scenario_services_data DROP COLUMN IF EXISTS middle_up_days;
