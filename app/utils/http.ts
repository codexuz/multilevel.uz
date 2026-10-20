/** Media is stored at public addresses, so a stored reference is already playable. */
export function mediaUrl(url?: string | null) {
  return url || ''
}

/** What went wrong, in words: the server's message when it sent one. */
export function errorMessage(e: unknown, fallback = 'Something went wrong') {
  const data = (e as { data?: { message?: string } } | null)?.data
  if (data?.message) return data.message
  return e instanceof Error && e.message ? e.message : fallback
}
