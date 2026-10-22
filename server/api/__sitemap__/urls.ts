import { desc, eq } from 'drizzle-orm'
import { packs, tests } from '../../database/schema'

// Every published test's page and every pack on sale, for the sitemap: search engines find each by its title.
export default defineSitemapEventHandler(async () => {
  const db = useDb()
  const [rows, packRows] = await Promise.all([
    db.select({ slug: tests.slug, updatedAt: tests.updatedAt, publishedAt: tests.publishedAt })
      .from(tests)
      .where(eq(tests.status, 'PUBLISHED'))
      .orderBy(desc(tests.publishedAt)),
    db.select({ slug: packs.slug, updatedAt: packs.updatedAt }).from(packs).where(eq(packs.active, true))
  ])
  return [
    ...rows.map(t => ({
      loc: `/tests/${t.slug}`,
      lastmod: t.updatedAt ?? t.publishedAt ?? undefined,
      changefreq: 'monthly' as const,
      priority: 0.8 as const
    })),
    ...packRows.map(p => ({ loc: `/packs/${p.slug}`, lastmod: p.updatedAt, changefreq: 'weekly' as const, priority: 0.8 as const }))
  ]
})
