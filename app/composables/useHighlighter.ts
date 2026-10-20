export interface HighlightEntry {
  id: string
  text: string
  color: string
  comment?: string
}

export interface HighlightPopupState {
  visible: boolean
  x: number
  y: number
  highlightId: string | null
}

const ATTR = 'data-highlight-id'
const CLASS = 'exam-highlight'
let nextId = 1

function findTextRange(root: Node, searchText: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const segments: { node: Text, start: number }[] = []
  let full = ''
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest(`mark.${CLASS}`)) continue
    segments.push({ node, start: full.length })
    full += node.textContent ?? ''
  }
  const idx = full.indexOf(searchText)
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

function wrapRange(range: Range, id: string, color: string, hasComment: boolean) {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const n = walker.currentNode as Text
    if (range.intersectsNode(n)) textNodes.push(n)
  }
  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE && !textNodes.length) {
    textNodes.push(range.commonAncestorContainer as Text)
  }
  for (const textNode of textNodes) {
    const start = textNode === range.startContainer ? range.startOffset : 0
    const end = textNode === range.endContainer ? range.endOffset : textNode.length
    if (start >= end) continue
    const mark = document.createElement('mark')
    mark.setAttribute(ATTR, id)
    mark.className = hasComment ? `${CLASS} has-note` : CLASS
    mark.style.backgroundColor = color
    const highlighted = textNode.splitText(start)
    highlighted.splitText(end - start)
    mark.appendChild(highlighted.cloneNode(true))
    highlighted.parentNode!.replaceChild(mark, highlighted)
  }
}

export function useHighlighter() {
  const container = ref<HTMLElement | null>(null)
  const highlights = ref<HighlightEntry[]>([])
  const popup = ref<HighlightPopupState>({ visible: false, x: 0, y: 0, highlightId: null })
  let savedRange: Range | null = null

  function reapply() {
    const root = container.value
    if (!root) return
    for (const entry of highlights.value) {
      if (root.querySelector(`mark[${ATTR}="${entry.id}"]`)) continue
      const range = findTextRange(root, entry.text)
      if (range) wrapRange(range, entry.id, entry.color, !!entry.comment)
    }
  }
  onUpdated(() => nextTick(reapply))

  function closePopup() {
    popup.value = { visible: false, x: 0, y: 0, highlightId: null }
    savedRange = null
  }

  function position(rect: DOMRect) {
    const c = container.value?.getBoundingClientRect()
    return { x: rect.left + rect.width / 2 - (c?.left ?? 0), y: rect.bottom - (c?.top ?? 0) + 4 }
  }

  function addHighlight(color: string) {
    const range = savedRange
    if (!range || range.collapsed || !container.value) {
      closePopup()
      return null
    }
    const id = `hl-${nextId++}`
    const entry: HighlightEntry = { id, text: range.toString(), color, comment: '' }
    wrapRange(range, id, color, false)
    window.getSelection()?.removeAllRanges()
    highlights.value.push(entry)
    closePopup()
    return id
  }

  function updateComment(id: string, comment: string) {
    const h = highlights.value.find(x => x.id === id)
    if (h) h.comment = comment
    container.value?.querySelectorAll(`mark[${ATTR}="${id}"]`).forEach((m) => {
      m.classList.toggle('has-note', !!comment)
    })
  }

  function removeHighlight(id: string) {
    container.value?.querySelectorAll(`mark[${ATTR}="${id}"]`).forEach((mark) => {
      const parent = mark.parentNode
      if (!parent) return
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
      parent.normalize()
    })
    highlights.value = highlights.value.filter(h => h.id !== id)
    closePopup()
  }

  function onMouseUp(e: MouseEvent) {
    const sel = window.getSelection()
    const mark = (e.target as HTMLElement).closest(`mark.${CLASS}`)
    const hId = mark?.getAttribute(ATTR)
    if (mark && hId) {
      sel?.removeAllRanges()
      popup.value = { visible: true, ...position(mark.getBoundingClientRect()), highlightId: hId }
      return
    }
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      closePopup()
      return
    }
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, button, [role="combobox"]')) return
    const range = sel.getRangeAt(0)
    savedRange = range.cloneRange()
    popup.value = { visible: true, ...position(range.getBoundingClientRect()), highlightId: null }
  }

  return { container, highlights, popup, addHighlight, updateComment, removeHighlight, closePopup, onMouseUp }
}
