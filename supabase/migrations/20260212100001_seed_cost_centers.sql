-- Seed: 9 Cost Centers + allocations for 26 members
-- Uses the same user_id as the seed_members migrations

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
  -- Insert 9 cost centers
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'BE', 'Business Expander') RETURNING id INTO v_be;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'COM', 'Comunicazione') RETURNING id INTO v_com;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'HRC', 'HR Consulting') RETURNING id INTO v_hrc;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'GSM', 'Gestione Sale Meeting') RETURNING id INTO v_gsm;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'MKTG', 'Marketing/COM/R&D') RETURNING id INTO v_mktg;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'CCL', 'Ciclotte') RETURNING id INTO v_ccl;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'AFC', 'Amministrazione Finanza e Controllo') RETURNING id INTO v_afc;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'HR', 'Human Resources') RETURNING id INTO v_hr;
  INSERT INTO cost_centers (user_id, code, name) VALUES (v_user_id, 'PRO', 'Sales') RETURNING id INTO v_pro;

  -- Insert allocations (member name -> cost center -> percentage)
  -- Chiara Ballabio: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.name = 'Chiara Ballabio' AND m.user_id = v_user_id;

  -- Benedetta Bianchi: BE 45, HRC 45, MKTG 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 45 FROM members m WHERE m.name = 'Benedetta Bianchi' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_hrc, 45 FROM members m WHERE m.name = 'Benedetta Bianchi' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.name = 'Benedetta Bianchi' AND m.user_id = v_user_id;

  -- Francesca Bosis: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.name = 'Francesca Bosis' AND m.user_id = v_user_id;

  -- Valentina Bucca: BE 55, MKTG 10, PRO 35
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 55 FROM members m WHERE m.name = 'Valentina Bucca' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.name = 'Valentina Bucca' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 35 FROM members m WHERE m.name = 'Valentina Bucca' AND m.user_id = v_user_id;

  -- Mattia Casula: COM 70, MKTG 15, PRO 15
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 70 FROM members m WHERE m.name = 'Mattia Casula' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 15 FROM members m WHERE m.name = 'Mattia Casula' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 15 FROM members m WHERE m.name = 'Mattia Casula' AND m.user_id = v_user_id;

  -- Giordano Coccia: COM 90, MKTG 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 90 FROM members m WHERE m.name = 'Giordano Coccia' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.name = 'Giordano Coccia' AND m.user_id = v_user_id;

  -- Ilaria Colleoni: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.name = 'Ilaria Colleoni' AND m.user_id = v_user_id;

  -- Silvia Cortinovis: BE 80, MKTG 10, PRO 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 80 FROM members m WHERE m.name = 'Silvia Cortinovis' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.name = 'Silvia Cortinovis' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 10 FROM members m WHERE m.name = 'Silvia Cortinovis' AND m.user_id = v_user_id;

  -- Andrea Dick: COM 95, MKTG 5
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 95 FROM members m WHERE m.name = 'Andrea Dick' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 5 FROM members m WHERE m.name = 'Andrea Dick' AND m.user_id = v_user_id;

  -- Francesca Gritti: BE 90, PRO 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 90 FROM members m WHERE m.name = 'Francesca Gritti' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 10 FROM members m WHERE m.name = 'Francesca Gritti' AND m.user_id = v_user_id;

  -- Nicola Lazzaroni: COM 45, MKTG 45, PRO 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 45 FROM members m WHERE m.name = 'Nicola Lazzaroni' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 45 FROM members m WHERE m.name = 'Nicola Lazzaroni' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 10 FROM members m WHERE m.name = 'Nicola Lazzaroni' AND m.user_id = v_user_id;

  -- Chiara Mascheretti: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.name = 'Chiara Mascheretti' AND m.user_id = v_user_id;

  -- Erica Mazzola: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.name = 'Erica Mazzola' AND m.user_id = v_user_id;

  -- Tiziana Moretti: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.name = 'Tiziana Moretti' AND m.user_id = v_user_id;

  -- Marta Nozza Bielli: COM 90, MKTG 5, PRO 5
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 90 FROM members m WHERE m.name = 'Marta Nozza Bielli' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 5 FROM members m WHERE m.name = 'Marta Nozza Bielli' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 5 FROM members m WHERE m.name = 'Marta Nozza Bielli' AND m.user_id = v_user_id;

  -- Cristian Pellegrini: BE 40, MKTG 5, PRO 55
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 40 FROM members m WHERE m.name = 'Cristian Pellegrini' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 5 FROM members m WHERE m.name = 'Cristian Pellegrini' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 55 FROM members m WHERE m.name = 'Cristian Pellegrini' AND m.user_id = v_user_id;

  -- Lisa Pezzali: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.name = 'Lisa Pezzali' AND m.user_id = v_user_id;

  -- Michele Piazza: COM 95, MKTG 5
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 95 FROM members m WHERE m.name = 'Michele Piazza' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 5 FROM members m WHERE m.name = 'Michele Piazza' AND m.user_id = v_user_id;

  -- Lorenzo Piccolo: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.name = 'Lorenzo Piccolo' AND m.user_id = v_user_id;

  -- Giulia Pizzati: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.name = 'Giulia Pizzati' AND m.user_id = v_user_id;

  -- Francesca Poletti: BE 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 100 FROM members m WHERE m.name = 'Francesca Poletti' AND m.user_id = v_user_id;

  -- Consuelo Rocchi: COM 90, MKTG 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 90 FROM members m WHERE m.name = 'Consuelo Rocchi' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.name = 'Consuelo Rocchi' AND m.user_id = v_user_id;

  -- Simone Savoldi: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.name = 'Simone Savoldi' AND m.user_id = v_user_id;

  -- Chiara Simoncelli: COM 100
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 100 FROM members m WHERE m.name = 'Chiara Simoncelli' AND m.user_id = v_user_id;

  -- Annalisa Surini: BE 70, MKTG 10, PRO 20
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_be, 70 FROM members m WHERE m.name = 'Annalisa Surini' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_mktg, 10 FROM members m WHERE m.name = 'Annalisa Surini' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 20 FROM members m WHERE m.name = 'Annalisa Surini' AND m.user_id = v_user_id;

  -- Maddalena Zambaiti: COM 80, CCL 10, PRO 10
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_com, 80 FROM members m WHERE m.name = 'Maddalena Zambaiti' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_ccl, 10 FROM members m WHERE m.name = 'Maddalena Zambaiti' AND m.user_id = v_user_id;
  INSERT INTO member_cost_center_allocations (member_id, cost_center_id, percentage)
    SELECT m.id, v_pro, 10 FROM members m WHERE m.name = 'Maddalena Zambaiti' AND m.user_id = v_user_id;
END $$;
