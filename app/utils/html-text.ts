/**
 * Visible text of an HTML string. Used on both sides of the wire: the composer
 * to decide whether the editor is really empty (TipTap emits `<p></p>`), and the
 * server to reject bodies that only look filled.
 *
 * This is a readability helper, not a security boundary — never rely on it to
 * neutralise markup. Sanitizing is `sanitizeRichText()`'s job.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .trim()
}
