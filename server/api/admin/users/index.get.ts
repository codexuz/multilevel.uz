import { desc, count } from 'drizzle-orm'
import { users } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const p = getPagination(event)

  const [totalRow] = await db.select({ total: count() }).from(users)
  const rows = await db.select().from(users)
    .orderBy(desc(users.createdAt))
    .limit(p.pageSize).offset(p.offset)

  return paginate(rows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    banned: u.banned,
    createdAt: u.createdAt
  })), totalRow?.total ?? 0, p)
})
