import { getGradingDetail } from '../../../database/repos/tests'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const detail = await getGradingDetail(db, id)
  if (!detail) throw createError({ statusCode: 404, message: 'Attempt not found' })
  return detail
})
