-- PR 5b — scope scenario events to their scenario server-side.
-- Today we infer which scenario an event belongs to via scenario_member_id
-- (joins to hr_scenario_members.hr_scenario_id) OR, for canonical-override
-- events created by PR 5a's data migration, we can't infer at all (the
-- source hr_scenario_members rows were deleted). Adding the column makes
-- scoping explicit and eliminates the `.not('member_id', 'is', null)`
-- fetch workaround in useHRScenarios.

BEGIN;

-- 1. Add hr_scenario_id column (nullable for the backfill; tightened at the end)
ALTER TABLE scenario_member_events
  ADD COLUMN IF NOT EXISTS hr_scenario_id UUID REFERENCES hr_scenarios(id) ON DELETE CASCADE;

-- 2. Backfill via scenario_member_id join (works for all synthetic-scoped events)
UPDATE scenario_member_events sme
SET hr_scenario_id = sm.hr_scenario_id
FROM hr_scenario_members sm
WHERE sme.scenario_member_id = sm.id
  AND sme.hr_scenario_id IS NULL;

-- 3. Orphan cleanup: events with member_id set (canonical overrides from PR 5a
-- migration) have no preserved hr_scenario_id. If there's exactly one scenario
-- for the user, auto-attribute; otherwise leave NULL and we'll delete them.
-- Rationale: these are "scenario-less" overrides, which has no meaning in the
-- delta model — they'd apply to all scenarios uniformly, which equals never.
UPDATE scenario_member_events sme
SET hr_scenario_id = (
  SELECT id FROM hr_scenarios hs
  WHERE hs.user_id = sme.user_id
  LIMIT 1
)
WHERE sme.hr_scenario_id IS NULL
  AND sme.member_id IS NOT NULL
  AND (SELECT COUNT(*) FROM hr_scenarios hs WHERE hs.user_id = sme.user_id) = 1;

-- 4. Delete any remaining NULL-hr_scenario_id events (multi-scenario users with
-- untraceable PR 5a canonical-override orphans). Cascade removes their CDC
-- sidecar rows automatically.
DELETE FROM scenario_member_events WHERE hr_scenario_id IS NULL;

-- 5. Tighten: hr_scenario_id is now NOT NULL
ALTER TABLE scenario_member_events
  ALTER COLUMN hr_scenario_id SET NOT NULL;

-- 6. Index for per-scenario lookups
CREATE INDEX IF NOT EXISTS idx_scenario_member_events_hr_scenario_id
  ON scenario_member_events(hr_scenario_id);

COMMIT;
