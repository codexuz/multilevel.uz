/**
 * Dates in the interface language. Many browsers ship without Uzbek date names, and then
 * `toLocaleString('uz-Latn-UZ', …)` gives "M10" for October; Uzbek is written out here instead,
 * in the same shape Intl gives where it knows Uzbek ("payshanba, 22-oktabr, 14:05", "22-okt, 2026").
 * Other languages go to Intl as they are.
 */

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const UZ_WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Like `date.toLocaleString(locale, options)`, with Uzbek month and weekday names that do not depend on the browser. */
export function localeDate(date: Date | string | number, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(date)
  if (!locale.toLowerCase().startsWith('uz')) return d.toLocaleString(locale, options)

  const o = options ?? {}
  const hasDate = !!(o.weekday || o.day || o.month || o.year)
  const hasTime = !!(o.hour || o.minute || o.second)
  // No fields asked for: date and time in numbers, as toLocaleString gives them.
  const all = !hasDate && !hasTime

  // The numbers for this moment in the asked time zone, from a format every browser has.
  const parts: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: o.timeZone, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
  }).formatToParts(d)) parts[p.type] = p.value
  const two = (v?: string) => (v ?? '').padStart(2, '0')
  const month = Number(parts.month) - 1
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ''] ?? 0
  const time = all || o.second ? `${two(parts.hour)}:${two(parts.minute)}:${two(parts.second)}` : `${two(parts.hour)}:${two(parts.minute)}`

  if (all) return `${two(parts.day)}/${two(String(month + 1))}/${parts.year}, ${time}`

  const out: string[] = []
  if (o.weekday) out.push(o.weekday === 'long' ? UZ_WEEKDAYS[weekday]! : UZ_WEEKDAYS_SHORT[weekday]!)
  if (o.day || o.month) {
    const day = o.day === '2-digit' ? two(parts.day) : parts.day
    const name = o.month === 'long' ? UZ_MONTHS[month]! : UZ_MONTHS_SHORT[month]!
    // A month alone stands capitalised ("Oktabr"); with a day it is "22-oktabr".
    if (o.day && o.month) out.push(`${day}-${name}`)
    else if (o.month) out.push(name.charAt(0).toUpperCase() + name.slice(1))
    else out.push(day!)
  }
  if (o.year) out.push(parts.year!)
  if (hasTime) out.push(time)
  return out.join(', ')
}
