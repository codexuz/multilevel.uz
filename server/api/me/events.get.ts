import { registerStream, unregisterStream } from '../../utils/events'

// SSE stream of per-user events (e.g. an account being suspended). The client keeps
// this open and reacts to messages; auth comes from the access-token cookie.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const stream = createEventStream(event)

  registerStream(user.id, stream)

  // Heartbeat keeps the connection alive through idle proxies.
  const heartbeat = setInterval(() => {
    stream.push(JSON.stringify({ type: 'ping' })).catch(() => {})
  }, 25000)

  stream.onClosed(async () => {
    clearInterval(heartbeat)
    unregisterStream(user.id, stream)
    await stream.close()
  })

  return stream.send()
})
