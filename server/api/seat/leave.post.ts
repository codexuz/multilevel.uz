// Done at this computer: the seat's sign-in ends, ready for the next candidate's code.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  if (!user) {
    clearAuthCookies(event)
    return { done: true }
  }
  return leaveSeat(event, user.id)
})
