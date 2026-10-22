/**
 * Compact "time ago" label for feeds — short enough not to crowd the meta row on
 * a phone (e.g. "5m", "3h", "2d", then a plain date). Pair it with the absolute
 * timestamp from `fullTime()` in a `title`/`datetime` attribute for the full value.
 */
export function timeAgo(date: string | Date): string {
  const then = new Date(date).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.round((Date.now() - then) / 1000)

  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.round(days / 7)
  if (days < 30) return `${weeks}w`

  // Older than a month: drop to an absolute date, and include the year only when
  // it isn't the current one.
  const d = new Date(then)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return localeDate(d, intlLocale(), { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** Full, locale-formatted timestamp for tooltips and `<time>` labels. */
export function fullTime(date: string | Date): string {
  return localeDate(date, intlLocale())
}
