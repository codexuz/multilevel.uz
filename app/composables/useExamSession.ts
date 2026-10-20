import type { AnswerMap, PartData } from '~/types/exam'

export function useExamSession(parts: MaybeRefOrGetter<PartData[]>, autoStart = false) {
  const answers = ref<AnswerMap>({})
  const currentPart = ref(0)
  const currentQuestion = ref<number | null>(null)
  const started = ref(autoStart)
  const running = ref(autoStart)
  const submitted = ref(false)

  const part = computed(() => toValue(parts)[currentPart.value])

  function scrollTo(n: number) {
    nextTick(() => document.getElementById(`question-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  function answer(n: number, value: string) {
    answers.value = { ...answers.value, [n]: value }
    currentQuestion.value = n
  }

  function setPart(index: number) {
    currentPart.value = index
    currentQuestion.value = null
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
    }
  }

  function start() {
    started.value = true
    running.value = true
  }

  function finish() {
    running.value = false
    submitted.value = true
  }

  return { answers, currentPart, currentQuestion, started, running, submitted, part, answer, setPart, goToQuestion, prev, next, start, finish }
}
