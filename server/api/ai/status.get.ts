// Whether AI feedback is on here (Speaking also needs speech recognition, Listening transcription needs AssemblyAI), and how many checks this user has left today.
export default defineEventHandler(async (event) => {
  const user = await optionalUser(event)
  return { enabled: aiEnabled(), speaking: speakingAiEnabled(), transcribe: transcribeEnabled(), allowances: user && aiEnabled() ? await aiAllowances(user) : null, rules: aiRules() }
})
