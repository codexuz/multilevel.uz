// Every morning: exam countdown messages and nudges for users who set the day of their exam.
export default defineTask({
  meta: { name: 'reminders:plan', description: 'Telegram reminders for users with an exam date' },
  async run() {
    return { result: await sendPlanReminders() }
  }
})
