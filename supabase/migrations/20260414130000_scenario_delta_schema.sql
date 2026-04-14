-- PR 5a — scenario event delta model.
-- Adds scenario_member_events.member_id so scenario events can override
-- canonical employees directly (delta overlay) instead of via a full-copy.
-- Runs a one-time data migration that:
--   1. Reassigns events of copy-members to reference canonical members.
--   2. Drops byte-identical events (they were no-op duplicates from scenario creation).
--   3. Deletes copy-member rows (their events now live against canonical IDs).
-- After this migration, hr_scenario_members only contains synthetic "what-if"
-- members that have no canonical counterpart.

BEGIN;

-- 1. Add is_synthetic flag on hr_scenario_members (default TRUE for everything that survives)
ALTER TABLE hr_scenario_members
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add member_id to scenario_member_events (nullable; references canonical members)
ALTER TABLE scenario_member_events
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE;

-- 3. Relax scenario_member_id from NOT NULL so events can alternatively target a canonical member
ALTER TABLE scenario_member_events
  ALTER COLUMN scenario_member_id DROP NOT NULL;

-- 4. Data migration: reassign events of copy-members to reference canonical via source_member_id
UPDATE scenario_member_events sme
SET member_id = sm.source_member_id,
    scenario_member_id = NULL
FROM hr_scenario_members sm
WHERE sme.scenario_member_id = sm.id
  AND sm.source_member_id IS NOT NULL;

-- 5. Drop scenario events that are byte-identical to canonical events (no-op overrides).
-- These were auto-duplicated at scenario creation and never edited by the user.
-- Cascade on event_cost_center_allocations removes their CDC rows automatically.
--
-- IMPORTANT: exclude field='cost_center_allocations'. For CDC events, `value`
-- is always the empty string — the actual allocation data lives in the sidecar
-- event_cost_center_allocations table, which this byte-identical check doesn't
-- inspect. Without this exclusion, a user-customized scenario CDC event would
-- be misclassified as duplicate and destroyed (along with its sidecar rows via
-- CASCADE). Keep all CDC events; the resolver's tie-break rules handle any
-- functional redundancy correctly.
DELETE FROM scenario_member_events sme
USING member_events me
WHERE sme.member_id IS NOT NULL
  AND sme.field != 'cost_center_allocations'
  AND sme.member_id = me.member_id
  AND sme.field = me.field
  AND sme.value = me.value
  AND sme.start_date = me.start_date
  AND COALESCE(sme.end_date::text, 'open') = COALESCE(me.end_date::text, 'open');

-- 6. Delete copy-member rows from hr_scenario_members. Their events now live
-- against canonical member_ids (step 4) or were dropped as duplicates (step 5).
-- Remaining rows are genuine synthetic members (source_member_id IS NULL).
DELETE FROM hr_scenario_members
WHERE source_member_id IS NOT NULL;

-- 7. Add CHECK constraint: exactly one of (member_id, scenario_member_id) is set.
-- Must land after data migration — mid-migration states are fine because each
-- UPDATE is atomic within a row, but defensive placement here ensures no
-- rogue writes during the transaction could slip through.
ALTER TABLE scenario_member_events
  ADD CONSTRAINT scenario_member_events_member_xor
  CHECK ((member_id IS NULL) != (scenario_member_id IS NULL));

-- 8. Index on the new FK column to keep per-canonical-member lookups fast.
CREATE INDEX IF NOT EXISTS idx_scenario_member_events_member_id
  ON scenario_member_events(member_id);

COMMIT;
