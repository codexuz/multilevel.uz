-- ============================================================================
-- Sample published test covering every question type, derived from the shapes in
-- examples/listening_1.html and examples/reading_1.html.
-- Run AFTER 0001_init.sql. Safe to re-run (fixed UUIDs, ON CONFLICT).
-- ============================================================================

-- Test -----------------------------------------------------------------------
insert into public.tests (id, title, description, level, status, is_premium)
values ('a0000000-0000-0000-0000-000000000001',
        'Multilevel Mock Test 1',
        'A full sample exam with Listening, Reading, Writing and Speaking sections.',
        'B2', 'published', false)
on conflict (id) do update set title = excluded.title, status = excluded.status;

-- Sections -------------------------------------------------------------------
insert into public.sections (id, test_id, type, title, duration_minutes, order_index, audio_url) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'listening', 'Listening', 45, 0, null),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'reading',   'Reading',   60, 1, null),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'writing',   'Writing',   60, 2, null),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'speaking',  'Speaking',  15, 3, null)
on conflict (id) do nothing;

-- Parts ----------------------------------------------------------------------
insert into public.parts (id, section_id, title, instructions, content, order_index) values
  -- Listening
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Part 1: Questions 1–3', 'Choose the correct response.', '{}', 0),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Part 2: Questions 4–6', 'Listen and complete the notes with ONE word.', '{}', 1),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Part 3: Questions 7–9', 'Match each speaker (7–9) with the correct opinion (A–D).', '{}', 2),
  -- Reading
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Part 1: Questions 1–3', 'Complete the sentences with ONE word.', '{"passage":"<p>The city library first opened in 1897. Today it holds over two million books and welcomes thousands of visitors every week.</p>"}', 0),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Part 2: Questions 4–6', 'Match each paragraph (4–6) with the correct heading (A–D).', '{"passage":"<p><strong>A</strong> A new beginning<br><strong>B</strong> Facing challenges<br><strong>C</strong> Lasting success<br><strong>D</strong> Early years</p>"}', 1),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Part 3: Questions 7–9', 'Choose the correct answer A, B or C.', '{"passage":"<p>Read the article and answer the questions below.</p>"}', 2),
  -- Writing
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'Writing tasks', 'Complete all three writing tasks.', '{}', 0),
  -- Speaking
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'Speaking parts', 'Answer each speaking prompt.', '{}', 0)
on conflict (id) do nothing;

-- Questions ------------------------------------------------------------------
-- Listening Part 1 — single_choice
insert into public.questions (id, part_id, order_index, question_number, type, prompt, options, correct_answer, points, meta) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 0, 1, 'single_choice',
   'How often does she visit her grandparents?',
   '[{"value":"A","label":"She often does."},{"value":"B","label":"I can''t remember it."},{"value":"C","label":"Everyone knows her."}]',
   '"A"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 1, 2, 'single_choice',
   'Would you like some help?',
   '[{"value":"A","label":"Yes, please."},{"value":"B","label":"I''m afraid not."},{"value":"C","label":"Not bad, thank you."}]',
   '"A"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 2, 3, 'single_choice',
   'How long is the river?',
   '[{"value":"A","label":"About two months."},{"value":"B","label":"It''s quite long."},{"value":"C","label":"Almost 30 kilometres."}]',
   '"C"', 1, '{}'),
  -- Listening Part 2 — text_input
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 0, 4, 'text_input',
   'The meeting starts at ____ o''clock.', '[]', '["nine","9"]', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 1, 5, 'text_input',
   'Bring your ____ to the reception.', '[]', '["passport"]', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 2, 6, 'text_input',
   'The tour lasts about two ____.', '[]', '["hours","hour"]', 1, '{}'),
  -- Listening Part 3 — dropdown_match (pool A–D)
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 0, 7, 'dropdown_match',
   'Speaker 1', '[{"value":"A","label":"A"},{"value":"B","label":"B"},{"value":"C","label":"C"},{"value":"D","label":"D"}]', '"B"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 1, 8, 'dropdown_match',
   'Speaker 2', '[{"value":"A","label":"A"},{"value":"B","label":"B"},{"value":"C","label":"C"},{"value":"D","label":"D"}]', '"D"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 2, 9, 'dropdown_match',
   'Speaker 3', '[{"value":"A","label":"A"},{"value":"B","label":"B"},{"value":"C","label":"C"},{"value":"D","label":"D"}]', '"A"', 1, '{}'),
  -- Reading Part 1 — text_input
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 0, 1, 'text_input',
   'The library opened in the year ____.', '[]', '["1897"]', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 1, 2, 'text_input',
   'It holds over two million ____.', '[]', '["books"]', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 2, 3, 'text_input',
   'It welcomes visitors every ____.', '[]', '["week"]', 1, '{}'),
  -- Reading Part 2 — dropdown_match (pool A–D)
  ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000005', 0, 4, 'dropdown_match',
   'Paragraph 4', '[{"value":"A","label":"A"},{"value":"B","label":"B"},{"value":"C","label":"C"},{"value":"D","label":"D"}]', '"D"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000005', 1, 5, 'dropdown_match',
   'Paragraph 5', '[{"value":"A","label":"A"},{"value":"B","label":"B"},{"value":"C","label":"C"},{"value":"D","label":"D"}]', '"B"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000005', 2, 6, 'dropdown_match',
   'Paragraph 6', '[{"value":"A","label":"A"},{"value":"B","label":"B"},{"value":"C","label":"C"},{"value":"D","label":"D"}]', '"C"', 1, '{}'),
  -- Reading Part 3 — single_choice
  ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000006', 0, 7, 'single_choice',
   'What is the main idea of the article?',
   '[{"value":"A","label":"Libraries are outdated."},{"value":"B","label":"Libraries remain valuable community spaces."},{"value":"C","label":"Books are too expensive."}]',
   '"B"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000006', 1, 8, 'single_choice',
   'According to the writer, libraries should…',
   '[{"value":"A","label":"close on weekends."},{"value":"B","label":"charge higher fees."},{"value":"C","label":"offer digital services."}]',
   '"C"', 1, '{}'),
  ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000006', 2, 9, 'single_choice',
   'The writer''s tone is…',
   '[{"value":"A","label":"positive."},{"value":"B","label":"angry."},{"value":"C","label":"uncertain."}]',
   '"A"', 1, '{}'),
  -- Writing — essays (manual grading)
  ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000007', 0, 1, 'essay',
   'Task 1.1 — You received this email from a friend. Write a short reply (about 60 words).',
   '[]', null, 6, '{"taskLabel":"1.1","wordLimit":80}'),
  ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000007', 1, 2, 'essay',
   'Task 1.2 — Write a note to a colleague explaining why you will be late (about 60 words).',
   '[]', null, 6, '{"taskLabel":"1.2","wordLimit":80}'),
  ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000007', 2, 3, 'essay',
   'Task 2 — Some people think technology makes life easier; others disagree. Discuss both views and give your opinion (about 250 words).',
   '[]', null, 12, '{"taskLabel":"2","wordLimit":300}'),
  -- Speaking — prompts (manual grading)
  ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000008', 0, 1, 'speaking_prompt',
   'Part 1.1 — Tell me about your hometown.', '[]', null, 5, '{"taskLabel":"1.1","prepTime":10,"speakTime":45}'),
  ('d0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000008', 1, 2, 'speaking_prompt',
   'Part 1.2 — Describe a hobby you enjoy and why.', '[]', null, 5, '{"taskLabel":"1.2","prepTime":10,"speakTime":45}'),
  ('d0000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000008', 2, 3, 'speaking_prompt',
   'Part 2 — Compare the two photographs and say which situation you would prefer.', '[]', null, 8, '{"taskLabel":"2","prepTime":60,"speakTime":90}'),
  ('d0000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000008', 3, 4, 'speaking_prompt',
   'Part 3 — Do you think people rely too much on technology? Explain your view.', '[]', null, 8, '{"taskLabel":"3","prepTime":60,"speakTime":120}')
on conflict (id) do nothing;
