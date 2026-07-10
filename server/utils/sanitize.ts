import { FilterXSS, escapeAttrValue } from 'xss'

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

  onTagAttr(tag, name, value) {
    if (tag !== 'a') return undefined
    if (name === 'href') {
      // Blocks javascript:, data:, vbscript: and friends.
      return ALLOWED_PROTOCOL.test(value.trim()) ? `href="${escapeAttrValue(value.trim())}"` : ''
    }
    // Outbound links from user content must never hand over window.opener.
    if (name === 'target') return 'target="_blank"'
    if (name === 'rel') return 'rel="noopener noreferrer nofollow"'
    return undefined
  }
})

export function sanitizeRichText(html: string): string {
  return filter.process(html)
}
