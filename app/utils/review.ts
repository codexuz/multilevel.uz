import type { Part, QuestionGroup, QuestionItem } from '~/types/ielts'

/**
 * Drawing a marked Listening or Reading part: the API's review sends each group with its items,
 * the answer given, whether it earned the mark and the key. These helpers put the answers back
 * into the gaps, pick the key's sentence out of the passage, and read a transcript's cues.
 */

export const TFNG_TYPES = ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN']
/** Groups whose items are gaps in the group's shared text (or table). */
export const GAP_TYPES = ['NOTE_COMPLETION', 'SUMMARY_COMPLETION', 'SUMMARY_COMPLETION_DRAG_DROP', 'SENTENCE_COMPLETION', 'SHORT_ANSWER', 'TABLE_COMPLETION', 'FLOW_CHART_COMPLETION', 'DIAGRAM_LABELLING']

// A gap is "___" (numbered in order) or "{7}" (question 7, wherever it stands) — as the exam draws it.
const GAP_RE = /_{3,}|\.{3,}|\{blank\}|\{answer\}|\[blank\]|\(\.\.\.\)|\{\d{1,2}\}/gi

export const sortedGroups = (part: Part) => [...(part.groups ?? [])].sort((a, b) => a.position - b.position)
export const sortedItems = (group: QuestionGroup) => [...(group.items ?? [])].sort((a, b) => a.number - b.number)
export const partItems = (part: Part) => sortedGroups(part).flatMap(sortedItems)

export const answered = (item: QuestionItem) => item.answer != null && String(item.answer).trim() !== ''

/** The tone of a question's mark: right, wrong, or left blank. */
export const itemColor = (item: QuestionItem) => (item.isCorrect ? 'success' : answered(item) ? 'error' : 'neutral') as 'success' | 'error' | 'neutral'

const JUDGEMENT: Record<string, string> = {
  't': 'TRUE', 'true': 'TRUE', 'f': 'FALSE', 'false': 'FALSE', 'y': 'YES', 'yes': 'YES', 'n': 'NO', 'no': 'NO',
  'ng': 'NOT GIVEN', 'not given': 'NOT GIVEN', 'notgiven': 'NOT GIVEN'
}
/** "t", "True" and "TRUE" are one judgement. */
export const judgement = (value?: string | null) => JUDGEMENT[String(value ?? '').trim().toLowerCase()] ?? String(value ?? '').trim().toUpperCase()

/** The letters and headings a group chooses from, keyed as the answers are. */
export function choicesOf(group: QuestionGroup) {
  return [...(group.content?.options ?? []), ...(group.content?.headings ?? [])]
}

/** "B" → "B — the text of option B", when the group has such an option. */
export function describeKey(group: QuestionGroup, key?: string | null) {
  if (!key) return ''
  const hit = choicesOf(group).find(o => o.key.trim().toLowerCase() === key.trim().toLowerCase())
  return hit ? `${hit.key} — ${stripHtml(hit.text)}` : key
}

/** The key as a line: "colour / color". */
export const keyText = (item: QuestionItem) => (item.acceptedAnswers ?? []).join(' / ')

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** How many gaps a piece of text has. */
export const gapCount = (html?: string | null) => (html ? [...html.matchAll(GAP_RE)].length : 0)

/**
 * The chip drawn in a gap: the answer given, whether it was right, and the key when asked for.
 * `numbered` off leaves out the number and the anchor, for a gap whose question is numbered beside it.
 * `blank` draws the gap as a printed exam paper does: "(7)__________".
 */
export function gapChip(item: QuestionItem | undefined, showKey: boolean, label?: (key: string) => string, numbered = true, blank = false) {
  if (!item) return '<span class="text-dimmed">___</span>'
  if (blank) return `<span class="whitespace-nowrap">${numbered ? `(${item.number})` : ''}<span class="inline-block w-24 border-b border-current">&nbsp;</span></span>`
  const show = (v: string) => escapeHtml(label ? label(v) : v)
  const ok = !!item.isCorrect
  const given = answered(item)
  let s = `<span ${numbered ? `id="review-question-${item.number}" ` : ''}class="inline-flex flex-wrap items-center gap-1 align-middle my-0.5 scroll-mt-24">`
  if (numbered) s += `<span class="inline-flex items-center justify-center rounded-full size-5 text-[10px] font-bold text-white ${ok ? 'bg-success' : given ? 'bg-error' : 'bg-neutral-400 dark:bg-neutral-600'}">${item.number}</span>`
  s += `<span class="inline-block px-2 py-0.5 rounded-md border-2 font-medium min-w-14 leading-6 ${ok ? 'border-success bg-success/10' : given ? 'border-error bg-error/10' : 'border-default text-dimmed italic'}">${given ? show(String(item.answer)) : 'no answer'}</span>`
  if (showKey && !ok && item.acceptedAnswers?.length) s += `<span class="text-success font-semibold text-sm">✓ ${item.acceptedAnswers.map(show).join(' / ')}</span>`
  return `${s}</span>`
}

/**
 * The group's text with each gap filled by the answer given. A "{7}" gap is question 7; the plain
 * gaps take the group's remaining numbers in order, as the exam numbered them.
 */
export function fillGaps(html: string, items: QuestionItem[], showKey: boolean, label?: (key: string) => string, numbered = true, blank = false) {
  const byNumber = new Map(items.map(i => [i.number, i]))
  const explicit = new Set([...html.matchAll(/\{(\d{1,2})\}/g)].map(m => Number(m[1])))
  const free = items.filter(i => !explicit.has(i.number))
  const placed = new Set<number>()
  let next = 0
  const out = html.replace(GAP_RE, (gap) => {
    const explicitGap = /^\{(\d{1,2})\}$/.exec(gap)
    const item = explicitGap ? byNumber.get(Number(explicitGap[1])) : free[next++]
    if (item) placed.add(item.number)
    return gapChip(item, showKey, label, numbered, blank)
  })
  return { html: out, placed }
}

/** A table-completion table with the gaps filled, cell by cell, numbered across the table. */
export function fillTable(table: { headers: string[], rows: string[][] }, items: QuestionItem[], showKey: boolean, blank = false) {
  const byNumber = new Map(items.map(i => [i.number, i]))
  const all = table.rows.flat().join(' ')
  const explicit = new Set([...all.matchAll(/\{(\d{1,2})\}/g)].map(m => Number(m[1])))
  const free = items.filter(i => !explicit.has(i.number))
  let next = 0
  return table.rows.map(row => row.map(cell => escapeHtml(cell).replace(GAP_RE, (gap) => {
    const numbered = /^\{(\d{1,2})\}$/.exec(gap)
    return gapChip(numbered ? byNumber.get(Number(numbered[1])) : free[next++], showKey, undefined, true, blank)
  })))
}

// ─── The key's sentence in the passage ─────────────────────────────────────

const decode = (h: string) => h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/\s+/g, ' ').trim()
const fold = (t: string) => t.replace(/[–—‒―]/g, '-').replace(/[‘’‚`´]/g, '\'').replace(/[“”„]/g, '"').replace(/\s+/g, ' ').toLowerCase()

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '\'', '&rsquo;': '\'', '&lsquo;': '\'', '&ldquo;': '"', '&rdquo;': '"', '&ndash;': '-', '&mdash;': '-' }
/** One character for an entity, so the text and the HTML walk count alike. */
const entityChar = (entity: string) => ENTITIES[entity.toLowerCase()] ?? (entity.length > 1 ? '•' : entity)

/**
 * The passage with each question's evidence marked and numbered. Evidence is matched on the text
 * alone, so it may run across tags; `found` says which questions were located, so the rest keep
 * their quote beside the question.
 */
export function highlightPassage(passageHtml: string, items: QuestionItem[]): { html: string, found: Set<number> } {
  const found = new Set<number>()
  const entries = items.filter(i => i.evidence?.trim()).map(i => ({ n: i.number, text: i.evidence! }))
  if (!entries.length || !passageHtml) return { html: passageHtml, found }

  // The passage's text, character by character, as the walk below counts it.
  let plain = ''
  for (let h = 0; h < passageHtml.length;) {
    const ch = passageHtml[h]!
    if (ch === '<') {
      const end = passageHtml.indexOf('>', h)
      h = end === -1 ? passageHtml.length : end + 1
    } else if (ch === '&') {
      const end = passageHtml.indexOf(';', h)
      const entity = end !== -1 && end - h < 10 ? passageHtml.slice(h, end + 1) : ch
      plain += entityChar(entity)
      h += entity.length
    } else {
      plain += ch
      h++
    }
  }
  // Folding keeps length except for runs of spaces; map folded positions back to plain ones.
  const map: number[] = []
  {
    let prevSpace = false
    for (let i = 0; i < plain.length; i++) {
      const space = /\s/.test(plain[i]!)
      if (space && prevSpace) continue
      map.push(i)
      prevSpace = space
    }
    map.push(plain.length)
  }
  const collapsed = fold(plain)

  const ranges: { start: number, end: number, n: number }[] = []
  for (const e of entries) {
    const needle = fold(decode(e.text)).replace(/^["'“]+|["'”]+$/g, '').trim()
    if (!needle) continue
    let len = needle.length
    let idx = collapsed.indexOf(needle)
    if (idx === -1 && needle.length > 80) { len = 80; idx = collapsed.indexOf(needle.slice(0, 80)) }
    if (idx === -1 && needle.length > 40) { len = 40; idx = collapsed.indexOf(needle.slice(0, 40)) }
    if (idx === -1) continue
    found.add(e.n)
    ranges.push({ start: map[idx]!, end: map[Math.min(idx + len, map.length - 1)]!, n: e.n })
  }
  if (!ranges.length) return { html: passageHtml, found }
  ranges.sort((a, b) => a.start - b.start)

  const merged: { start: number, end: number, nums: number[] }[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
      if (!last.nums.includes(r.n)) last.nums.push(r.n)
    } else merged.push({ start: r.start, end: r.end, nums: [r.n] })
  }
  merged.forEach(m => m.nums.sort((a, b) => a - b))

  // Marks are closed and reopened around tags, so a highlight never straddles an element boundary.
  const open = '<mark class="bg-orange-200 dark:bg-orange-900/60 text-inherit">'
  const badges = (nums: number[]) => nums.map(n => `<span id="evidence-${n}" class="inline-flex items-center justify-center size-[18px] rounded-full bg-orange-600 text-white text-[10px] font-bold ms-0.5 align-middle scroll-mt-24">${n}</span>`).join('')
  let out = ''
  let p = 0
  let ri = 0
  let inMark = false
  for (let h = 0; h < passageHtml.length;) {
    const range = merged[ri]
    const ch = passageHtml[h]!
    if (ch === '<') {
      const end = passageHtml.indexOf('>', h)
      const tag = end === -1 ? passageHtml.slice(h) : passageHtml.slice(h, end + 1)
      out += inMark ? `</mark>${tag}${open}` : tag
      h += tag.length
      continue
    }
    if (range && !inMark && p === range.start) {
      out += open
      inMark = true
    }
    let unit = ch
    if (ch === '&') {
      const end = passageHtml.indexOf(';', h)
      if (end !== -1 && end - h < 10) unit = passageHtml.slice(h, end + 1)
    }
    out += unit
    h += unit.length
    p++
    if (range && inMark && p >= range.end) {
      out += `${badges(range.nums)}</mark>`
      inMark = false
      ri++
    }
  }
  if (inMark) out += '</mark>'
  return { html: out.replace(new RegExp(`${open.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</mark>`, 'g'), ''), found }
}

// ─── Transcripts ─────────────────────────────────────────────────────────

export interface Cue { start: number, end: number, text: string }

function cueTime(s: string) {
  const parts = s.trim().replace(',', '.').split(':')
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number.parseFloat(parts[2]!)
  if (parts.length === 2) return Number(parts[0]) * 60 + Number.parseFloat(parts[1]!)
  return Number.parseFloat(s) || 0
}

/** Timed cues from a WebVTT or SRT file; none when the file is plain text. */
export function parseCues(raw: string): Cue[] {
  const cues: Cue[] = []
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.includes('-->')) continue
    const [a, b] = line.split('-->')
    const text: string[] = []
    while (i + 1 < lines.length && lines[i + 1]!.trim() !== '') text.push(lines[++i]!.replace(/<[^>]*>/g, '').trim())
    if (text.length) cues.push({ start: cueTime(a!), end: cueTime((b ?? '').trim().split(/\s+/)[0]!), text: text.join(' ') })
  }
  return cues
}

/** A transcript the page can read itself — a text file — by its type or its file name. PDFs and Word files open in a new tab. */
export function readableTranscript(contentType?: string | null, disposition?: string | null) {
  if (/^text\/|subrip|vtt/i.test(contentType ?? '')) return true
  return /\.(vtt|srt|txt)(["';\s]|$)/i.test(disposition ?? '')
}
