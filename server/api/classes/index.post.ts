// A new class of mine (making me a teacher the first time): its join link is ready to share.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = (await readBody<{ name?: string, exam?: string | null, level?: string | null, description?: string | null }>(event)) ?? {}
  const g = await createClass(user.id, String(body.name ?? ''), { exam: body.exam, level: body.level, description: body.description })
  return { id: g.id, name: g.name, exam: g.exam, level: g.level, description: g.description, joinCode: g.joinCode }
})
