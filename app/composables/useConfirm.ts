// Promise-based confirmation dialog backed by a single global <ConfirmDialog>
// host (mounted in app.vue). Replaces native window.confirm():
//
//   const { confirm } = useConfirm()
//   if (!await confirm({ title: 'Delete?', color: 'error' })) return

export type ConfirmColor = 'primary' | 'error' | 'warning' | 'success' | 'neutral'

export interface ConfirmOptions {
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  color?: ConfirmColor
  icon?: string
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'icon'>> {
  icon?: string
  open: boolean
  resolve?: (value: boolean) => void
}

// Module-level singleton — confirmation is a client-only interaction.
const state = reactive<ConfirmState>({
  open: false,
  title: 'Are you sure?',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  color: 'primary',
  icon: undefined
})

export function useConfirm() {
  function confirm(options: ConfirmOptions = {}): Promise<boolean> {
    // Resolve any dialog still open before opening a new one.
    state.resolve?.(false)
    return new Promise<boolean>((resolve) => {
      state.title = options.title ?? 'Are you sure?'
      state.description = options.description ?? ''
      state.confirmLabel = options.confirmLabel ?? 'Confirm'
      state.cancelLabel = options.cancelLabel ?? 'Cancel'
      state.color = options.color ?? 'primary'
      state.icon = options.icon
      state.resolve = resolve
      state.open = true
    })
  }
  return { confirm }
}

// Internal accessor used by the <ConfirmDialog> host component.
export function useConfirmState() {
  return state
}
