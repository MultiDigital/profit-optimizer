-- Remove utilization column from scenario_members_data
-- Allocation now serves as the single scaling factor for both capacity and salary cost

ALTER TABLE scenario_members_data
DROP COLUMN utilization;
