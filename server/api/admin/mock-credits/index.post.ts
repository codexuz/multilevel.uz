// Mock credits sold (or taken back) to a centre or a teacher: { centreId | userId, credits, note }.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  return grantCredits(admin.id, (await readBody(event)) ?? {})
})
