<script setup lang="ts">
/**
 * A Listening or Reading part's public answers: the opening of the passage (never the recording,
 * and not the whole passage), then every question's answer, why it is right and the words it comes
 * from, and the way into the part itself in the exam interface. Others like it follow.
 */
type Kind = 'LISTENING' | 'READING'
interface Answer { number: number, type: string, prompt: string | null, answers: string[], explanation: string | null, evidence: string | null }
interface Card { slug: string, title: string, exam: string, partNumber: number, questions: number, preview: string, test: { slug: string, title: string } }
interface Page extends Card { passageOpening: string | null, practise: string, premium: boolean, groups: { type: string, instruction: string | null, numbers: number[] }[], answers: Answer[], related: Card[] }

const props = defineProps<{ kind: Kind }>()
const { t } = useI18n()
const route = useRoute()
const base = `/${props.kind.toLowerCase()}`
const { data: p, error } = await useFetch<Page>(`/api/public${base}/${route.params.slug}`)
if (error.value || !p.value) throw createError({ statusCode: 404, statusMessage: t('answers.notFound'), fatal: true })

const kindName = computed(() => skillLabel(props.kind))
const where = computed(() => `${examLabel(p.value!.exam)} · ${partName(props.kind, p.value!.partNumber, p.value!.exam)}`)
const range = computed(() => {
  const n = p.value!.answers.map(a => a.number)
  return n.length ? `${Math.min(...n)}–${Math.max(...n)}` : ''
})
useSeoMeta({
  title: () => t('answers.partSeoTitle', { title: p.value!.title, skill: kindName.value }),
  description: () => t('answers.partSeoDescription', { title: p.value!.title, skill: kindName.value, n: p.value!.answers.length }),
  ogType: 'article'
})
// What a search engine can read as questions and answers.
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': p.value!.answers.slice(0, 40).map(a => ({
        '@type': 'Question',
        'name': `${p.value!.title}: question ${a.number}${a.prompt ? ` (${a.prompt})` : ''}`,
        'acceptedAnswer': { '@type': 'Answer', 'text': a.answers.join(' / ') }
      }))
    })
  }]
})
const typeOf = (n: number) => p.value!.groups.find(g => g.numbers.includes(n))?.type
</script>

<template>
  <AppPage
    v-if="p"
    :title="p.title"
    :icon="SKILL_META[kind].icon"
  >
    <article class="flex flex-col gap-6 w-full max-w-3xl mx-auto">
      <div>
        <UButton
          :to="base"
          :label="t(`answers.${kind.toLowerCase()}Title`)"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          class="px-0 mb-2"
        />
        <p class="text-sm text-muted">
          {{ where }} · {{ p.test.title }}
        </p>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted mt-1">
          {{ t('answers.partHeading', { title: p.title, skill: kindName }) }}
        </h1>
        <p class="text-muted mt-2">
          {{ t('answers.partLead', { n: p.answers.length, range }) }}
        </p>
      </div>

      <!-- The way in: the part itself, in the exam interface -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-primary/5 ring ring-primary/20 p-4">
        <UIcon
          :name="SKILL_META[kind].icon"
          class="size-8 text-primary shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted">
            {{ t('answers.practiseTitle') }}
          </p>
          <p class="text-sm text-muted">
            {{ kind === 'LISTENING' ? t('answers.practiseListening') : t('answers.practiseReading') }}
          </p>
        </div>
        <UButton
          :to="p.practise"
          :label="t('answers.practise')"
          :icon="p.premium ? 'i-lucide-sparkles' : 'i-lucide-play'"
          size="lg"
          data-testid="practise"
        />
      </div>

      <section v-if="p.passageOpening">
        <h2 class="text-lg font-semibold text-highlighted mb-2">
          {{ t('answers.passageOpening') }}
        </h2>
        <div class="relative rounded-xl ring ring-default p-4 font-serif leading-7 text-toned whitespace-pre-line">
          {{ p.passageOpening }}
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl bg-linear-to-t from-default to-transparent" />
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-highlighted mb-3">
          {{ t('answers.answersHeading', { range }) }}
        </h2>
        <ol
          class="flex flex-col divide-y divide-default rounded-xl ring ring-default"
          data-testid="answers"
        >
          <li
            v-for="a in p.answers"
            :key="a.number"
            class="flex gap-3 p-4"
          >
            <span class="size-8 shrink-0 grid place-items-center rounded-full bg-elevated text-sm font-semibold text-highlighted">{{ a.number }}</span>
            <div class="min-w-0 flex-1 flex flex-col gap-1.5">
              <p
                v-if="a.prompt"
                class="text-sm text-muted"
              >
                {{ a.prompt }}
              </p>
              <p class="font-semibold text-success">
                {{ a.answers.join(' / ') || '—' }}
                <span
                  v-if="typeOf(a.number)"
                  class="ms-2 text-xs font-normal text-dimmed"
                >{{ questionTypeLabel(typeOf(a.number)!) }}</span>
              </p>
              <!-- eslint-disable vue/no-v-html -- explanations are authored in the builder, as on the review -->
              <div
                v-if="a.explanation"
                class="text-sm leading-6 text-toned [&_p]:mb-1.5 [&_strong]:text-highlighted"
                v-html="a.explanation"
              />
              <!-- eslint-enable vue/no-v-html -->
              <blockquote
                v-if="a.evidence"
                class="border-s-2 border-primary/50 ps-3 text-sm italic text-muted"
              >
                “{{ a.evidence }}”
              </blockquote>
            </div>
          </li>
        </ol>
      </section>

      <section v-if="p.related.length">
        <h2 class="text-lg font-semibold text-highlighted mb-3">
          {{ t('answers.more', { skill: kindName }) }}
        </h2>
        <div class="grid sm:grid-cols-2 gap-3">
          <NuxtLink
            v-for="r in p.related"
            :key="r.slug"
            :to="`${base}/${r.slug}`"
            class="rounded-xl ring ring-default p-3 hover:ring-primary/40"
          >
            <p class="text-xs text-muted">
              {{ examLabel(r.exam) }} · {{ partName(kind, r.partNumber, r.exam) }}
            </p>
            <p class="font-medium text-highlighted line-clamp-1">
              {{ r.title }}
            </p>
          </NuxtLink>
        </div>
      </section>

      <p class="text-xs text-dimmed">
        {{ t('answers.disclaimer') }}
      </p>
    </article>
  </AppPage>
</template>
