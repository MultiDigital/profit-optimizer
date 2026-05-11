-- Add 'cost_center_allocations' to the field CHECK on member_events
ALTER TABLE member_events DROP CONSTRAINT IF EXISTS member_events_field_check;
ALTER TABLE member_events ADD CONSTRAINT member_events_field_check
  CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days', 'cost_center_allocations'));

-- Add 'cost_center_allocations' to the field CHECK on scenario_member_events
ALTER TABLE scenario_member_events DROP CONSTRAINT IF EXISTS scenario_member_events_field_check;
ALTER TABLE scenario_member_events ADD CONSTRAINT scenario_member_events_field_check
  CHECK (field IN ('salary', 'ft_percentage', 'seniority', 'category', 'capacity_percentage', 'chargeable_days', 'cost_center_allocations'));

-- Event cost center allocations table
CREATE TABLE IF NOT EXISTS event_cost_center_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_event_id UUID REFERENCES member_events(id) ON DELETE CASCADE,
  scenario_member_event_id UUID REFERENCES scenario_member_events(id) ON DELETE CASCADE,
  cost_center_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE NOT NULL,
  percentage NUMERIC NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  UNIQUE(member_event_id, cost_center_id),
  UNIQUE(scenario_member_event_id, cost_center_id),
  CHECK (
    (member_event_id IS NOT NULL AND scenario_member_event_id IS NULL) OR
    (member_event_id IS NULL AND scenario_member_event_id IS NOT NULL)
  )
);

ALTER TABLE event_cost_center_allocations ENABLE ROW LEVEL SECURITY;

-- RLS: access via member_events → user_id
CREATE POLICY "Users can CRUD own event_cost_center_allocations via member_events" ON event_cost_center_allocations
  FOR ALL USING (
    (member_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM member_events WHERE member_events.id = event_cost_center_allocations.member_event_id AND member_events.user_id = auth.uid()
    ))
    OR
    (scenario_member_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM scenario_member_events WHERE scenario_member_events.id = event_cost_center_allocations.scenario_member_event_id AND scenario_member_events.user_id = auth.uid()
    ))
  );

CREATE INDEX IF NOT EXISTS idx_event_cc_alloc_member_event ON event_cost_center_allocations(member_event_id);
CREATE INDEX IF NOT EXISTS idx_event_cc_alloc_scenario_event ON event_cost_center_allocations(scenario_member_event_id);
CREATE INDEX IF NOT EXISTS idx_event_cc_alloc_cost_center ON event_cost_center_allocations(cost_center_id);
