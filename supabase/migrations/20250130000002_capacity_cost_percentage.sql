-- Rename allocation to capacity_percentage
ALTER TABLE scenario_members_data
  RENAME COLUMN allocation TO capacity_percentage;

-- Add cost_percentage with default 100
ALTER TABLE scenario_members_data
  ADD COLUMN cost_percentage NUMERIC DEFAULT 100;
