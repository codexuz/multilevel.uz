<script setup lang="ts">
/**
 * A whole test as a printed paper, for Premium, set the way the Multilevel mock papers are: plain
 * Arial, each part under a red centred heading and flowing on from the one before, passages in full,
 * questions with "A)" options and "(7)______" gaps (PaperGroup), Writing tasks with lines to write
 * on, Speaking cards, and the answer key at the end. Each section starts a page. "Download PDF"
 * opens the browser's print window, where the PDF is saved; with ?download=1 (the button on a test
 * card) it opens by itself once the pictures have loaded.
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
      class="paper mx-auto my-6 print:my-0 max-w-[210mm] bg-white text-black px-[16mm] py-[14mm] print:p-0 shadow-sm print:shadow-none"
    >
      <header class="flex items-baseline justify-between gap-4 text-[8.5pt] pb-2 mb-4 border-b border-black/30">
        <span class="font-bold">{{ data.test.title }}</span>
        <span>Mockmee · {{ site }}</span>
      </header>

      <section
        v-for="(s, si) in data.sections"
        :key="s.skill"
        :class="si > 0 ? 'break-before-page' : ''"
      >
        <p class="paper-section">
          {{ skillLabel(s.skill) }} · {{ t('pdf.time', { n: Math.round((s.seconds ?? 0) / 60) }) }}
        </p>
        <p
          v-if="s.skill === 'LISTENING'"
          class="text-center text-[8.5pt] -mt-2 mb-2"
        >
          {{ t('pdf.listeningNote', { site }) }}
        </p>

        <!-- Listening and Reading: part after part -->
        <div
          v-for="p in s.parts"
          :key="p.id"
        >
          <h2 class="paper-part">
            {{ s.skill === 'READING' ? `PART ${p.partNumber}` : `Part ${p.partNumber}` }}
          </h2>
          <template v-if="s.skill === 'READING' && p.passage">
            <p
              v-if="p.title"
              class="paper-title"
            >
              {{ p.title }}
            </p>
            <div
              class="rich-content paper-passage"
              v-html="p.passage"
            />
          </template>
          <PaperGroup
            v-for="g in p.groups"
            :key="g.id"
            :group="g"
            class="mt-3"
          />
        </div>

        <!-- Writing: each task, with lines to write on -->
        <div
          v-for="(task, ti) in s.tasks"
          :key="task.id"
          :class="Number(ti) > 0 ? 'break-before-page' : ''"
        >
          <h2 class="paper-part">
            {{ writingTaskLabel(task.taskNumber).toUpperCase() }}
          </h2>
          <div
            class="rich-content"
            v-html="task.prompt"
          />
          <p class="mt-1">
            {{ t('pdf.minWords', { n: task.minWords }) }}
          </p>
          <img
            v-if="task.imageUrl"
            :src="mediaUrl(task.imageUrl)"
            alt=""
            class="mx-auto mt-3 max-h-[90mm] w-auto"
          >
          <div class="mt-4">
            <div
              v-for="n in lines(task.taskNumber)"
              :key="n"
              class="h-[8mm] border-b border-black/40"
            />
          </div>
        </div>

        <!-- Speaking: the questions and the cards -->
        <div
          v-for="part in s.speaking"
          :key="part.id"
          class="break-inside-avoid-page"
        >
          <h2 class="paper-part">
            {{ speakingPartLabel(part.partNumber) }}
          </h2>
          <img
            v-if="part.imageUrl"
            :src="mediaUrl(part.imageUrl)"
            alt=""
            class="mx-auto mb-3 max-h-[70mm] w-auto"
          >
          <div
            v-if="part.cueCard"
            class="rich-content paper-box speaking-card mb-2"
            v-html="part.cueCard"
          />
          <p
            v-for="(q, qi) in part.questions"
            :key="q.id"
          >
            {{ Number(qi) + 1 }}. {{ q.text }}
          </p>
        </div>
      </section>

      <!-- The answer key -->
      <section
        v-if="withKey && data.key.length"
        class="break-before-page"
      >
        <h2 class="paper-part">
          {{ t('pdf.key').toUpperCase() }}
        </h2>
        <div
          v-for="k in data.key"
          :key="k.skill"
          class="mb-5"
        >
          <p class="font-bold mb-1">
            {{ skillLabel(k.skill) }}
          </p>
          <ol class="columns-3 gap-6">
            <li
              v-for="a in k.answers"
              :key="a.number"
              class="break-inside-avoid"
            >
              {{ a.number }}. {{ keyText(a.answers) }}
            </li>
          </ol>
        </div>
      </section>
    </article>
  </div>
</template>

<style>
@page {
  size: A4;
  margin: 18mm 16mm 16mm;
}
@media print {
  html, body {
    background: #fff !important;
  }
  /* Black on white, whatever the screen's theme; the part headings and letters stay red. */
  .pdf-page, .pdf-page * {
    color: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-page .paper-part, .pdf-page .paper-red {
    color: #e3000f !important;
  }
}
.paper {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.38;
}
.paper .paper-section {
  text-align: center;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 9pt;
  margin-bottom: 0.6rem;
}
.paper .paper-part {
  color: #e3000f;
  text-align: center;
  font-size: 13pt;
  font-weight: 400;
  margin: 1.1rem 0 0.6rem;
}
.paper .paper-title {
  color: #e3000f;
  text-align: center;
  margin: 0.5rem 0 0.3rem;
}
.paper .paper-red {
  color: #e3000f;
}
.paper .paper-instruction {
  margin-bottom: 0.4rem;
}
.paper .paper-passage p {
  margin: 0;
}
.paper .paper-gaps {
  line-height: 1.75;
}
.paper .paper-dots::after {
  content: " ……………………";
  letter-spacing: 0.05em;
}
.paper .paper-box {
  border: 1px solid #000;
  padding: 0.5rem 0.9rem;
  width: fit-content;
  max-width: 100%;
}
.paper .speaking-card {
  width: auto;
}
.paper .paper-table, .paper .rich-content table {
  border-collapse: collapse;
  width: 100%;
}
.paper .paper-table th, .paper .paper-table td, .paper .rich-content th, .paper .rich-content td {
  border: 1px solid #000;
  padding: 0.25rem 0.5rem;
  vertical-align: top;
  text-align: left;
}
</style>
