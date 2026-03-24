-- Seed: 20 new team members + cost center allocations
-- Uses the same user_id as existing seed migrations

DO $$
DECLARE
  v_user_id UUID := 'b3fcad45-d5e9-4dcb-9591-175d78525af5';
  v_be UUID;
  v_com UUID;
  v_hrc UUID;
  v_gsm UUID;
  v_mktg UUID;
  v_ccl UUID;
  v_afc UUID;
  v_hr UUID;
  v_pro UUID;
BEGIN
  -- Look up cost center IDs by code
  SELECT id INTO v_be   FROM cost_centers WHERE code = 'BE'   AND user_id = v_user_id;
  SELECT id INTO v_com  FROM cost_centers WHERE code = 'COM'  AND user_id = v_user_id;
  SELECT id INTO v_hrc  FROM cost_centers WHERE code = 'HRC'  AND user_id = v_user_id;
  SELECT id INTO v_gsm  FROM cost_centers WHERE code = 'GSM'  AND user_id = v_user_id;
  SELECT id INTO v_mktg FROM cost_centers WHERE code = 'MKTG' AND user_id = v_user_id;
  SELECT id INTO v_ccl  FROM cost_centers WHERE code = 'CCL'  AND user_id = v_user_id;
  SELECT id INTO v_afc  FROM cost_centers WHERE code = 'AFC'  AND user_id = v_user_id;
  SELECT id INTO v_hr   FROM cost_centers WHERE code = 'HR'   AND user_id = v_user_id;
  SELECT id INTO v_pro  FROM cost_centers WHERE code = 'PRO'  AND user_id = v_user_id;

  -- Insert 20 new members (post name-split schema: first_name/last_name)
  INSERT INTO members (user_id, first_name, last_name, seniority, days_per_month, utilization, salary) VALUES
    (v_user_id, 'Elena',      'Barcella',     'middle_up', 22, 82, 53750),
    (v_user_id, 'Camilla',    'Battaini',     'middle',    22, 82, 35763),
    (v_user_id, 'Chiara',     'Bernareggi',   'middle',    22, 82, 34823),
    (v_user_id, 'Cristina',   'Bettoni',      'middle',    22, 82, 27873),
    (v_user_id, 'Luca',       'Bonfanti',     'senior',    22, 82, 69637),
    (v_user_id, 'Gian Piero', 'Borgonovo',    'senior',    22, 82, 23000),
    (v_user_id, 'Serena',     'Carminati',    'junior',    22, 82, 31257),
    (v_user_id, 'Roberta',    'Facheris',     'middle',    22, 82, 44003),
    (v_user_id, 'Francesca',  'Gelmi',        'middle',    22, 82, 39554),
    (v_user_id, 'Francesca',  'Gelmini',      'senior',    22, 82, 91637),
    (v_user_id, 'Alessandro', 'Hahn',         'middle',    22, 82, 7680),
    (v_user_id, 'Chiara',     'Moioli',       'senior',    22, 82, 71231),
    (v_user_id, 'Martina',    'Pellicone',    'junior',    22, 82, 31787),
    (v_user_id, 'Angela',     'Pezzoli A.',   'senior',    22, 82, 56425),
    (v_user_id, 'Francesca',  'Pezzoli F.',   'senior',    22, 82, 67809),
    (v_user_id, 'Giovanna',   'Ricuperati',   'senior',    22, 82, 100000),
    (v_user_id, 'Federica',   'Riganti',      'senior',    22, 82, 62579),
    (v_user_id, 'Chiara',     'Rota',         'junior',    22, 82, 8400),
    (v_user_id, 'Erica',      'Salvucci',     'middle',    22, 82, 4000),
    (v_user_id, 'Gaia',       'Seghezzi',     'senior',    22, 82, 57774);

  -- Insert cost center allocations for all 20 new members

  -- Elena Barcella: PRO 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 100 FROM members m WHERE m.first_name = 'Elena' AND m.last_name = 'Barcella' AND m.user_id = v_user_id;

  -- Camilla Battaini: COM 85, PRO 15
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 85 FROM members m WHERE m.first_name = 'Camilla' AND m.last_name = 'Battaini' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 15 FROM members m WHERE m.first_name = 'Camilla' AND m.last_name = 'Battaini' AND m.user_id = v_user_id;

  -- Chiara Bernareggi: HRC 50, HR 50
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_hrc, 50 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Bernareggi' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_hr, 50 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Bernareggi' AND m.user_id = v_user_id;

  -- Cristina Bettoni: CCL 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_ccl, 100 FROM members m WHERE m.first_name = 'Cristina' AND m.last_name = 'Bettoni' AND m.user_id = v_user_id;

  -- Luca Bonfanti: MKTG 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 100 FROM members m WHERE m.first_name = 'Luca' AND m.last_name = 'Bonfanti' AND m.user_id = v_user_id;

  -- Gian Piero Borgonovo: AFC 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_afc, 100 FROM members m WHERE m.first_name = 'Gian Piero' AND m.last_name = 'Borgonovo' AND m.user_id = v_user_id;

  -- Serena Carminati: CCL 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_ccl, 100 FROM members m WHERE m.first_name = 'Serena' AND m.last_name = 'Carminati' AND m.user_id = v_user_id;

  -- Roberta Facheris: COM 10, GSM 85, MKTG 5
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 10 FROM members m WHERE m.first_name = 'Roberta' AND m.last_name = 'Facheris' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_gsm, 85 FROM members m WHERE m.first_name = 'Roberta' AND m.last_name = 'Facheris' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 5 FROM members m WHERE m.first_name = 'Roberta' AND m.last_name = 'Facheris' AND m.user_id = v_user_id;

  -- Francesca Gelmi: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.first_name = 'Francesca' AND m.last_name = 'Gelmi' AND m.user_id = v_user_id;

  -- Francesca Gelmini: PRO 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 100 FROM members m WHERE m.first_name = 'Francesca' AND m.last_name = 'Gelmini' AND m.user_id = v_user_id;

  -- Alessandro Hahn: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.first_name = 'Alessandro' AND m.last_name = 'Hahn' AND m.user_id = v_user_id;

  -- Chiara Moioli: HRC 10, AFC 20, HR 50, PRO 20
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_hrc, 10 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Moioli' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_afc, 20 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Moioli' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_hr, 50 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Moioli' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 20 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Moioli' AND m.user_id = v_user_id;

  -- Martina Pellicone: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.first_name = 'Martina' AND m.last_name = 'Pellicone' AND m.user_id = v_user_id;

  -- Angela Pezzoli A.: COM 10, GSM 20, MKTG 30, PRO 40
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 10 FROM members m WHERE m.first_name = 'Angela' AND m.last_name = 'Pezzoli A.' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_gsm, 20 FROM members m WHERE m.first_name = 'Angela' AND m.last_name = 'Pezzoli A.' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 30 FROM members m WHERE m.first_name = 'Angela' AND m.last_name = 'Pezzoli A.' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 40 FROM members m WHERE m.first_name = 'Angela' AND m.last_name = 'Pezzoli A.' AND m.user_id = v_user_id;

  -- Francesca Pezzoli F.: COM 30, MKTG 10, PRO 60
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 30 FROM members m WHERE m.first_name = 'Francesca' AND m.last_name = 'Pezzoli F.' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.first_name = 'Francesca' AND m.last_name = 'Pezzoli F.' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 60 FROM members m WHERE m.first_name = 'Francesca' AND m.last_name = 'Pezzoli F.' AND m.user_id = v_user_id;

  -- Giovanna Ricuperati: PRO 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 100 FROM members m WHERE m.first_name = 'Giovanna' AND m.last_name = 'Ricuperati' AND m.user_id = v_user_id;

  -- Federica Riganti: COM 60, PRO 40
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 60 FROM members m WHERE m.first_name = 'Federica' AND m.last_name = 'Riganti' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 40 FROM members m WHERE m.first_name = 'Federica' AND m.last_name = 'Riganti' AND m.user_id = v_user_id;

  -- Chiara Rota: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.first_name = 'Chiara' AND m.last_name = 'Rota' AND m.user_id = v_user_id;

  -- Erica Salvucci: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.first_name = 'Erica' AND m.last_name = 'Salvucci' AND m.user_id = v_user_id;

  -- Gaia Seghezzi: PRO 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 100 FROM members m WHERE m.first_name = 'Gaia' AND m.last_name = 'Seghezzi' AND m.user_id = v_user_id;
END $$;
