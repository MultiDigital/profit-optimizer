CREATE TABLE IF NOT EXISTS member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days')),
  value TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own member_events" ON member_events
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_member_events_user_id ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_member_id ON member_events(member_id);
CREATE INDEX IF NOT EXISTS idx_member_events_dates ON member_events(start_date, end_date);
