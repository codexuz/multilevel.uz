// Whether AI feedback is on here (Speaking also needs speech recognition), and how much this user has left.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  return { enabled: aiEnabled(), speaking: speakingAiEnabled(), allowance: user && aiEnabled() ? await aiAllowance(user) : null, rules: aiRules() }
})
