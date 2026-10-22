<script setup lang="ts">
import type { Pack } from '~/utils/billing'

/**
 * The landing page, in the manner of SmallTalk2Me's: what the site is over a soft glow (mock tests
 * for IELTS and for Multilevel, the exam picked here), the two exams side by side, what you get
 * (shown, not told), test packs, the newest tests of the exam (rendered on the server, so search
 * engines read them), the four skills, how a test is taken, the questions people ask, and the way
 * in. Always the public site.
 */
definePageMeta({ layout: 'public' })

const { loggedIn, me } = useMe()
const { t } = useI18n()
const { exam } = useExam()

const { data } = await useFetch<{ items: any[], total: number }>('/api/tests', { query: computed(() => ({ limit: 6, exam: exam.value })) })
const { data: packs } = await useFetch<Pack[]>('/api/packs', { query: computed(() => ({ exam: exam.value })), default: () => [] })
const EXAM_CARDS = computed(() => [
  { exam: 'IELTS' as const, icon: 'i-lucide-globe-2', title: 'IELTS', points: [1, 2, 3, 4].map(n => t(`home.ielts${n}`)) },
  { exam: 'MULTILEVEL' as const, icon: 'i-lucide-flag', title: 'Multilevel', points: [1, 2, 3, 4].map(n => t(`home.multilevel${n}`)) }
])

useSeoMeta({
  title: () => t('home.seoTitle'),
  description: () => t('home.seoDescription'),
  ogTitle: () => t('home.seoTitle'),
  ogDescription: () => t('home.seoOg')
})

const firstName = computed(() => me.value?.name?.split(' ')[0])

const skills = computed(() => ['LISTENING', 'READING', 'WRITING', 'SPEAKING'].map(key => ({ key, title: skillLabel(key), text: t(exam.value === 'IELTS' ? `home.skillTextIelts.${key}` : `home.skillText.${key}`) })))
const steps = computed(() => [1, 2, 3, 4, 5].map(n => ({ title: t(`home.step${n}`), text: t(`home.step${n}Text`) })))
const faq = computed(() => [1, 2, 3, 4, 5].map(n => ({ label: t(`home.faq${n}`), content: t(`home.faq${n}Answer`) })))
const stats = computed(() => [
  { n: '2', l: t('home.statExams') }, { n: exam.value === 'IELTS' ? '0–9' : '0–75', l: exam.value === 'IELTS' ? t('home.statBand') : t('home.statScore') }, { n: 'A2–C2', l: t('home.statLevel') }, { n: t('home.statHours'), l: t('home.statMarked') }
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
          <div class="flex flex-col gap-2 max-lg:items-center">
            <p class="text-sm font-semibold text-muted">
              {{ t('exam.choose') }}
            </p>
            <ExamSwitch size="lg" />
          </div>
          <div class="flex flex-wrap gap-3 max-lg:justify-center">
            <UButton
              :to="`/tests?exam=${exam}`"
              :label="t('pub.startNow')"
              size="xl"
              class="px-9 rounded-full text-base font-semibold"
            />
            <UButton
              :to="loggedIn ? '/results' : '/pricing'"
              :label="loggedIn ? t('nav.results') : t('home.seePremium')"
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
            <span class="text-lg font-bold text-primary">{{ exam === 'IELTS' ? 'IELTS' : 'CEFR' }}</span>
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
              {{ exam === 'IELTS' ? '7.0' : 'B2' }}
            </p>
            <p class="text-[10px] font-medium opacity-90">
              {{ exam === 'IELTS' ? t('result.band') : t('home.upperInt') }}
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
              {{ skillLabel('READING') }} · {{ exam === 'IELTS' ? 'IELTS Academic Test 1' : 'Multilevel Practice Test 1' }}
            </p>
            <p class="text-sm font-semibold text-highlighted">
              {{ exam === 'IELTS' ? t('home.heroCardIelts') : t('home.heroCard') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- The two exams -->
    <section
      :class="wrap"
      class="flex flex-col items-center gap-8 text-center"
    >
      <div class="flex flex-col gap-2 items-center">
        <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance max-w-3xl">
          {{ t('home.twoExams') }}
        </h2>
        <p class="text-toned text-lg max-w-2xl text-pretty">
          {{ t('home.twoExamsText') }}
        </p>
      </div>
      <div class="grid md:grid-cols-2 gap-4 w-full max-w-4xl text-left">
        <NuxtLink
          v-for="c in EXAM_CARDS"
          :key="c.exam"
          :to="`/tests?exam=${c.exam}`"
          class="group flex flex-col gap-4 rounded-2xl p-6 ring transition-all hover:-translate-y-0.5 hover:shadow-md"
          :class="exam === c.exam ? 'ring-2 ring-primary bg-primary/5' : 'ring-default bg-default'"
        >
          <div class="flex items-center gap-3">
            <div class="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <UIcon
                :name="c.icon"
                class="size-6"
              />
            </div>
            <h3 class="text-xl font-bold text-highlighted">
              {{ c.title }}
            </h3>
          </div>
          <ul class="flex flex-col gap-2 text-sm text-toned">
            <li
              v-for="point in c.points"
              :key="point"
              class="flex gap-2"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4 mt-0.5 shrink-0 text-success"
              />{{ point }}
            </li>
          </ul>
          <span class="mt-auto text-sm font-semibold text-primary flex items-center gap-1 group-hover:gap-1.5 transition-all">
            {{ t('home.seeTests', { exam: c.title }) }}<UIcon
              name="i-lucide-arrow-right"
              class="size-4"
            />
          </span>
        </NuxtLink>
      </div>
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
          <div class="rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] py-7 text-center text-white">
            <p
              v-if="exam === 'IELTS'"
              class="text-6xl font-bold leading-none"
            >
              <span class="text-2xl opacity-80 me-2">{{ t('result.band') }}</span>7.0
            </p>
            <p
              v-else
              class="text-6xl font-bold leading-none"
            >
              58<span class="text-2xl opacity-80"> / 75</span>
            </p>
            <p class="mt-2 font-medium">
              {{ exam === 'IELTS' ? 'CEFR C1' : 'CEFR B2' }}
            </p>
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

    <!-- Newest tests -->
    <section
      :class="wrap"
      class="flex flex-col gap-6"
    >
      <div class="flex items-end justify-between gap-3">
        <div>
          <i18n-t
            keypath="home.newest"
            tag="h2"
            scope="global"
            class="text-2xl sm:text-3xl font-bold text-highlighted"
          >
            <template #accent>
              <span class="text-accent">{{ t('home.newestAccent') }}</span>
            </template>
          </i18n-t>
          <p class="text-muted mt-1">
            {{ t('home.newestText') }}
          </p>
        </div>
        <UButton
          :to="`/tests?exam=${exam}`"
          :label="t('pub.allTests')"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="ghost"
          class="font-semibold"
        />
      </div>
      <div
        v-if="packs.length"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <PackCard
          v-for="p in packs.slice(0, 3)"
          :key="p.id"
          :pack="p"
        />
      </div>
      <div
        v-if="data?.items?.length"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TestCard
          v-for="test in data.items"
          :key="test.id"
          :test="test"
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-clipboard-list"
        :title="t('home.emptyTitle')"
        :description="t('home.emptyText')"
        variant="naked"
      />
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
            to="/tests"
            :label="t('pub.startNow')"
            size="xl"
            color="neutral"
            class="self-start px-9 rounded-full text-base font-semibold bg-white text-[#3f49c9] hover:bg-white/90"
          />
        </div>
      </div>
    </section>
  </div>
</template>
