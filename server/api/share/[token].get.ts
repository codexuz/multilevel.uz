// A shared result's page: what the picture says, for the page and its link preview.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const id = attemptOfToken(token)
  const data = id ? await shareData(id) : null
  if (!data) throw createError({ statusCode: 404, message: 'This shared result is not available' })
  return { ...data, image: `/og/${token}.png` }
})
