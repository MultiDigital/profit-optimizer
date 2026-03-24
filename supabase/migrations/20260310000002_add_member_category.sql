-- Add category to members
ALTER TABLE members ADD COLUMN category text NOT NULL DEFAULT 'dipendente'
  CHECK (category IN ('dipendente', 'segnalatore', 'freelance'));

-- Make seniority nullable first (before migrating data)
ALTER TABLE members ALTER COLUMN seniority DROP NOT NULL;

-- Drop old seniority CHECK that includes 'segnalatore'
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_seniority_check;

-- Migrate existing segnalatore-seniority members to category
UPDATE members SET category = 'segnalatore', seniority = NULL WHERE seniority = 'segnalatore';

-- Add new seniority CHECK without 'segnalatore'
ALTER TABLE members ADD CONSTRAINT members_seniority_check
  CHECK (seniority IS NULL OR seniority IN ('senior', 'middle_up', 'middle', 'junior', 'stage'));

-- Add category to scenario_members_data
ALTER TABLE scenario_members_data ADD COLUMN category text NOT NULL DEFAULT 'dipendente'
  CHECK (category IN ('dipendente', 'segnalatore', 'freelance'));

-- Make seniority nullable first
ALTER TABLE scenario_members_data ALTER COLUMN seniority DROP NOT NULL;

-- Drop old seniority CHECK
ALTER TABLE scenario_members_data DROP CONSTRAINT IF EXISTS scenario_members_data_seniority_check;

-- Migrate scenario segnalatore members
UPDATE scenario_members_data SET category = 'segnalatore', seniority = NULL WHERE seniority = 'segnalatore';

-- Add new seniority CHECK without 'segnalatore'
ALTER TABLE scenario_members_data ADD CONSTRAINT scenario_members_data_seniority_check
  CHECK (seniority IS NULL OR seniority IN ('senior', 'middle_up', 'middle', 'junior', 'stage'));
