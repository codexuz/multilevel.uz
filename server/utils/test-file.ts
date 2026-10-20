import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { eq, like } from 'drizzle-orm'
import {
  questionGroups, questionItems, parts, sectionItems, sections, speakingParts, speakingQuestions, tests, writingTasks
} from '../database/schema'

/**
 * A test as one file, the same format the erp-lms IELTS app imports and exports
 * ("erp-lms/ielts-test", version 1; docs/ielts-import there): sections, parts with their question
 * groups and keys, writing tasks and speaking parts. Media are addresses, or data: URIs that are
 * stored on import. A file from erp-lms imports here unchanged, and the other way round.
 */

export const TEST_FILE_FORMAT = 'erp-lms/ielts-test'

/** A title as an address, made unique among the tests. */
export async function uniqueSlug(title: string, exceptId?: string) {
  const db = useDb()
  const base = slugify(title)
  const taken = new Set((await db.select({ slug: tests.slug, id: tests.id }).from(tests).where(like(tests.slug, `${base}%`)))
    .filter(row => row.id !== exceptId).map(row => row.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

const EXT: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm',
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'text/vtt': 'vtt'
}

/** A data: URI is stored as a file and replaced by its address; anything else is kept as it is. */
async function keepEmbedded(ref: unknown, name: string): Promise<string | null> {
  if (typeof ref !== 'string' || !ref) return null
  if (!ref.startsWith('data:')) return ref
  const match = /^data:([\w.+-]+\/[\w.+-]+)(?:;[^,;]*)*;base64,([A-Za-z0-9+/=\s]+)$/.exec(ref)
  if (!match) throw createError({ statusCode: 400, message: `${name}: the embedded file could not be read` })
  const type = match[1]!
  const purpose = type.startsWith('audio/') ? 'tests/audio' : 'tests/assets'
  const key = `${purpose}/shared/${randomUUID()}.${EXT[type] ?? 'bin'}`
  await useS3Client().send(new PutObjectCommand({ Bucket: s3Bucket(), Key: key, Body: Buffer.from(match[2]!, 'base64'), ContentType: type, ACL: 'public-read' }))
  return s3PublicUrl(key)
}

async function keepEmbeddedMedia(test: any) {
  for (const [s, section] of (test.sections ?? []).entries()) {
    if (section.audioRef) section.audioRef = await keepEmbedded(section.audioRef, `section-${s + 1}-audio`)
    for (const [i, item] of (section.items ?? []).entries()) {
      const where = `${String(section.skill ?? '').toLowerCase()}-${i + 1}`
      if (item.part) {
        if (item.part.audioRef) item.part.audioRef = await keepEmbedded(item.part.audioRef, `${where}-audio`)
        if (item.part.transcriptRef) item.part.transcriptRef = await keepEmbedded(item.part.transcriptRef, `${where}-transcript`)
        for (const [g, group] of (item.part.groups ?? []).entries()) {
          if (group?.content?.image) group.content.image = await keepEmbedded(group.content.image, `${where}-group-${g + 1}`)
        }
      }
      if (item.writingTask?.imageRef) item.writingTask.imageRef = await keepEmbedded(item.writingTask.imageRef, `${where}-task`)
      if (item.speakingPart?.imageRef) item.speakingPart.imageRef = await keepEmbedded(item.speakingPart.imageRef, `${where}-picture`)
    }
  }
  return test
}

const strip = ({ id: _i, createdAt: _a, updatedAt: _u, createdById: _b, partId: _p, groupId: _g, ...rest }: any) => rest

/** A test with all its content, without ids, to move between sites or keep as a backup. */
export function exportTest(test: any) {
  return {
    format: TEST_FILE_FORMAT,
    version: 1,
    exportedAt: new Date(),
    test: {
      title: test.title, description: test.description, mode: test.mode, category: test.category, module: test.module, source: test.source,
      sections: (test.sections ?? []).map((section: any) => ({
        skill: section.skill, title: section.title, instructions: section.instructions, durationSeconds: section.durationSeconds,
        audioRef: section.audioRef, settings: section.settings,
        items: (section.items ?? []).map((item: any) => ({
          part: item.part ? { ...strip(item.part), isActive: undefined, groups: item.part.groups.map((group: any) => ({ ...strip(group), items: group.items.map(strip) })) } : undefined,
          writingTask: item.writingTask ? strip(item.writingTask) : undefined,
          speakingPart: item.speakingPart ? { ...strip(item.speakingPart), questions: item.speakingPart.questions.map((q: any) => q.text) } : undefined
        }))
      }))
    }
  }
}

const SKILL_SET = new Set(['LISTENING', 'READING', 'WRITING', 'SPEAKING'])

/** Creates the test a file describes, as a draft. Returns its id. */
export async function importTest(payload: any, userId: string | null) {
  if (payload?.format !== TEST_FILE_FORMAT || !payload.test?.title) throw createError({ statusCode: 400, message: 'This is not a test file (format "erp-lms/ielts-test")' })
  const source = await keepEmbeddedMedia(structuredClone(payload.test))
  for (const section of source.sections ?? []) {
    if (!SKILL_SET.has(section.skill)) throw createError({ statusCode: 400, message: `Unknown section "${section.skill}"` })
  }
  const slug = await uniqueSlug(String(source.title))
  const db = useDb()
  return db.transaction(async (tx) => {
    const [test] = await tx.insert(tests).values({
      slug, title: String(source.title).slice(0, 300), description: source.description ?? null,
      mode: ['PRACTICE', 'MOCK'].includes(source.mode) ? source.mode : 'PRACTICE',
      category: ['AUTHENTIC', 'CAMBRIDGE', 'PRE_TEST', 'CUSTOM'].includes(source.category) ? source.category : null,
      module: 'MULTILEVEL', source: source.source ?? null, createdById: userId
    }).returning({ id: tests.id })
    for (const section of source.sections ?? []) {
      const [created] = await tx.insert(sections).values({
        testId: test!.id, skill: section.skill, position: SECTION_ORDER[section.skill as Skill], title: section.title ?? null,
        instructions: section.instructions ?? null, durationSeconds: section.durationSeconds ?? null, audioRef: section.audioRef ?? null, settings: section.settings ?? {}
      }).returning({ id: sections.id })
      for (const [index, item] of (section.items ?? []).entries()) {
        const link: any = { sectionId: created!.id, position: index + 1 }
        if (item.part) {
          const [part] = await tx.insert(parts).values({
            skill: section.skill, partNumber: Number(item.part.partNumber) || index + 1, title: item.part.title ?? null, passage: item.part.passage ?? null,
            audioRef: item.part.audioRef ?? null, transcriptRef: item.part.transcriptRef ?? null, difficulty: item.part.difficulty ?? null,
            timeLimitMinutes: item.part.timeLimitMinutes ?? null, createdById: userId
          }).returning({ id: parts.id })
          for (const [g, group] of (item.part.groups ?? []).entries()) {
            const [createdGroup] = await tx.insert(questionGroups).values({
              partId: part!.id, position: g + 1, type: String(group.type), instruction: group.instruction ?? null, context: group.context ?? null,
              content: group.content ?? {}, explanation: group.explanation ?? null
            }).returning({ id: questionGroups.id })
            const groupItems = (group.items ?? []).map((q: any, i: number) => ({
              groupId: createdGroup!.id, number: Number(q.number), position: i + 1, prompt: q.prompt ?? null,
              acceptedAnswers: alternativesOf(q.acceptedAnswers), explanation: q.explanation ?? null, evidence: q.evidence ?? null, points: q.points ?? 1
            }))
            if (groupItems.length) await tx.insert(questionItems).values(groupItems)
          }
          link.partId = part!.id
        } else if (item.writingTask) {
          const [task] = await tx.insert(writingTasks).values({
            taskNumber: Number(item.writingTask.taskNumber) || index + 1, module: item.writingTask.module ?? null, title: item.writingTask.title ?? null,
            prompt: item.writingTask.prompt ?? '', imageRef: item.writingTask.imageRef ?? null, minWords: item.writingTask.minWords ?? null,
            suggestedMinutes: item.writingTask.suggestedMinutes ?? null, createdById: userId
          }).returning({ id: writingTasks.id })
          link.writingTaskId = task!.id
        } else if (item.speakingPart) {
          const [part] = await tx.insert(speakingParts).values({
            partNumber: Number(item.speakingPart.partNumber) || index + 1, title: item.speakingPart.title ?? null, cueCard: item.speakingPart.cueCard ?? null,
            imageRef: item.speakingPart.imageRef ?? null, prepSeconds: item.speakingPart.prepSeconds ?? null, speakSeconds: item.speakingPart.speakSeconds ?? null,
            createdById: userId
          }).returning({ id: speakingParts.id })
          const questions = (item.speakingPart.questions ?? []).map((text: unknown, i: number) => ({ partId: part!.id, text: String(text), position: i + 1 }))
          if (questions.length) await tx.insert(speakingQuestions).values(questions)
          link.speakingPartId = part!.id
        } else continue
        await tx.insert(sectionItems).values(link)
      }
    }
    return test!.id
  })
}

/** The test is found by id for staff. */
export async function testIdOrThrow(id: string) {
  const db = useDb()
  const [row] = await db.select({ id: tests.id }).from(tests).where(eq(tests.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Test not found' })
  return row.id
}
