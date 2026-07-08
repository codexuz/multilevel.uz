import type { H3Event } from 'h3'

export interface Pagination {
  page: number
  pageSize: number
  offset: number
}

// Parse ?page & ?pageSize query params, clamped to sane bounds.
export function getPagination(event: H3Event, defaultSize = 20, maxSize = 100): Pagination {
  const q = getQuery(event)
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(maxSize, Math.max(1, Math.floor(Number(q.pageSize) || defaultSize)))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

// Standard paginated envelope returned by list endpoints.
export function paginate<T>(items: T[], total: number, p: Pagination) {
  return {
    items,
    total,
    page: p.page,
    pageSize: p.pageSize,
    totalPages: Math.max(1, Math.ceil(total / p.pageSize))
  }
}
