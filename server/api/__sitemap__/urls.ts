import { desc, eq } from 'drizzle-orm'
import { tests } from '../../database/schema'

// Every published test's page, for the sitemap: search engines find each test by its title.
export default defineSitemapEventHandler(async () => {
  const rows = await useDb()
    .select({ slug: tests.slug, updatedAt: tests.updatedAt, publishedAt: tests.publishedAt })
    .from(tests)
    .where(eq(tests.status, 'PUBLISHED'))
    .orderBy(desc(tests.publishedAt))
  return rows.map(t => ({
    loc: `/tests/${t.slug}`,
    lastmod: t.updatedAt ?? t.publishedAt ?? undefined,
    changefreq: 'monthly' as const,
    priority: 0.8 as const
  }))
})
