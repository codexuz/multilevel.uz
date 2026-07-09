import { getCourseTree } from '../../../database/repos/courses'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const tree = await getCourseTree(db, id, 'admin')
  if (!tree) throw createError({ statusCode: 404, message: 'Course not found' })
  return tree
})
