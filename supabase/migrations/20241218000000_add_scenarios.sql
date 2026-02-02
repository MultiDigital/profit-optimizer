-- Scenarios for Revenue Optimizer
-- Scenarios reference existing members and services via junction tables

-- Scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: scenarios <-> members (many-to-many)
CREATE TABLE IF NOT EXISTS scenario_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_id, member_id)
);

-- Junction table: scenarios <-> services (many-to-many)
CREATE TABLE IF NOT EXISTS scenario_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_id, service_id)
);

-- Enable Row Level Security
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_services ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can CRUD own scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can CRUD own scenario_members" ON scenario_members;
DROP POLICY IF EXISTS "Users can CRUD own scenario_services" ON scenario_services;

-- Policies: users can only access their own data
CREATE POLICY "Users can CRUD own scenarios" ON scenarios
  FOR ALL USING (auth.uid() = user_id);

-- For junction tables, verify ownership via the scenario's user_id
CREATE POLICY "Users can CRUD own scenario_members" ON scenario_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = scenario_members.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD own scenario_services" ON scenario_services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = scenario_services.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_members_scenario_id ON scenario_members(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_members_member_id ON scenario_members(member_id);
CREATE INDEX IF NOT EXISTS idx_scenario_services_scenario_id ON scenario_services(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_services_service_id ON scenario_services(service_id);
