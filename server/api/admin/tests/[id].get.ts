import { getTestTree } from '../../../database/repos/tests'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const tree = await getTestTree(db, id)
  if (!tree) throw createError({ statusCode: 404, message: 'Test not found' })
  return tree
})
