import type { Database, Test, Section, Part, Question } from '~/types/database.types'
import type { SectionType } from '~/types/exam'
import { SECTION_META } from '~/types/exam'
import type { EditableQuestion } from '~/components/admin/QuestionEditor.vue'

export interface PartNode extends Part { questions: Question[] }
export interface SectionNode extends Section { parts: PartNode[] }
// Form-friendly test: nullable text fields normalised to '' for v-model.
export type EditableTest = Omit<Test, 'description' | 'level'> & { description: string, level: string }

export function useTestBuilder(testId: string) {
  const supabase = useSupabaseClient<Database>()
  const toast = useToast()

  const test = ref<EditableTest | null>(null)
  const sections = ref<SectionNode[]>([])
  const loading = ref(true)

  async function load() {
    loading.value = true
    const { data: t } = await supabase.from('tests').select('*').eq('id', testId).single()
    test.value = t ? { ...t, description: t.description ?? '', level: t.level ?? '' } : null

    const { data } = await supabase
      .from('sections')
      .select('*, parts(*, questions(*))')
      .eq('test_id', testId)
      .order('order_index')
    const rows = (data as unknown as SectionNode[]) ?? []
    for (const s of rows) {
      s.parts = (s.parts ?? []).sort((a, b) => a.order_index - b.order_index)
      for (const p of s.parts) p.questions = (p.questions ?? []).sort((a, b) => a.order_index - b.order_index)
    }
    sections.value = rows
    loading.value = false
  }

  async function saveTestMeta(patch: Partial<Test>) {
    const { error } = await supabase.from('tests').update(patch).eq('id', testId)
    if (error) return toast.add({ title: error.message, color: 'error' })
    if (test.value) Object.assign(test.value, patch)
    toast.add({ title: 'Saved', color: 'success', icon: 'i-lucide-check' })
  }

  async function addSection(type: SectionType) {
    const { error } = await supabase.from('sections').insert({
      test_id: testId,
      type,
      title: `${SECTION_META[type].label} Section`,
      duration_minutes: SECTION_META[type].duration,
      order_index: sections.value.length
    })
    if (error) return toast.add({ title: error.message, color: 'error' })
    await load()
  }

  async function saveSection(s: SectionNode) {
    const { error } = await supabase.from('sections').update({
      title: s.title, duration_minutes: s.duration_minutes, audio_url: s.audio_url
    }).eq('id', s.id)
    if (error) return toast.add({ title: error.message, color: 'error' })
    toast.add({ title: 'Section saved', color: 'success', icon: 'i-lucide-check' })
  }

  async function deleteSection(id: string) {
    if (!confirm('Delete this section and all its parts/questions?')) return
    await supabase.from('sections').delete().eq('id', id)
    await load()
  }

  async function addPart(s: SectionNode) {
    const { error } = await supabase.from('parts').insert({
      section_id: s.id,
      title: `Part ${s.parts.length + 1}`,
      order_index: s.parts.length
    })
    if (error) return toast.add({ title: error.message, color: 'error' })
    await load()
  }

  async function savePart(p: PartNode) {
    const { error } = await supabase.from('parts').update({
      title: p.title, instructions: p.instructions, content: p.content, audio_url: p.audio_url
    }).eq('id', p.id)
    if (error) return toast.add({ title: error.message, color: 'error' })
    toast.add({ title: 'Part saved', color: 'success', icon: 'i-lucide-check' })
  }

  async function deletePart(id: string) {
    if (!confirm('Delete this part and its questions?')) return
    await supabase.from('parts').delete().eq('id', id)
    await load()
  }

  async function saveQuestions(p: PartNode, drafts: EditableQuestion[], removedIds: string[]) {
    if (removedIds.length) await supabase.from('questions').delete().in('id', removedIds)
    const rows = drafts.map((q, i) => ({
      id: q.id,
      part_id: p.id,
      order_index: i,
      question_number: q.question_number,
      type: q.type,
      prompt: q.prompt,
      options: q.options as unknown as Database['public']['Tables']['questions']['Row']['options'],
      correct_answer: q.correct_answer as unknown as Database['public']['Tables']['questions']['Row']['correct_answer'],
      points: q.points,
      meta: q.meta as unknown as Database['public']['Tables']['questions']['Row']['meta']
    }))
    const { error } = await supabase.from('questions').upsert(rows)
    if (error) return toast.add({ title: error.message, color: 'error' })
    toast.add({ title: 'Questions saved', color: 'success', icon: 'i-lucide-check' })
    await load()
  }

  return {
    test, sections, loading,
    load, saveTestMeta,
    addSection, saveSection, deleteSection,
    addPart, savePart, deletePart,
    saveQuestions
  }
}
