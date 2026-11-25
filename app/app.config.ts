/**
 * Nuxt UI dressed in the manner of SmallTalk2Me: white cards drawn with a hairline border, light
 * grey inner panels, bordered fields that turn indigo on focus, an indigo primary and a near-black
 * neutral for strong secondary actions ("Retake"), grey segmented tabs, 8px controls and 12px
 * cards. On a phone, modals open as sheets from the bottom. The tokens live in assets/css/main.css.
 */
// The playful layer's sizes are CSS variables (assets/css/main.css): --card-bw, --card-radius,
// --field-bw, --btn-radius, --btn-weight and --press, the depth a button sits on and presses into.
// The exam screens (.classic) set them back to a plain look. A solid or outline button stands on an
// edge of a darker shade and presses into it (written out in full: Tailwind reads classes as text).
const surface = 'bg-default ring-[length:var(--card-bw)] ring-default'
const overlay = 'bg-default shadow-overlay ring-0'
const field = 'text-highlighted bg-(--ui-field) ring-[length:var(--field-bw)] ring-inset ring-accented hover:ring-(--ui-text-dimmed)/50'

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'zinc'
    },

    button: {
      slots: {
        base: 'rounded-[var(--btn-radius)] [font-weight:var(--btn-weight)] transition-[color,background-color,transform,box-shadow] duration-100 touch-manipulation'
      },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'shadow-[0_var(--press)_0_0_var(--ui-color-primary-700)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-color-primary-700)]' },
        { color: 'neutral', variant: 'solid', class: 'shadow-[0_var(--press)_0_0_#000] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_#000]' },
        { color: 'success', variant: 'solid', class: 'shadow-[0_var(--press)_0_0_var(--ui-color-success-700)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-color-success-700)]' },
        { color: 'error', variant: 'solid', class: 'shadow-[0_var(--press)_0_0_var(--ui-color-error-700)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-color-error-700)]' },
        { color: 'warning', variant: 'solid', class: 'shadow-[0_var(--press)_0_0_var(--ui-color-warning-700)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-color-warning-700)]' },
        { color: 'info', variant: 'solid', class: 'shadow-[0_var(--press)_0_0_var(--ui-color-info-700)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-color-info-700)]' },
        { color: 'neutral', variant: 'outline', class: 'ring-[length:var(--field-bw)] ring-accented bg-default hover:bg-elevated shadow-[0_var(--press)_0_0_var(--ui-border-accented)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-border-accented)]' },
        { color: 'primary', variant: 'outline', class: 'ring-[length:var(--field-bw)] shadow-[0_var(--press)_0_0_var(--ui-color-primary-300)] active:not-disabled:translate-y-[var(--press-sm)] active:not-disabled:shadow-[0_calc(var(--press)-var(--press-sm))_0_0_var(--ui-color-primary-300)]' },
        { color: 'neutral', variant: 'soft', class: 'bg-elevated hover:bg-accented' }
      ]
    },
    badge: {
      slots: { base: 'font-bold' },
      variants: {
        size: {
          xs: { base: 'rounded-md' }, sm: { base: 'rounded-md' }, md: { base: 'rounded-lg' }, lg: { base: 'rounded-lg' }, xl: { base: 'rounded-lg' }
        }
      }
    },
    card: {
      slots: {
        root: 'rounded-[var(--card-radius)]',
        header: 'px-4 py-3.5 sm:px-5',
        body: 'p-4 sm:p-5',
        footer: 'px-4 py-3 sm:px-5'
      },
      variants: {
        variant: {
          outline: { root: `${surface} divide-y-[length:var(--card-bw)] divide-default` },
          subtle: { root: `${surface} divide-y-[length:var(--card-bw)] divide-default` },
          soft: { root: 'bg-elevated divide-y divide-default' }
        }
      }
    },
    alert: {
      slots: { root: 'rounded-[var(--card-radius)]' },
      compoundVariants: [
        { variant: 'subtle', class: { root: 'ring-0' } },
        { variant: 'outline', class: { root: 'bg-default' } }
      ]
    },
    input: {
      slots: { base: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    textarea: {
      slots: { base: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    inputNumber: {
      slots: { base: 'rounded-lg' },
      variants: { variant: { outline: field } }
    },
    select: {
      slots: { base: 'rounded-lg', content: `rounded-lg p-1 ${overlay}`, item: 'rounded-md' },
      variants: { variant: { outline: field } }
    },
    selectMenu: {
      slots: { base: 'rounded-lg', content: `rounded-lg ${overlay}`, item: 'rounded-md' },
      variants: { variant: { outline: field } }
    },
    tabs: {
      slots: { trigger: 'rounded-md font-bold' },
      variants: {
        variant: {
          pill: { list: 'bg-elevated rounded-lg', indicator: 'rounded-md shadow-[0_2px_0_rgb(10_8_18/0.08),0_0_0_1px_rgb(10_8_18/0.06)]' }
        }
      },
      compoundVariants: [
        { color: 'primary', variant: 'pill', class: { indicator: 'bg-(--ui-segment)', trigger: 'data-[state=active]:text-highlighted' } },
        { color: 'neutral', variant: 'pill', class: { indicator: 'bg-(--ui-segment)', trigger: 'data-[state=active]:text-highlighted' } }
      ]
    },
    navigationMenu: {
      slots: { link: 'before:rounded-lg py-2.5 font-bold' },
      compoundVariants: [
        // The current page: a light tile with a coloured edge.
        { variant: 'pill', active: true, highlight: false, class: { link: 'text-primary before:bg-primary/10 before:ring-[length:var(--field-bw)] before:ring-primary/35', linkLeadingIcon: 'text-primary' } }
      ]
    },
    progress: {
      slots: { base: 'bg-accented/70', indicator: 'rounded-full' }
    },
    dropdownMenu: { slots: { content: `rounded-xl p-1 ${overlay}`, item: 'before:rounded-md' } },
    popover: { slots: { content: `rounded-xl ${overlay}` } },
    tooltip: { slots: { content: 'rounded-md ring-0 shadow-overlay' } },
    toast: { slots: { root: 'rounded-xl ring-0 shadow-overlay' } },
    modal: {
      slots: { content: 'divide-y-0', header: 'border-0 pb-0', title: 'text-lg font-extrabold', footer: 'border-0 pt-0' },
      variants: {
        fullscreen: {
          false: {
            content: [
              'rounded-2xl shadow-overlay ring-0',
              // A sheet from the bottom on a phone.
              'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]'
            ]
          }
        }
      }
    },
    slideover: { slots: { content: 'ring-0 shadow-overlay' } },
    accordion: { slots: { trigger: 'font-semibold text-highlighted py-4', body: 'text-muted' } },
    table: {
      slots: { th: 'text-muted font-medium text-xs uppercase tracking-wide' }
    },

    dashboardPanel: {
      slots: {
        root: 'bg-canvas lg:not-last:border-e-0',
        body: 'p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10'
      }
    },
    dashboardNavbar: {
      slots: { root: 'border-b border-default bg-canvas/90 backdrop-blur-xl sticky top-0 z-10', title: 'text-base font-semibold' }
    },
    dashboardToolbar: {
      slots: { root: 'border-b border-default bg-canvas px-4 sm:px-6 lg:px-8 py-1 [scrollbar-width:none]' }
    },
    dashboardSidebar: {
      slots: {
        root: 'bg-canvas border-e border-default',
        footer: 'border-t border-default',
        content: 'bg-canvas'
      }
    }
  }
})
