// In-memory per-user Server-Sent Events registry. A user may have several open
// streams (multiple tabs/devices); publishToUser fans out to all of them.
// Single-process only — for multi-instance deployments back this with Redis pub/sub.

interface Streamable {
  push: (message: string) => Promise<void>
}

const userStreams = new Map<string, Set<Streamable>>()

export function registerStream(userId: string, stream: Streamable) {
  let set = userStreams.get(userId)
  if (!set) {
    set = new Set()
    userStreams.set(userId, set)
  }
  set.add(stream)
}

export function unregisterStream(userId: string, stream: Streamable) {
  const set = userStreams.get(userId)
  if (!set) return
  set.delete(stream)
  if (!set.size) userStreams.delete(userId)
}

export interface UserEvent {
  type: string
  [key: string]: unknown
}

// Push a JSON event to every open stream for a user. No-op if none connected.
export async function publishToUser(userId: string, payload: UserEvent) {
  const set = userStreams.get(userId)
  if (!set || !set.size) return
  const data = JSON.stringify(payload)
  await Promise.all([...set].map(s => s.push(data).catch(() => {})))
}
