<script setup lang="ts">
/**
 * A whole test as a printed paper, for Premium: Listening and Reading parts with their passages and
 * questions (drawn as the review draws them, the gaps left empty), Writing tasks with lines to
 * write on, Speaking cards, and the answer key at the end. "Download PDF" opens the browser's print
 * window, where the PDF is saved; with ?download=1 (the button on a test card) it opens by itself
 * once the pictures have loaded.
 */
definePageMeta({ layout: false })
const { t } = useI18n()
const route = useRoute()
const slug = String(route.params.slug)
const config = useRuntimeConfig()
const site = String(config.public.siteUrl || 'https://mockmee.uz').replace(/^https?:\/\//, '').replace(/\/$/, '')

const { data, error } = await useFetch<{ test: { slug: string, title: string, description: string | null }, sections: any[], key: { skill: string, answers: { number: number, answers: string[] }[] }[] }>(`/api/tests/${slug}/paper`)
useSeoMeta({ title: () => (data.value ? `${data.value.test.title} (PDF)` : 'PDF'), robots: 'noindex' })

const withKey = ref(true)
const keyText = (answers: string[]) => answers.map(a => a.replace(/\|/g, ' / ')).join(', ') || '—'
const lines = (taskNumber: number) => (taskNumber >= 3 ? 24 : 18)

function download() {
  window.print()
}
onMounted(async () => {
  if (!route.query.download || !data.value) return
  // Print once the pictures are in, or they are missing from the PDF.
  await Promise.all([...document.images].map(img => (img.complete ? null : new Promise(r => (img.onload = img.onerror = r)))))
  setTimeout(download, 300)
})
</script>

<template>
  <div class="pdf-page min-h-dvh bg-muted print:bg-white">
    <!-- The bar above the paper (not printed) -->
    <div class="print:hidden sticky top-0 z-10 border-b border-default bg-default/95 backdrop-blur">
      <div class="mx-auto max-w-[210mm] px-4 py-3 flex flex-wrap items-center gap-3">
        <UButton
          :to="`/tests/${slug}`"
          icon="i-lucide-arrow-left"
          :label="t('common.back')"
          color="neutral"
          variant="ghost"
        />
        <USwitch
          v-if="data?.key.length"
          v-model="withKey"
          :label="t('pdf.withKey')"
          class="ms-auto"
        />
        <UButton
          :label="t('pdf.download')"
          icon="i-lucide-download"
          :disabled="!data"
          :class="data?.key.length ? '' : 'ms-auto'"
          @click="download"
        />
      </div>
      <p class="mx-auto max-w-[210mm] px-4 pb-2 text-xs text-muted">
        {{ t('pdf.hint') }}
      </p>
    </div>

    <div
      v-if="error"
      class="mx-auto max-w-lg p-8"
    >
      <UAlert
        :color="error.statusCode === 402 ? 'warning' : 'error'"
        variant="subtle"
        :icon="error.statusCode === 402 ? 'i-lucide-sparkles' : 'i-lucide-circle-alert'"
        :title="error.statusCode === 402 ? t('pdf.premium') : t('pdf.notFound')"
        :description="error.statusCode === 402 ? t('pdf.premiumText') : undefined"
        :actions="error.statusCode === 402 ? [{ label: t('nav.premium'), to: `/pricing?from=${encodeURIComponent(`/tests/${slug}`)}` }] : []"
      />
    </div>

    <!-- The paper -->
    <article
      v-else-if="data"
      class="paper mx-auto my-6 print:my-0 max-w-[210mm] bg-white text-black px-[14mm] py-[12mm] print:p-0 shadow-sm print:shadow-none"
    >
      <header class="flex items-center justify-between gap-4 border-b-2 border-black pb-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold">
            {{ data.test.title }}
          </h1>
          <p class="text-xs mt-1">
            Multilevel (CEFR) · {{ data.sections.map(s => skillLabel(s.skill)).join(' · ') }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <img
            src="/icon.svg"
            alt=""
            class="size-8 rounded-md"
          >
          <div class="leading-tight">
            <p class="font-bold">
              Mockmee
            </p>
            <p class="text-[10px]">
              {{ site }}
            </p>
          </div>
        </div>
      </header>

      <section
        v-for="(s, si) in data.sections"
        :key="s.skill"
        class="paper-section"
        :class="si > 0 ? 'break-before-page pt-2' : ''"
      >
        <h2 class="text-xl font-bold uppercase tracking-wide mb-1">
          {{ skillLabel(s.skill) }}
        </h2>
        <p class="text-xs mb-4">
          {{ t('pdf.time', { n: Math.round((s.seconds ?? 0) / 60) }) }}
          <template v-if="s.skill === 'LISTENING'">
            · {{ t('pdf.listeningNote', { site }) }}
          </template>
        </p>

        <!-- Listening and Reading: part by part -->
        <div
          v-for="(p, pi) in s.parts"
          :key="p.id"
          class="paper-part"
          :class="Number(pi) > 0 && s.skill === 'READING' ? 'break-before-page pt-2' : 'mt-8'"
        >
          <h3 class="font-bold text-lg border-b border-black/40 pb-1 mb-3">
            {{ t('pdf.part', { n: p.partNumber }) }}<span v-if="p.from && p.to"> · {{ t('pdf.questions', { from: p.from, to: p.to }) }}</span>
          </h3>
          <div
            v-if="s.skill === 'READING' && p.passage"
            class="mb-6"
          >
            <p
              v-if="p.title"
              class="font-bold mb-2"
            >
              {{ p.title }}
            </p>
            <div
              class="rich-content reading-passage leading-7 text-[13px]"
              v-html="p.passage"
            />
          </div>
          <div class="space-y-6 text-[13px]">
            <ReviewGroup
              v-for="g in p.groups"
              :key="g.id"
              :group="g"
              :show-key="false"
              blank
              class="break-inside-avoid-page"
            />
          </div>
        </div>

        <!-- Writing: each task, with lines to write on -->
        <div
          v-for="(task, ti) in s.tasks"
          :key="task.id"
          class="paper-part"
          :class="Number(ti) > 0 ? 'break-before-page pt-2' : 'mt-6'"
        >
          <h3 class="font-bold text-lg border-b border-black/40 pb-1 mb-3">
            {{ writingTaskLabel(task.taskNumber) }} · {{ t('pdf.minWords', { n: task.minWords }) }}
          </h3>
          <div
            class="rich-content text-[13px] leading-6"
            v-html="task.prompt"
          />
          <img
            v-if="task.imageUrl"
            :src="mediaUrl(task.imageUrl)"
            alt=""
            class="mt-3 max-h-[90mm] w-auto border border-black/20"
          >
          <div class="mt-4">
            <div
              v-for="n in lines(task.taskNumber)"
              :key="n"
              class="h-[8mm] border-b border-black/30"
            />
          </div>
        </div>

        <!-- Speaking: the questions and cards -->
        <div
          v-for="part in s.speaking"
          :key="part.id"
          class="paper-part mt-6 break-inside-avoid-page"
        >
          <h3 class="font-bold text-lg border-b border-black/40 pb-1 mb-3">
            {{ speakingPartLabel(part.partNumber) }}
          </h3>
          <img
            v-if="part.imageUrl"
            :src="mediaUrl(part.imageUrl)"
            alt=""
            class="mb-3 max-h-[70mm] w-auto border border-black/20"
          >
          <div
            v-if="part.cueCard"
            class="rich-content speaking-card text-[13px] leading-6 border border-black/40 rounded p-3 mb-3"
            v-html="part.cueCard"
          />
          <ol
            v-if="part.questions?.length"
            class="list-decimal ps-5 text-[13px] space-y-1"
          >
            <li
              v-for="q in part.questions"
              :key="q.id"
            >
              {{ q.text }}
            </li>
          </ol>
        </div>
      </section>

      <!-- The answer key -->
      <section
        v-if="withKey && data.key.length"
        class="break-before-page pt-2"
      >
        <h2 class="text-xl font-bold uppercase tracking-wide mb-4">
          {{ t('pdf.key') }}
        </h2>
        <div
          v-for="k in data.key"
          :key="k.skill"
          class="mb-6"
        >
          <h3 class="font-bold mb-2">
            {{ skillLabel(k.skill) }}
          </h3>
          <ol class="columns-2 sm:columns-3 print:columns-3 gap-6 text-[13px]">
            <li
              v-for="a in k.answers"
              :key="a.number"
              class="break-inside-avoid py-0.5"
            >
              <span class="font-bold tabular-nums">{{ a.number }}.</span> {{ keyText(a.answers) }}
            </li>
          </ol>
        </div>
      </section>

      <footer class="mt-10 pt-3 border-t border-black/30 text-[10px] flex justify-between">
        <span>{{ data.test.title }}</span>
        <span>Mockmee · {{ site }}</span>
      </footer>
    </article>
  </div>
</template>

<style>
@page {
  size: A4;
  margin: 14mm 14mm 16mm;
}
@media print {
  html, body {
    background: #fff !important;
  }
  /* The paper is black on white, whatever the screen's theme. */
  .pdf-page, .pdf-page * {
    color: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
.paper .rich-content table {
  border-collapse: collapse;
}
.paper .rich-content th, .paper .rich-content td {
  border: 1px solid rgb(0 0 0 / 0.35);
  padding: 0.25rem 0.5rem;
  vertical-align: top;
}
</style>
