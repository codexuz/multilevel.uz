<script setup lang="ts">
/**
 * A Writing task's public page: the task as set (with its chart or map), the way into it in the exam
 * interface, and essays its writers chose to show, unnamed, each with the AI's marks for every
 * criterion. An admin can take a sample off the page.
 */
interface Sample { id: string, text: string, wordCount: number, scale: number, band: number | null, level: string | null, criteria: Record<string, number>, comment: string, examinerFeedback: string | null }
interface Card { slug: string, title: string, exam: string, taskNumber: number, preview: string, samples: number, test: { slug: string, title: string } }
interface Page extends Omit<Card, 'samples'> { prompt: string, imageUrl: string | null, minWords: number, minutes: number, practise: string, premium: boolean, samples: Sample[], related: Card[] }

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { isAdmin } = useMe()
const { data: p, error, refresh } = await useFetch<Page>(`/api/public/writing/${route.params.slug}`)
if (error.value || !p.value) throw createError({ statusCode: 404, statusMessage: t('answers.notFound'), fatal: true })

const name = computed(() => `${examLabel(p.value!.exam)} ${taskName(p.value!.exam, p.value!.taskNumber)}`)
const ielts = computed(() => p.value!.exam === 'IELTS')
useSeoMeta({
  title: () => t('answers.taskSeoTitle', { title: p.value!.title, task: name.value }),
  description: () => p.value!.preview,
  ogType: 'article'
})

const CRITERIA = ['taskAchievement', 'organisation', 'vocabulary', 'grammar']
const criterionLabel = (key: string) => t(ielts.value ? `ieltsCriterion.${key}` : `criterion.${key}`)
const mark = (s: Sample) => (s.scale === 9 ? (s.band != null ? fmtBand(s.band) : '') : s.level ?? '')

async function hide(s: Sample) {
  try {
    await $fetch(`/api/admin/essays/${s.id}/hide`, { method: 'POST', body: { hidden: true } })
    toast.add({ title: t('answers.sampleHidden'), color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    v-if="p"
    :title="p.title"
    icon="i-lucide-pen-line"
  >
    <article class="flex flex-col gap-6 w-full max-w-3xl mx-auto">
      <div>
        <UButton
          to="/writing"
          :label="t('answers.writingTitle')"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="link"
          class="px-0 mb-2"
        />
        <p class="text-sm text-muted">
          {{ name }} · {{ p.test.title }}
        </p>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted mt-1">
          {{ p.title }}
        </h1>
      </div>

      <!-- The task as set -->
      <section class="rounded-xl ring ring-default p-4 sm:p-5 flex flex-col gap-3">
        <p class="text-sm text-muted">
          {{ t('answers.taskRubric', { minutes: p.minutes, words: p.minWords }) }}
        </p>
        <!-- eslint-disable vue/no-v-html -- the prompt is authored in the builder, as in the test -->
        <div
          class="leading-7 text-highlighted [&_p]:mb-3"
          v-html="p.prompt"
        />
        <!-- eslint-enable vue/no-v-html -->
        <img
          v-if="p.imageUrl"
          :src="p.imageUrl"
          :alt="t('answers.chartAlt', { title: p.title })"
          class="max-w-full rounded-lg ring ring-default"
        >
        <UButton
          :to="p.practise"
          :label="t('answers.writeIt')"
          :icon="p.premium ? 'i-lucide-sparkles' : 'i-lucide-pen-line'"
          size="lg"
          class="self-start"
          data-testid="practise"
        />
      </section>

      <!-- Samples its writers chose to show -->
      <section>
        <h2 class="text-lg font-semibold text-highlighted mb-1">
          {{ t('answers.samplesHeading') }}
        </h2>
        <p class="text-sm text-muted mb-3">
          {{ t('answers.samplesLead') }}
        </p>
        <div
          v-if="!p.samples.length"
          class="rounded-xl ring ring-default p-5 text-center text-sm text-muted"
        >
          {{ t('answers.noSamples') }}
        </div>
        <div
          v-else
          class="flex flex-col gap-4"
          data-testid="samples"
        >
          <UCard
            v-for="s in p.samples"
            :key="s.id"
          >
            <div class="flex flex-col gap-4">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  :label="s.scale === 9 ? t('answers.bandMark', { band: mark(s) }) : mark(s)"
                  color="primary"
                  variant="subtle"
                />
                <span class="text-sm text-muted">{{ t('answers.wordsN', { n: s.wordCount }) }}</span>
                <UButton
                  v-if="isAdmin"
                  :label="t('answers.hideSample')"
                  icon="i-lucide-eye-off"
                  size="xs"
                  color="error"
                  variant="ghost"
                  class="ms-auto"
                  @click="hide(s)"
                />
              </div>
              <p class="font-serif leading-7 text-highlighted whitespace-pre-line">
                {{ s.text }}
              </p>
              <div class="rounded-lg bg-elevated/60 p-4 flex flex-col gap-3">
                <p class="text-xs font-semibold text-muted">
                  {{ t('answers.feedback') }}
                </p>
                <p class="text-sm text-toned">
                  {{ s.comment }}
                </p>
                <ul class="grid sm:grid-cols-2 gap-2">
                  <li
                    v-for="c in CRITERIA.filter(k => s.criteria[k] != null)"
                    :key="c"
                    class="flex items-center justify-between gap-2 rounded-md bg-default px-3 py-2 text-sm"
                  >
                    <span class="text-toned">{{ criterionLabel(c) }}</span>
                    <span class="font-semibold text-highlighted">{{ s.criteria[c] }}<span class="text-dimmed font-normal">/{{ s.scale }}</span></span>
                  </li>
                </ul>
                <p
                  v-if="s.examinerFeedback"
                  class="text-sm text-toned border-t border-default pt-3"
                >
                  <span class="font-semibold text-highlighted">{{ t('answers.examinerSaid') }}</span> {{ s.examinerFeedback }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <section v-if="p.related.length">
        <h2 class="text-lg font-semibold text-highlighted mb-3">
          {{ t('answers.moreTasks', { task: name }) }}
        </h2>
        <div class="grid sm:grid-cols-2 gap-3">
          <NuxtLink
            v-for="r in p.related"
            :key="r.slug"
            :to="`/writing/${r.slug}`"
            class="rounded-xl ring ring-default p-3 hover:ring-primary/40"
          >
            <p class="font-medium text-highlighted line-clamp-1">
              {{ r.title }}
            </p>
            <p class="text-xs text-muted line-clamp-2 mt-0.5">
              {{ r.preview }}
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
