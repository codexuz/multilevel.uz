import type { AnswerMap, PartData } from '~/types/exam'

export function useIxSession(parts: MaybeRefOrGetter<PartData[]>, autoStart = false) {
  const answers = ref<AnswerMap>({})
  const currentPart = ref(0)
  const currentQuestion = ref<number | null>(null)
  const started = ref(autoStart)
  const running = ref(autoStart)
  const submitted = ref(false)

  const part = computed(() => toValue(parts)[currentPart.value])
  // The first question of the paper is the one in hand at the start.
  const firstNums = toValue(parts)[0] ? getAllQuestionNumbers(toValue(parts)[0]!.questions) : []
  currentQuestion.value = firstNums[0] ?? null

  /** Brings a question into view and puts the cursor in it, as a number in the bottom bar does. */
  function scrollTo(n: number) {
    nextTick(() => {
      const el = document.getElementById(`question-${n}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const field = el.matches('input, textarea, select, button') ? el : el.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, [tabindex="0"]')
      field?.focus({ preventScroll: true })
    })
  }

  /** The question entered (a gap focused, a choice made) becomes the one in hand. */
  function focusQuestion(n: number) {
    currentQuestion.value = n
  }

  function answer(n: number, value: string) {
    answers.value = { ...answers.value, [n]: value }
    currentQuestion.value = n
  }

  function setPart(index: number) {
    currentPart.value = index
    const p = toValue(parts)[index]
    currentQuestion.value = p ? (getAllQuestionNumbers(p.questions)[0] ?? null) : null
  }

  function goToQuestion(n: number) {
    currentQuestion.value = n
    scrollTo(n)
  }

  function prev() {
    const list = toValue(parts)
    const p = list[currentPart.value]
    if (!p) return
    const nums = getAllQuestionNumbers(p.questions)
    const idx = currentQuestion.value ? nums.indexOf(currentQuestion.value) : -1
    if (idx > 0) return goToQuestion(nums[idx - 1]!)
    if (currentPart.value > 0) {
      currentPart.value--
      const prevNums = getAllQuestionNumbers(list[currentPart.value]!.questions)
      currentQuestion.value = prevNums[prevNums.length - 1] ?? null
      if (currentQuestion.value) scrollTo(currentQuestion.value)
    }
  }

  function next() {
    const list = toValue(parts)
    const p = list[currentPart.value]
    if (!p) return
    const nums = getAllQuestionNumbers(p.questions)
    const idx = currentQuestion.value ? nums.indexOf(currentQuestion.value) : -1
    if (idx < nums.length - 1) return goToQuestion(nums[idx + 1]!)
    if (currentPart.value < list.length - 1) {
      currentPart.value++
      currentQuestion.value = getAllQuestionNumbers(list[currentPart.value]!.questions)[0] ?? null
      if (currentQuestion.value) scrollTo(currentQuestion.value)
    }
  }

  /** Whether ← or → has anywhere to go. */
  const atStart = computed(() => {
    const list = toValue(parts)
    if (currentPart.value > 0) return false
    const nums = list[0] ? getAllQuestionNumbers(list[0].questions) : []
    return !currentQuestion.value || nums.indexOf(currentQuestion.value) <= 0
  })
  const atEnd = computed(() => {
    const list = toValue(parts)
    if (currentPart.value < list.length - 1) return false
    const nums = list[currentPart.value] ? getAllQuestionNumbers(list[currentPart.value]!.questions) : []
    return !!currentQuestion.value && nums.indexOf(currentQuestion.value) === nums.length - 1
  })

  function start() {
    started.value = true
    running.value = true
  }

  function finish() {
    running.value = false
    submitted.value = true
  }

  return { answers, currentPart, currentQuestion, started, running, submitted, part, answer, setPart, goToQuestion, focusQuestion, prev, next, atStart, atEnd, start, finish }
}
