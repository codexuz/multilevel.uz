/**
 * The exam the app is showing: IELTS or Multilevel. It is the one the user prepares for, else the
 * last one picked on this device (a cookie, so the server renders the same), else IELTS. Picking
 * one keeps it, and for a signed-in user saves it to their profile.
 */
export function useExam() {
  const { me, loggedIn } = useMe()
  const kept = useCookie<string | null>('exam', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  const exam = computed<Exam>(() => (isExam(kept.value) ? kept.value : me.value?.exam ?? 'IELTS'))
  const isIelts = computed(() => exam.value === 'IELTS')

  async function setExam(next: Exam) {
    if (next === exam.value && kept.value === next) return
    kept.value = next
    if (loggedIn.value && me.value?.exam !== next) {
      me.value = { ...me.value!, exam: next }
      await $fetch('/api/me/plan', { method: 'PATCH', body: { exam: next } }).catch(() => {})
    }
  }
  return { exam, isIelts, setExam }
}
