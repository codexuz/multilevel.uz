// The test packs on sale (?exam=IELTS|MULTILEVEL), and which of them I own.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  return listPacks({ exam: getQuery(event).exam, userId: user?.id })
})
