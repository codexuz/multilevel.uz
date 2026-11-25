import type {
  LmsAcceptedAnswers,
  LmsQuestionConfig,
  LmsQuestionGrade,
  LmsQuestionType
} from '../../shared/utils/lms'

interface GradableQuestion {
  id: string
  type: string
  prompt: string
  context: string | null
  audioRef: string | null
  imageRef: string | null
  config: unknown
  acceptedAnswers: unknown
  explanation: string | null
  points: number
}

const asList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(x => String(x ?? '').trim()).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

const asMap = (v: unknown): Record<string, string[]> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = asList(val)
  }
  return out
}

function matchTextAnswer(given: string, expectedList: string[]): boolean {
  const cleanGiven = normaliseAnswer(given)
  if (!cleanGiven) return false
  const variants = expectedList.flatMap(k => alternativesOf(k)).flatMap(k => expandKey(k))
  return variants.some(v => normaliseAnswer(v) === cleanGiven)
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/** Grade a single LMS exercise question across all 12 supported question types. */
export function gradeLmsQuestion(question: GradableQuestion, submitted: unknown): LmsQuestionGrade {
  const type = question.type as LmsQuestionType
  const max = Math.max(1, Number(question.points) || 1)
  const cfg = (question.config ?? {}) as LmsQuestionConfig
  const accepted = question.acceptedAnswers as LmsAcceptedAnswers
  const explanation = question.explanation ?? null

  switch (type) {
    case 'SINGLE_CHOICE': {
      const expected = asList(accepted).map(x => x.toUpperCase())
      const given = String(submitted ?? '').trim().toUpperCase()
      const ok = !!given && expected.includes(given)
      return { earned: ok ? max : 0, max, isCorrect: ok, expected, explanation }
    }

    case 'MCQ': {
      const expectedSet = new Set(asList(accepted).map(x => x.toUpperCase()))
      const givenArr = (Array.isArray(submitted) ? submitted : typeof submitted === 'string' && submitted ? [submitted] : [])
        .map(x => String(x).trim().toUpperCase())
        .filter(Boolean)
      const givenSet = new Set(givenArr)
      const exact = expectedSet.size > 0 && expectedSet.size === givenSet.size && [...expectedSet].every(k => givenSet.has(k))
      // Partial credit: each right option adds credit, each wrong option deducts credit.
      let earned = 0
      if (exact) {
        earned = max
      } else if (expectedSet.size > 0 && givenSet.size > 0) {
        const right = [...givenSet].filter(k => expectedSet.has(k)).length
        const wrong = [...givenSet].filter(k => !expectedSet.has(k)).length
        const ratio = Math.max(0, (right - wrong) / expectedSet.size)
        earned = Math.round(ratio * max)
      }
      return { earned, max, isCorrect: exact, expected: [...expectedSet], explanation }
    }

    case 'TRUE_FALSE': {
      const norm = (v: string) => {
        const s = normaliseAnswer(v)
        if (s === 't' || s === 'true') return 'TRUE'
        if (s === 'f' || s === 'false') return 'FALSE'
        if (s === 'ng' || s === 'not given' || s === 'notgiven') return 'NOT_GIVEN'
        return s.toUpperCase()
      }
      const expected = asList(accepted).map(norm)
      const given = norm(String(submitted ?? ''))
      const ok = !!given && expected.includes(given)
      return { earned: ok ? max : 0, max, isCorrect: ok, expected, explanation }
    }

    case 'SHORT_ANSWER':
    case 'TRANSLATION': {
      const given = String(submitted ?? '').trim()
      const expected = asList(accepted)
      const withinLimit = type !== 'SHORT_ANSWER' || !cfg.wordLimit || countWords(given) <= cfg.wordLimit
      const ok = !!given && withinLimit && matchTextAnswer(given, expected)
      return { earned: ok ? max : 0, max, isCorrect: ok, expected, explanation }
    }

    case 'SENTENCE_BUILD': {
      const given = Array.isArray(submitted)
        ? submitted.map(w => String(w ?? '').trim()).filter(Boolean).join(' ')
        : String(submitted ?? '').trim()
      const expected = asList(accepted)
      if (!expected.length && Array.isArray(cfg.words) && cfg.words.length) {
        expected.push(cfg.words.join(' '))
      }
      const ok = !!given && matchTextAnswer(given, expected)
      return { earned: ok ? max : 0, max, isCorrect: ok, expected, explanation }
    }

    case 'ERROR_SPOT': {
      const payload = (submitted && typeof submitted === 'object' ? submitted : {}) as { index?: number | null, correction?: string }
      const expectedIndex = Number.isInteger(cfg.errorIndex) ? Number(cfg.errorIndex) : 0
      const selectedIndex = typeof payload.index === 'number' ? payload.index : null
      const indexCorrect = selectedIndex === expectedIndex
      const requireCorrection = !!cfg.requireCorrection
      const expectedCorrections = asList(accepted)
      if (!requireCorrection) {
        return {
          earned: indexCorrect ? max : 0,
          max,
          isCorrect: indexCorrect,
          errorSpot: { selectedIndex, expectedIndex, indexCorrect },
          expected: { index: expectedIndex, corrections: expectedCorrections },
          explanation
        }
      }
      const correctionCorrect = matchTextAnswer(String(payload.correction ?? ''), expectedCorrections)
      const isCorrect = indexCorrect && correctionCorrect
      const earned = isCorrect ? max : (indexCorrect ? Math.floor(max / 2) : 0)
      return {
        earned,
        max,
        isCorrect,
        errorSpot: { selectedIndex, expectedIndex, indexCorrect, correctionCorrect },
        expected: { index: expectedIndex, corrections: expectedCorrections },
        explanation
      }
    }

    case 'NOTE_COMPLETION':
    case 'SUMMARY_COMPLETION': {
      const gaps = parseGapNumbers(question.context)
      const keyMap = asMap(accepted)
      const ansMap = (submitted && typeof submitted === 'object' && !Array.isArray(submitted) ? submitted : {}) as Record<string, string>
      const blanks: Record<string, { given: string, correct: boolean, expected: string[] }> = {}
      const keys = gaps.length ? gaps : Object.keys(keyMap)
      let rightCount = 0
      for (const num of keys) {
        const given = String(ansMap[num] ?? '').trim()
        const exp = keyMap[num] ?? []
        const withinLimit = !cfg.wordLimit || countWords(given) <= cfg.wordLimit
        const ok = !!given && withinLimit && matchTextAnswer(given, exp)
        if (ok) rightCount++
        blanks[num] = { given, correct: ok, expected: exp }
      }
      const totalBlanks = Math.max(1, keys.length)
      const isCorrect = keys.length > 0 && rightCount === keys.length
      const earned = Math.round((rightCount / totalBlanks) * max)
      return { earned, max, isCorrect, blanks, expected: keyMap, explanation }
    }

    case 'SUMMARY_DRAG_DROP': {
      const gaps = parseGapNumbers(question.context)
      const keyMap = asMap(accepted)
      const ansMap = (submitted && typeof submitted === 'object' && !Array.isArray(submitted) ? submitted : {}) as Record<string, string>
      const bankByKey = new Map((cfg.wordBank ?? []).map(w => [w.key.toUpperCase(), w.text]))
      const blanks: Record<string, { given: string, correct: boolean, expected: string[] }> = {}
      const keys = gaps.length ? gaps : Object.keys(keyMap)
      let rightCount = 0
      for (const num of keys) {
        const given = String(ansMap[num] ?? '').trim()
        const exp = keyMap[num] ?? []
        const givenUpper = given.toUpperCase()
        const givenText = bankByKey.get(givenUpper) ?? given
        const ok = !!given && exp.some((e) => {
          const eu = e.toUpperCase()
          const expText = bankByKey.get(eu) ?? e
          return eu === givenUpper || normaliseAnswer(expText) === normaliseAnswer(givenText)
        })
        if (ok) rightCount++
        blanks[num] = { given, correct: ok, expected: exp }
      }
      const totalBlanks = Math.max(1, keys.length)
      const isCorrect = keys.length > 0 && rightCount === keys.length
      const earned = Math.round((rightCount / totalBlanks) * max)
      return { earned, max, isCorrect, blanks, expected: keyMap, explanation }
    }

    case 'ORDER': {
      const expectedOrder = asList(accepted).length
        ? asList(accepted)
        : (cfg.items ?? []).map(i => i.id)
      const givenOrder = (Array.isArray(submitted) ? submitted : []).map(x => String(x))
      const isCorrect = expectedOrder.length > 0
        && expectedOrder.length === givenOrder.length
        && expectedOrder.every((id, idx) => givenOrder[idx] === id)
      let matches = 0
      expectedOrder.forEach((id, idx) => {
        if (givenOrder[idx] === id) matches++
      })
      const earned = expectedOrder.length ? Math.round((matches / expectedOrder.length) * max) : 0
      return { earned, max, isCorrect, expected: expectedOrder, explanation }
    }

    case 'DICTATION': {
      // Timed segments of a recording: each segment typed in its own box, marked on its own.
      if (cfg.segments?.length) {
        const keys = asMap(accepted)
        const typed = (submitted && typeof submitted === 'object' && !Array.isArray(submitted)) ? submitted as Record<string, unknown> : {}
        const segments: NonNullable<LmsQuestionGrade['segments']> = {}
        let sum = 0
        for (const seg of cfg.segments) {
          const expectedList = keys[seg.id] ?? []
          const expected = expectedList[0] ?? ''
          const given = String(typed[seg.id] ?? '').trim()
          const exact = !!given && matchTextAnswer(given, expectedList)
          const diff = diffDictationWords(expected, given)
          const total = diff.filter(d => d.status !== 'extra').length
          const matched = diff.filter(d => d.status === 'match').length
          const extra = diff.filter(d => d.status === 'extra').length
          const accuracy = exact ? 1 : total > 0 ? Math.max(0, (matched - extra * 0.5) / total) : 0
          segments[seg.id] = { given, expected, diff, accuracy, exact }
          sum += accuracy
        }
        const n = cfg.segments.length
        const earned = Math.round((sum / n) * max)
        return { earned, max, isCorrect: Object.values(segments).every(x => x.exact), segments, expected: keys, explanation }
      }
      const given = String(submitted ?? '').trim()
      const expected = asList(accepted)
      if (!expected.length && cfg.ttsText) expected.push(cfg.ttsText)
      const primary = expected[0] ?? ''
      const exact = !!given && matchTextAnswer(given, expected)
      const diff = diffDictationWords(primary, given)
      const totalWords = diff.filter(d => d.status !== 'extra').length
      const matchedWords = diff.filter(d => d.status === 'match').length
      const extraWords = diff.filter(d => d.status === 'extra').length
      const accuracy = totalWords > 0 ? Math.max(0, (matchedWords - extraWords * 0.5) / totalWords) : 0
      const earned = exact ? max : Math.round(accuracy * max)
      return { earned, max, isCorrect: exact, diff, expected, explanation }
    }

    case 'WRITTEN_RESPONSE': {
      // Marked afterwards by the AI (and the teacher): see markWrittenResponses (ai-response.ts).
      const given = String(submitted ?? '').trim()
      return { earned: 0, max, isCorrect: false, review: { status: 'PENDING', words: countWords(given) }, explanation }
    }

    default:
      return { earned: 0, max, isCorrect: false, explanation }
  }
}

/**
 * Prepare a question for a student taking an exercise:
 * strips answer keys & explanations, and shuffles word tiles / order items deterministically
 * so the answer is never revealed in the payload.
 */
export function sanitizeQuestionForStudent(q: GradableQuestion) {
  const cfg = structuredClone((q.config ?? {}) as LmsQuestionConfig)
  if (q.type === 'SENTENCE_BUILD') {
    const combined = [...(cfg.words ?? []), ...(cfg.distractors ?? [])]
    cfg.words = shuffleDeterministic(combined, q.id)
    delete cfg.distractors
  }
  if (q.type === 'ERROR_SPOT') {
    delete cfg.errorIndex
  }
  if (q.type === 'ORDER' && Array.isArray(cfg.items)) {
    const shuffled = shuffleDeterministic(cfg.items, q.id)
    // Avoid accidentally leaving a 2+ item list in the exact answer order
    if (shuffled.length > 1 && shuffled.every((item, i) => item.id === cfg.items![i]!.id)) {
      const first = shuffled.shift()!
      shuffled.push(first)
    }
    cfg.items = shuffled
  }
  // For DICTATION: keep ttsText only when there is no uploaded audioRef (so browser TTS can speak it),
  // otherwise strip ttsText so students cannot inspect the transcript in DevTools.
  if (q.type === 'DICTATION' && (q.audioRef || cfg.youtubeUrl || cfg.segments?.length)) {
    delete cfg.ttsText
  }
  // A written response's key points and model answer are the teacher's.
  if (q.type === 'WRITTEN_RESPONSE') {
    delete cfg.keyPoints
    delete cfg.modelAnswer
  }
  return {
    id: q.id,
    exerciseId: (q as any).exerciseId,
    position: (q as any).position,
    type: q.type as LmsQuestionType,
    prompt: q.prompt,
    context: q.context,
    audioRef: q.audioRef,
    imageRef: q.imageRef,
    config: cfg,
    points: q.points
  }
}
