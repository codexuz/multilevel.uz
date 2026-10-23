import { eq } from 'drizzle-orm'
import { tests } from '../../../../../database/schema'

// A Writing or Speaking mark given on the board ({ WRITING, SPEAKING }: bands for IELTS, scores for Multilevel).
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  const [t] = await useDb().select({ module: tests.module }).from(tests).where(eq(tests.id, session.testId)).limit(1)
  return setMarks(session, String(getRouterParam(event, 'candidateId')), (await readBody(event)) ?? {}, examOfModule(t?.module))
})
