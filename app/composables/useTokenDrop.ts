import type { AnswerMap } from '~/types/exam'

/**
 * Moving words or headings into gaps, as the computer-delivered IELTS does it: drag one into a gap
 * (or click it, then click the gap); drag a placed one to another gap, or back to the list to take
 * it out; click a filled gap to empty it. Unless a choice may be used more than once, a placed one
 * leaves the list.
 */
export function useTokenDrop(opts: {
  nums: () => number[]
  answers: () => AnswerMap
  disabled: () => boolean | undefined
  emit: (n: number, value: string) => void
  /** A choice may go into more than one gap ("You may use any letter more than once"). */
  reuse?: boolean
}) {
  const picked = ref<string | null>(null)
  const over = ref<number | 'list' | null>(null)

  const used = (key: string) => !opts.reuse && opts.nums().some(n => opts.answers()[n] === key)

  function place(n: number, key: string, from?: number) {
    if (opts.disabled()) return
    if (!opts.reuse) {
      for (const num of opts.nums()) if (num !== n && opts.answers()[num] === key) opts.emit(num, '')
    } else if (from != null && from !== n) opts.emit(from, '')
    opts.emit(n, key)
    picked.value = null
  }

  function clickToken(key: string) {
    if (opts.disabled()) return
    picked.value = picked.value === key ? null : key
  }

  function clickGap(n: number) {
    if (opts.disabled()) return
    if (picked.value) place(n, picked.value)
    else if (opts.answers()[n]) opts.emit(n, '')
  }

  function dragToken(key: string, e: DragEvent, from?: number) {
    if (opts.disabled()) return e.preventDefault()
    e.dataTransfer?.setData('text/plain', JSON.stringify({ key, from }))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  function read(e: DragEvent): { key: string, from?: number } | null {
    try {
      return JSON.parse(e.dataTransfer?.getData('text/plain') || 'null')
    } catch {
      return null
    }
  }

  function dropOnGap(n: number, e: DragEvent) {
    over.value = null
    const data = read(e)
    if (data?.key) place(n, data.key, data.from)
  }

  function dropOnList(e: DragEvent) {
    over.value = null
    const data = read(e)
    if (data?.from != null && !opts.disabled()) opts.emit(data.from, '')
  }

  return { picked, over, used, place, clickToken, clickGap, dragToken, dropOnGap, dropOnList }
}
