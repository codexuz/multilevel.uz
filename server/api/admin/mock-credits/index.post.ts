// Mock credits sold (or taken back) to a teacher: { userId, credits, note }.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  return grantCredits(admin.id, (await readBody(event)) ?? {})
})
