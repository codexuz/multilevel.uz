// `xss` is CommonJS. Node's named-export detection exposes `FilterXSS`, but not
// its `escapeAttrValue` helper, so the one attribute we re-emit is escaped here.
import { FilterXSS } from 'xss'

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Community bodies are authored in TipTap and rendered with v-html, so every
// stored string must be sanitized on the way IN — a reader's browser is not the
// place to discover that a post contained a <script>.
//
// The allowlist mirrors exactly what the community toolbar can produce; anything
// else is stripped rather than escaped, so pasted markup degrades to its text.

const ALLOWED_PROTOCOL = /^(https?:|mailto:)/i

const filter = new FilterXSS({
  whiteList: {
    p: [],
    br: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    strike: [],
    code: [],
    pre: [],
    h1: [],
    h2: [],
    h3: [],
    ul: [],
    ol: [],
    li: [],
    blockquote: [],
    hr: [],
    a: ['href', 'target', 'rel']
  },
  // Drop unknown tags entirely, and discard the contents of dangerous ones so a
  // stripped <script> does not leave its source code behind as visible text.
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],

  // Rebuild every anchor from scratch. `onTagAttr` only fires for attributes the
  // author actually wrote, so it cannot add `rel` to a bare `<a href>` — and
  // outbound links in user content need `noopener` and `nofollow` unconditionally.
  onTag(tag: string, html: string, options: { isClosing?: boolean }) {
    if (tag !== 'a' || options.isClosing) return undefined

    const match = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html)
    const href = (match?.[2] ?? match?.[3] ?? match?.[4] ?? '').trim()

    // Blocks javascript:, data:, vbscript: and friends — the link becomes inert
    // rather than disappearing, so its text still reads.
    if (!href || !ALLOWED_PROTOCOL.test(href)) return '<a>'
    return `<a href="${escapeAttrValue(href)}" target="_blank" rel="noopener noreferrer nofollow">`
  }
})

export function sanitizeRichText(html: string): string {
  return filter.process(html)
}
