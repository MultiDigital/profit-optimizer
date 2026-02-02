-- Add allocation column to scenario_members_data table
-- Default 100 for backwards compatibility (existing members remain at 100%)
ALTER TABLE scenario_members_data
ADD COLUMN allocation NUMERIC DEFAULT 100;
