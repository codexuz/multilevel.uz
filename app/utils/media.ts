export function youTubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' && u.pathname.startsWith('/embed/')) return url
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v')
      return v ? `https://www.youtube.com/embed/${v}` : null
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
  } catch {}
  return null
}

export function fileNameFromUrl(url?: string | null, fallback = 'File') {
  if (!url) return fallback
  try {
    return decodeURIComponent(url.split('/').pop() || fallback)
  } catch {
    return url.split('/').pop() || fallback
  }
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return ''
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Downloads a file through fetch and saves it from a blob URL, so the browser treats it as a
 * same-origin download instead of navigating to (and warning about) the remote file URL.
 */
export async function downloadAsBlob(url: string, fileName = fileNameFromUrl(url), onProgress?: (percent: number) => void) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status})`)

  let blob: Blob
  const total = Number(res.headers.get('content-length')) || 0
  if (onProgress && total && res.body) {
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress(Math.round((received / total) * 100))
    }
    blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') ?? 'application/octet-stream' })
  } else {
    blob = await res.blob()
  }

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}
