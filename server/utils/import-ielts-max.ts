import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { courseLessons, courseModules, courses, exerciseQuestions, lessonExercises } from '../database/schema'

/**
 * Imports the IELTS Max 24-day course (github.com/codexuz/ielts-course, src/data/seed) as one Mockmee
 * course: a topic per day, each with its lessons:
 * - Grammar: a quiz of the day's five corrections, verb forms and sentence joins (marked
 *   automatically), and on days 1–14 the second "challenge" set as practice;
 * - Podcast: the audio and the transcription task, with the transcript folded away to check against;
 * - Article: the text and the summary task;
 * - Video: the TED-Ed video and its gap-fill (a marked quiz on the days with an answer key);
 * - Speaking: the Part 1–3 questions, the cue card task, the PDF, and the vocabulary exercise (a
 *   marked quiz where keyed);
 * - Writing: the Task 1 or Task 2 prompt, its charts and what to check (test days instead point to a
 *   mock test);
 * - Film & cartoon: the short film, its words, the cartoon's words and a model summary.
 * Lessons open one after another, as in IELTS Max. The course starts as a private draft for its
 * owner to review and publish. The articles, videos and audio are the original's (third parties'):
 * check the rights before making it public.
 */

const SOURCE = (process.env.IELTS_MAX_SOURCE || 'https://raw.githubusercontent.com/codexuz/ielts-course/main/src/data/seed').replace(/\/$/, '')
export const IELTS_MAX_TITLE = 'IELTS Max: the 24-day intensive'

interface GrammarItem { t: string, q: string, start?: string, a: string[], why?: string }
interface Day {
  n: number
  data: {
    title: string
    grammar: GrammarItem[]
    podcast: { title?: string, note?: string, audio?: string, end?: number, lines?: { t: number, text: string }[] }
    article: { title?: string, task?: string, text?: string }
    video: { url?: string, title?: string, note?: string, segments?: string[] }
    speaking: { url?: string, title?: string, task?: string, text?: string, maxMin?: number, segments?: string[] }
    writing: { type?: string, prompt?: string, check?: string, image?: string, images?: string[], minWords?: number }
  }
}
interface Films { films: { title: string, yt: string, words: [string, string][] }[], cartoons: [string, string][][] }
interface Keys { n: number, answers: string[], speak_answers: string[] }
/** A question before it belongs to a quiz. */
type QuestionDraft = Omit<typeof exerciseQuestions.$inferInsert, 'exerciseId'>

async function load<T>(file: string): Promise<T> {
  const res = await fetch(`${SOURCE}/${file}`, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw createError({ statusCode: 502, message: `Could not read ${file} from the IELTS Max data (${res.status})` })
  return await res.json() as T
}

// ---- text into the lesson's rich text (the sanitizer keeps p, br, strong, em, h2, h3, ul, ol, li, a) ----
const siteUrl = () => String(useRuntimeConfig().public.siteUrl || 'https://mockmee.uz').replace(/\/$/, '')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const paras = (text: string) => text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
const link = (href: string, label: string) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`
const list = (items: string[]) => (items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '')
/** A gap-fill text with numbered blanks, for days without an answer key. */
const withBlanks = (segments: string[]) => segments.map((s, i) => esc(s) + (i < segments.length - 1 ? `<strong>(${i + 1}) ________</strong>` : '')).join('').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
/** The same text with {{1}}, {{2}} gaps, for a marked quiz. */
const withGaps = (segments: string[]) => segments.map((s, i) => s + (i < segments.length - 1 ? `{{${i + 1}}}` : '')).join('')

function grammarQuestion(g: GrammarItem): QuestionDraft {
  const start = g.start ? ` Start with: “${g.start}…”` : ''
  const prompt = g.t === 'correct'
    ? `Correct the mistake in this sentence: “${g.q}”`
    : g.t === 'verb'
      ? `Put the verb in brackets in the right form: ${g.q}`
      : g.t === 'combine'
        ? `Join the sentences into one: “${g.q}”${start}`
        : g.t === 'paraphrase' || g.t === 'rewrite'
          ? `Say it another way, keeping the meaning: “${g.q}”${start}`
          : g.q
  return { type: 'SHORT_ANSWER', prompt, context: null, config: { placeholder: g.t === 'verb' ? 'The verb' : 'The whole sentence' }, acceptedAnswers: g.a, explanation: g.why || null, points: 1 }
}

export async function importIeltsMax(ownerId: string) {
  const [days, grammar2, films, filmSamples, keys] = await Promise.all([
    load<Day[]>('days.json'),
    load<Record<string, GrammarItem[]>>('grammar2.json'),
    load<Films>('films.json'),
    load<string[][]>('film_samples.json'),
    load<Keys[]>('answer_keys.json')
  ])
  const db = useDb()
  const [existing] = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.teacherId, ownerId), eq(courses.title, IELTS_MAX_TITLE))).limit(1)
  if (existing) throw createError({ statusCode: 409, message: 'This account already has the IELTS Max course', data: { id: existing.id } })

  const keyOf = new Map(keys.map(k => [k.n, k]))
  const sorted = [...days].sort((a, b) => a.n - b.n)

  return await db.transaction(async (tx) => {
    const [course] = await tx.insert(courses).values({
      teacherId: ownerId,
      title: IELTS_MAX_TITLE,
      slug: `ielts-max-24-day-intensive-${randomBytes(3).toString('hex')}`,
      summary: 'Twenty-four themed days of grammar, podcasts, articles, TED-Ed videos, speaking and IELTS writing, building to Band 6.5+.',
      description: [
        '<p>Every day of the course works all four skills on real material: a podcast to transcribe, an article to summarise, a TED-Ed video to complete, an IELTS Speaking set with a cue card to record, and an IELTS Writing task. Each day ends with a short film and a cartoon to talk about.</p>',
        '<p>Grammar comes first each day: five sentences to correct, complete or join, marked as you hand them in. Days 6, 12, 18 and 24 are test days: take a full IELTS Listening and Reading mock test.</p>',
        '<p>Lessons open one after another: finish a lesson to open the next.</p>'
      ].join(''),
      exam: 'IELTS',
      level: 'B1',
      visibility: 'PRIVATE',
      published: false,
      dripMode: 'SEQUENTIAL',
      passingScore: 60,
      outcomes: [
        'Write IELTS Task 1 reports and Task 2 essays with clear introductions, paragraphs and conclusions',
        'Answer IELTS Speaking Parts 1–3 and speak for two minutes on a cue card',
        'Understand podcasts and TED-Ed talks well enough to write them down',
        'Summarise long articles in your own words',
        'Use common phrasal verbs, idioms and topic vocabulary accurately',
        'Avoid the grammar mistakes that cost the most marks'
      ],
      requirements: ['English at about B1 (intermediate) level', 'About 2 hours a day', 'Headphones and a microphone for listening and speaking'],
      audience: ['IELTS candidates aiming for Band 6.5 or higher', 'Intermediate learners who want a daily routine with real-world English']
    }).returning()

    const lessonsOf = async (moduleId: string, items: (typeof courseLessons.$inferInsert & { quizzes?: { title: string, type: string, required: boolean, instructions?: string, questions: QuestionDraft[] }[] })[]) => {
      for (const [i, item] of items.entries()) {
        const { quizzes, ...lesson } = item
        const body = lesson.body ? sanitizeRichText(lesson.body) : null
        const [l] = await tx.insert(courseLessons).values({ ...lesson, body, courseId: course!.id, moduleId, position: i + 1 }).returning({ id: courseLessons.id })
        for (const [qi, quiz] of (quizzes ?? []).entries()) {
          const [ex] = await tx.insert(lessonExercises).values({
            lessonId: l!.id, position: qi + 1, title: quiz.title, instructions: quiz.instructions ?? null,
            exerciseType: quiz.type, passingScore: 60, requiredForCompletion: quiz.required, showFeedback: 'AFTER_SUBMIT'
          }).returning({ id: lessonExercises.id })
          if (quiz.questions.length) await tx.insert(exerciseQuestions).values(quiz.questions.map((q, n) => ({ ...q, exerciseId: ex!.id, position: n + 1 })))
        }
      }
    }

    let lessonCount = 0
    let quizCount = 0
    for (const day of sorted) {
      const d = day.data
      const n = day.n
      const testDay = [6, 12, 18, 24].includes(n)
      const [mod] = await tx.insert(courseModules).values({
        courseId: course!.id, position: n, title: `Day ${n}: ${d.title}`,
        description: testDay ? 'A test day: the usual daily work, then a full IELTS Listening and Reading mock test.' : null
      }).returning({ id: courseModules.id })
      const key = keyOf.get(n)
      const items: Parameters<typeof lessonsOf>[1] = []

      // Grammar
      const g2 = grammar2[String(n)] ?? []
      items.push({
        title: 'Grammar', durationMinutes: 15, courseId: course!.id,
        summary: 'Five sentences to correct, complete or join.',
        body: '<p>Correct each sentence, put the verb in the right form, or join two sentences into one. Write the whole sentence where asked. Your answers are marked when you hand them in, with an explanation for each.</p>',
        quizzes: [
          { title: `Day ${n} grammar`, type: 'QUIZ', required: true, questions: d.grammar.map(grammarQuestion) },
          ...(g2.length ? [{ title: `Day ${n} grammar challenge`, type: 'PRACTICE', required: false, instructions: 'A second set for the slower, 48-day pace.', questions: g2.map(grammarQuestion) }] : [])
        ]
      })

      // Podcast
      if (d.podcast?.audio) {
        const minutes = d.podcast.end ? Math.ceil(d.podcast.end / 60) : 6
        items.push({
          title: `Podcast${d.podcast.title ? `: ${d.podcast.title}` : ''}`, durationMinutes: minutes * 4, courseId: course!.id,
          summary: 'Listen and write down what the speakers say.',
          body: [
            paras(d.podcast.note || 'Listen as many times as you need and write down everything the speakers say, word for word.'),
            `<p>${link(d.podcast.audio, 'Listen to the podcast (MP3)')}</p>`,
            d.podcast.lines?.length ? `<details><summary>Show the transcript (when you have finished)</summary>${d.podcast.lines.map(l => `<p>${esc(l.text)}</p>`).join('')}</details>` : ''
          ].join('')
        })
      }

      // Article
      if (d.article?.text) {
        items.push({
          title: `Article${d.article.title ? `: ${d.article.title}` : ''}`, durationMinutes: 30, courseId: course!.id,
          summary: 'Read the article and summarise it in about 150 words.',
          body: [d.article.task ? `<h3>Your task</h3>${paras(d.article.task)}` : '', '<h3>The article</h3>', paras(d.article.text)].join('')
        })
      }

      // Video
      if (d.video?.url) {
        const segs = d.video.segments ?? []
        const keyed = key && segs.length - 1 === key.answers.length
        items.push({
          title: `Video${d.video.title ? `: ${d.video.title}` : ''}`, durationMinutes: 20, courseId: course!.id, videoUrl: d.video.url,
          summary: 'Watch and fill in the missing words.',
          body: [
            paras(d.video.note || 'Watch the video and fill in the missing words.'),
            segs.length > 1 && !keyed ? `<h3>Fill in the gaps</h3>${withBlanks(segs)}` : ''
          ].join(''),
          quizzes: keyed
            ? [{ title: 'Video gap-fill', type: 'QUIZ', required: false, questions: [{ type: 'SUMMARY_COMPLETION', prompt: 'Watch the video and type the missing words.', context: withGaps(segs), config: { wordLimit: 3 }, acceptedAnswers: Object.fromEntries(key!.answers.map((a, i) => [String(i + 1), [a]])), explanation: null, points: key!.answers.length } as QuestionDraft] }]
            : []
        })
      }

      // Speaking
      if (d.speaking?.text || d.speaking?.task) {
        const segs = d.speaking.segments ?? []
        const keyed = key && segs.length - 1 === key.speak_answers.length
        items.push({
          title: `Speaking${d.speaking.title ? `: ${d.speaking.title}` : ''}`, durationMinutes: 30, courseId: course!.id,
          summary: 'IELTS Speaking Parts 1–3 and a cue card to record.',
          body: [
            d.speaking.task ? `<h3>Your task</h3>${paras(d.speaking.task)}` : '',
            d.speaking.url ? `<p>${link(d.speaking.url, 'Open the speaking file (PDF)')}</p>` : '',
            d.speaking.text ? `<h3>Questions</h3>${paras(d.speaking.text)}` : '',
            segs.length > 1 && !keyed ? `<h3>Vocabulary</h3>${withBlanks(segs)}` : ''
          ].join(''),
          quizzes: keyed
            ? [{ title: 'Speaking vocabulary', type: 'QUIZ', required: false, questions: [{ type: 'NOTE_COMPLETION', prompt: 'Fill in each gap with the right word or phrase.', context: withGaps(segs), config: { wordLimit: 4 }, acceptedAnswers: Object.fromEntries(key!.speak_answers.map((a, i) => [String(i + 1), [a]])), explanation: null, points: key!.speak_answers.length } as QuestionDraft] }]
            : []
        })
      }

      // Writing, or the test day's mock test
      if (d.writing?.prompt) {
        const task = d.writing.type === 'task1' ? 'Task 1' : 'Task 2'
        const images = [...new Set([...(d.writing.images ?? []), ...(d.writing.image ? [d.writing.image] : [])])]
        items.push({
          title: `Writing: IELTS ${task}`, durationMinutes: task === 'Task 1' ? 25 : 45, courseId: course!.id,
          summary: task === 'Task 1' ? 'Describe the chart in an IELTS Task 1 report.' : 'Write an IELTS Task 2 essay.',
          body: [
            '<h3>Your task</h3>', paras(d.writing.prompt),
            images.length ? `<h3>The charts</h3>${list(images.map((u, i) => link(u, `Chart ${i + 1}`)))}` : '',
            d.writing.check ? `<h3>Check</h3>${paras(d.writing.check)}` : '',
            d.writing.minWords ? `<p>Write at least ${d.writing.minWords} words.</p>` : ''
          ].join('')
        })
      } else if (testDay) {
        items.push({
          title: 'Mock test', durationMinutes: 120, courseId: course!.id,
          summary: 'A full IELTS Listening and Reading mock test.',
          body: `<p>Today is a test day. Take a full IELTS Listening and Reading mock test in the ${link(`${siteUrl()}/tests?exam=IELTS`, 'test catalogue')}, as on the real day: one sitting, no pauses.</p>`
        })
      }

      // Film & cartoon
      const film = films.films[n - 1]
      const cartoon = films.cartoons[n - 1] ?? []
      const sample = filmSamples[n - 1] ?? []
      if (film?.yt) {
        items.push({
          title: `Film: ${film.title}`, durationMinutes: 20, courseId: course!.id, videoUrl: `https://www.youtube.com/watch?v=${film.yt}`,
          summary: 'A short film and a cartoon to talk about.',
          body: [
            '<p>Watch the short film, then retell it in a few sentences using the words below. Then describe the cartoon and say what it means.</p>',
            film.words?.length ? `<h3>Film words</h3>${list(film.words.map(([w, m]) => `<strong>${esc(w)}</strong>: ${esc(m)}`))}` : '',
            cartoon.length ? `<h3>Cartoon words</h3>${list(cartoon.map(([w, m]) => `<strong>${esc(w)}</strong>: ${esc(m)}`))}` : '',
            sample.length ? `<details><summary>Show the model answers</summary>${sample.map(s => paras(s)).join('')}</details>` : ''
          ].join('')
        })
      }

      await lessonsOf(mod!.id, items)
      lessonCount += items.length
      quizCount += items.reduce((c, i) => c + (i.quizzes?.length ?? 0), 0)
    }
    return { id: course!.id, slug: course!.slug, days: sorted.length, lessons: lessonCount, quizzes: quizCount }
  })
}
