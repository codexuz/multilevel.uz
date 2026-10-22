<script setup lang="ts">
import type { PublicCentre } from '~/components/centre/Card.vue'

/**
 * The landing page, laid out the way multi-exam prep sites are: one clear promise and one way in,
 * then "choose your exam" as a card for each exam with its own button, what you get (shown, not
 * told), the four skills, how it works, the learning centres that use Mockmee, the questions
 * people ask, and the way in again. No catalogue here: the exam card leads to it. Always the public site.
 */
definePageMeta({ layout: 'public' })

const { loggedIn, me } = useMe()
const { t } = useI18n()
const { setExam } = useExam()

const { data: centres } = await useFetch<PublicCentre[]>('/api/centres', { default: () => [] })
const EXAM_CARDS = computed(() => [
  { exam: 'IELTS' as const, icon: 'i-lucide-globe-2', title: 'IELTS', tag: t('exam.ieltsHint'), lead: t('home.ieltsLead'), points: [1, 2, 3, 4].map(n => t(`home.ielts${n}`)), cta: t('home.ieltsCta') },
  { exam: 'MULTILEVEL' as const, icon: 'i-lucide-flag', title: 'Multilevel', tag: t('exam.multilevelHint'), lead: t('home.multilevelLead'), points: [1, 2, 3, 4].map(n => t(`home.multilevel${n}`)), cta: t('home.multilevelCta') }
])
/** The way in: a guest signs up (onboarding asks their exam); a signed-in user goes to their tests. */
const startTo = computed(() => (loggedIn.value ? '/tests' : '/login?next=/onboarding'))
/** An exam's card: a guest looks round that exam's tests; a signed-in user goes to their own. */
async function openExam(exam: Exam) {
  if (!loggedIn.value) await setExam(exam)
  await navigateTo(loggedIn.value ? '/tests' : `/tests?exam=${exam}`)
}

useSeoMeta({
  title: () => t('home.seoTitle'),
  description: () => t('home.seoDescription'),
  ogTitle: () => t('home.seoTitle'),
  ogDescription: () => t('home.seoOg')
})

const firstName = computed(() => me.value?.name?.split(' ')[0])

const skills = computed(() => ['LISTENING', 'READING', 'WRITING', 'SPEAKING'].map(key => ({ key, title: skillLabel(key), text: t(`home.skillTextBoth.${key}`) })))
const steps = computed(() => [1, 2, 3, 4, 5].map(n => ({ title: t(`home.step${n}`), text: t(`home.step${n}Text`) })))
const faq = computed(() => [1, 2, 3, 4, 5].map(n => ({ label: t(`home.faq${n}`), content: t(`home.faq${n}Answer`) })))
const stats = computed(() => [
  { n: '2', l: t('home.statExams') }, { n: '0–9', l: t('home.statBand') }, { n: '0–75', l: t('home.statScore') }, { n: t('home.statHours'), l: t('home.statMarked') }
])

const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

// Arrived through a friend's invite link (/r/<code>): say what signing up gets them.
const route = useRoute()
const invited = computed(() => route.query.invited === '1' && !loggedIn.value)
</script>

<template>
  <div class="flex flex-col gap-20 sm:gap-28 pb-20 sm:pb-28">
    <div
      v-if="invited"
      :class="wrap"
      class="-mb-16 sm:-mb-24 pt-4"
    >
      <UAlert
        color="primary"
        variant="subtle"
        icon="i-lucide-gift"
        :title="t('home.invitedTitle')"
        :description="t('home.invitedText')"
        :actions="[{ label: t('home.invitedAction'), to: '/login?next=/earn', color: 'primary', variant: 'solid' }]"
      />
    </div>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div
        class="hero-glow absolute inset-0"
        aria-hidden="true"
      />
      <div
        :class="wrap"
        class="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center pt-10 sm:pt-16 lg:pt-20"
      >
        <div class="flex flex-col gap-6 max-lg:text-center max-lg:items-center">
          <p
            v-if="loggedIn && firstName"
            class="text-sm font-semibold text-primary"
          >
            {{ t('home.welcomeBack', { name: firstName }) }} 👋
          </p>
          <i18n-t
            keypath="home.heroTitle"
            tag="h1"
            scope="global"
            class="text-[2.1rem] leading-[1.15] sm:text-5xl lg:text-[3.4rem] font-bold text-highlighted text-balance"
          >
            <template #accent>
              <span class="text-accent">IELTS</span>
            </template>
            <template #second>
              <span class="text-accent">Multilevel</span>
            </template>
          </i18n-t>
          <p class="text-lg text-toned max-w-xl text-pretty">
            {{ t('home.heroText') }}
          </p>
          <div class="flex flex-wrap gap-3 max-lg:justify-center">
            <UButton
              :to="startTo"
              :label="loggedIn ? t('home.toMyTests') : t('home.startFree')"
              trailing-icon="i-lucide-arrow-right"
              size="xl"
              class="px-9 rounded-full text-base font-semibold"
            />
            <UButton
              to="/#exams"
              :label="t('home.chooseExam')"
              size="xl"
              color="neutral"
              variant="outline"
              class="px-7 rounded-full text-base font-semibold"
            />
          </div>
          <p class="text-sm text-muted flex items-center gap-2 max-lg:justify-center">
            <UIcon
              name="i-lucide-circle-check"
              class="size-4 text-success"
            />{{ t('home.noAccount') }}
          </p>
        </div>

        <!-- The picture: a score in a circle, with stickers floating round it -->
        <div
          class="relative mx-auto w-full max-w-72 sm:max-w-md aspect-square"
          aria-hidden="true"
        >
          <div class="absolute inset-[6%] rounded-full bg-gradient-to-br from-primary/15 via-sky-200/30 to-transparent dark:via-sky-400/10" />
          <div class="absolute inset-[18%] rounded-full bg-gradient-to-br from-[#5870f5] to-[#8b9cff] shadow-glow grid place-items-center">
            <img
              src="/illustrations/trophy.svg"
              alt=""
              class="size-1/2 drop-shadow-2xl"
            >
          </div>
          <div class="absolute left-[2%] top-[14%] -rotate-12 rounded-xl bg-default px-3 py-2 shadow-glow ring ring-default">
            <span class="text-lg font-bold text-primary">IELTS</span>
          </div>
          <div class="absolute right-[0%] top-[10%] rotate-6 rounded-xl bg-default p-2 shadow-glow ring ring-default">
            <img
              src="/illustrations/headphones.svg"
              alt=""
              class="size-10"
            >
          </div>
          <div class="absolute right-[2%] bottom-[22%] rotate-12 rounded-xl bg-primary px-3 py-2 text-white shadow-glow">
            <p class="text-xl font-bold leading-none">
              B2
            </p>
            <p class="text-[10px] font-medium opacity-90">
              Multilevel
            </p>
          </div>
          <div class="absolute left-[4%] bottom-[24%] -rotate-6 rounded-xl bg-default p-2 shadow-glow ring ring-default">
            <img
              src="/illustrations/microphone.svg"
              alt=""
              class="size-9"
            >
          </div>
          <div class="absolute inset-x-[12%] bottom-[4%] rounded-xl bg-default px-4 py-2.5 text-center shadow-glow ring ring-default">
            <p class="text-[11px] text-muted">
              {{ skillLabel('READING') }} · IELTS Academic Test 1
            </p>
            <p class="text-sm font-semibold text-highlighted">
              {{ t('home.heroCardIelts') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Choose your exam: a card for each, with its own way in -->
    <section
      id="exams"
      :class="wrap"
      class="flex flex-col items-center gap-8 text-center scroll-mt-24"
    >
      <div class="flex flex-col gap-2 items-center">
        <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance max-w-3xl">
          {{ t('home.twoExams') }}
        </h2>
        <p class="text-toned text-lg max-w-2xl text-pretty">
          {{ t('home.twoExamsText') }}
        </p>
      </div>
      <div class="grid md:grid-cols-2 gap-5 w-full max-w-5xl text-left">
        <article
          v-for="c in EXAM_CARDS"
          :key="c.exam"
          class="flex flex-col gap-5 rounded-3xl p-6 sm:p-8 ring ring-default bg-default shadow-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="size-12 rounded-2xl bg-linear-to-br from-primary-400 to-primary-600 text-white grid place-items-center shadow-md shadow-primary-500/25">
                <UIcon
                  :name="c.icon"
                  class="size-6"
                />
              </div>
              <div>
                <h3 class="text-2xl font-bold text-highlighted leading-tight">
                  {{ c.title }}
                </h3>
                <p class="text-sm text-muted">
                  {{ c.tag }}
                </p>
              </div>
            </div>
          </div>
          <p class="text-toned text-pretty">
            {{ c.lead }}
          </p>
          <ul class="flex flex-col gap-2.5 text-sm text-toned">
            <li
              v-for="point in c.points"
              :key="point"
              class="flex gap-2.5"
            >
              <UIcon
                name="i-lucide-circle-check"
                class="size-5 shrink-0 text-success"
              />{{ point }}
            </li>
          </ul>
          <UButton
            :label="c.cta"
            trailing-icon="i-lucide-arrow-right"
            size="lg"
            class="mt-auto self-start rounded-full px-6"
            @click="openExam(c.exam)"
          />
        </article>
      </div>
      <p class="text-sm text-muted flex items-center gap-2">
        <UIcon
          name="i-lucide-badge-check"
          class="size-4 text-success"
        />{{ t('home.freeTier') }}
      </p>
    </section>

    <!-- In numbers -->
    <section
      :class="wrap"
      class="flex flex-col items-center gap-10 text-center"
    >
      <i18n-t
        keypath="home.allFour"
        tag="h2"
        scope="global"
        class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance max-w-3xl"
      >
        <template #accent>
          <span class="text-accent">{{ t('home.allFourAccent') }}</span>
        </template>
      </i18n-t>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 w-full max-w-4xl">
        <div
          v-for="stat in stats"
          :key="stat.l"
        >
          <p class="text-3xl sm:text-5xl font-bold text-highlighted tabular-nums">
            {{ stat.n }}
          </p>
          <p class="text-sm text-muted mt-1.5">
            {{ stat.l }}
          </p>
        </div>
      </div>
    </section>

    <!-- What you get, shown -->
    <section
      :class="wrap"
      class="flex flex-col gap-16 sm:gap-24"
    >
      <div class="grid lg:grid-cols-2 gap-10 items-center">
        <div class="flex flex-col gap-4 max-lg:text-center max-lg:items-center">
          <img
            src="/illustrations/target.svg"
            alt=""
            class="size-12"
          >
          <i18n-t
            keypath="home.f1Title"
            tag="h2"
            scope="global"
            class="text-2xl sm:text-4xl font-bold text-highlighted text-balance"
          >
            <template #accent>
              <span class="text-accent">{{ t('home.f1Accent') }}</span>
            </template>
          </i18n-t>
          <p class="text-toned text-lg text-pretty max-w-lg">
            {{ t('home.f1Text') }}
          </p>
        </div>
        <div
          class="rounded-2xl ring ring-default p-5 sm:p-6 max-w-md w-full mx-auto bg-default"
          aria-hidden="true"
        >
          <p class="text-center font-semibold text-highlighted mb-3">
            {{ t('home.yourScore') }}
          </p>
          <!-- Each exam on its own scale: an IELTS band, a Multilevel score -->
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] py-6 text-center text-white">
              <p class="text-xs font-semibold uppercase tracking-wide opacity-80">
                IELTS
              </p>
              <p class="mt-1 text-5xl font-bold leading-none">
                7.0
              </p>
              <p class="mt-2 text-sm font-medium">
                CEFR C1
              </p>
            </div>
            <div class="rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] py-6 text-center text-white">
              <p class="text-xs font-semibold uppercase tracking-wide opacity-80">
                Multilevel
              </p>
              <p class="mt-1 text-5xl font-bold leading-none">
                58<span class="text-lg opacity-80"> / 75</span>
              </p>
              <p class="mt-2 text-sm font-medium">
                CEFR B2
              </p>
            </div>
          </div>
          <ul class="mt-4 flex flex-col gap-2 text-sm">
            <li
              v-for="(p, i) in [[t('home.demoPart1'), '6/6'], [t('home.demoPart2'), '7/8'], [t('home.demoPart4'), '5/9']]"
              :key="i"
              class="flex items-center gap-3"
            >
              <UIcon
                :name="i < 2 ? 'i-lucide-circle-check' : 'i-lucide-circle-dot'"
                class="size-5"
                :class="i < 2 ? 'text-success' : 'text-warning'"
              />
              <span class="flex-1 text-toned">{{ p[0] }}</span><span class="font-semibold text-highlighted">{{ p[1] }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-10 items-center">
        <div class="flex flex-col gap-4 max-lg:text-center max-lg:items-center lg:order-2">
          <img
            src="/illustrations/bulb.svg"
            alt=""
            class="size-12"
          >
          <i18n-t
            keypath="home.f2Title"
            tag="h2"
            scope="global"
            class="text-2xl sm:text-4xl font-bold text-highlighted text-balance"
          >
            <template #accent>
              <span class="text-accent">{{ t('home.f2Accent') }}</span>
            </template>
          </i18n-t>
          <p class="text-toned text-lg text-pretty max-w-lg">
            {{ t('home.f2Text') }}
          </p>
        </div>
        <div
          class="rounded-2xl ring ring-default p-5 sm:p-6 max-w-md w-full mx-auto bg-default lg:order-1"
          aria-hidden="true"
        >
          <p class="text-sm leading-7 text-toned">
            The library is open every day except <mark class="rounded px-1 bg-warning/25 text-highlighted">Monday</mark>, from nine in the morning until eight in the evening.
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span class="size-7 rounded-full bg-error text-white grid place-items-center text-xs font-bold">3</span>
            <span class="rounded-lg ring ring-error/40 bg-error/5 px-3 py-1 line-through text-muted">Sunday</span>
            <UIcon
              name="i-lucide-check"
              class="size-4 text-success"
            />
            <span class="font-semibold text-success">Monday</span>
          </div>
          <p class="mt-3 text-xs text-muted">
            {{ t('home.demoEvidence') }}
          </p>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-10 items-center">
        <div class="flex flex-col gap-4 max-lg:text-center max-lg:items-center">
          <img
            src="/illustrations/writing.svg"
            alt=""
            class="size-12"
          >
          <i18n-t
            keypath="home.f3Title"
            tag="h2"
            scope="global"
            class="text-2xl sm:text-4xl font-bold text-highlighted text-balance"
          >
            <template #accent>
              <span class="text-accent">{{ t('home.f3Accent') }}</span>
            </template>
          </i18n-t>
          <p class="text-toned text-lg text-pretty max-w-lg">
            {{ t('home.f3Text') }}
          </p>
        </div>
        <div
          class="rounded-2xl ring ring-default p-5 sm:p-6 max-w-md w-full mx-auto bg-default"
          aria-hidden="true"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold text-highlighted">{{ t('home.demoTask') }}</span>
            <UBadge
              :label="t('home.demoWords')"
              color="primary"
              variant="soft"
              size="sm"
            />
          </div>
          <p class="mt-3 text-sm leading-6 text-muted line-clamp-3 font-serif">
            Some people believe that practical skills such as cooking and managing money should be taught at school. In my opinion, schools should…
          </p>
          <div class="mt-4 rounded-xl bg-elevated p-4">
            <p class="text-xs font-semibold text-muted mb-1">
              {{ t('home.demoFeedback') }}
            </p>
            <p class="text-sm text-toned">
              {{ t('home.demoFeedbackText') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- The four skills -->
    <section
      :class="wrap"
      class="flex flex-col gap-10"
    >
      <i18n-t
        keypath="home.why"
        tag="h2"
        scope="global"
        class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-center text-balance"
      >
        <template #accent>
          <span class="text-accent">Mockmee</span>
        </template>
      </i18n-t>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="s in skills"
          :key="s.key"
          class="flex sm:flex-col items-start sm:items-center sm:text-center gap-4 sm:gap-3 rounded-2xl ring ring-default p-5 sm:p-7"
        >
          <div class="size-14 sm:size-20 shrink-0 rounded-2xl bg-elevated grid place-items-center">
            <img
              :src="SKILL_ART[s.key]"
              alt=""
              class="size-9 sm:size-12"
            >
          </div>
          <div class="flex flex-col gap-1.5 sm:items-center">
            <h3 class="text-lg font-bold text-highlighted">
              {{ s.title }}
            </h3>
            <p class="text-sm text-muted text-pretty">
              {{ s.text }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section
      id="how"
      :class="wrap"
      class="flex flex-col gap-10 scroll-mt-24"
    >
      <i18n-t
        keypath="home.howTitle"
        tag="h2"
        scope="global"
        class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-center text-balance"
      >
        <template #accent>
          <span class="text-accent">{{ t('home.howAccent') }}</span>
        </template>
      </i18n-t>
      <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <li
          v-for="(s, i) in steps"
          :key="s.title"
          class="flex lg:flex-col gap-4 lg:gap-3 rounded-2xl bg-elevated p-5"
        >
          <span class="size-9 shrink-0 rounded-full bg-primary text-white grid place-items-center font-bold">{{ i + 1 }}</span>
          <div>
            <p class="font-semibold text-highlighted">
              {{ s.title }}
            </p>
            <p class="text-sm text-muted mt-0.5">
              {{ s.text }}
            </p>
          </div>
        </li>
      </ol>
    </section>

    <!-- The learning centres that use Mockmee -->
    <section
      v-if="centres.length"
      :class="wrap"
      class="flex flex-col gap-8"
    >
      <div class="flex flex-col gap-2 items-center text-center">
        <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance">
          {{ t('home.centresTitle') }}
        </h2>
        <p class="text-toned text-lg max-w-2xl text-pretty">
          {{ t('home.centresText') }}
        </p>
      </div>
      <CentreStrip :centres="centres" />
    </section>

    <!-- Questions -->
    <section
      id="faq"
      :class="wrap"
      class="grid lg:grid-cols-[1fr_1.4fr] gap-8 items-start scroll-mt-24"
    >
      <div class="flex flex-col gap-3 max-lg:text-center max-lg:items-center">
        <i18n-t
          keypath="home.faqTitle"
          tag="h2"
          scope="global"
          class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance"
        >
          <template #accent>
            <span class="text-accent">{{ t('home.faqAccent') }}</span>
          </template>
        </i18n-t>
        <p class="text-muted">
          {{ t('home.faqMore') }}
        </p>
        <img
          src="/illustrations/chat.svg"
          alt=""
          class="size-24 mt-2 max-lg:hidden"
        >
      </div>
      <UAccordion
        :items="faq"
        class="rounded-2xl ring ring-default px-5"
      />
    </section>

    <!-- Last call -->
    <section :class="wrap">
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-12 sm:px-14 sm:py-16 text-white">
        <img
          src="/illustrations/rocket.svg"
          alt=""
          class="absolute -right-4 -bottom-6 size-40 sm:size-60 drop-shadow-2xl"
          aria-hidden="true"
        >
        <div class="relative max-w-xl flex flex-col gap-4">
          <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-balance">
            {{ t('home.ctaTitle') }}
          </h2>
          <p class="text-white/85 text-lg">
            {{ t('home.ctaText') }}
          </p>
          <UButton
            :to="startTo"
            :label="loggedIn ? t('home.toMyTests') : t('home.startFree')"
            size="xl"
            color="neutral"
            class="self-start px-9 rounded-full text-base font-semibold bg-white text-[#3f49c9] hover:bg-white/90"
          />
        </div>
      </div>
    </section>
  </div>
</template>
