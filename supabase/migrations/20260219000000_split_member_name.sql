-- Split 'name' column into 'first_name' and 'last_name' for members table
ALTER TABLE members ADD COLUMN first_name TEXT;
ALTER TABLE members ADD COLUMN last_name TEXT;

UPDATE members SET
  first_name = CASE
    WHEN position(' ' IN name) > 0 THEN left(name, position(' ' IN name) - 1)
    ELSE ''
  END,
  last_name = CASE
    WHEN position(' ' IN name) > 0 THEN substring(name FROM position(' ' IN name) + 1)
    ELSE name
  END;

ALTER TABLE members ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE members ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE members DROP COLUMN name;

-- Split 'name' column into 'first_name' and 'last_name' for scenario_members_data table
ALTER TABLE scenario_members_data ADD COLUMN first_name TEXT;
ALTER TABLE scenario_members_data ADD COLUMN last_name TEXT;

UPDATE scenario_members_data SET
  first_name = CASE
    WHEN position(' ' IN name) > 0 THEN left(name, position(' ' IN name) - 1)
    ELSE ''
  END,
  last_name = CASE
    WHEN position(' ' IN name) > 0 THEN substring(name FROM position(' ' IN name) + 1)
    ELSE name
  END;

ALTER TABLE scenario_members_data ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE scenario_members_data ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE scenario_members_data DROP COLUMN name;
