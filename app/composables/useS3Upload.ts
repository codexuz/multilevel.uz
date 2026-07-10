type Purpose = 'test-audio' | 'test-asset' | 'recording' | 'avatar' | 'community'

interface UploadResponse {
  key: string
  publicUrl: string
}

/**
 * Uploads a File/Blob to S3-compatible storage by streaming it through a Nuxt
 * server route (the storage provider's S3 host does not support browser CORS).
 * Returns the public URL the object is served from.
 */
export function useS3Upload() {
  const uploading = ref(false)
  const progress = ref(0)

  async function upload(file: Blob, purpose: Purpose, fileName?: string): Promise<string> {
    uploading.value = true
    progress.value = 0
    try {
      const form = new FormData()
      form.append('purpose', purpose)
      form.append('file', file, fileName || 'upload')

      const { publicUrl } = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/storage/upload')
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100)
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)) }
            catch { reject(new Error('Invalid server response')) }
          } else {
            let msg = `Upload failed (${xhr.status})`
            try { msg = JSON.parse(xhr.responseText).message || msg } catch { /* ignore */ }
            reject(new Error(msg))
          }
        }
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(form)
      })

      return publicUrl
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, progress }
}
