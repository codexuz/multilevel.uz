/**
 * The exam the app is showing: IELTS or Multilevel. A signed-in user prepares for one, chosen in
 * onboarding (and changed in Settings), and only ever sees that one. A guest looking round picks one
 * on the home page; it is kept in a cookie (so the server renders the same) and defaults to IELTS.
 */
export function useExam() {
  const { me, loggedIn } = useMe()
  const kept = useCookie<string | null>('exam', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  // One value for the whole page: separate cookie reads would disagree while the server renders.
  const chosen = useState<Exam | null>('exam-choice', () => (isExam(kept.value) ? kept.value : null))
  const exam = computed<Exam>(() => (loggedIn.value ? me.value?.exam ?? chosen.value ?? 'IELTS' : chosen.value ?? 'IELTS'))
  const isIelts = computed(() => exam.value === 'IELTS')

  /** Picks the exam: a guest's is kept on this device, a signed-in user's saved to their profile. */
  async function setExam(next: Exam) {
    chosen.value = next
    kept.value = next
    if (loggedIn.value && me.value?.exam !== next) {
      me.value = { ...me.value!, exam: next }
      await $fetch('/api/me/plan', { method: 'PATCH', body: { exam: next } }).catch(() => {})
    }
  }
  return { exam, isIelts, setExam }
}
