// One candidate's evidence: flagged attempts with what was seen, and where they signed in from.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return integrityCase(String(getRouterParam(event, 'userId')))
})
