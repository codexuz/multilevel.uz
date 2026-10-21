import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import satori from 'satori'
import sharp from 'sharp'
import { attempts, tests, users } from '../database/schema'
import { referralCodeOf } from './rewards'
import { cefrLevel } from './score'

/**
 * A result as a picture to share: "Aziz scored 58/75, B2 in Multilevel Reading", with the
 * sharer's invite link on it, so every shared result can bring a friend. The link to it is signed,
 * so only results their owner chose to share can be opened.
 */

const secret = () => process.env.JWT_ACCESS_SECRET || (useRuntimeConfig().jwtAccessSecret as string) || 'multilevel-share'

const sign = (attemptId: string) => createHmac('sha256', secret()).update(`share:${attemptId}`).digest('hex').slice(0, 16)

/** `<attempt id>-<signature>`: what goes in a share link. */
export const shareToken = (attemptId: string) => `${attemptId}-${sign(attemptId)}`

/** The attempt a share token is for, or null if it was not signed here. */
export function attemptOfToken(token: string): string | null {
  const id = token.slice(0, 36)
  const sig = token.slice(37)
  if (!/^[0-9a-f-]{36}$/i.test(id) || sig.length !== 16) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(sign(id))
  return a.length === b.length && timingSafeEqual(a, b) ? id : null
}

export interface ShareData { name: string, score: number, cefrLevel: string, skill: string, partNumber: number | null, test: { slug: string, title: string } | null, code: string }

/** What a shared result shows, if it has a score to show. */
export async function shareData(attemptId: string): Promise<ShareData | null> {
  const db = useDb()
  const [row] = await db.select({ a: attempts, test: { slug: tests.slug, title: tests.title }, name: users.name, telegramUsername: users.telegramUsername })
    .from(attempts).innerJoin(users, eq(users.id, attempts.userId)).leftJoin(tests, eq(tests.id, attempts.testId))
    .where(eq(attempts.id, attemptId)).limit(1)
  if (!row || row.a.score == null || row.a.status !== 'GRADED') return null
  return {
    name: (row.name || '').trim().split(/\s+/)[0] || (row.telegramUsername ? `@${row.telegramUsername}` : 'I'),
    score: row.a.score,
    cefrLevel: row.a.cefrLevel ?? cefrLevel(row.a.score),
    skill: row.a.skill,
    partNumber: row.a.partNumber,
    test: row.test?.slug ? row.test : null,
    code: await referralCodeOf(row.a.userId)
  }
}

export const skillLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
export const levelLabel = (l: string) => (l === 'A2' || l === 'A1' ? 'Below B1' : `CEFR ${l}`)
export const siteHost = () => String(useRuntimeConfig().public.siteUrl || 'https://multilevel.uz').replace(/^https?:\/\//, '').replace(/\/$/, '')

// ---------- the picture ----------

type Node = { type: string, props: Record<string, any> }
const h = (type: string, style: Record<string, any>, ...children: (Node | string)[]): Node =>
  ({ type, props: { style, children: children.length === 1 ? children[0] : children } })

let fonts: { name: string, data: Buffer, weight: 400 | 700 | 900, style: 'normal' }[] | null = null
async function loadFonts() {
  if (fonts) return fonts
  const storage = useStorage('assets:server')
  const read = async (file: string) => Buffer.from(await storage.getItemRaw(`fonts:${file}`) as ArrayBuffer)
  fonts = [
    { name: 'Roboto', data: await read('roboto-400.woff'), weight: 400, style: 'normal' },
    { name: 'Roboto', data: await read('roboto-700.woff'), weight: 700, style: 'normal' },
    { name: 'Roboto', data: await read('roboto-900.woff'), weight: 900, style: 'normal' }
  ]
  return fonts
}

/** The card as a 1200×630 PNG (the size link previews use). */
export async function renderShareCard(d: ShareData): Promise<Buffer> {
  const what = `${skillLabel(d.skill)}${d.partNumber ? ` · Part ${d.partNumber}` : ''}${d.test ? ` · ${d.test.title}` : ''}`
  const tree = h('div', {
    width: 1200, height: 630, display: 'flex', color: 'white', fontFamily: 'Roboto',
    backgroundImage: 'linear-gradient(135deg, #4458e8 0%, #6d7ff5 55%, #9aa8ff 100%)'
  }, h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, margin: '52px 64px' },
  h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    h('div', { display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 900 },
      h('div', { display: 'flex', width: 44, height: 44, borderRadius: 10, background: '#2ecc8f', marginRight: 14 }),
      'Multilevel'),
    h('div', { display: 'flex', fontSize: 24, fontWeight: 700, padding: '8px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.18)' }, 'CEFR English mock test')),
  h('div', { display: 'flex', flexDirection: 'column' },
    h('div', { display: 'flex', fontSize: 40, fontWeight: 700, opacity: 0.9 }, `${d.name} scored`),
    h('div', { display: 'flex', alignItems: 'flex-end', marginTop: 4 },
      h('div', { display: 'flex', fontSize: 200, fontWeight: 900, lineHeight: 1 }, String(d.score)),
      h('div', { display: 'flex', fontSize: 64, fontWeight: 700, opacity: 0.85, marginLeft: 12, marginBottom: 22 }, '/ 75'),
      h('div', { display: 'flex', fontSize: 52, fontWeight: 900, color: '#3b4fd8', background: 'white', borderRadius: 18, padding: '10px 26px', marginLeft: 36, marginBottom: 26 }, levelLabel(d.cefrLevel))),
    h('div', { display: 'flex', fontSize: 34, fontWeight: 400, opacity: 0.92, marginTop: 6, maxWidth: 1070 }, what.length > 64 ? `${what.slice(0, 63)}…` : what)),
  h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 30 },
    h('div', { display: 'flex', fontWeight: 400 }, 'Practise free at ', h('span', { fontWeight: 700, marginLeft: 8 }, `${siteHost()}/r/${d.code}`)),
    h('div', { display: 'flex', fontWeight: 900 }, 'Can you beat it?'))))

  const svg = await satori(tree as any, { width: 1200, height: 630, fonts: await loadFonts() })
  return sharp(Buffer.from(svg)).png().toBuffer()
}
