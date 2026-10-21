// The picture of a shared result, /og/<token>.png, for link previews and to save.
export default defineEventHandler(async (event) => {
  const file = String(getRouterParam(event, 'file') ?? '')
  const id = file.endsWith('.png') ? attemptOfToken(file.slice(0, -4)) : null
  const data = id ? await shareData(id) : null
  if (!data) throw createError({ statusCode: 404, message: 'Not found' })
  const png = await renderShareCard(data)
  setResponseHeaders(event, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' })
  return png
})
