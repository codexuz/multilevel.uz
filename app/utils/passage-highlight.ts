// Highlights the supporting evidence (`question.meta.fromText`) inside a reading
// passage. The passage is rich text, so the match runs against a plain-text
// projection of the HTML and the <mark> tags are spliced back in at the
// corresponding HTML offsets — never inside a tag or an entity.

export interface Evidence {
  questionNumber: number
  text: string
}

interface PlainProjection {
  plain: string
  /** htmlStart[i] / htmlEnd[i] delimit the HTML slice that produced plain[i]. */
  htmlStart: number[]
  htmlEnd: number[]
}

/** Strip tags, keeping a char-for-char map from plain text back into the HTML. */
function project(html: string): PlainProjection {
  const plain: string[] = []
  const htmlStart: number[] = []
  const htmlEnd: number[] = []

  let i = 0
  while (i < html.length) {
    const ch = html[i]!
    if (ch === '<') {
      const close = html.indexOf('>', i)
      i = close === -1 ? html.length : close + 1
    } else if (ch === '&') {
      const semi = html.indexOf(';', i)
      // Treat a whole entity as one plain character; a stray '&' stays literal.
      const end = semi !== -1 && semi - i <= 10 ? semi + 1 : i + 1
      const entity = html.slice(i, end)
      plain.push(entity === '&nbsp;' ? ' ' : decodeEntity(entity))
      htmlStart.push(i)
      htmlEnd.push(end)
      i = end
    } else {
      plain.push(ch)
      htmlStart.push(i)
      htmlEnd.push(i + 1)
      i++
    }
  }
  return { plain: plain.join(''), htmlStart, htmlEnd }
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '\'', '&apos;': '\''
}
function decodeEntity(entity: string): string {
  return ENTITIES[entity] ?? entity[0]!
}

/** Fold case, unify smart punctuation, collapse whitespace — keeping an index map. */
function normalize(plain: string): { norm: string, map: number[] } {
  const out: string[] = []
  const map: number[] = []
  let prevWasSpace = false

  for (let i = 0; i < plain.length; i++) {
    const ch = plain[i]!
    if (/\s/.test(ch)) {
      if (prevWasSpace) continue
      prevWasSpace = true
      out.push(' ')
      map.push(i)
      continue
    }
    prevWasSpace = false
    out.push(fold(ch))
    map.push(i)
  }
  return { norm: out.join(''), map }
}

function fold(ch: string): string {
  if ('–—‒―'.includes(ch)) return '-'
  if ('‘’‚`´'.includes(ch)) return '\''
  if ('“”„'.includes(ch)) return '"'
  return ch.toLowerCase()
}

function stripTags(html: string): string {
  return project(html).plain
}

interface Range { start: number, end: number, numbers: number[] }

/** Locate each evidence snippet in the passage, merging overlaps. */
function locate(projection: PlainProjection, evidence: Evidence[]): Range[] {
  const { norm, map } = normalize(projection.plain)
  const found: Range[] = []

  for (const item of evidence) {
    const needleSource = normalize(stripTags(item.text)).norm.trim()
    if (!needleSource) continue

    // Long snippets are often paraphrased at the tail; retry on a prefix.
    let idx = -1
    let matched = needleSource
    for (const candidate of [needleSource, needleSource.slice(0, 80), needleSource.slice(0, 40)]) {
      if (candidate.length < 12) break
      idx = norm.indexOf(candidate)
      if (idx !== -1) {
        matched = candidate
        break
      }
    }
    if (idx === -1) continue

    const startPlain = map[idx]!
    const endPlain = map[idx + matched.length - 1]! + 1
    found.push({ start: startPlain, end: endPlain, numbers: [item.questionNumber] })
  }

  found.sort((a, b) => a.start - b.start)

  const merged: Range[] = []
  for (const range of found) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
      for (const n of range.numbers) {
        if (!last.numbers.includes(n)) last.numbers.push(n)
      }
    } else {
      merged.push({ ...range })
    }
  }
  for (const range of merged) range.numbers.sort((a, b) => a - b)
  return merged
}

/**
 * Wrap every located snippet in `<mark class="evidence">` followed by a badge
 * per question number. Returns the passage unchanged when nothing matches.
 */
export function highlightPassage(html: string, evidence: Evidence[]): string {
  if (!html || evidence.length === 0) return html

  const projection = project(html)
  const ranges = locate(projection, evidence)
  if (ranges.length === 0) return html

  // Splice from the end so earlier offsets stay valid.
  let result = html
  for (const range of [...ranges].reverse()) {
    const openAt = projection.htmlStart[range.start]!
    const closeAt = projection.htmlEnd[range.end - 1]!
    const badges = range.numbers
      .map(n => `<span class="evidence-num">${n}</span>`)
      .join('')
    result
      = result.slice(0, openAt)
        + '<mark class="evidence">'
        + result.slice(openAt, closeAt)
        + badges
        + '</mark>'
        + result.slice(closeAt)
  }
  return result
}
