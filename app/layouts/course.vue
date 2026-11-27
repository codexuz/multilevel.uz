<script setup lang="ts">
import type { DripState } from '#shared/utils/lms'

/**
 * Learning a course: the course's own sidebar instead of the app's. At the top the way back to the
 * course's page, the course's title and how far I am; then its topics with their lessons (the
 * current topic open), each one a link: done, the one open now, open, or locked (opening a locked
 * lesson shows why and what opens it). On a phone the sidebar slides in from the menu button.
 */
provide(PANEL_LAYOUT, 'course')
interface OutlineLesson { id: string, position: number, title: string, durationMinutes: number | null, done: boolean, drip: DripState, has: { video: boolean, audio?: boolean, exercises: boolean, live: boolean } }
interface Outline {
  id: string
  slug: string
  title: string
  speakingCount?: number
  access: { teaches: boolean, learn: boolean }
  modules: { id: string, title: string, lessons: OutlineLesson[] }[]
  lessons: OutlineLesson[]
}

const { t } = useI18n()
const route = useRoute()
const { me } = useMe()
const slug = String(route.params.slug)
const { data: c } = await useFetch<Outline>(`/api/courses/${slug}`, { key: `course-outline-${slug}` })

const current = computed(() => String(route.params.lesson ?? ''))
const done = computed(() => c.value?.lessons.filter(l => l.done).length ?? 0)
const total = computed(() => c.value?.lessons.length ?? 0)
const pct = computed(() => (total.value ? Math.round(done.value / total.value * 100) : 0))

// Topics fold; the one holding the open lesson stays open.
const open = ref(new Set<string>())
watch([current, c], () => {
  const m = c.value?.modules.find(x => x.lessons.some(l => l.id === current.value))
  if (m) open.value = new Set([...open.value, m.id])
}, { immediate: true })
function toggle(id: string) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}
const topicName = (m: { id: string, title: string }, i: number) => (m.id === '__ungrouped__' ? t(c.value!.modules.length > 1 ? 'builder.outsideTopicsTitle' : 'courses.lessonsTitle') : m.title || t('builder.topicN', { n: i + 1 }))
const lockedFor = (l: OutlineLesson) => l.drip?.locked && !c.value?.access.teaches
const icon = (l: OutlineLesson) => (l.done ? 'i-lucide-circle-check' : l.id === current.value ? 'i-lucide-circle-dot' : lockedFor(l) ? 'i-lucide-lock' : l.has.video ? 'i-lucide-circle-play' : l.has.audio ? 'i-lucide-audio-lines' : 'i-lucide-circle')
const minutes = (n: number | null) => (n ? (n >= 60 ? t('builder.hoursMinutes', { h: Math.floor(n / 60), m: n % 60 }) : t('builder.minutes', { n })) : '')
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage="local"
  >
    <UDashboardSidebar
      id="course"
      collapsible
      resizable
      :default-size="20"
      :min-size="15"
      :max-size="28"
      :ui="{ footer: 'border-t border-default', body: 'gap-0 px-2' }"
    >
      <template #header="{ collapsed }">
        <UButton
          :to="`/courses/${slug}`"
          icon="i-lucide-arrow-left"
          :label="collapsed ? undefined : t('lessonNav.back')"
          :square="collapsed"
          color="neutral"
          variant="ghost"
          class="-ms-1"
          data-testid="course-back"
        />
      </template>

      <template #default="{ collapsed }">
        <template v-if="c && !collapsed">
          <div class="px-2 pt-1 pb-4 border-b border-default">
            <NuxtLink
              :to="`/courses/${slug}`"
              class="block font-semibold text-highlighted leading-snug line-clamp-2 hover:text-primary"
            >
              {{ c.title }}
            </NuxtLink>
            <div class="mt-3 flex items-baseline justify-between text-xs text-muted tabular-nums">
              <span>{{ t('courses.progress', { done, of: total }) }}</span>
              <span>{{ pct }}%</span>
            </div>
            <UProgress
              :model-value="pct"
              size="xs"
              class="mt-1.5"
            />
          </div>

          <nav
            class="py-2 flex flex-col"
            :aria-label="t('coursePage.curriculum')"
            data-testid="course-outline"
          >
            <section
              v-for="(m, mi) in c.modules"
              :key="m.id"
            >
              <button
                type="button"
                class="w-full flex items-start gap-2 rounded-lg px-2 py-2 text-start hover:bg-elevated/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
                :aria-expanded="open.has(m.id)"
                @click="toggle(m.id)"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 mt-0.5 text-muted shrink-0 transition-transform duration-200"
                  :class="open.has(m.id) ? 'rotate-90' : ''"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-highlighted leading-snug">{{ topicName(m, mi) }}</span>
                  <span class="block text-xs text-muted tabular-nums">{{ m.lessons.filter(l => l.done).length }}/{{ m.lessons.length }}</span>
                </span>
              </button>
              <ol
                v-show="open.has(m.id)"
                class="pb-1"
              >
                <li
                  v-for="l in m.lessons"
                  :key="l.id"
                >
                  <NuxtLink
                    :to="`/courses/${slug}/${l.id}`"
                    class="flex items-start gap-2.5 rounded-lg ms-4 px-2 py-1.5 text-sm transition-colors"
                    :class="l.id === current ? 'bg-primary/10 text-primary' : lockedFor(l) ? 'text-dimmed hover:bg-elevated/60' : 'text-toned hover:bg-elevated/60 hover:text-highlighted'"
                    :aria-current="l.id === current ? 'page' : undefined"
                    data-testid="outline-lesson"
                  >
                    <UIcon
                      :name="icon(l)"
                      class="size-4 mt-0.5 shrink-0"
                      :class="l.done ? 'text-success' : ''"
                    />
                    <span class="min-w-0 flex-1">
                      <span
                        class="block leading-snug line-clamp-2"
                        :class="l.id === current ? 'font-semibold' : ''"
                      >{{ l.title }}</span>
                      <span
                        v-if="l.durationMinutes || l.has.exercises"
                        class="block text-xs text-muted"
                      >{{ [minutes(l.durationMinutes), l.has.exercises ? t('builder.quiz') : ''].filter(Boolean).join(' · ') }}</span>
                    </span>
                  </NuxtLink>
                </li>
              </ol>
            </section>
          </nav>
        </template>
      </template>

      <template #footer="{ collapsed }">
        <UButton
          :to="homeOf(me?.role)"
          icon="i-lucide-layout-dashboard"
          :label="collapsed ? undefined : t('nav.dashboard')"
          :square="collapsed"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
        />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
