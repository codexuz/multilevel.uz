/** Tracks a blob download with progress and reports failures as toasts. */
export function useFileDownload() {
  const toast = useToast()
  const progress = ref<number | null>(null)

  async function download(url?: string | null, fileName?: string) {
    if (!url || progress.value !== null) return
    progress.value = 0
    try {
      await downloadAsBlob(url, fileName ?? fileNameFromUrl(url), p => (progress.value = p))
    } catch (e) {
      toast.add({ title: 'Download failed', description: errorMessage(e), color: 'error' })
    } finally {
      progress.value = null
    }
  }

  return { download, progress, downloading: computed(() => progress.value !== null) }
}
