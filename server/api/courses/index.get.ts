// The course catalogue: published public courses of every teacher (?exam=IELTS|MULTILEVEL).
export default defineEventHandler(async (event) => {
  return { courses: await publicCourses(String(getQuery(event).exam ?? '')) }
})
