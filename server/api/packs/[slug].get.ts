// One test pack: what is in it, its price, and whether I own it.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  return packBySlug(getRouterParam(event, 'slug')!, user?.id)
})
