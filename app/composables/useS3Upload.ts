type Purpose = 'test-audio' | 'test-asset' | 'recording' | 'avatar'

interface PresignResponse {
  uploadUrl: string
  key: string
  publicUrl: string
}

/**
 * Uploads a File/Blob to S3-compatible storage via a server-issued presigned URL.
 * Returns the public URL the object is served from.
 */
export function useS3Upload() {
  const uploading = ref(false)
  const progress = ref(0)

  async function upload(file: Blob, purpose: Purpose, fileName?: string): Promise<string> {
    uploading.value = true
    progress.value = 0
    try {
      const contentType = file.type || 'application/octet-stream'
      const { uploadUrl, publicUrl } = await $fetch<PresignResponse>('/api/storage/presign', {
        method: 'POST',
        body: { purpose, contentType, fileName }
      })

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100)
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })

      return publicUrl
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, progress }
}
