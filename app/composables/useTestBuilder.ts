import type { EditableQuestion } from '~/components/admin/QuestionEditor.vue'
import type { SectionType, QuestionType, Choice, QuestionMeta } from '~/types/exam'

// Editor node shapes use snake_case to match the admin sub-components.
export interface QuestionNode {
  id: string
  type: QuestionType
  question_number: number | null
  prompt: string | null
  options: Choice[]
  correct_answer: string | string[] | null
  points: number
  meta: QuestionMeta
}
export interface PartNode {
  id: string
  title: string
  instructions: string | null
  content: Record<string, unknown>
  audio_url: string | null
  order_index: number
  questions: QuestionNode[]
}
export interface SectionNode {
  id: string
  type: SectionType
  title: string
  duration_minutes: number
  audio_url: string | null
  order_index: number
  parts: PartNode[]
}
export interface TestMeta {
  id: string
  title: string
  description: string | null
  level: string | null
  status: 'draft' | 'published'
  is_premium: boolean
}

// --- API DTOs (camelCase, as returned by /api/admin/tests/[id]) ---
interface ApiQuestion {
  id: string
  type: QuestionType
  questionNumber: number | null
  prompt: string | null
  options: Choice[]
  correctAnswer: string | string[] | null
  points: number
  meta: QuestionMeta
}
interface ApiPart {
  id: string
  title: string
  instructions: string | null
  content: Record<string, unknown>
  audioUrl: string | null
  orderIndex: number
  questions: ApiQuestion[]
}
interface ApiSection {
  id: string
  type: SectionType
  title: string
  durationMinutes: number
  audioUrl: string | null
  orderIndex: number
  parts: ApiPart[]
}
interface ApiTree {
  test: TestMeta & { isPremium: boolean }
  sections: ApiSection[]
}

function toQuestionNode(q: ApiQuestion): QuestionNode {
  return {
    id: q.id,
    type: q.type,
    question_number: q.questionNumber,
    prompt: q.prompt,
    options: q.options ?? [],
    correct_answer: q.correctAnswer,
    points: q.points,
    meta: q.meta ?? {}
  }
}
function toPartNode(p: ApiPart): PartNode {
  return {
    id: p.id,
    title: p.title,
    instructions: p.instructions,
    content: p.content ?? {},
    audio_url: p.audioUrl,
    order_index: p.orderIndex,
    questions: (p.questions ?? []).map(toQuestionNode)
  }
}
function toSectionNode(s: ApiSection): SectionNode {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    duration_minutes: s.durationMinutes,
    audio_url: s.audioUrl,
    order_index: s.orderIndex,
    parts: (s.parts ?? []).map(toPartNode)
  }
}

export function useTestBuilder(testId: string) {
  const toast = useToast()
  // Cookie-aware fetch so the tree loads during SSR (plain $fetch drops auth on the server).
  const request = useRequestFetch()
  const test = ref<{ id: string, title: string, description: string | null, level: string | null, status: 'draft' | 'published', is_premium: boolean } | null>(null)
  const sections = ref<SectionNode[]>([])
  const loading = ref(false)

  function notifyError(e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message ?? 'Something went wrong'
    toast.add({ title: msg, color: 'error' })
  }

  async function load() {
    loading.value = true
    try {
      const tree = await request<ApiTree>(`/api/admin/tests/${testId}`)
      test.value = {
        id: tree.test.id,
        title: tree.test.title,
        description: tree.test.description,
        level: tree.test.level,
        status: tree.test.status,
        is_premium: tree.test.isPremium
      }
      sections.value = tree.sections.map(toSectionNode)
    } catch (e) {
      notifyError(e)
    } finally {
      loading.value = false
    }
  }

  async function saveTestMeta(patch: Partial<{ title: string, description: string | null, level: string | null, is_premium: boolean, status: 'draft' | 'published' }>) {
    try {
      await $fetch(`/api/admin/tests/${testId}`, {
        method: 'PATCH',
        body: {
          title: patch.title,
          description: patch.description,
          level: patch.level,
          isPremium: patch.is_premium,
          status: patch.status
        }
      })
      if (test.value) Object.assign(test.value, patch)
      toast.add({ title: 'Saved', color: 'success', icon: 'i-lucide-check' })
    } catch (e) {
      notifyError(e)
    }
  }

  async function addSection(type: SectionType) {
    try {
      const s = await $fetch<ApiSection>('/api/admin/sections', { method: 'POST', body: { testId, type } })
      sections.value.push(toSectionNode(s))
    } catch (e) {
      notifyError(e)
    }
  }

  async function saveSection(s: SectionNode) {
    try {
      await $fetch(`/api/admin/sections/${s.id}`, {
        method: 'PATCH',
        body: { title: s.title, durationMinutes: s.duration_minutes, audioUrl: s.audio_url }
      })
      toast.add({ title: 'Section saved', color: 'success', icon: 'i-lucide-check' })
    } catch (e) {
      notifyError(e)
    }
  }

  async function deleteSection(id: string) {
    if (!confirm('Delete this section and all its parts/questions?')) return
    try {
      await $fetch(`/api/admin/sections/${id}`, { method: 'DELETE' })
      sections.value = sections.value.filter(s => s.id !== id)
    } catch (e) {
      notifyError(e)
    }
  }

  async function addPart(section: SectionNode) {
    try {
      const p = await $fetch<ApiPart>('/api/admin/parts', { method: 'POST', body: { sectionId: section.id } })
      section.parts.push(toPartNode(p))
    } catch (e) {
      notifyError(e)
    }
  }

  async function savePart(p: PartNode) {
    try {
      await $fetch(`/api/admin/parts/${p.id}`, {
        method: 'PATCH',
        body: { title: p.title, instructions: p.instructions, content: p.content, audioUrl: p.audio_url }
      })
      toast.add({ title: 'Part saved', color: 'success', icon: 'i-lucide-check' })
    } catch (e) {
      notifyError(e)
    }
  }

  async function deletePart(id: string) {
    if (!confirm('Delete this part and its questions?')) return
    try {
      await $fetch(`/api/admin/parts/${id}`, { method: 'DELETE' })
      for (const s of sections.value) s.parts = s.parts.filter(p => p.id !== id)
    } catch (e) {
      notifyError(e)
    }
  }

  async function saveQuestions(part: PartNode, drafts: EditableQuestion[], removedIds: string[]) {
    try {
      const res = await $fetch<{ saved: { id: string, tempIndex: number }[] }>(
        `/api/admin/parts/${part.id}/questions`,
        {
          method: 'POST',
          body: {
            questions: drafts.map(d => ({
              id: d.id,
              type: d.type,
              questionNumber: d.question_number,
              prompt: d.prompt,
              options: d.options,
              correctAnswer: d.correct_answer,
              points: d.points,
              meta: d.meta
            })),
            removedIds
          }
        }
      )
      // Reflect new ids back onto the part's question nodes.
      part.questions = drafts.map((d, i) => ({
        id: res.saved.find(s => s.tempIndex === i)?.id ?? d.id ?? '',
        type: d.type,
        question_number: d.question_number,
        prompt: d.prompt,
        options: d.options,
        correct_answer: d.correct_answer,
        points: d.points,
        meta: d.meta
      }))
      toast.add({ title: 'Questions saved', color: 'success', icon: 'i-lucide-check' })
    } catch (e) {
      notifyError(e)
    }
  }

  return {
    test,
    sections,
    loading,
    load,
    saveTestMeta,
    addSection,
    saveSection,
    deleteSection,
    addPart,
    savePart,
    deletePart,
    saveQuestions
  }
}
