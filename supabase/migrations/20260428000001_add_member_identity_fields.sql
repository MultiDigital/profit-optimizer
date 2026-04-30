-- Add identity / contract metadata fields to members and both scenario member tables.
-- All three columns are nullable; existing rows get NULL and remain legal.

ALTER TABLE members
  ADD COLUMN gender TEXT
    CHECK (gender IS NULL OR gender IN ('maschio', 'femmina')),
  ADD COLUMN contract_type TEXT
    CHECK (contract_type IS NULL OR contract_type IN (
      'indeterminato', 'determinato', 'stage',
      'prestazione_occasionale', 'piva',
      'apprendistato', 'amministratore'
    )),
  ADD COLUMN livello TEXT
    CHECK (livello IS NULL OR livello IN ('6', '5', '4', '3', '2', '1', 'Q'));

ALTER TABLE scenario_members_data
  ADD COLUMN gender TEXT
    CHECK (gender IS NULL OR gender IN ('maschio', 'femmina')),
  ADD COLUMN contract_type TEXT
    CHECK (contract_type IS NULL OR contract_type IN (
      'indeterminato', 'determinato', 'stage',
      'prestazione_occasionale', 'piva',
      'apprendistato', 'amministratore'
    )),
  ADD COLUMN livello TEXT
    CHECK (livello IS NULL OR livello IN ('6', '5', '4', '3', '2', '1', 'Q'));

ALTER TABLE hr_scenario_members
  ADD COLUMN gender TEXT
    CHECK (gender IS NULL OR gender IN ('maschio', 'femmina')),
  ADD COLUMN contract_type TEXT
    CHECK (contract_type IS NULL OR contract_type IN (
      'indeterminato', 'determinato', 'stage',
      'prestazione_occasionale', 'piva',
      'apprendistato', 'amministratore'
    )),
  ADD COLUMN livello TEXT
    CHECK (livello IS NULL OR livello IN ('6', '5', '4', '3', '2', '1', 'Q'));
