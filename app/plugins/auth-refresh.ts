// Silent token refresh: when any API call 401s, hit /api/auth/refresh once and let
// ofetch retry the original request with the new access cookie.
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  let refreshing: Promise<unknown> | null = null

  globalThis.$fetch = $fetch.create({
    retry: 1,
    retryStatusCodes: [401],
    async onResponseError({ request, response }) {
      const url = typeof request === 'string' ? request : request.url
      if (response.status !== 401 || url.includes('/api/auth/')) return
      // De-dupe concurrent refreshes.
      refreshing ??= $fetch('/api/auth/refresh', { method: 'POST' }).catch(() => null).finally(() => { refreshing = null })
      await refreshing
    }
  })
})
