-- HR Scenarios
CREATE TABLE IF NOT EXISTS hr_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own hr_scenarios" ON hr_scenarios
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hr_scenarios_user_id ON hr_scenarios(user_id);

-- HR Scenario Members
CREATE TABLE IF NOT EXISTS hr_scenario_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hr_scenario_id UUID REFERENCES hr_scenarios(id) ON DELETE CASCADE NOT NULL,
  source_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('dipendente', 'segnalatore', 'freelance')),
  seniority TEXT CHECK (seniority IN ('senior', 'middle_up', 'middle', 'junior', 'stage')),
  salary NUMERIC NOT NULL DEFAULT 0,
  ft_percentage NUMERIC DEFAULT 100,
  chargeable_days NUMERIC,
  capacity_percentage NUMERIC DEFAULT 100,
  cost_percentage NUMERIC DEFAULT 100,
  contract_start_date DATE,
  contract_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hr_scenario_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own hr_scenario_members" ON hr_scenario_members
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_hr_scenario_members_scenario_id ON hr_scenario_members(hr_scenario_id);
CREATE INDEX IF NOT EXISTS idx_hr_scenario_members_source ON hr_scenario_members(source_member_id);

-- Scenario Member Events
CREATE TABLE IF NOT EXISTS scenario_member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scenario_member_id UUID REFERENCES hr_scenario_members(id) ON DELETE CASCADE NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days')),
  value TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scenario_member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own scenario_member_events" ON scenario_member_events
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scenario_member_events_member_id ON scenario_member_events(scenario_member_id);
CREATE INDEX IF NOT EXISTS idx_scenario_member_events_dates ON scenario_member_events(start_date, end_date);
