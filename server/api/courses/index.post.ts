// A new course of mine (private and unpublished to start with; making me a teacher the first time).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const c = await createCourse(user.id, (await readBody(event)) ?? {})
  return { id: c.id, slug: c.slug }
})
