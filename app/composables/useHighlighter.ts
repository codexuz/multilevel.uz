export interface HighlightEntry {
  id: string
  /** Part id (or any key) the highlight belongs to — restored only in its own scope. */
  scope: string
  text: string
  color: string
  note: string
}

export interface PopupState {
  visible: boolean
  x: number
  y: number
  /** Set when the popup targets an existing highlight (note / delete actions). */
  highlightId: string | null
}

export const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: 'Sariq' },
  { value: '#bbf7d0', label: 'Yashil' },
  { value: '#fbcfe8', label: 'Pushti' },
  { value: '#bfdbfe', label: 'Ko\'k' }
] as const

/** Colour used when a highlight is created straight from the "add note" action. */
export const DEFAULT_HIGHLIGHT_COLOR = '#fef08a'

const HIGHLIGHT_ATTR = 'data-highlight-id'
const HIGHLIGHT_CLASS = 'exam-highlight'
const MARK_SELECTOR = `mark.${HIGHLIGHT_CLASS}`
/** The floating popup lives inside the container — never highlight its own labels. */
const UI_SELECTOR = '[data-highlight-ui]'

let nextId = 1

/**
 * Walk the text nodes under `root` (skipping text already inside a highlight),
 * find `searchText` in the flattened string and return a Range covering it.
 * Used to re-apply highlights after Vue re-renders the passage.
 */
function findTextRange(root: Node, searchText: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const segments: { node: Text, start: number }[] = []
  let fullText = ''

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest(`${MARK_SELECTOR}, ${UI_SELECTOR}`)) continue
    segments.push({ node, start: fullText.length })
    fullText += node.textContent ?? ''
  }

  const idx = fullText.indexOf(searchText)
  if (idx === -1) return null
  const endIdx = idx + searchText.length

  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  for (const seg of segments) {
    const segEnd = seg.start + (seg.node.textContent?.length ?? 0)
    if (!startNode && idx >= seg.start && idx < segEnd) {
      startNode = seg.node
      startOffset = idx - seg.start
    }
    if (endIdx > seg.start && endIdx <= segEnd) {
      endNode = seg.node
      endOffset = endIdx - seg.start
      break
    }
  }
  if (!startNode || !endNode) return null

  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

function applyNoteStyle(mark: HTMLElement, hasNote: boolean) {
  if (hasNote) mark.setAttribute('data-note', '')
  else mark.removeAttribute('data-note')
}

/** Wrap every text node the range touches in its own <mark>. */
function wrapRange(range: Range, id: string, color: string, hasNote: boolean) {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const n = walker.currentNode as Text
    // Leave existing highlights alone so overlapping selections don't nest marks.
    if (n.parentElement?.closest(`${MARK_SELECTOR}, ${UI_SELECTOR}`)) continue
    if (range.intersectsNode(n)) textNodes.push(n)
  }
  if (!textNodes.length && range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    textNodes.push(range.commonAncestorContainer as Text)
  }

  for (const textNode of textNodes) {
    const start = textNode === range.startContainer ? range.startOffset : 0
    const end = textNode === range.endContainer ? range.endOffset : textNode.length
    if (start >= end) continue

    const mark = document.createElement('mark')
    mark.setAttribute(HIGHLIGHT_ATTR, id)
    mark.className = HIGHLIGHT_CLASS
    mark.style.backgroundColor = color
    applyNoteStyle(mark, hasNote)

    // splitText leaves `textNode` as the prefix and returns the remainder.
    const target = textNode.splitText(start)
    target.splitText(end - start)
    target.parentNode?.replaceChild(mark, target)
    mark.appendChild(target)
  }
}

/**
 * Text highlighting over arbitrary rendered content: select → pick a colour,
 * click a highlight → add a note or delete it. Highlights are stored per
 * `scope` (part id) and re-applied by text search after a re-render.
 */
export function useHighlighter(scope: () => string) {
  const containerRef = ref<HTMLElement | null>(null)
  const highlights = ref<HighlightEntry[]>([])
  const popup = ref<PopupState>({ visible: false, x: 0, y: 0, highlightId: null })

  let savedRange: Range | null = null

  const activeHighlight = computed(() =>
    highlights.value.find(h => h.id === popup.value.highlightId) ?? null
  )

  function closePopup() {
    popup.value = { visible: false, x: 0, y: 0, highlightId: null }
    savedRange = null
  }

  /** Position the popup in the container's own coordinate space (it scrolls with the text). */
  function showPopup(rect: DOMRect, highlightId: string | null) {
    const root = containerRef.value
    if (!root) return
    const box = root.getBoundingClientRect()
    const x = rect.left + rect.width / 2 - box.left + root.scrollLeft
    const y = rect.bottom - box.top + root.scrollTop + 4
    popup.value = {
      visible: true,
      x: Math.min(Math.max(x, 96), root.clientWidth - 96 + root.scrollLeft),
      y,
      highlightId
    }
  }

  function addHighlight(color: string): string | undefined {
    const range = savedRange
    const root = containerRef.value
    if (!range || range.collapsed || !root) {
      closePopup()
      return
    }

    const id = `hl-${nextId++}`
    const entry: HighlightEntry = { id, scope: scope(), text: range.toString(), color, note: '' }
    wrapRange(range, id, color, false)
    window.getSelection()?.removeAllRanges()

    highlights.value.push(entry)
    closePopup()
    return id
  }

  function setNote(id: string, note: string) {
    const entry = highlights.value.find(h => h.id === id)
    if (entry) entry.note = note
    containerRef.value
      ?.querySelectorAll<HTMLElement>(`mark[${HIGHLIGHT_ATTR}="${id}"]`)
      .forEach(mark => applyNoteStyle(mark, !!note))
  }

  function removeHighlight(id: string) {
    containerRef.value
      ?.querySelectorAll(`mark[${HIGHLIGHT_ATTR}="${id}"]`)
      .forEach((mark) => {
        const parent = mark.parentNode
        if (!parent) return
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
        parent.removeChild(mark)
        parent.normalize() // merge the text nodes back together
      })

    highlights.value = highlights.value.filter(h => h.id !== id)
    closePopup()
  }

  /** Re-wrap highlights whose <mark> was wiped by a re-render (part switch, v-html swap). */
  function restore() {
    const root = containerRef.value
    if (!root) return
    const current = scope()
    for (const entry of highlights.value) {
      if (entry.scope !== current) continue
      if (root.querySelector(`mark[${HIGHLIGHT_ATTR}="${entry.id}"]`)) continue
      const range = findTextRange(root, entry.text)
      if (range) wrapRange(range, entry.id, entry.color, !!entry.note)
    }
  }

  function onMouseUp(e: MouseEvent) {
    const selection = window.getSelection()

    // Clicking an existing highlight opens the note/delete popup.
    const mark = (e.target as HTMLElement | null)?.closest?.(MARK_SELECTOR)
    if (mark) {
      selection?.removeAllRanges()
      showPopup(mark.getBoundingClientRect(), mark.getAttribute(HIGHLIGHT_ATTR))
      return
    }

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      closePopup()
      return
    }

    const range = selection.getRangeAt(0)
    savedRange = range.cloneRange()
    showPopup(range.getBoundingClientRect(), null)
  }

  return {
    containerRef,
    highlights,
    popup,
    activeHighlight,
    addHighlight,
    setNote,
    removeHighlight,
    restore,
    closePopup,
    onMouseUp
  }
}
