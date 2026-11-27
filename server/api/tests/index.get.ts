// The open catalog: published PUBLIC tests, newest first, searchable by title and description.
// Staff pickers (class assignments, live mocks) may pass ?includeOwn=1 to also include the signed-in
// teacher's own published private tests (or all published tests for admins).
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const wantOwn = query.includeOwn === '1' || query.includeOwn === 'true'
  if (wantOwn) {
    const user = await optionalUser(event)
    if (user && areaOf(user.role) !== 'student') {
      return listTests(query, {
        publishedOnly: true,
        includeAllVisibility: isAdminUser(user),
        includeOwnTeacherId: isAdminUser(user) ? null : user.id
      })
    }
  }
  return listTests(query, { publishedOnly: true })
})
