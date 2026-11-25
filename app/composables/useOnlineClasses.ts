import type { LiveLesson } from '~/components/online/Row.vue'

/**
 * Cancelling an online class, asked in a dialog first (it comes off the Calendar and students are
 * told). Resolves true when it was cancelled.
 */
export function useOnlineClasses() {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useDialogs()
  async function cancelClass(l: Pick<LiveLesson, 'id' | 'title'>) {
    const ok = await confirm({
      title: t('online.cancelTitle'),
      description: t('online.cancelSure', { title: l.title }),
      confirmLabel: t('online.cancelClass'),
      cancelLabel: t('online.keepClass'),
      color: 'error'
    })
    if (!ok) return false
    try {
      await $fetch(`/api/live-lessons/${l.id}`, { method: 'DELETE' })
      toast.add({ title: t('online.cancelledToast'), description: t('online.toldText'), color: 'success' })
      return true
    } catch (e) {
      toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
      return false
    }
  }
  return { cancelClass }
}
