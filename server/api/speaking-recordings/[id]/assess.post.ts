// Enrolled student or course teacher assesses a speaking studio recording (1-5 ratings).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return upsertSpeakingAssessment(user, String(getRouterParam(event, 'id')), (await readBody(event)) ?? {})
})
