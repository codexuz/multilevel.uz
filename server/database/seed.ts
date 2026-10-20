import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import {
  tests, sections, sectionItems, parts, questionGroups, questionItems, writingTasks, speakingParts, speakingQuestions
} from './schema'

// Loads examples/multilevel-practice-test-1.json (the "erp-lms/ielts-test" file format, the same one
// the admin import takes) as a published test. Running it again replaces the sample.
const client = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(client, { schema })

const SLUG = 'multilevel-practice-test-1'
const ORDER: Record<string, number> = { LISTENING: 1, READING: 2, WRITING: 3, SPEAKING: 4 }

async function main() {
  const file = JSON.parse(readFileSync(join(process.cwd(), 'examples/multilevel-practice-test-1.json'), 'utf8'))
  const source = file.test
  console.log(`Seeding "${source.title}"…`)
  await db.delete(tests).where(eq(tests.slug, SLUG))

  await db.transaction(async (tx) => {
    const [test] = await tx.insert(tests).values({
      slug: SLUG, title: source.title, description: source.description, mode: source.mode, category: source.category,
      module: 'MULTILEVEL', source: source.source, status: 'PUBLISHED', publishedAt: new Date()
    }).returning({ id: tests.id })
    for (const section of source.sections) {
      const [s] = await tx.insert(sections).values({
        testId: test!.id, skill: section.skill, position: ORDER[section.skill]!, title: section.title,
        instructions: section.instructions, durationSeconds: section.durationSeconds, audioRef: section.audioRef, settings: section.settings ?? {}
      }).returning({ id: sections.id })
      for (const [index, item] of section.items.entries()) {
        const link: typeof sectionItems.$inferInsert = { sectionId: s!.id, position: index + 1 }
        if (item.part) {
          const [part] = await tx.insert(parts).values({
            skill: section.skill, partNumber: item.part.partNumber, title: item.part.title, passage: item.part.passage, audioRef: item.part.audioRef
          }).returning({ id: parts.id })
          for (const [g, group] of item.part.groups.entries()) {
            const [created] = await tx.insert(questionGroups).values({
              partId: part!.id, position: g + 1, type: group.type, instruction: group.instruction, context: group.context, content: group.content ?? {}
            }).returning({ id: questionGroups.id })
            await tx.insert(questionItems).values(group.items.map((q: any, i: number) => ({
              groupId: created!.id, number: q.number, position: i + 1, prompt: q.prompt, acceptedAnswers: q.acceptedAnswers, evidence: q.evidence, points: q.points ?? 1
            })))
          }
          link.partId = part!.id
        } else if (item.writingTask) {
          const t = item.writingTask
          const [task] = await tx.insert(writingTasks).values({
            taskNumber: t.taskNumber, title: t.title, prompt: t.prompt, imageRef: t.imageRef, minWords: t.minWords, suggestedMinutes: t.suggestedMinutes
          }).returning({ id: writingTasks.id })
          link.writingTaskId = task!.id
        } else if (item.speakingPart) {
          const p = item.speakingPart
          const [part] = await tx.insert(speakingParts).values({
            partNumber: p.partNumber, title: p.title, cueCard: p.cueCard, imageRef: p.imageRef, prepSeconds: p.prepSeconds, speakSeconds: p.speakSeconds
          }).returning({ id: speakingParts.id })
          if (p.questions.length) await tx.insert(speakingQuestions).values(p.questions.map((text: string, i: number) => ({ partId: part!.id, text, position: i + 1 })))
          link.speakingPartId = part!.id
        }
        await tx.insert(sectionItems).values(link)
      }
    }
  })
  console.log(`Done: /tests/${SLUG}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => client.end())
