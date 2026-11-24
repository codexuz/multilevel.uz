import { randomUUID } from 'node:crypto'

// A student account becomes a teacher's: it opens the Teacher panel from now on (and no longer the
// student app). Its results and words are kept. A new access token carries the new role at once.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (areaOf(user.role) !== 'student') return { role: user.role }
  await raiseToTeacher(useDb(), user.id)
  setAccessCookie(event, await signAccessToken(user.id, 'teacher', randomUUID()))
  return { role: 'teacher' }
})
