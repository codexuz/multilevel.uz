// The open catalog: published tests, newest first, searchable by title and description.
export default defineEventHandler(event => listTests(getQuery(event), { publishedOnly: true }))
