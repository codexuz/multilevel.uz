// The results as a spreadsheet: one row a candidate.
export default defineEventHandler(async (event) => {
  const { session } = await requireSession(event, String(getRouterParam(event, 'id')))
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="mock-${session.opensAt.toISOString().slice(0, 10)}.csv"`)
  // A byte-order mark, so Excel reads the names as UTF-8.
  return `\uFEFF${await resultsCsv(session)}`
})
