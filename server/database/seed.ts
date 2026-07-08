import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema'
import { tests, sections, parts, questions } from './schema'

const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client, { schema })

async function main() {
  console.log('Seeding sample test…')

  // Idempotent: clear the sample test if present, then re-insert.
  const TEST_ID = 'a0000000-0000-0000-0000-000000000001'
  await db.delete(tests).where(sql`${tests.id} = ${TEST_ID}`)

  await db.insert(tests).values({
    id: TEST_ID,
    title: 'Multilevel Mock Test 1',
    description: 'A full sample exam with Listening, Reading, Writing and Speaking sections.',
    level: 'B2',
    status: 'published',
    isPremium: false
  })

  const [listening, reading, writing, speaking] = await db.insert(sections).values([
    { testId: TEST_ID, type: 'listening', title: 'Listening', durationMinutes: 45, orderIndex: 0 },
    { testId: TEST_ID, type: 'reading', title: 'Reading', durationMinutes: 60, orderIndex: 1 },
    { testId: TEST_ID, type: 'writing', title: 'Writing', durationMinutes: 60, orderIndex: 2 },
    { testId: TEST_ID, type: 'speaking', title: 'Speaking', durationMinutes: 15, orderIndex: 3 }
  ]).returning()

  // Listening parts
  const [lp1, lp2, lp3] = await db.insert(parts).values([
    { sectionId: listening!.id, title: 'Part 1: Questions 1–3', instructions: 'Choose the correct response.', orderIndex: 0 },
    { sectionId: listening!.id, title: 'Part 2: Questions 4–6', instructions: 'Complete the notes with ONE word.', orderIndex: 1 },
    { sectionId: listening!.id, title: 'Part 3: Questions 7–9', instructions: 'Match each speaker (7–9) with an opinion (A–D).', orderIndex: 2 }
  ]).returning()

  // Reading parts
  const [rp1, rp2, rp3, rp4] = await db.insert(parts).values([
    { sectionId: reading!.id, title: 'Part 1: Questions 1–3', instructions: 'Complete the sentences with ONE word.', orderIndex: 0, content: { passage: '<p>The city library first opened in 1897. Today it holds over two million books and welcomes thousands of visitors every week.</p>' } },
    { sectionId: reading!.id, title: 'Part 2: Questions 4–6', instructions: 'Match each paragraph (4–6) with a heading (A–D).', orderIndex: 1, content: { passage: '<p><strong>A</strong> A new beginning<br><strong>B</strong> Facing challenges<br><strong>C</strong> Lasting success<br><strong>D</strong> Early years</p>' } },
    { sectionId: reading!.id, title: 'Part 3: Questions 7–9', instructions: 'Choose the correct answer A, B or C.', orderIndex: 2, content: { passage: '<p>Read the article and answer the questions below.</p>' } },
    // Part 4 demonstrates grouped completions (summary + table) rendered by CompletionGroup.
    {
      sectionId: reading!.id,
      title: 'Part 4: Questions 10–16',
      instructions: 'Complete the summary and table below.',
      orderIndex: 3,
      content: {
        passage: '<p>Coastal erosion has reshaped the village of Hallsands over the past century. Heavy storms, the removal of offshore shingle and rising sea levels each played a part in the loss of the original settlement.</p>',
        groups: [
          {
            kind: 'summary_completion',
            heading: 'Complete the summary below. Write ONE WORD ONLY from the passage for each answer.',
            template: 'The village was damaged mainly by powerful {{10}}, made worse after offshore {{11}} was removed for building work. As a result the {{12}} rose and gradually washed away the {{13}} that protected the houses.'
          },
          {
            kind: 'table_completion',
            heading: 'Complete the table below. Write NO MORE THAN TWO WORDS for each answer.',
            columns: ['Year', 'Event'],
            rows: [
              ['1897', 'Shingle dredging began near the {{14}}.'],
              ['1917', 'A severe {{15}} destroyed most of the houses.'],
              ['Today', 'The site is a protected {{16}}.']
            ]
          }
        ]
      }
    }
  ]).returning()

  const [wp] = await db.insert(parts).values([
    { sectionId: writing!.id, title: 'Writing tasks', instructions: 'Complete all three writing tasks.', orderIndex: 0 }
  ]).returning()

  const [sp] = await db.insert(parts).values([
    { sectionId: speaking!.id, title: 'Speaking parts', instructions: 'Answer each speaking prompt.', orderIndex: 0 }
  ]).returning()

  const pool = [
    { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
    { value: 'C', label: 'C' }, { value: 'D', label: 'D' }
  ]

  await db.insert(questions).values([
    // Listening P1 single_choice
    { partId: lp1!.id, orderIndex: 0, questionNumber: 1, type: 'single_choice', prompt: 'How often does she visit her grandparents?', options: [{ value: 'A', label: 'She often does.' }, { value: 'B', label: "I can't remember it." }, { value: 'C', label: 'Everyone knows her.' }], correctAnswer: 'A', points: '1' },
    { partId: lp1!.id, orderIndex: 1, questionNumber: 2, type: 'single_choice', prompt: 'Would you like some help?', options: [{ value: 'A', label: 'Yes, please.' }, { value: 'B', label: "I'm afraid not." }, { value: 'C', label: 'Not bad, thank you.' }], correctAnswer: 'A', points: '1' },
    { partId: lp1!.id, orderIndex: 2, questionNumber: 3, type: 'single_choice', prompt: 'How long is the river?', options: [{ value: 'A', label: 'About two months.' }, { value: 'B', label: "It's quite long." }, { value: 'C', label: 'Almost 30 kilometres.' }], correctAnswer: 'C', points: '1' },
    // Listening P2 text_input
    { partId: lp2!.id, orderIndex: 0, questionNumber: 4, type: 'text_input', prompt: 'The meeting starts at ____ o\'clock.', correctAnswer: ['nine', '9'], points: '1' },
    { partId: lp2!.id, orderIndex: 1, questionNumber: 5, type: 'text_input', prompt: 'Bring your ____ to the reception.', correctAnswer: ['passport'], points: '1' },
    { partId: lp2!.id, orderIndex: 2, questionNumber: 6, type: 'text_input', prompt: 'The tour lasts about two ____.', correctAnswer: ['hours', 'hour'], points: '1' },
    // Listening P3 dropdown_match
    { partId: lp3!.id, orderIndex: 0, questionNumber: 7, type: 'dropdown_match', prompt: 'Speaker 1', options: pool, correctAnswer: 'B', points: '1' },
    { partId: lp3!.id, orderIndex: 1, questionNumber: 8, type: 'dropdown_match', prompt: 'Speaker 2', options: pool, correctAnswer: 'D', points: '1' },
    { partId: lp3!.id, orderIndex: 2, questionNumber: 9, type: 'dropdown_match', prompt: 'Speaker 3', options: pool, correctAnswer: 'A', points: '1' },
    // Reading P1 text_input
    { partId: rp1!.id, orderIndex: 0, questionNumber: 1, type: 'text_input', prompt: 'The library opened in the year ____.', correctAnswer: ['1897'], points: '1' },
    { partId: rp1!.id, orderIndex: 1, questionNumber: 2, type: 'text_input', prompt: 'It holds over two million ____.', correctAnswer: ['books'], points: '1' },
    { partId: rp1!.id, orderIndex: 2, questionNumber: 3, type: 'text_input', prompt: 'It welcomes visitors every ____.', correctAnswer: ['week'], points: '1' },
    // Reading P2 dropdown_match
    { partId: rp2!.id, orderIndex: 0, questionNumber: 4, type: 'dropdown_match', prompt: 'Paragraph 4', options: pool, correctAnswer: 'D', points: '1' },
    { partId: rp2!.id, orderIndex: 1, questionNumber: 5, type: 'dropdown_match', prompt: 'Paragraph 5', options: pool, correctAnswer: 'B', points: '1' },
    { partId: rp2!.id, orderIndex: 2, questionNumber: 6, type: 'dropdown_match', prompt: 'Paragraph 6', options: pool, correctAnswer: 'C', points: '1' },
    // Reading P3 single_choice
    { partId: rp3!.id, orderIndex: 0, questionNumber: 7, type: 'single_choice', prompt: 'What is the main idea of the article?', options: [{ value: 'A', label: 'Libraries are outdated.' }, { value: 'B', label: 'Libraries remain valuable community spaces.' }, { value: 'C', label: 'Books are too expensive.' }], correctAnswer: 'B', points: '1' },
    { partId: rp3!.id, orderIndex: 1, questionNumber: 8, type: 'single_choice', prompt: 'According to the writer, libraries should…', options: [{ value: 'A', label: 'close on weekends.' }, { value: 'B', label: 'charge higher fees.' }, { value: 'C', label: 'offer digital services.' }], correctAnswer: 'C', points: '1' },
    { partId: rp3!.id, orderIndex: 2, questionNumber: 9, type: 'single_choice', prompt: "The writer's tone is…", options: [{ value: 'A', label: 'positive.' }, { value: 'B', label: 'angry.' }, { value: 'C', label: 'uncertain.' }], correctAnswer: 'A', points: '1' },
    // Reading P4 grouped completions (blanks referenced by {{n}} in rp4.content.groups)
    { partId: rp4!.id, orderIndex: 0, questionNumber: 10, type: 'text_input', correctAnswer: ['storms', 'storm'], points: '1' },
    { partId: rp4!.id, orderIndex: 1, questionNumber: 11, type: 'text_input', correctAnswer: ['shingle'], points: '1' },
    { partId: rp4!.id, orderIndex: 2, questionNumber: 12, type: 'text_input', correctAnswer: ['sea'], points: '1' },
    { partId: rp4!.id, orderIndex: 3, questionNumber: 13, type: 'text_input', correctAnswer: ['beach'], points: '1' },
    { partId: rp4!.id, orderIndex: 4, questionNumber: 14, type: 'text_input', correctAnswer: ['village'], points: '1' },
    { partId: rp4!.id, orderIndex: 5, questionNumber: 15, type: 'text_input', correctAnswer: ['storm'], points: '1' },
    { partId: rp4!.id, orderIndex: 6, questionNumber: 16, type: 'text_input', correctAnswer: ['site'], points: '1' },
    // Writing essays
    { partId: wp!.id, orderIndex: 0, questionNumber: 1, type: 'essay', prompt: 'Task 1.1 — You received an email from a friend. Write a short reply (about 60 words).', points: '6', meta: { taskLabel: '1.1', wordLimit: 80 } },
    { partId: wp!.id, orderIndex: 1, questionNumber: 2, type: 'essay', prompt: 'Task 1.2 — Write a note to a colleague explaining why you will be late (about 60 words).', points: '6', meta: { taskLabel: '1.2', wordLimit: 80 } },
    { partId: wp!.id, orderIndex: 2, questionNumber: 3, type: 'essay', prompt: 'Task 2 — Some people think technology makes life easier; others disagree. Discuss both views and give your opinion (about 250 words).', points: '12', meta: { taskLabel: '2', wordLimit: 300 } },
    // Speaking prompts
    { partId: sp!.id, orderIndex: 0, questionNumber: 1, type: 'speaking_prompt', prompt: 'Part 1.1 — Tell me about your hometown.', points: '5', meta: { taskLabel: '1.1', prepTime: 10, speakTime: 45 } },
    { partId: sp!.id, orderIndex: 1, questionNumber: 2, type: 'speaking_prompt', prompt: 'Part 1.2 — Describe a hobby you enjoy and why.', points: '5', meta: { taskLabel: '1.2', prepTime: 10, speakTime: 45 } },
    { partId: sp!.id, orderIndex: 2, questionNumber: 3, type: 'speaking_prompt', prompt: 'Part 2 — Compare the two photographs and say which situation you would prefer.', points: '8', meta: { taskLabel: '2', prepTime: 60, speakTime: 90 } },
    { partId: sp!.id, orderIndex: 3, questionNumber: 4, type: 'speaking_prompt', prompt: 'Part 3 — Do you think people rely too much on technology? Explain your view.', points: '8', meta: { taskLabel: '3', prepTime: 60, speakTime: 120 } }
  ])

  console.log('✅ Seed complete.')
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
