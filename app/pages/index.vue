<script setup lang="ts">
/**
 * The front page, in the manner of SmallTalk2Me's: what the site is over a soft glow, the newest
 * tests (rendered on the server, so search engines read them), the four skills, how a test is taken,
 * and the questions people ask.
 */
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
</script>

<template>
  <AppPage
    title="Home"
    icon="i-lucide-house"
  >
    <div class="flex flex-col gap-16 sm:gap-20 max-w-6xl w-full mx-auto">
      <!-- Hero -->
      <section class="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-4 overflow-hidden">
        <div
          class="hero-glow absolute inset-0 -z-0"
          aria-hidden="true"
        />
        <div class="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div class="flex flex-col gap-5 max-lg:text-center max-lg:items-center">
            <p
              v-if="loggedIn && firstName"
              class="text-sm font-medium text-primary"
            >
              Welcome back, {{ firstName }} 👋
            </p>
            <h1 class="text-[2rem] leading-tight sm:text-5xl font-bold text-highlighted text-balance">
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
                class="px-8 rounded-full text-base font-semibold"
              />
              <UButton
                v-if="loggedIn"
                to="/results"
                label="My results"
                size="xl"
                color="neutral"
                variant="outline"
                class="px-6 rounded-full text-base"
              />
              <UButton
                v-else
                to="/login"
                label="Sign in"
                size="xl"
                color="neutral"
                variant="outline"
                class="px-6 rounded-full text-base"
              />
            </div>
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

      <!-- What it is, in numbers -->
      <section class="flex flex-col items-center gap-8 text-center">
        <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance max-w-3xl">
          Practise <span class="text-accent">all four skills</span> the way the Multilevel exam tests them
        </h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 w-full max-w-4xl">
          <div
            v-for="stat in [{ n: '35 + 35', l: 'Listening and Reading questions' }, { n: '0–75', l: 'Score, as the exam reports it' }, { n: 'A2–C1', l: 'Your CEFR level' }, { n: '24 h', l: 'Writing and Speaking marked' }]"
            :key="stat.l"
          >
            <p class="text-3xl sm:text-4xl font-bold text-highlighted tabular-nums">
              {{ stat.n }}
            </p>
            <p class="text-sm text-muted mt-1">
              {{ stat.l }}
            </p>
          </div>
        </div>
      </section>

      <!-- Newest tests -->
      <section class="flex flex-col gap-5">
        <div class="flex items-end justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold text-highlighted">
              Newest tests
            </h2>
            <p class="text-sm text-muted">
              Free ones open without an account.
            </p>
          </div>
          <UButton
            to="/tests"
            label="All tests"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
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
      <section class="flex flex-col gap-8">
        <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-center text-balance">
          Why practise on <span class="text-accent">Multilevel</span>?
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="s in skills"
            :key="s.key"
            class="flex sm:flex-col items-start sm:items-center sm:text-center gap-4 sm:gap-3 rounded-xl ring ring-default p-4 sm:p-6"
          >
            <div class="size-14 sm:size-20 shrink-0 rounded-2xl bg-elevated grid place-items-center">
              <img
                :src="SKILL_ART[s.key]"
                alt=""
                class="size-9 sm:size-12"
              >
            </div>
            <h3 class="text-lg font-bold text-highlighted">
              {{ s.title }}
            </h3>
            <p class="text-sm text-muted text-pretty">
              {{ s.text }}
            </p>
          </div>
        </div>
      </section>

      <!-- How it works -->
      <section class="flex flex-col gap-8">
        <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-center text-balance">
          How <span class="text-accent">it works</span>
        </h2>
        <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <li
            v-for="(s, i) in steps"
            :key="s.title"
            class="flex lg:flex-col gap-4 lg:gap-3 rounded-xl bg-elevated p-5"
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
      <section class="grid lg:grid-cols-[1fr_1.4fr] gap-8 items-start">
        <div class="flex flex-col gap-3 max-lg:text-center max-lg:items-center">
          <h2 class="text-2xl sm:text-4xl font-bold text-highlighted text-balance">
            Frequently asked <span class="text-accent">questions</span>
          </h2>
          <p class="text-muted">
            Anything else? Write to us on Telegram.
          </p>
          <img
            src="/illustrations/bulb.svg"
            alt=""
            class="size-24 mt-2 max-lg:hidden"
          >
        </div>
        <UAccordion
          :items="faq"
          class="rounded-xl ring ring-default px-5"
        />
      </section>

      <!-- Last call -->
      <section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#5870f5] to-[#8b9cff] px-6 py-10 sm:px-12 sm:py-14 text-white">
        <img
          src="/illustrations/rocket.svg"
          alt=""
          class="absolute -right-4 -bottom-6 size-40 sm:size-52 opacity-95 drop-shadow-2xl"
          aria-hidden="true"
        >
        <div class="relative max-w-xl flex flex-col gap-4">
          <h2 class="text-2xl sm:text-4xl font-bold text-balance">
            Ready to see your level?
          </h2>
          <p class="text-white/85">
            Take a free test now. It takes under an hour, and your score comes the moment you finish.
          </p>
          <UButton
            to="/tests"
            label="Start now"
            size="xl"
            color="neutral"
            class="self-start px-8 rounded-full text-base font-semibold bg-white text-[#3f49c9] hover:bg-white/90"
          />
        </div>
      </section>
    </div>
  </AppPage>
</template>
