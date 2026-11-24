/**
 * A video address a lesson can show in place: YouTube (as youtube-nocookie) or Vimeo, as an
 * embeddable player address; null for anything else (shown as a link).
 */
export function videoEmbed(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? (/^\/(embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname)?.[2] ?? null)
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = /(\d{5,})/.exec(u.pathname)?.[1]
    if (v) return `https://player.vimeo.com/video/${v}`
  }
  return null
}
