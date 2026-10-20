// A test file (format "erp-lms/ielts-test"), from erp-lms or an AI-converted book, as a draft.
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  return getTest(await importTest(await readBody(event), user.id))
})
