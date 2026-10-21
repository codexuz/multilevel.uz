// Whether AI feedback is on here, and how much this user has left.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  return { enabled: aiEnabled(), allowance: user && aiEnabled() ? await aiAllowance(user) : null, rules: aiRules() }
})
