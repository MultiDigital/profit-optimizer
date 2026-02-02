-- Scenario Data Tables Migration
-- Replace junction tables with full data copies for scenario-specific customization

-- Drop old junction tables
DROP TABLE IF EXISTS scenario_members CASCADE;
DROP TABLE IF EXISTS scenario_services CASCADE;

-- Create scenario_members_data - full copy of member data per scenario
CREATE TABLE scenario_members_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE NOT NULL,
  source_member_id UUID REFERENCES members(id) ON DELETE SET NULL, -- for resync, nullable if source deleted
  name TEXT NOT NULL,
  seniority TEXT NOT NULL CHECK (seniority IN ('senior', 'middleup', 'middle', 'junior')),
  days_per_month NUMERIC DEFAULT 20,
  utilization NUMERIC DEFAULT 80,
  salary NUMERIC DEFAULT 50000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scenario_services_data - full copy of service data per scenario
CREATE TABLE scenario_services_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE NOT NULL,
  source_service_id UUID REFERENCES services(id) ON DELETE SET NULL, -- for resync, nullable if source deleted
  name TEXT NOT NULL,
  senior_days NUMERIC DEFAULT 0,
  middle_up_days NUMERIC DEFAULT 0,
  middle_days NUMERIC DEFAULT 0,
  junior_days NUMERIC DEFAULT 0,
  price NUMERIC NOT NULL,
  max_year NUMERIC, -- NULL = unlimited, only exists at scenario level
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove max_year from services catalog (it only belongs at scenario level)
ALTER TABLE services DROP COLUMN IF EXISTS max_year;

-- Enable Row Level Security
ALTER TABLE scenario_members_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_services_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can CRUD own scenario_members_data" ON scenario_members_data;
DROP POLICY IF EXISTS "Users can CRUD own scenario_services_data" ON scenario_services_data;

-- Policies: verify ownership via the scenario's user_id
CREATE POLICY "Users can CRUD own scenario_members_data" ON scenario_members_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = scenario_members_data.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD own scenario_services_data" ON scenario_services_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = scenario_services_data.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX idx_scenario_members_data_scenario_id ON scenario_members_data(scenario_id);
CREATE INDEX idx_scenario_members_data_source_id ON scenario_members_data(source_member_id);
CREATE INDEX idx_scenario_services_data_scenario_id ON scenario_services_data(scenario_id);
CREATE INDEX idx_scenario_services_data_source_id ON scenario_services_data(source_service_id);
