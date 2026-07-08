// Helpers for video sources that may be a direct file URL or a YouTube link.

// Extract the 11-char YouTube video id from any common YouTube URL form
// (watch?v=, youtu.be/, /embed/, /shorts/). Returns null if not a YouTube URL.
export function youtubeId(url?: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/|\/live\/)([\w-]{11})/)
  return m ? m[1]! : null
}

export function isYoutubeUrl(url?: string | null): boolean {
  return youtubeId(url) !== null
}

// Privacy-friendly nocookie embed URL, or null if the input isn't YouTube.
export function youtubeEmbedUrl(url?: string | null): string | null {
  const id = youtubeId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
}
