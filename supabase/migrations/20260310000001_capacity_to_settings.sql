-- Move capacity fields from members to settings (global)

-- 1. Add capacity columns to settings
ALTER TABLE settings
  ADD COLUMN yearly_workable_days integer NOT NULL DEFAULT 261,
  ADD COLUMN ferie integer NOT NULL DEFAULT 25,
  ADD COLUMN malattia integer NOT NULL DEFAULT 3,
  ADD COLUMN formazione integer NOT NULL DEFAULT 6;

-- 2. Update existing rows with new defaults
UPDATE settings SET
  festivita_nazionali = 8,
  yearly_workable_days = 261,
  ferie = 25,
  malattia = 3,
  formazione = 6;

-- 3. Update festivita_nazionali default
ALTER TABLE settings ALTER COLUMN festivita_nazionali SET DEFAULT 8;

-- 4. Drop capacity columns from members
ALTER TABLE members
  DROP COLUMN yearly_workable_days,
  DROP COLUMN ferie,
  DROP COLUMN malattia,
  DROP COLUMN formazione;

-- 5. Drop capacity columns from scenario_members_data
ALTER TABLE scenario_members_data
  DROP COLUMN yearly_workable_days,
  DROP COLUMN ferie,
  DROP COLUMN malattia,
  DROP COLUMN formazione;
