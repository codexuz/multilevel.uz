// The invigilator's board: every candidate's check-in, seat, sections, marks and result.
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  return board(session)
})
