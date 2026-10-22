/**
 * Talking to this app's API, in the shape the components ported from the erp-lms IELTS app expect
 * (services/http.ts there). Sign-in travels in cookies, so a call is $fetch on the same origin;
 * plugins/auth-refresh.ts renews an expired session once and retries.
 */

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function request<T>(options: { url: string, method?: Method, content?: unknown }): Promise<T> {
  // Rendered on the server, the call carries the visitor's cookies like the browser would.
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  try {
    return await fetcher<T>(`/api${options.url}`, { method: options.method ?? 'GET', body: options.content as BodyInit | Record<string, any> | undefined })
  } catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status ?? 0
    const data = e?.data ?? e?.response?._data
    // The server's checks come back as a message and, for a test not ready, a list of what is missing.
    const errors: string[] | undefined = data?.data?.errors
    const message = data?.message || e?.message || 'Something went wrong'
    throw new ApiError(status, errors?.length ? `${message}: ${errors.join('; ')}` : message, data)
  }
}

export const storage = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string | null | undefined) {
    if (typeof window === 'undefined') return
    try {
      if (value === null || value === undefined) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {}
  },
  remove(key: string) {
    if (typeof window === 'undefined') return
    try { localStorage.removeItem(key) } catch {}
  }
}

export interface UploadOptions {
  onProgress?: (percent: number) => void
  /** What the file is for; by default a test's audio or picture, decided by its type. */
  purpose?: 'test-audio' | 'test-asset' | 'recording' | 'avatar' | 'centre-logo'
}

export interface UploadedMedia { ref: string, url: string, name: string, mimeType: string, size: number }

/** An audio file, picture or transcript, stored in the bucket; it is referred to by its public address. */
export function uploadFile(file: File | Blob, opts: UploadOptions = {}): Promise<UploadedMedia> {
  const type = file.type || 'application/octet-stream'
  const purpose = opts.purpose ?? (type.startsWith('audio/') ? 'test-audio' : 'test-asset')
  const name = (file as File).name || 'file'
  const form = new FormData()
  form.append('file', file, name)
  form.append('purpose', purpose)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    if (opts.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) opts.onProgress!(Math.round((e.loaded / e.total) * 100))
      })
    }
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { publicUrl } = JSON.parse(xhr.responseText)
        resolve({ ref: publicUrl, url: publicUrl, name, mimeType: type, size: file.size })
        return
      }
      let message = `Upload failed (${xhr.status})`
      try { message = JSON.parse(xhr.responseText).message || message } catch {}
      reject(new ApiError(xhr.status, message))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
    xhr.open('POST', '/api/storage/upload')
    xhr.withCredentials = true
    xhr.send(form)
  })
}

/** A playable address for a media reference: stored files are public addresses already. */
export function qs(params: Record<string, unknown> = {}) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    s.set(k, String(v))
  }
  const q = s.toString()
  return q ? `?${q}` : ''
}

/** A JSON value saved as a file (a test exported from the builder). */
export function saveJson(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

export { errorMessage, mediaUrl } from '~/utils/http'
