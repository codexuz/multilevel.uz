/**
 * Dates in the interface language, written the same on the server and in the browser. Intl cannot
 * be trusted for that: many browsers ship without Uzbek date names ("M10" for October), Node and
 * Chrome word English and Russian dates differently ("Thu 22 Oct" against "Thu, 22 Oct", "Sept"
 * against "Sep"), and the server's time zone is not the reader's. So English, Uzbek and Russian are
 * written out here, in the shape Node's Intl gives them ("Thursday 22 October at 14:05",
 * "payshanba, 22-oktabr, 14:05", "22 окт. 2026 г."), in Tashkent time, as the site's schedule is.
 * A "2026-10-22" day is read as that calendar day. Other languages still go to Intl.
 */

/** The time zone the site's dates are shown in. */
export const SITE_TIME_ZONE = 'Asia/Tashkent'

type Lang = 'en' | 'uz' | 'ru'
const NAMES: Record<Lang, { months: string[], monthsOf: string[], monthsShort: string[], weekdays: string[], weekdaysShort: string[] }> = {
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsOf: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  },
  uz: {
    months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
    monthsOf: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    monthsShort: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
    weekdays: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
    weekdaysShort: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
  },
  ru: {
    months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    monthsOf: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    monthsShort: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
    weekdays: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    weekdaysShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
  }
}

const langOf = (locale: string): Lang | null => {
  const l = locale.slice(0, 2).toLowerCase()
  return l === 'en' || l === 'uz' || l === 'ru' ? l : null
}
const two = (n: number) => String(n).padStart(2, '0')

/** The calendar date and clock of a moment in a time zone, from numbers every Intl has. */
function partsOf(date: Date | string | number, timeZone: string) {
  const day = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null
  if (day) {
    const [y, m, d] = [Number(day[1]), Number(day[2]), Number(day[3])]
    return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), hh: 0, mm: 0, ss: 0 }
  }
  const at = new Date(date)
  if (Number.isNaN(at.getTime())) return null
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(at)) p[x.type] = x.value
  const [y, m, d] = [Number(p.year), Number(p.month), Number(p.day)]
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), hh: Number(p.hour) % 24, mm: Number(p.minute), ss: Number(p.second) }
}

/** Like `date.toLocaleString(locale, options)`, the same wherever it runs (see above). */
export function localeDate(date: Date | string | number, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const lang = langOf(locale)
  const o = options ?? {}
  if (!lang) return new Date(date).toLocaleString(locale, { timeZone: SITE_TIME_ZONE, ...o })
  const p = partsOf(date, o.timeZone ?? SITE_TIME_ZONE)
  if (!p) return '—'
  const n = NAMES[lang]
  const hasDate = !!(o.weekday || o.day || o.month || o.year)
  const hasTime = !!(o.hour || o.minute || o.second)

  // No fields asked for: date and time in numbers, as toLocaleString gives them.
  if (!hasDate && !hasTime) {
    const sep = lang === 'ru' ? '.' : '/'
    return `${two(p.d)}${sep}${two(p.m)}${sep}${p.y}, ${two(p.hh)}:${two(p.mm)}:${two(p.ss)}`
  }
  const time = o.second ? `${two(p.hh)}:${two(p.mm)}:${two(p.ss)}` : `${two(p.hh)}:${two(p.mm)}`
  const day = o.day === '2-digit' ? two(p.d) : String(p.d)
  const longMonth = o.month === 'long'

  let text: string
  if (o.day && o.month) {
    const month = longMonth ? n.monthsOf[p.m - 1]! : n.monthsShort[p.m - 1]!
    text = lang === 'uz' ? `${day}-${month}` : `${day} ${month}`
  } else if (o.month) {
    text = longMonth || lang === 'uz' ? n.months[p.m - 1]! : n.monthsShort[p.m - 1]!
  } else {
    text = o.day ? day : ''
  }
  if (o.year) text = lang === 'uz' ? (text ? `${text}, ${p.y}` : String(p.y)) : lang === 'ru' ? `${text} ${p.y} г.`.trim() : `${text} ${p.y}`.trim()
  if (o.weekday) {
    const wd = o.weekday === 'long' ? n.weekdays[p.wd]! : n.weekdaysShort[p.wd]!
    text = text ? (lang === 'en' ? `${wd} ${text}` : `${wd}, ${text}`) : wd
  }
  if (!hasTime) return text
  if (!text) return time
  // "Thursday 22 October at 14:05", "четверг, 22 октября в 14:05"; elsewhere a comma.
  if (o.weekday === 'long' && !o.year && lang !== 'uz') return `${text} ${lang === 'ru' ? 'в' : 'at'} ${time}`
  return `${text}, ${time}`
}
