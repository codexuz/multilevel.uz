/** Helpers for the charts in components/viz. */

/** A y scale from 0 that ends on a round number, with four or five round ticks. */
export function niceScale(max: number) {
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find(s => s * mag >= raw) ?? 10) * mag
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(Math.round(t * 100) / 100)
  return { max: top, ticks }
}

/** 1200 → 1.2K, 3400000 → 3.4M. */
export const compact = (n: number) => new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)

const asDate = (d: string) => new Date(`${d}T00:00:00`)
export const shortDay = (d: string) => localeDate(asDate(d), intlLocale(), { day: 'numeric', month: 'short' })
export const longDay = (d: string) => localeDate(asDate(d), intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
