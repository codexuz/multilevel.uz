/**
 * Nuxt UI dressed as HeroUI v3: pill buttons that press in, white surfaces on soft shadows
 * (rounded-3xl cards, rounded-2xl menus and alerts), borderless fields, segmented pill tabs, and
 * modals that rise from the bottom on a phone. The tokens live in assets/css/main.css.
 */
const surface = 'bg-default shadow-surface ring-0'
const overlay = 'bg-default shadow-overlay ring-0 dark:ring-1 dark:ring-default'
// Fields keep a hairline ring: on the white paper of an exam a shadow alone is too faint to find.
const field = 'text-highlighted bg-(--ui-field) shadow-field ring ring-inset ring-default'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'zinc'
    },

    button: {
      slots: {
        base: 'rounded-full font-medium transition-[color,background-color,transform,box-shadow] duration-150 active:not-disabled:scale-[0.97] touch-manipulation'
      },
      compoundVariants: [
        { color: 'neutral', variant: 'outline', class: 'ring-0 bg-default shadow-surface hover:bg-elevated dark:ring-1 dark:ring-default' }
      ]
    },
    badge: {
      slots: { base: 'rounded-full' },
      variants: {
        size: {
          xs: { base: 'rounded-full' }, sm: { base: 'rounded-full px-2' }, md: { base: 'rounded-full px-2.5' }, lg: { base: 'rounded-full px-3' }, xl: { base: 'rounded-full px-3' }
        }
      }
    },
    card: {
      slots: {
        root: 'rounded-3xl',
        header: 'p-4 sm:px-5',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5'
      },
      variants: {
        variant: {
          outline: { root: `${surface} divide-y divide-default` },
          subtle: { root: `${surface} divide-y divide-default` },
          soft: { root: 'bg-elevated/60 divide-y divide-default' }
        }
      }
    },
    alert: {
      slots: { root: 'rounded-2xl' },
      compoundVariants: [
        { variant: 'subtle', class: { root: 'ring-0 shadow-surface' } },
        { variant: 'outline', class: { root: 'ring-0 bg-default shadow-surface' } }
      ]
    },
    input: {
      slots: { base: 'rounded-xl' },
      variants: { variant: { outline: field } }
    },
    textarea: {
      slots: { base: 'rounded-xl' },
      variants: { variant: { outline: field } }
    },
    inputNumber: {
      slots: { base: 'rounded-xl' },
      variants: { variant: { outline: field } }
    },
    select: {
      slots: { base: 'rounded-xl', content: `rounded-2xl ${overlay}`, item: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    selectMenu: {
      slots: { base: 'rounded-xl', content: `rounded-2xl ${overlay}`, item: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    tabs: {
      slots: { trigger: 'rounded-full' },
      variants: {
        variant: {
          pill: { list: 'bg-elevated rounded-full', indicator: 'rounded-full shadow-surface' }
        }
      },
      compoundVariants: [
        { color: 'primary', variant: 'pill', class: { indicator: 'bg-(--ui-segment)', trigger: 'data-[state=active]:text-highlighted' } },
        { color: 'neutral', variant: 'pill', class: { indicator: 'bg-(--ui-segment)', trigger: 'data-[state=active]:text-highlighted' } }
      ]
    },
    navigationMenu: {
      slots: { link: 'before:rounded-xl py-2' },
      compoundVariants: [
        { variant: 'pill', active: true, highlight: false, class: { link: 'before:bg-default before:shadow-surface dark:before:bg-elevated' } }
      ]
    },
    dropdownMenu: { slots: { content: `rounded-2xl p-1 ${overlay}`, item: 'before:rounded-lg' } },
    popover: { slots: { content: `rounded-2xl ${overlay}` } },
    tooltip: { slots: { content: 'rounded-lg ring-0 shadow-overlay' } },
    toast: { slots: { root: 'rounded-2xl ring-0 shadow-overlay' } },
    modal: {
      slots: { content: 'divide-y-0', header: 'border-0 pb-0', footer: 'border-0 pt-0' },
      variants: {
        fullscreen: {
          false: {
            content: [
              'rounded-3xl shadow-overlay ring-0 dark:ring-1 dark:ring-default',
              // A sheet from the bottom on a phone.
              'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]'
            ]
          }
        }
      }
    },
    slideover: { slots: { content: 'ring-0 shadow-overlay' } },
    table: {
      slots: { th: 'text-muted font-medium' }
    },

    dashboardPanel: {
      slots: {
        root: 'bg-canvas lg:not-last:border-e-0',
        body: 'p-4 sm:p-6 pb-28 lg:pb-8'
      }
    },
    dashboardNavbar: {
      slots: { root: 'border-b-0 bg-canvas/80 backdrop-blur-xl sticky top-0 z-10', title: 'text-lg' }
    },
    dashboardToolbar: {
      slots: { root: 'border-b-0 bg-canvas px-4 sm:px-6 py-1 [scrollbar-width:none]' }
    },
    dashboardSidebar: {
      slots: {
        root: 'bg-canvas border-e-0',
        footer: 'border-t-0',
        content: 'bg-canvas'
      }
    }
  }
})
