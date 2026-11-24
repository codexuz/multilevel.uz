const parse = (url: string | null | undefined) => {
  if (!url) return null
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** The id of a YouTube video (watch, youtu.be, embed, shorts or live address), or null. */
export function youtubeId(url: string | null | undefined): string | null {
  const u = parse(url)
  if (!u) return null
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? (/^\/(embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname)?.[2] ?? null)
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null
}

/** Whether the address is a video file a browser plays itself (MP4, WebM, Ogg, MOV). */
export function isVideoFile(url: string | null | undefined): boolean {
  const u = parse(url)
  return !!u && /\.(mp4|m4v|webm|ogv|mov)$/i.test(u.pathname)
}

/**
 * A video address a lesson can show in place: YouTube (as youtube-nocookie) or Vimeo, as an
 * embeddable player address; null for anything else (shown as a link).
 */
export function videoEmbed(url: string | null | undefined): string | null {
  const id = youtubeId(url)
  if (id) return `https://www.youtube-nocookie.com/embed/${id}`
  const u = parse(url)
  if (!u) return null
  const host = u.hostname.replace(/^www\.|^m\./, '')
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = /(\d{5,})/.exec(u.pathname)?.[1]
    if (v) return `https://player.vimeo.com/video/${v}`
  }
  return null
}

/** A time as m:ss (or h:mm:ss). */
export function clockTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** One player plays at a time: each says when it starts, and the others pause. */
export const MEDIA_PLAY_EVENT = 'mockmee:media-play'
