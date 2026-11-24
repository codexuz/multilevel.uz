// A class's online classes, for its teacher.
export default defineEventHandler(async (event) => {
  const { user, group } = await requireClassTeacher(event, String(getRouterParam(event, 'id')))
  return { lessons: await teacherLiveLessons(group.teacherId === user.id ? user.id : group.teacherId, { groupId: group.id }) }
})
