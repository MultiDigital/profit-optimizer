-- Cost Centers: lista centri di costo
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member ↔ Cost Center allocations: % allocazione per membro/centro di costo
CREATE TABLE IF NOT EXISTS member_cost_center_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  cost_center_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE NOT NULL,
  percentage NUMERIC DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, cost_center_id)
);

-- Add cost_center_id to scenarios (nullable for backwards compatibility)
ALTER TABLE scenarios ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_cost_center_allocations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can CRUD own cost_centers" ON cost_centers;
DROP POLICY IF EXISTS "Users can CRUD own member_cost_center_allocations" ON member_cost_center_allocations;

-- Policies: users can only access their own data
CREATE POLICY "Users can CRUD own cost_centers" ON cost_centers
  FOR ALL USING (auth.uid() = user_id);

-- For allocations, verify ownership via the member's user_id
CREATE POLICY "Users can CRUD own member_cost_center_allocations" ON member_cost_center_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.id = member_cost_center_allocations.member_id
      AND members.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cost_centers_user_id ON cost_centers(user_id);
CREATE INDEX IF NOT EXISTS idx_member_cc_alloc_member_id ON member_cost_center_allocations(member_id);
CREATE INDEX IF NOT EXISTS idx_member_cc_alloc_cost_center_id ON member_cost_center_allocations(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_cost_center_id ON scenarios(cost_center_id);
