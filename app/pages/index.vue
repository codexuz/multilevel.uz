<script setup lang="ts">
/**
 * The landing page, in the manner of SmallTalk2Me's: what the site is over a soft glow, what you get
 * (shown, not told), the newest tests (rendered on the server, so search engines read them), the
 * four skills, how a test is taken, the questions people ask, and the way in. Always the public site.
 */
definePageMeta({ layout: 'public' })

const { loggedIn, me } = useMe()

const { data } = await useFetch<{ items: any[], total: number }>('/api/tests', { query: { limit: 6 } })

useSeoMeta({
  title: 'Free Multilevel English mock tests',
  description: 'Free online Multilevel (CEFR) English practice tests: Listening, Reading, Writing and Speaking in the official format, checked instantly with a score out of 75 and your CEFR level.',
  ogTitle: 'Free Multilevel English mock tests',
  ogDescription: 'Listening, Reading, Writing and Speaking in the official Multilevel format, checked instantly.'
})

const firstName = computed(() => me.value?.name?.split(' ')[0])

const skills = [
  { key: 'LISTENING', title: 'Listening', text: 'Six parts and 35 questions with the recording played as on the day, checked the moment you finish.' },
  { key: 'READING', title: 'Reading', text: 'Five passages and 35 questions side by side, with the line that holds each answer shown in the review.' },
  { key: 'WRITING', title: 'Writing', text: 'Task 1.1, Task 1.2 and Task 2 with a live word count. Download your answers, or have an examiner mark them.' },
  { key: 'SPEAKING', title: 'Speaking', text: 'Four parts with preparation and speaking timers. Listen back to yourself, or send it to an examiner.' }
]

const steps = [
  { title: 'Pick a test', text: 'Every free test opens without an account.' },
  { title: 'Sit it as on the day', text: 'Official timing, layout and question types.' },
  { title: 'See your score', text: 'Out of 75, with your CEFR level, in seconds.' },
  { title: 'Review every answer', text: 'The key for each question, and why it is right.' },
  { title: 'Track your progress', text: 'Sign in to keep every result and see your best.' }
]

const faq = [
  { label: 'Is it really free?', content: 'Yes. Free tests open without an account and are checked instantly. Premium adds the whole library, the explanations behind every answer, and examiner marking for Writing and Speaking.' },
  { label: 'How is my score worked out?', content: 'Listening and Reading answers are checked against the key and converted to the Multilevel scale out of 75 with the official tables. 65+ is C1, 51+ B2 and 38+ B1.' },
  { label: 'Do I need an account?', content: 'No. Without one your answers are checked and shown once. Sign in with Google to keep your results and have Writing and Speaking marked.' },
  { label: 'Is it like the real Multilevel exam?', content: 'The sections, timings, part structure and question types follow the official format, on a screen laid out the way the exam is.' },
  { label: 'Does it work on my phone?', content: 'Yes. Every test works on a phone: on small screens the passage and the questions switch with one tap.' }
]

const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'
</script>

<template>
  <div class="flex flex-col gap-20 sm:gap-28 pb-20 sm:pb-28">
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
            Welcome back, {{ firstName }} 👋
          </p>
          <h1 class="text-[2.1rem] leading-[1.15] sm:text-5xl lg:text-[3.4rem] font-bold text-highlighted text-balance">
            Free <span class="text-accent">Multilevel</span> English mock tests &amp; CEFR level check
          </h1>
          <p class="text-lg text-toned max-w-xl text-pretty">
            Listening, Reading, Writing and Speaking in the official format. Your answers are checked whether you sign in or not, with a score out of 75 and your CEFR level.
          </p>
          <div class="flex flex-wrap gap-3 max-lg:justify-center">
            <UButton
              to="/tests"
              label="Start now"
              size="xl"
              class="px-9 rounded-full text-base font-semibold"
            />
            <UButton
              :to="loggedIn ? '/results' : '/pricing'"
              :label="loggedIn ? 'My results' : 'See Premium'"
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
            />No account needed for free tests
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
            <span class="text-lg font-bold text-primary">CEFR</span>
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
              Upper-int.
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
              Reading · Multilevel Practice Test 1
            </p>
            <p class="text-sm font-semibold text-highlighted">
              58 / 75 · B2 in 41 minutes
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- In numbers -->
    <section
      :class="wrap"
      class="flex flex-col items-center gap-10 text-center"
    >
      <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance max-w-3xl">
        Practise <span class="text-accent">all four skills</span> the way the Multilevel exam tests them
      </h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 w-full max-w-4xl">
        <div
          v-for="stat in [{ n: '35 + 35', l: 'Listening and Reading questions' }, { n: '0–75', l: 'Score, as the exam reports it' }, { n: 'A2–C1', l: 'Your CEFR level' }, { n: '24 h', l: 'Writing and Speaking marked' }]"
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
          <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
            Your score, <span class="text-accent">the moment you finish</span>
          </h2>
          <p class="text-toned text-lg text-pretty max-w-lg">
            Listening and Reading are checked as soon as you hand in: a score out of 75 on the official scale, your CEFR level, and how each part went.
          </p>
        </div>
        <div
          class="rounded-2xl ring ring-default p-5 sm:p-6 max-w-md w-full mx-auto bg-default"
          aria-hidden="true"
        >
          <p class="text-center font-semibold text-highlighted mb-3">
            Your score
          </p>
          <div class="rounded-xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] py-7 text-center text-white">
            <p class="text-6xl font-bold leading-none">
              58<span class="text-2xl opacity-80"> / 75</span>
            </p>
            <p class="mt-2 font-medium">
              CEFR B2
            </p>
          </div>
          <ul class="mt-4 flex flex-col gap-2 text-sm">
            <li
              v-for="(p, i) in [['Part 1 — Notices', '6/6'], ['Part 2 — Matching', '7/8'], ['Part 4 — Multiple choice', '5/9']]"
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
          <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
            Know <span class="text-accent">why</span> every answer is right
          </h2>
          <p class="text-toned text-lg text-pretty max-w-lg">
            The review sets the passage beside the questions, with your answer, the key, and the line in the text that gives it away.
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
            "…every day except Monday" — the passage says the library closes on Mondays.
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
          <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
            Writing and Speaking, <span class="text-accent">marked by an examiner</span>
          </h2>
          <p class="text-toned text-lg text-pretty max-w-lg">
            Write and record in the real format. Practise freely, or hand it in for an examiner's score out of 75 and written feedback, usually within a day.
          </p>
        </div>
        <div
          class="rounded-2xl ring ring-default p-5 sm:p-6 max-w-md w-full mx-auto bg-default"
          aria-hidden="true"
        >
          <div class="flex items-center justify-between">
            <span class="font-semibold text-highlighted">Task 2 — Essay</span>
            <UBadge
              label="214 words"
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
              Examiner's feedback · 56 / 75
            </p>
            <p class="text-sm text-toned">
              Clear position and well-organised paragraphs. Work on linking ideas within paragraphs and vary your sentence openings.
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
          <h2 class="text-2xl sm:text-3xl font-bold text-highlighted">
            Newest <span class="text-accent">tests</span>
          </h2>
          <p class="text-muted mt-1">
            Free ones open without an account.
          </p>
        </div>
        <UButton
          to="/tests"
          label="All tests"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="ghost"
          class="font-semibold"
        />
      </div>
      <div
        v-if="data?.items?.length"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TestCard
          v-for="t in data.items"
          :key="t.id"
          :test="t"
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-clipboard-list"
        title="Tests are on their way"
        description="Check back soon."
        variant="naked"
      />
    </section>

    <!-- The four skills -->
    <section
      :class="wrap"
      class="flex flex-col gap-10"
    >
      <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-center text-balance">
        Why practise on <span class="text-accent">Multilevel</span>?
      </h2>
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
      <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-center text-balance">
        How <span class="text-accent">it works</span>
      </h2>
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
        <h2 class="text-3xl sm:text-[2.6rem] leading-tight font-bold text-highlighted text-balance">
          Frequently asked <span class="text-accent">questions</span>
        </h2>
        <p class="text-muted">
          Anything else? Write to us on Telegram.
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
            Ready to see your level?
          </h2>
          <p class="text-white/85 text-lg">
            Take a free test now. It takes under an hour, and your score comes the moment you finish.
          </p>
          <UButton
            to="/tests"
            label="Start now"
            size="xl"
            color="neutral"
            class="self-start px-9 rounded-full text-base font-semibold bg-white text-[#3f49c9] hover:bg-white/90"
          />
        </div>
      </div>
    </section>
  </div>
</template>
