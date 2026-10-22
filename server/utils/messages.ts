/**
 * What the bot says, in each interface language (English, Uzbek in Latin script, Russian). A user's
 * language is the one they chose on the site (users.locale); before that, the one their Telegram
 * app uses. Texts are Telegram HTML: only <b> is used, and anything a user typed is escaped.
 */

export type Locale = 'en' | 'uz' | 'ru'
export const asLocale = (l?: string | null): Locale => (l === 'uz' || l === 'ru' ? l : 'en')
/** Telegram's language_code (en, ru, uz, uz-UZ …) as one of ours, or null for anything else. */
export const fromTelegram = (code?: string | null): Locale | null => {
  const c = (code ?? '').slice(0, 2).toLowerCase()
  return c === 'uz' || c === 'ru' || c === 'en' ? c : null
}
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const INTL: Record<Locale, string> = { en: 'en-GB', uz: 'uz-Latn-UZ', ru: 'ru-RU' }
export const dayText = (l: Locale, d: Date, withTime = false) => localeDate(d, INTL[l], {
  weekday: 'long', day: 'numeric', month: 'long', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Tashkent'
})

/** Russian: 1 день, 2 дня, 5 дней. */
const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m = Math.abs(n) % 100
  if (m >= 11 && m <= 14) return many
  return m % 10 === 1 ? one : m % 10 >= 2 && m % 10 <= 4 ? few : many
}

const SKILL: Record<Locale, Record<string, string>> = {
  en: { LISTENING: 'Listening', READING: 'Reading', WRITING: 'Writing', SPEAKING: 'Speaking' },
  uz: { LISTENING: 'Tinglash', READING: 'O‘qish', WRITING: 'Yozish', SPEAKING: 'Gapirish' },
  ru: { LISTENING: 'Аудирование', READING: 'Чтение', WRITING: 'Письмо', SPEAKING: 'Говорение' }
}
export const skillName = (l: Locale, skill: string) => SKILL[l][skill] ?? skill

/** "Part 2", "Task 1.2" (Writing), "Part 1.1" (Speaking). */
export function partName(l: Locale, skill: string, n: number) {
  const label = skill === 'WRITING'
    ? ({ 1: '1.1', 2: '1.2', 3: '2' } as Record<number, string>)[n]
    : skill === 'SPEAKING' ? ({ 1: '1.1', 2: '1.2', 3: '2', 4: '3' } as Record<number, string>)[n] : String(n)
  const task = skill === 'WRITING'
  if (l === 'uz') return `${label ?? n}-${task ? 'topshiriq' : 'qism'}`
  if (l === 'ru') return `${task ? 'Задание' : 'Часть'} ${label ?? n}`
  return `${task ? 'Task' : 'Part'} ${label ?? n}`
}

const TYPES: Record<Locale, Record<string, string>> = {
  en: {
    TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given', YES_NO_NOT_GIVEN: 'Yes / No / Not Given', MULTIPLE_CHOICE: 'Multiple choice', MULTIPLE_ANSWER: 'Multiple answer',
    NOTE_COMPLETION: 'Note completion', SENTENCE_COMPLETION: 'Sentence completion', SUMMARY_COMPLETION: 'Summary completion', SUMMARY_COMPLETION_DRAG_DROP: 'Summary completion (word list)',
    SHORT_ANSWER: 'Short answer', TABLE_COMPLETION: 'Table completion', FLOW_CHART_COMPLETION: 'Flow chart completion', DIAGRAM_LABELLING: 'Diagram labelling',
    MATCHING_HEADINGS: 'Matching headings', MATCHING_INFORMATION: 'Matching information', MATCHING_FEATURES: 'Matching features', MATCHING_SENTENCE_ENDINGS: 'Matching sentence endings', PLAN_MAP_LABELLING: 'Plan / map labelling'
  },
  uz: {
    TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given', YES_NO_NOT_GIVEN: 'Yes / No / Not Given', MULTIPLE_CHOICE: 'Bir javobli test', MULTIPLE_ANSWER: 'Bir nechta javobli test',
    NOTE_COMPLETION: 'Qaydlarni to‘ldirish', SENTENCE_COMPLETION: 'Gapni to‘ldirish', SUMMARY_COMPLETION: 'Xulosani to‘ldirish', SUMMARY_COMPLETION_DRAG_DROP: 'Xulosani to‘ldirish (so‘zlar ro‘yxati)',
    SHORT_ANSWER: 'Qisqa javob', TABLE_COMPLETION: 'Jadvalni to‘ldirish', FLOW_CHART_COMPLETION: 'Sxemani to‘ldirish', DIAGRAM_LABELLING: 'Diagrammani belgilash',
    MATCHING_HEADINGS: 'Sarlavhalarni moslash', MATCHING_INFORMATION: 'Ma’lumotni moslash', MATCHING_FEATURES: 'Belgilarni moslash', MATCHING_SENTENCE_ENDINGS: 'Gap oxirlarini moslash', PLAN_MAP_LABELLING: 'Reja / xaritani belgilash'
  },
  ru: {
    TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given', YES_NO_NOT_GIVEN: 'Yes / No / Not Given', MULTIPLE_CHOICE: 'Выбор ответа', MULTIPLE_ANSWER: 'Несколько ответов',
    NOTE_COMPLETION: 'Заполнение заметок', SENTENCE_COMPLETION: 'Завершение предложений', SUMMARY_COMPLETION: 'Заполнение резюме', SUMMARY_COMPLETION_DRAG_DROP: 'Заполнение резюме (список слов)',
    SHORT_ANSWER: 'Краткий ответ', TABLE_COMPLETION: 'Заполнение таблицы', FLOW_CHART_COMPLETION: 'Заполнение схемы', DIAGRAM_LABELLING: 'Подписи к диаграмме',
    MATCHING_HEADINGS: 'Подбор заголовков', MATCHING_INFORMATION: 'Сопоставление информации', MATCHING_FEATURES: 'Сопоставление признаков', MATCHING_SENTENCE_ENDINGS: 'Окончания предложений', PLAN_MAP_LABELLING: 'Подписи к плану / карте'
  }
}
export const typeLabel = (l: Locale, t: string) => TYPES[l][t] ?? TYPES.en[t] ?? t
const CRITERIA: Record<Locale, Record<string, string>> = {
  en: { taskAchievement: 'Task achievement', organisation: 'Organisation', vocabulary: 'Vocabulary', grammar: 'Grammar', fluency: 'Fluency' },
  uz: { taskAchievement: 'Topshiriqni bajarish', organisation: 'Tuzilish', vocabulary: 'Lug‘at', grammar: 'Grammatika', fluency: 'Ravonlik' },
  ru: { taskAchievement: 'Выполнение задачи', organisation: 'Структура', vocabulary: 'Лексика', grammar: 'Грамматика', fluency: 'Беглость' }
}
export const criterionLabel = (l: Locale, k: string) => CRITERIA[l][k] ?? CRITERIA.en[k] ?? k

export const levelText = (l: Locale, cefr: string) => (cefr === 'A2' || cefr === 'A1' ? ({ en: 'below B1', uz: 'B1 dan past', ru: 'ниже B1' })[l] : cefr)

const days = (l: Locale, n: number) => (l === 'ru' ? `${n} ${ruPlural(n, 'день', 'дня', 'дней')}` : l === 'uz' ? `${n} kun` : `${n} ${n === 1 ? 'day' : 'days'}`)
const credits = (l: Locale, n: number) => (l === 'ru' ? `${n} ${ruPlural(n, 'кредит', 'кредита', 'кредитов')}` : l === 'uz' ? `${n} kredit` : `${n} ${n === 1 ? 'credit' : 'credits'}`)
const aiReviews = (l: Locale, n: number) => (l === 'ru' ? `${n} ${ruPlural(n, 'AI-разбор', 'AI-разбора', 'AI-разборов')}` : l === 'uz' ? `${n} ta AI tahlil` : `${n} AI ${n === 1 ? 'review' : 'reviews'}`)

export interface Offer { code: string, text: string }

export const MSG = {
  open: { en: 'Open Multilevel', uz: 'Multilevelni ochish', ru: 'Открыть Multilevel' },

  marked: (l: Locale, skill: string, score: number, cefr: string) => ({
    en: `✅ <b>Your ${skillName(l, skill)} is marked</b>\nScore: <b>${score}/75</b> (${levelText(l, cefr)}). The examiner's feedback is waiting for you.`,
    uz: `✅ <b>${skillName(l, skill)} bo‘limingiz baholandi</b>\nBall: <b>${score}/75</b> (${levelText(l, cefr)}). Imtihon oluvchining izohi sizni kutmoqda.`,
    ru: `✅ <b>${skillName(l, skill)}: работа проверена</b>\nБалл: <b>${score}/75</b> (${levelText(l, cefr)}). Комментарий экзаменатора уже ждёт вас.`
  })[l],
  markedButton: { en: 'See the feedback', uz: 'Izohni ko‘rish', ru: 'Смотреть отзыв' },

  aiReview: (l: Locale, skill: string, score: number, cefr: string) => ({
    en: `✨ <b>Your AI feedback is ready</b>\nEstimated ${skillName(l, skill)} score: <b>${score}/75</b> (${levelText(l, cefr)}), with corrections for each ${skill === 'SPEAKING' ? 'part' : 'task'}.`,
    uz: `✨ <b>AI tahlilingiz tayyor</b>\nTaxminiy ${skillName(l, skill)} bali: <b>${score}/75</b> (${levelText(l, cefr)}), har bir ${skill === 'SPEAKING' ? 'qism' : 'topshiriq'} bo‘yicha tuzatishlar bilan.`,
    ru: `✨ <b>AI-разбор готов</b>\nПримерный балл (${skillName(l, skill)}): <b>${score}/75</b> (${levelText(l, cefr)}), с исправлениями по каждой ${skill === 'SPEAKING' ? 'части' : 'задаче'}.`
  })[l],
  aiReviewButton: { en: 'Read it', uz: 'O‘qish', ru: 'Читать' },

  inviteReward: (l: Locale, n: number) => ({
    en: `🎁 <b>+${credits(l, n)}</b>\nA friend you invited finished their first test. Use credits to open Premium tests.`,
    uz: `🎁 <b>+${credits(l, n)}</b>\nSiz taklif qilgan do‘stingiz birinchi testini tugatdi. Kreditlar bilan Premium testlarni oching.`,
    ru: `🎁 <b>+${credits(l, n)}</b>\nПриглашённый вами друг прошёл первый тест. Открывайте Premium-тесты за кредиты.`
  })[l],
  inviteRewardButton: { en: 'See my credits', uz: 'Kreditlarim', ru: 'Мои кредиты' },

  offerLine: (l: Locale, o: Offer | null) => (o
    ? ({ en: `\nUse code <b>${o.code}</b> for ${o.text}.`, uz: `\n<b>${o.code}</b> kodi bilan: ${o.text}.`, ru: `\nКод <b>${o.code}</b>: ${o.text}.` })[l]
    : ''),
  premiumEnding: (l: Locale, endsAt: Date, offer: Offer | null) => ({
    en: `⏳ <b>Your Premium ends on ${dayText(l, endsAt)}</b>\nExtend it to keep every test and every explanation.`,
    uz: `⏳ <b>Premium obunangiz ${dayText(l, endsAt)} kuni tugaydi</b>\nBarcha testlar va izohlar qolishi uchun uni uzaytiring.`,
    ru: `⏳ <b>Premium заканчивается: ${dayText(l, endsAt)}</b>\nПродлите его, чтобы сохранить доступ ко всем тестам и объяснениям.`
  })[l] + MSG.offerLine(l, offer),
  premiumEndingButton: { en: 'Extend Premium', uz: 'Premiumni uzaytirish', ru: 'Продлить Premium' },
  premiumEnded: (l: Locale, offer: Offer | null) => ({
    en: 'Your Premium has ended. Your results are kept, and the free tests are still yours.',
    uz: 'Premium obunangiz tugadi. Natijalaringiz saqlanadi, bepul testlar esa doim siz uchun ochiq.',
    ru: 'Premium закончился. Ваши результаты сохранены, а бесплатные тесты по-прежнему доступны.'
  })[l] + MSG.offerLine(l, offer),
  premiumEndedButton: { en: 'Get Premium again', uz: 'Premiumni qayta olish', ru: 'Снова оформить Premium' },

  planToday: {
    en: '🍀 <b>Good luck in your exam today!</b>\nRead each task carefully, keep an eye on the time, and say a little more than you think you need to. You have prepared for this.',
    uz: '🍀 <b>Bugungi imtihoningizda omad!</b>\nHar bir topshiriqni diqqat bilan o‘qing, vaqtni kuzatib boring va kerak deb o‘ylaganingizdan biroz ko‘proq gapiring. Siz bunga tayyorlandingiz.',
    ru: '🍀 <b>Удачи на экзамене сегодня!</b>\nВнимательно читайте каждое задание, следите за временем и говорите чуть больше, чем кажется нужным. Вы к этому готовились.'
  },
  planMilestone: (l: Locale, n: number) => ({
    en: `📅 <b>${days(l, n)} to your exam</b>`,
    uz: `📅 <b>Imtihoningizgacha ${days(l, n)} qoldi</b>`,
    ru: `📅 <b>До экзамена ${ruPlural(n, 'остался', 'осталось', 'осталось')} ${days(l, n)}</b>`
  })[l],
  planNudge: (l: Locale, n: number) => ({
    en: `👋 <b>Time for a little practice?</b>\n${days(l, n)} to your exam, and a short session today keeps you on track.`,
    uz: `👋 <b>Biroz mashq qilamizmi?</b>\nImtihoningizgacha ${days(l, n)} qoldi, bugungi qisqa mashg‘ulot sizni yo‘lda ushlab turadi.`,
    ru: `👋 <b>Немного практики?</b>\nДо экзамена ${days(l, n)}, и короткое занятие сегодня поможет не сбиться с курса.`
  })[l],
  planWeek: (l: Locale, done: number, aim: number) => ({
    en: `\nThis week: ${done} of ${aim} practice days.`,
    uz: `\nShu hafta: ${aim} mashq kunidan ${done} tasi.`,
    ru: `\nНа этой неделе: ${done} из ${aim} дней практики.`
  })[l],
  planNext: (l: Locale, label: string) => ({ en: `\nNext: <b>${label}</b>`, uz: `\nKeyingisi: <b>${label}</b>`, ru: `\nДальше: <b>${label}</b>` })[l],
  planStart: { en: 'Start now', uz: 'Hozir boshlash', ru: 'Начать' },
  planSee: { en: 'See my plan', uz: 'Rejamni ko‘rish', ru: 'Мой план' },
  /** A goal of the weekly plan, as the bot names it. */
  goalSection: (l: Locale, skill: string) => ({ en: `A whole ${skillName(l, skill)} section`, uz: `To‘liq ${skillName(l, skill)} bo‘limi`, ru: `Целый раздел: ${skillName(l, skill)}` })[l],
  goalPractise: (l: Locale, skill: string, what: string) => ({ en: `Practise ${skillName(l, skill)}: ${what}`, uz: `${skillName(l, skill)} mashqi: ${what}`, ru: `Практика (${skillName(l, skill)}): ${what}` })[l],

  liveOpen: (l: Locale, title: string, endsAt: Date) => ({
    en: `🏆 <b>${escapeHtml(title)} is live</b>\nSit it by ${dayText(l, endsAt, true)}: Listening and Reading are ranked on one leaderboard. Your first try of each counts.`,
    uz: `🏆 <b>${escapeHtml(title)} boshlandi</b>\n${dayText(l, endsAt, true)} gacha topshiring: Tinglash va O‘qish bitta reytingda baholanadi. Har biridan birinchi urinishingiz hisoblanadi.`,
    ru: `🏆 <b>${escapeHtml(title)} уже идёт</b>\nПройдите до ${dayText(l, endsAt, true)}: Аудирование и Чтение идут в общий рейтинг. Засчитывается первая попытка в каждом разделе.`
  })[l],
  liveOpenButton: { en: 'Take part', uz: 'Qatnashish', ru: 'Участвовать' },
  liveOver: (l: Locale, title: string, rank: number, of: number, total: number) => ({
    en: `🏁 <b>${escapeHtml(title)} is over</b>\nYou placed <b>${rank}${rank % 100 >= 11 && rank % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[rank % 10] ?? 'th'}</b> of ${of}, with ${total} points. Thanks for taking part!`,
    uz: `🏁 <b>${escapeHtml(title)} yakunlandi</b>\n${of} kishi orasida <b>${rank}-o‘rin</b>, ${total} ball. Qatnashganingiz uchun rahmat!`,
    ru: `🏁 <b>${escapeHtml(title)} завершён</b>\nВы заняли <b>${rank}-е место</b> из ${of}, набрав ${total} ${ruPlural(total, 'балл', 'балла', 'баллов')}. Спасибо за участие!`
  })[l],
  liveOverButton: { en: 'See the leaderboard', uz: 'Reytingni ko‘rish', ru: 'Смотреть рейтинг' },

  newWork: (l: Locale, group: string, what: string, due: Date | null, note: string | null) => ({
    en: `📚 <b>New work from ${escapeHtml(group)}</b>\n${what}.${due ? `\nDue ${dayText(l, due, true)}.` : ''}`,
    uz: `📚 <b>${escapeHtml(group)} guruhidan yangi vazifa</b>\n${what}.${due ? `\nMuddat: ${dayText(l, due, true)}.` : ''}`,
    ru: `📚 <b>Новое задание от группы ${escapeHtml(group)}</b>\n${what}.${due ? `\nСрок: ${dayText(l, due, true)}.` : ''}`
  })[l] + (note ? `\n\n${escapeHtml(note)}` : ''),
  /** "Reading Part 2 of <test>" */
  workWhat: (l: Locale, skill: string, part: number | null, test: string) => {
    const s = `${skillName(l, skill)}${part ? ` (${partName(l, skill, part)})` : ''}`
    return ({ en: `${s} of ${escapeHtml(test)}`, uz: `${escapeHtml(test)}: ${s}`, ru: `${escapeHtml(test)}: ${s}` })[l]
  },
  start: { en: 'Start', uz: 'Boshlash', ru: 'Начать' },

  gift: (l: Locale, credit: number, ai: number) => {
    const parts = [credit > 0 ? credits(l, credit) : null, ai > 0 ? aiReviews(l, ai) : null].filter(Boolean).join(({ en: ' and ', uz: ' va ', ru: ' и ' })[l])
    return ({ en: `🎁 <b>A gift from Multilevel</b>\nYou received ${parts}.`, uz: `🎁 <b>Multilevel’dan sovg‘a</b>\nSizga ${parts} berildi.`, ru: `🎁 <b>Подарок от Multilevel</b>\nВы получили: ${parts}.` })[l]
  },

  botConnectedFromSite: {
    en: '✅ <b>You are connected</b>\nThis is where you will hear the moment your Writing or Speaking is marked, when your AI feedback is ready, and when an invite earns you credits.',
    uz: '✅ <b>Ulandingiz</b>\nYozish yoki Gapirish bo‘limingiz baholanganda, AI tahlil tayyor bo‘lganda va taklif sizga kredit keltirganda shu yerda xabar olasiz.',
    ru: '✅ <b>Вы подключены</b>\nЗдесь вы узнаете, когда проверят ваше Письмо или Говорение, когда будет готов AI-разбор и когда приглашение принесёт вам кредиты.'
  },
  botConnected: {
    en: '✅ <b>You are connected</b>\nYou will hear here when your work is marked, your AI feedback is ready, or an invite earns you credits.',
    uz: '✅ <b>Ulandingiz</b>\nIshingiz baholanganda, AI tahlil tayyor bo‘lganda yoki taklif kredit keltirganda shu yerda xabar olasiz.',
    ru: '✅ <b>Вы подключены</b>\nЗдесь вы узнаете, когда работа проверена, готов AI-разбор или приглашение принесло кредиты.'
  },
  botWelcome: {
    en: '👋 <b>Welcome to Multilevel</b>\nFree CEFR Multilevel mock tests, checked instantly. Sign in with Telegram on the site and your results will come here.',
    uz: '👋 <b>Multilevelga xush kelibsiz</b>\nBepul CEFR Multilevel mock testlari, darhol tekshiriladi. Saytga Telegram orqali kiring, natijalaringiz shu yerga keladi.',
    ru: '👋 <b>Добро пожаловать в Multilevel</b>\nБесплатные пробные тесты CEFR Multilevel с мгновенной проверкой. Войдите на сайт через Telegram, и результаты будут приходить сюда.'
  },
  botSignIn: { en: 'Sign in with Telegram', uz: 'Telegram orqali kirish', ru: 'Войти через Telegram' },
  botMergeOffer: {
    en: 'This Telegram already has its own Multilevel account. Combine it with the account you came from, so everything is in one place?',
    uz: 'Bu Telegramning o‘z Multilevel hisobi bor. Hammasi bir joyda bo‘lishi uchun uni siz kelgan hisob bilan birlashtiramizmi?',
    ru: 'У этого Telegram уже есть свой аккаунт Multilevel. Объединить его с аккаунтом, из которого вы пришли, чтобы всё было в одном месте?'
  },
  botMergeButton: { en: 'Combine my accounts', uz: 'Hisoblarni birlashtirish', ru: 'Объединить аккаунты' },
  botOther: {
    en: 'I send you news about your tests: marking, AI feedback and credits. Everything else is on the site.',
    uz: 'Men sizga testlaringiz haqida xabar beraman: baholash, AI tahlil va kreditlar. Qolgan hammasi saytda.',
    ru: 'Я присылаю новости о ваших тестах: проверка, AI-разборы и кредиты. Всё остальное — на сайте.'
  },

  shareText: (l: Locale, skill: string, score: number, cefr: string) => ({
    en: `I scored ${score}/75 (${levelText(l, cefr)}) in Multilevel ${skillName(l, skill)}. Can you beat it? Practise free:`,
    uz: `Multilevel ${skillName(l, skill)} bo‘limida ${score}/75 (${levelText(l, cefr)}) ball oldim. Undan yuqori ola olasizmi? Bepul mashq qiling:`,
    ru: `Я набрал(а) ${score}/75 (${levelText(l, cefr)}) в Multilevel, раздел «${skillName(l, skill)}». Сможете лучше? Тренируйтесь бесплатно:`
  })[l]
}
