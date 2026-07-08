// Unauthenticated liveness probe for load balancers / Coolify health checks.
export default defineEventHandler(() => ({ ok: true, ts: Date.now() }))
