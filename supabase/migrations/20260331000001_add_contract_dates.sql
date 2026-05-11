-- Add contract date fields to members
ALTER TABLE members ADD COLUMN contract_start_date DATE;
ALTER TABLE members ADD COLUMN contract_end_date DATE;

-- Add contract date fields to scenario_members_data
ALTER TABLE scenario_members_data ADD COLUMN contract_start_date DATE;
ALTER TABLE scenario_members_data ADD COLUMN contract_end_date DATE;
