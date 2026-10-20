import ConfirmModal from '~/components/ConfirmModal.vue'
import PromptModal from '~/components/PromptModal.vue'

export function useDialogs() {
  const overlay = useOverlay()
  const confirmModal = overlay.create(ConfirmModal)
  const promptModal = overlay.create(PromptModal)

  async function confirm(opts: { title: string, description?: string, confirmLabel?: string, color?: 'error' | 'primary' | 'warning' }) {
    return (await confirmModal.open(opts).result) === true
  }

  async function prompt(opts: { title: string, label?: string, initialValue?: string, placeholder?: string, confirmLabel?: string, multiline?: boolean }) {
    return (await promptModal.open(opts).result) as string | null
  }

  return { confirm, prompt }
}
