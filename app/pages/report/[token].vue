<script setup lang="ts">
import { renderSVG } from 'uqr'

definePageMeta({ guestLayout: true })

/**
 * A mock session's result, announced: opened from its link or the QR code on the printed slip, with
 * no sign-in (the token is the key). The skills' bands or scores, the overall and the level, who ran
 * the mock and when. ?print=1 opens the print dialog (the slip handed over at the desk).
 */
interface Report {
  name: string
  held: { by: string, centre: boolean, title: string, at: string, room: string | null }
  test: { title: string, exam: 'IELTS' | 'MULTILEVEL', module: string }
  skills: string[]
  marks: Record<string, number | null>
  overall: number | null
  cefr: string | null
  releasedAt: string
}
const { t } = useI18n()
const route = useRoute()
const { data: r, error } = await useFetch<Report>(`/api/report/${route.params.token}`)
if (error.value || !r.value) throw createError({ statusCode: 404, statusMessage: t('report.notFound'), fatal: true })
useSeoMeta({ title: () => t('report.title', { name: r.value!.name }), robots: 'noindex' })

const ielts = computed(() => r.value!.test.exam === 'IELTS')
const fmt = (m: number | null) => (m == null ? '—' : ielts.value ? fmtBand(m) : String(m))
const url = useRequestURL()
const qr = computed(() => renderSVG(`${url.origin}/report/${route.params.token}`, { border: 1 }))
const date = (d: string) => localeDate(d, intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
onMounted(() => {
  if (route.query.print) setTimeout(() => window.print(), 400)
})
</script>

<template>
  <div class="w-full max-w-2xl mx-auto py-6 px-4">
    <div
      class="report-sheet rounded-2xl ring ring-default bg-default p-6 sm:p-8 flex flex-col gap-6"
      data-testid="report"
    >
      <div class="flex items-start gap-4">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-muted">
            {{ ielts ? t('report.ieltsMock') : t('report.multilevelMock') }} · {{ r!.held.by }}
          </p>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted mt-1">
            {{ r!.name }}
          </h1>
          <p class="text-sm text-muted mt-1">
            {{ r!.test.title }} · {{ date(r!.held.at) }}<template v-if="r!.held.room">
              · {{ r!.held.room }}
            </template>
          </p>
        </div>
        <!-- eslint-disable vue/no-v-html -- an SVG we made from the page's own address -->
        <div
          class="size-24 shrink-0 [&_svg]:size-full"
          :aria-label="t('report.qr')"
          v-html="qr"
        />
        <!-- eslint-enable vue/no-v-html -->
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          v-for="skill in r!.skills"
          :key="skill"
          class="rounded-xl bg-elevated/60 p-4 text-center"
        >
          <p class="text-xs text-muted">
            {{ skillLabel(skill) }}
          </p>
          <p class="text-2xl font-bold text-highlighted mt-1">
            {{ fmt(r!.marks[skill] ?? null) }}
          </p>
          <p
            v-if="!ielts"
            class="text-[11px] text-dimmed"
          >
            / 75
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between gap-4 rounded-xl bg-primary/10 px-5 py-4">
        <div>
          <p class="text-sm text-muted">
            {{ ielts ? t('report.overallBand') : t('report.overallScore') }}
          </p>
          <p class="text-4xl font-black text-highlighted">
            {{ fmt(r!.overall) }}<span
              v-if="!ielts"
              class="text-lg font-semibold text-muted"
            > / 75</span>
          </p>
        </div>
        <UBadge
          v-if="r!.cefr"
          :label="`CEFR ${r!.cefr}`"
          color="primary"
          variant="solid"
          size="xl"
        />
      </div>

      <p class="text-xs text-dimmed">
        {{ t('report.note', { by: r!.held.by }) }}
      </p>
    </div>

    <div class="mt-6 rounded-2xl bg-elevated/50 p-5 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
      <p class="text-sm text-toned flex-1">
        {{ t('report.keepPractising') }}
      </p>
      <UButton
        to="/tests"
        :label="t('report.practise')"
        icon="i-lucide-arrow-right"
        trailing
      />
    </div>
  </div>
</template>

<style scoped>
/* The slip: only the result sheet is printed. */
@media print {
  :global(body *) { visibility: hidden; }
  .report-sheet, .report-sheet :deep(*) { visibility: visible; }
  .report-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none; }
}
</style>
