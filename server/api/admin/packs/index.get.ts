// Every test pack, on sale or not, with the tests in it (drafts too).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listPacks({ all: true, staff: true })
})
