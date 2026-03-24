-- Component-based capacity: replace opaque days_per_month * utilization with explicit breakdown
-- effective_days = yearly_workable_days - festivita_nazionali - ferie - malattia - formazione

-- 1. Settings: add festivita_nazionali
ALTER TABLE settings ADD COLUMN festivita_nazionali NUMERIC DEFAULT 10;

-- 2. Members: add new columns
ALTER TABLE members ADD COLUMN yearly_workable_days NUMERIC DEFAULT 261;
ALTER TABLE members ADD COLUMN ferie NUMERIC DEFAULT 26;
ALTER TABLE members ADD COLUMN malattia NUMERIC DEFAULT 5;
ALTER TABLE members ADD COLUMN formazione NUMERIC DEFAULT 3;

-- Migrate existing data: yearly_workable_days = days_per_month * 12
UPDATE members SET yearly_workable_days = days_per_month * 12;

-- Drop old columns
ALTER TABLE members DROP COLUMN days_per_month;
ALTER TABLE members DROP COLUMN utilization;

-- 3. Scenario members: add new columns
ALTER TABLE scenario_members_data ADD COLUMN yearly_workable_days NUMERIC DEFAULT 261;
ALTER TABLE scenario_members_data ADD COLUMN ferie NUMERIC DEFAULT 26;
ALTER TABLE scenario_members_data ADD COLUMN malattia NUMERIC DEFAULT 5;
ALTER TABLE scenario_members_data ADD COLUMN formazione NUMERIC DEFAULT 3;

-- Migrate existing data
UPDATE scenario_members_data SET yearly_workable_days = days_per_month * 12;

-- Drop old column
ALTER TABLE scenario_members_data DROP COLUMN days_per_month;
